import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient.js';
import { asyncH, AppError } from '../middleware/error.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

const LABELS = { NEW: 'Новая', IN_REVIEW: 'На рассмотрении', RESOLVED: 'Решена', REJECTED: 'Отклонена' };

function serialize(c) {
  return {
    id: c.id, subject: c.subject, text: c.text, status: c.status, statusLabel: LABELS[c.status],
    createdAt: c.createdAt, orderId: c.orderId,
    order: c.order ? { id: c.order.id, number: c.order.number } : null,
    user: c.user ? { id: c.user.id, firstName: c.user.firstName, lastName: c.user.lastName } : null,
  };
}

// Создать рекламацию (по заказу или общую)
router.post('/', authenticate, asyncH(async (req, res) => {
  const data = z.object({
    orderId: z.number().int().optional(),
    subject: z.string().min(2, 'Укажите тему'),
    text: z.string().min(5, 'Опишите проблему'),
  }).parse(req.body);

  if (data.orderId) {
    const order = await prisma.order.findUnique({ where: { id: data.orderId } });
    if (!order) throw new AppError(404, 'Заказ не найден');
    if (req.user.role !== 'MANAGER' && order.companyId !== req.user.companyId) throw new AppError(403, 'Нет доступа к заказу');
  }

  const complaint = await prisma.complaint.create({
    data: { orderId: data.orderId || null, userId: req.user.id, subject: data.subject, text: data.text },
    include: { order: true, user: true },
  });
  res.status(201).json(serialize(complaint));
}));

// Список рекламаций (клиент — свои, менеджер — все)
router.get('/', authenticate, asyncH(async (req, res) => {
  const where = req.user.role === 'MANAGER' ? {} : { userId: req.user.id };
  const list = await prisma.complaint.findMany({ where, orderBy: { createdAt: 'desc' }, include: { order: true, user: true } });
  res.json(list.map(serialize));
}));

// Обновить статус (менеджер)
router.patch('/:id/status', authenticate, requireRole('MANAGER'), asyncH(async (req, res) => {
  const { status } = z.object({ status: z.enum(['NEW', 'IN_REVIEW', 'RESOLVED', 'REJECTED']) }).parse(req.body);
  const c = await prisma.complaint.update({ where: { id: Number(req.params.id) }, data: { status }, include: { order: true, user: true } });
  res.json(serialize(c));
}));

export default router;
