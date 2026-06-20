import { Router } from 'express';
import { z } from 'zod';
import { resolve, basename } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
import { prisma } from '../prismaClient.js';
import { asyncH, AppError } from '../middleware/error.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadOrderDoc } from '../middleware/upload.js';
import { computeOrderTotals } from '../services/pricing.js';
import { generateOrderNumber } from '../services/orderNumber.js';
import { generateOfferPdf } from '../services/pdf.js';
import { recalcCompanyDiscount } from '../services/loyalty.js';
import { config } from '../config/env.js';

const router = Router();

const ORDER_INCLUDE = {
  company: true,
  createdBy: true,
  items: { include: { product: { select: { id: true, name: true, slug: true, unit: true, colorHex: true } } } },
  documents: { include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, role: true } } }, orderBy: { createdAt: 'desc' } },
  history: { orderBy: { createdAt: 'asc' } },
};

const STATUS_LABELS = {
  NEW: 'Новая заявка',
  INVOICE_ISSUED: 'Счёт выставлен (ожидает оплаты)',
  PAID: 'Оплачен',
  SHIPPED: 'Отгружен',
  DELIVERED: 'Доставлен',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};

function serializeOrder(o) {
  let remainingHours = null;
  if (['NEW', 'INVOICE_ISSUED'].includes(o.status) && o.autoCancelAt) {
    remainingHours = Math.max(0, (new Date(o.autoCancelAt).getTime() - Date.now()) / 36e5);
  }
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    statusLabel: STATUS_LABELS[o.status],
    deliveryRegion: o.deliveryRegion,
    deliveryCity: o.deliveryCity,
    comment: o.comment,
    totalWeightKg: Number(o.totalWeightKg),
    subtotal: Number(o.subtotal),
    discountPercent: Number(o.discountPercent),
    discountAmount: Number(o.discountAmount),
    vatRate: o.vatRate,
    vatAmount: Number(o.vatAmount),
    total: Number(o.total),
    invoiceIssuedAt: o.invoiceIssuedAt,
    autoCancelAt: o.autoCancelAt,
    remainingHours: remainingHours != null ? Number(remainingHours.toFixed(1)) : null,
    paidAt: o.paidAt,
    cancelledAt: o.cancelledAt,
    cancelReason: o.cancelReason,
    createdAt: o.createdAt,
    company: o.company ? { id: o.company.id, name: o.company.name, inn: o.company.inn } : null,
    createdBy: o.createdBy ? { id: o.createdBy.id, firstName: o.createdBy.firstName, lastName: o.createdBy.lastName, middleName: o.createdBy.middleName } : null,
    items: (o.items || []).map((it) => ({
      id: it.id, productId: it.productId, name: it.product?.name, unit: it.product?.unit, colorHex: it.product?.colorHex,
      weightKg: Number(it.weightKg), pricePerTon: Number(it.pricePerTon), lineTotal: Number(it.lineTotal),
    })),
    documents: (o.documents || []).map((d) => ({
      id: d.id, type: d.type, fileName: d.fileName, sizeBytes: d.sizeBytes, createdAt: d.createdAt,
      uploadedBy: d.uploadedBy ? `${d.uploadedBy.lastName} ${d.uploadedBy.firstName}` : null,
      downloadUrl: `/api/orders/${o.id}/documents/${d.id}/download`,
    })),
    history: (o.history || []).map((h) => ({ status: h.status, statusLabel: STATUS_LABELS[h.status], comment: h.comment, createdAt: h.createdAt })),
  };
}

function ensureAccess(user, order) {
  if (user.role === 'MANAGER') return;
  if (order.companyId !== user.companyId) throw new AppError(403, 'Нет доступа к этому заказу');
}

// ── Создание заказа (формирование заявки) ──
const createSchema = z.object({
  deliveryRegion: z.string().min(2, 'Укажите регион доставки'),
  deliveryCity: z.string().optional().or(z.literal('')),
  comment: z.string().optional().or(z.literal('')),
  items: z.array(z.object({
    productId: z.number().int(),
    weightKg: z.number().positive('Объём должен быть больше 0'),
  })).min(1, 'Добавьте хотя бы одну позицию'),
});

