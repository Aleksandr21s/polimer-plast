import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient.js';
import { asyncH, AppError } from '../middleware/error.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { loyaltyStatus } from '../services/loyalty.js';

const router = Router();

function serializeCompany(c) {
  return {
    id: c.id, name: c.name, orgForm: c.orgForm, inn: c.inn, kpp: c.kpp, ogrn: c.ogrn,
    legalAddress: c.legalAddress, bankName: c.bankName, bankBik: c.bankBik,
    bankAccount: c.bankAccount, corrAccount: c.corrAccount, discountPercent: Number(c.discountPercent),
  };
}

// Моя компания (реквизиты)
router.get('/', authenticate, asyncH(async (req, res) => {
  if (!req.user.companyId) return res.json(null);
  const c = await prisma.company.findUnique({ where: { id: req.user.companyId } });
  res.json(serializeCompany(c));
}));

// Программа лояльности: текущий объём, скидка, прогресс до следующего порога
router.get('/loyalty', authenticate, asyncH(async (req, res) => {
  if (!req.user.companyId) throw new AppError(400, 'Профиль не привязан к компании');
  res.json(await loyaltyStatus(req.user.companyId));
}));

// Обновление реквизитов своей компании
const updateSchema = z.object({
  name: z.string().min(2).optional(),
  kpp: z.string().optional().or(z.literal('')),
  ogrn: z.string().optional().or(z.literal('')),
  legalAddress: z.string().optional().or(z.literal('')),
  bankName: z.string().optional().or(z.literal('')),
  bankBik: z.string().optional().or(z.literal('')),
  bankAccount: z.string().optional().or(z.literal('')),
  corrAccount: z.string().optional().or(z.literal('')),
});
router.put('/', authenticate, asyncH(async (req, res) => {
  if (!req.user.companyId) throw new AppError(400, 'Профиль не привязан к компании');
  const data = updateSchema.parse(req.body);
  const c = await prisma.company.update({ where: { id: req.user.companyId }, data });
  res.json(serializeCompany(c));
}));

// Поиск компаний в базе (менеджер) — реальная база клиентов
router.get('/search', authenticate, requireRole('MANAGER'), asyncH(async (req, res) => {
  const q = String(req.query.q || '');
  const companies = await prisma.company.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { inn: { contains: q } }] } : {},
    take: 50, orderBy: { name: 'asc' },
  });
  res.json(companies.map(serializeCompany));
}));

export default router;
