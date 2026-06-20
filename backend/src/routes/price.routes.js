import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient.js';
import { asyncH, AppError } from '../middleware/error.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Текущий прайс-лист (все актуальные цены)
router.get('/current', asyncH(async (_req, res) => {
  const prices = await prisma.price.findMany({
    where: { isCurrent: true },
    include: { product: { select: { id: true, name: true, externalCode: true, unit: true } } },
    orderBy: { product: { name: 'asc' } },
  });
  res.json(prices.map((p) => ({
    productId: p.productId,
    name: p.product.name,
    externalCode: p.product.externalCode,
    unit: p.product.unit,
    pricePerTon: Number(p.pricePerTon),
    vatRate: p.vatRate,
    currency: p.currency,
    effectiveFrom: p.effectiveFrom,
  })));
}));

// История обновлений цен
router.get('/updates', authenticate, requireRole('MANAGER'), asyncH(async (_req, res) => {
  const updates = await prisma.priceUpdate.findMany({
    orderBy: { effectiveAt: 'desc' },
    take: 50,
    include: { _count: { select: { prices: true } } },
  });
  res.json(updates.map((u) => ({ id: u.id, comment: u.comment, effectiveAt: u.effectiveAt, pricesCount: u._count.prices })));
}));

const updateSchema = z.object({
  comment: z.string().optional(),
  items: z.array(z.object({
    productId: z.number().int(),
    pricePerTon: z.number().positive(),
    vatRate: z.number().int().min(0).max(30).optional(),
  })).min(1, 'Список цен пуст'),
});

// Простая процедура обновления цен (раз в 2 недели).
// Создаёт партию обновления, переводит старые цены в неактуальные и добавляет новые.
router.post('/update', authenticate, requireRole('MANAGER'), asyncH(async (req, res) => {
  const data = updateSchema.parse(req.body);

  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.priceUpdate.create({
      data: { comment: data.comment || `Обновление цен от ${new Date().toLocaleDateString('ru-RU')}`, createdById: req.user.id },
    });

    let updated = 0;
    for (const item of data.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;
      // старую текущую цену — в архив
      await tx.price.updateMany({ where: { productId: item.productId, isCurrent: true }, data: { isCurrent: false } });
      // новая текущая цена
      await tx.price.create({
        data: {
          productId: item.productId,
          pricePerTon: item.pricePerTon,
          vatRate: item.vatRate ?? 22,
          vatIncluded: true,
          isCurrent: true,
          priceUpdateId: batch.id,
        },
      });
      updated++;
    }
    return { batchId: batch.id, updated };
  });

  res.status(201).json({ message: `Цены обновлены: ${result.updated} позиц.`, ...result });
}));

// Обновление цены одной позиции (быстрое редактирование)
router.put('/product/:id', authenticate, requireRole('MANAGER'), asyncH(async (req, res) => {
  const productId = Number(req.params.id);
  const { pricePerTon, vatRate } = z.object({ pricePerTon: z.number().positive(), vatRate: z.number().int().optional() }).parse(req.body);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError(404, 'Товар не найден');

  await prisma.$transaction([
    prisma.price.updateMany({ where: { productId, isCurrent: true }, data: { isCurrent: false } }),
    prisma.price.create({ data: { productId, pricePerTon, vatRate: vatRate ?? 22, vatIncluded: true, isCurrent: true } }),
  ]);
  res.json({ message: 'Цена обновлена', productId, pricePerTon });
}));

export default router;
