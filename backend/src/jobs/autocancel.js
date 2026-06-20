import cron from 'node-cron';
import { prisma } from '../prismaClient.js';

// Авто-отмена заказов при неоплате/неподтверждении в течение 72 часов.
// Отменяются заказы в статусах NEW / INVOICE_ISSUED, у которых истёк autoCancelAt.
export async function cancelExpiredOrders() {
  const now = new Date();
  const expired = await prisma.order.findMany({
    where: { status: { in: ['NEW', 'INVOICE_ISSUED'] }, autoCancelAt: { lt: now } },
    select: { id: true, number: true },
  });
  for (const o of expired) {
    await prisma.order.update({
      where: { id: o.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelReason: 'Автоотмена: оплата/подтверждение не получены в течение 72 часов',
        history: { create: { status: 'CANCELLED', comment: 'Автоотмена по истечении 72 часов' } },
      },
    });
  }
  if (expired.length) console.log(`[autocancel] отменено заказов: ${expired.length}`);
  return expired.length;
}

// Запуск планировщика: проверка каждые 10 минут.
export function startAutoCancelJob() {
  cron.schedule('*/10 * * * *', () => {
    cancelExpiredOrders().catch((e) => console.error('[autocancel] ошибка:', e));
  });
  // первичная проверка при старте
  cancelExpiredOrders().catch(() => {});
}
