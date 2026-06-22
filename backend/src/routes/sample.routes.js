import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient.js';
import { asyncH, AppError } from '../middleware/error.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

const SAMPLE_LABELS = { NEW: 'Новая', APPROVED: 'Одобрена', SHIPPED: 'Отправлена', REJECTED: 'Отклонена' };

function serialize(s) {
  return {
    id: s.id, weightKg: s.weightKg, region: s.region, city: s.city, comment: s.comment,
    status: s.status, statusLabel: SAMPLE_LABELS[s.status], createdAt: s.createdAt,
    product: s.product ? { id: s.product.id, name: s.product.name } : null,
    company: s.company ? { id: s.company.id, name: s.company.name } : null,
    user: s.user ? { id: s.user.id, firstName: s.user.firstName, lastName: s.user.lastName } : null,
  };
}

// Заявка на бесплатные образцы (5 / 10 / 20 / 30 кг) — с карточки товара.
// Регион/город необязательны: по умолчанию доставка по реквизитам компании.
const createSchema = z.object({
  productId: z.number().int(),
  weightKg: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(30)]),
  region: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  comment: z.string().optional().or(z.literal('')),
});

router.post('/', authenticate, asyncH(async (req, res) => {
  const data = createSchema.parse(req.body);
  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product) throw new AppError(404, 'Товар не найден');

  // Если регион не указан — берём из реквизитов компании
  const region = (data.region || '').trim() || req.user.company?.legalAddress || 'По реквизитам компании';

  const sample = await prisma.sampleRequest.create({
    data: {
      productId: data.productId,
      userId: req.user.id,
      companyId: req.user.companyId || null,
      weightKg: data.weightKg,
      region,
      city: (data.city || '').trim() || null,
      comment: data.comment || null,
    },
    include: { product: true, company: true, user: true },
  });
  res.status(201).json(serialize(sample));
}));

// Список заявок на образцы (клиент — свои, менеджер — все)
router.get('/', authenticate, asyncH(async (req, res) => {
  const where = req.user.role === 'MANAGER' ? {} : { userId: req.user.id };
  const samples = await prisma.sampleRequest.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: { product: true, company: true, user: true },
  });
  res.json(samples.map(serialize));
}));

// Одна заявка на образец (клиент — только свою, менеджер — любую)
router.get('/:id', authenticate, asyncH(async (req, res) => {
  const sample = await prisma.sampleRequest.findUnique({
    where: { id: Number(req.params.id) },
    include: { product: true, company: true, user: true },
  });
  if (!sample) throw new AppError(404, 'Заявка не найдена');
  if (req.user.role !== 'MANAGER' && sample.userId !== req.user.id) throw new AppError(403, 'Нет доступа');
  res.json(serialize(sample));
}));

// Обновление статуса заявки (менеджер)
router.patch('/:id/status', authenticate, requireRole('MANAGER'), asyncH(async (req, res) => {
  const { status } = z.object({ status: z.enum(['NEW', 'APPROVED', 'SHIPPED', 'REJECTED']) }).parse(req.body);
  const sample = await prisma.sampleRequest.update({
    where: { id: Number(req.params.id) }, data: { status },
    include: { product: true, company: true, user: true },
  });
  res.json(serialize(sample));
}));

export default router;