router.post('/', authenticate, asyncH(async (req, res) => {
  const data = createSchema.parse(req.body);
  if (!req.user.companyId) throw new AppError(400, 'Профиль не привязан к компании');

  // Текущие цены позиций
  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { prices: { where: { isCurrent: true }, take: 1 } },
  });
  const priceMap = new Map(products.map((p) => [p.id, p.prices[0] ? Number(p.prices[0].pricePerTon) : null]));
  for (const it of data.items) {
    if (!priceMap.has(it.productId)) throw new AppError(400, `Товар ${it.productId} не найден`);
    if (priceMap.get(it.productId) == null) throw new AppError(400, `Для товара ${it.productId} не задана цена`);
  }

  // Скидка по лояльности компании
  const company = await prisma.company.findUnique({ where: { id: req.user.companyId } });
  const discountPercent = Number(company.discountPercent) || 0;

  const itemsForCalc = data.items.map((it) => ({ productId: it.productId, weightKg: it.weightKg, pricePerTon: priceMap.get(it.productId) }));
  const totals = computeOrderTotals(itemsForCalc, discountPercent, 22);

  const number = await generateOrderNumber();
  const autoCancelAt = new Date(Date.now() + config.autoCancelHours * 36e5);

  const order = await prisma.order.create({
    data: {
      number,
      status: 'NEW',
      companyId: req.user.companyId,
      createdById: req.user.id,
      deliveryRegion: data.deliveryRegion,
      deliveryCity: data.deliveryCity || null,
      comment: data.comment || null,
      totalWeightKg: totals.totalWeightKg,
      subtotal: totals.subtotal,
      discountPercent: totals.discountPercent,
      discountAmount: totals.discountAmount,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      total: totals.total,
      autoCancelAt,
      items: { create: totals.lines.map((l) => ({ productId: l.productId, weightKg: l.weightKg, pricePerTon: l.pricePerTon, lineTotal: l.lineTotal })) },
      history: { create: [{ status: 'NEW', comment: 'Заявка сформирована', changedById: req.user.id }] },
    },
    include: ORDER_INCLUDE,
  });

  res.status(201).json(serializeOrder(order));
}));

// ── Список заказов (клиент — свои; менеджер — все) ──
router.get('/', authenticate, asyncH(async (req, res) => {
  const where = {};
  if (req.user.role !== 'MANAGER') where.companyId = req.user.companyId;
  if (req.query.status) where.status = String(req.query.status);

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { company: true, createdBy: true, items: { include: { product: { select: { name: true, unit: true } } } }, _count: { select: { documents: true } } },
  });
  res.json(orders.map(serializeOrder));
}));

// ── Карточка заказа / отслеживание ──
router.get('/:id', authenticate, asyncH(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include: ORDER_INCLUDE });
  if (!order) throw new AppError(404, 'Заказ не найден');
  ensureAccess(req.user, order);
  res.json(serializeOrder(order));
}));

// ── Формирование КП/счёта (PDF) → старт окна 72ч ──
router.post('/:id/issue-invoice', authenticate, asyncH(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include: ORDER_INCLUDE });
  if (!order) throw new AppError(404, 'Заказ не найден');
  ensureAccess(req.user, order);
  if (['CANCELLED', 'COMPLETED'].includes(order.status)) throw new AppError(400, 'Заказ закрыт');

  const filePath = await generateOfferPdf(order);

  const autoCancelAt = new Date(Date.now() + config.autoCancelHours * 36e5);
  const updated = await prisma.$transaction(async (tx) => {
    // заменить прежний файл КП, если был
    await tx.orderDocument.deleteMany({ where: { orderId: order.id, type: 'COMMERCIAL_OFFER' } });
    await tx.orderDocument.create({
      data: { orderId: order.id, type: 'COMMERCIAL_OFFER', fileName: basename(filePath), filePath, mimeType: 'application/pdf', uploadedById: req.user.id },
    });
    const data = { };
    if (order.status === 'NEW') {
      data.status = 'INVOICE_ISSUED';
      data.invoiceIssuedAt = new Date();
      data.autoCancelAt = autoCancelAt;
    }
    const o = await tx.order.update({ where: { id: order.id }, data, include: ORDER_INCLUDE });
    if (data.status) await tx.orderStatusHistory.create({ data: { orderId: order.id, status: 'INVOICE_ISSUED', comment: 'Сформирован КП/счёт', changedById: req.user.id } });
    return o;
  });

  res.json(serializeOrder(updated));
}));

// ── Подтверждение оплаты (менеджер) ──
router.post('/:id/confirm-payment', authenticate, requireRole('MANAGER'), asyncH(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include: { documents: true } });
  if (!order) throw new AppError(404, 'Заказ не найден');
  if (order.status === 'CANCELLED') throw new AppError(400, 'Заказ отменён');

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: 'PAID', paidAt: new Date(), autoCancelAt: null, history: { create: { status: 'PAID', comment: 'Оплата подтверждена менеджером', changedById: req.user.id } } },
    include: ORDER_INCLUDE,
  });

  // Пересчёт скидки компании (объём вырос)
  await recalcCompanyDiscount(order.companyId);
  res.json(serializeOrder(updated));
}));

