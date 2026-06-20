import { Router } from 'express';
import { resolve } from 'node:path';
import { prisma } from '../prismaClient.js';
import { asyncH, AppError } from '../middleware/error.js';

const router = Router();

function serializeProduct(p, full = false) {
  const price = p.prices?.[0];
  const pricePerTon = price ? Number(price.pricePerTon) : null;
  // Артикул — внешний код из учётной системы
  const article = p.externalCode || p.slug;
  // Детерминированное распределение 10 фото по всем товарам («в случайном порядке»)
  const imageIndex = ((p.id * 7) % 10) + 1;
  const base = {
    id: p.id,
    name: p.name,
    slug: p.slug,
    article,
    unit: p.unit,
    imageUrl: `/static/products/${imageIndex}.jpg`,
    colorName: p.colorName,
    colorRal: p.colorRal,
    colorHex: p.colorHex,
    shoreHardnessA: p.shoreHardnessA,
    brittlenessTemp: p.brittlenessTemp,
    meltFlowIndex: p.meltFlowIndex != null ? Number(p.meltFlowIndex) : null,
    density: p.density != null ? Number(p.density) : null,
    pricePerTon,
    pricePerKg: pricePerTon != null ? Math.round((pricePerTon / 1000) * 100) / 100 : null,
    vatRate: price ? price.vatRate : 22,
    currency: price ? price.currency : 'RUB',
    tags: (p.tags || []).map((t) => ({ id: t.id, name: t.name, slug: t.slug, color: t.color })),
  };
  if (full) base.description = p.description;
  return base;
}

// Список меток применения (для фильтров)
router.get('/tags', asyncH(async (_req, res) => {
  const tags = await prisma.applicationTag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  res.json(tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug, color: t.color, productCount: t._count.products })));
}));

// Каталог продукции с фильтрами:
//   q — поиск по названию; tag — slug метки; minShore/maxShore; maxBrittle (морозостойкость)
//   sort=price_asc|price_desc|name; page, pageSize
router.get('/products', asyncH(async (req, res) => {
  const { q, tag, minShore, maxShore, maxBrittle, sort } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(300, Math.max(1, Number(req.query.pageSize) || 20));

  const where = { isActive: true };
  if (q) where.name = { contains: String(q), mode: 'insensitive' };
  if (tag) where.tags = { some: { slug: String(tag) } };
  if (minShore || maxShore) {
    where.shoreHardnessA = {};
    if (minShore) where.shoreHardnessA.gte = Number(minShore);
    if (maxShore) where.shoreHardnessA.lte = Number(maxShore);
  }
  if (maxBrittle) where.brittlenessTemp = { lte: Number(maxBrittle) };

  let orderBy = { name: 'asc' };
  // сортировка по цене — через связанную текущую цену сделаем после выборки (упрощённо по id)
  if (sort === 'name') orderBy = { name: 'asc' };

  const [total, productsRaw] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { tags: true, prices: { where: { isCurrent: true }, take: 1 } },
    }),
  ]);

  let products = productsRaw.map((p) => serializeProduct(p));
  if (sort === 'price_asc') products.sort((a, b) => (a.pricePerTon ?? 0) - (b.pricePerTon ?? 0));
  if (sort === 'price_desc') products.sort((a, b) => (b.pricePerTon ?? 0) - (a.pricePerTon ?? 0));

  res.json({ total, page, pageSize, totalPages: Math.ceil(total / pageSize), products });
}));

// Карточка продукции
router.get('/products/:id', asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const p = await prisma.product.findUnique({
    where: { id },
    include: { tags: true, category: true, prices: { where: { isCurrent: true }, take: 1 } },
  });
  if (!p) throw new AppError(404, 'Товар не найден');
  res.json(serializeProduct(p, true));
}));

// Текущий файл каталога (docx/pdf) — метаданные
router.get('/catalog-file', asyncH(async (_req, res) => {
  const file = await prisma.catalogFile.findFirst({ where: { isCurrent: true }, orderBy: { createdAt: 'desc' } });
  if (!file) return res.json(null);
  res.json({ id: file.id, title: file.title, fileName: file.fileName, version: file.version, createdAt: file.createdAt, downloadUrl: `/api/catalog/catalog-file/${file.id}/download` });
}));

// Скачивание файла каталога
router.get('/catalog-file/:id/download', asyncH(async (req, res) => {
  const file = await prisma.catalogFile.findUnique({ where: { id: Number(req.params.id) } });
  if (!file) throw new AppError(404, 'Файл каталога не найден');
  res.download(resolve(file.filePath), file.fileName);
}));

export default router;