// ── Смена статуса менеджером (SHIPPED → DELIVERED → COMPLETED) ──
const TRANSITIONS = {
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
};
router.patch('/:id/status', authenticate, requireRole('MANAGER'), asyncH(async (req, res) => {
  const { status, comment } = z.object({ status: z.enum(['SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED']), comment: z.string().optional() }).parse(req.body);
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
  if (!order) throw new AppError(404, 'Заказ не найден');
  const allowed = TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) throw new AppError(400, `Недопустимый переход: ${order.status} → ${status}`);

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status,
      ...(status === 'CANCELLED' ? { cancelledAt: new Date(), cancelReason: comment || 'Отменён менеджером' } : {}),
      history: { create: { status, comment: comment || null, changedById: req.user.id } },
    },
    include: ORDER_INCLUDE,
  });
  if (status === 'COMPLETED') await recalcCompanyDiscount(order.companyId);
  res.json(serializeOrder(updated));
}));

// ── Отмена заказа (клиент своей заявки или менеджер) ──
router.post('/:id/cancel', authenticate, asyncH(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
  if (!order) throw new AppError(404, 'Заказ не найден');
  ensureAccess(req.user, order);
  if (['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.status)) {
    throw new AppError(400, 'Заказ нельзя отменить на текущем этапе');
  }
  const reason = (req.body?.reason || '').trim() || 'Отменён пользователем';
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason, autoCancelAt: null, history: { create: { status: 'CANCELLED', comment: reason, changedById: req.user.id } } },
    include: ORDER_INCLUDE,
  });
  res.json(serializeOrder(updated));
}));

// ── Удаление заказа (клиент своей заявки или менеджер) ──
// Удалить можно только необработанный заказ (до оплаты): NEW / INVOICE_ISSUED.
router.delete('/:id', authenticate, asyncH(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include: { documents: true } });
  if (!order) throw new AppError(404, 'Заказ не найден');
  ensureAccess(req.user, order);
  if (!['NEW', 'INVOICE_ISSUED'].includes(order.status)) {
    throw new AppError(400, 'Удалить можно только заказ до оплаты. Оплаченные/отгруженные заказы не удаляются.');
  }
  // удалить файлы документов с диска (КП, платёжки и т.п.)
  for (const d of order.documents) {
    try { if (d.filePath && existsSync(resolve(d.filePath))) unlinkSync(resolve(d.filePath)); } catch {}
  }
  // позиции, документы, история удаляются каскадно (onDelete: Cascade)
  await prisma.order.delete({ where: { id: order.id } });
  res.json({ message: 'Заказ удалён', id: order.id });
}));

// ── Загрузка документа к заказу (с разграничением по ролям) ──
// TRANSPORT_INVOICE (счёт от ТК за доставку) — только МЕНЕДЖЕР
// PAYMENT_GOODS / PAYMENT_DELIVERY (платёжки) — только КЛИЕНТ
const DOC_RULES = {
  TRANSPORT_INVOICE: 'MANAGER',
  PAYMENT_GOODS: 'CLIENT',
  PAYMENT_DELIVERY: 'CLIENT',
};
router.post('/:id/documents', authenticate, uploadOrderDoc.single('file'), asyncH(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
  if (!order) throw new AppError(404, 'Заказ не найден');
  ensureAccess(req.user, order);

  const type = String(req.body.type || '');
  if (!DOC_RULES[type]) throw new AppError(400, 'Недопустимый тип документа');
  if (DOC_RULES[type] !== req.user.role) {
    const who = DOC_RULES[type] === 'MANAGER' ? 'менеджеру' : 'клиенту';
    throw new AppError(403, `Этот документ может загружать только ${who === 'менеджеру' ? 'менеджер' : 'клиент'}`);
  }
  if (!req.file) throw new AppError(400, 'Файл не передан');
  if (['CANCELLED', 'COMPLETED'].includes(order.status)) throw new AppError(400, 'Заказ закрыт для загрузки документов');

  // multer декодирует имя файла как latin1 — возвращаем кириллицу в UTF-8
  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const doc = await prisma.orderDocument.create({
    data: {
      orderId: order.id,
      type,
      fileName: originalName,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedById: req.user.id,
    },
  });
  res.status(201).json({ id: doc.id, type: doc.type, fileName: doc.fileName, sizeBytes: doc.sizeBytes, downloadUrl: `/api/orders/${order.id}/documents/${doc.id}/download` });
}));

// ── Скачивание документа заказа ──
router.get('/:id/documents/:docId/download', authenticate, asyncH(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
  if (!order) throw new AppError(404, 'Заказ не найден');
  ensureAccess(req.user, order);
  const doc = await prisma.orderDocument.findUnique({ where: { id: Number(req.params.docId) } });
  if (!doc || doc.orderId !== order.id) throw new AppError(404, 'Документ не найден');
  res.download(resolve(doc.filePath), doc.fileName);
}));

export default router;
