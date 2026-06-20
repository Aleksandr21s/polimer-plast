import { prisma } from '../prismaClient.js';

// Программа лояльности: скидка зависит от суммарного объёма (в тоннах),
// заказанного компанией за последние 2 года. Скидка распространяется на всех
// сотрудников компании.
//
// Учитываются заказы в статусах оплачен/отгружен/доставлен/завершён.
const COUNTED_STATUSES = ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'];

export async function getCompanyTons(companyId) {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 2);
  const agg = await prisma.order.aggregate({
    _sum: { totalWeightKg: true },
    where: { companyId, status: { in: COUNTED_STATUSES }, createdAt: { gte: since } },
  });
  return Number(agg._sum.totalWeightKg ?? 0) / 1000;
}

export async function calcDiscountPercent(companyId) {
  const tons = await getCompanyTons(companyId);
  const tiers = await prisma.loyaltyTier.findMany({ orderBy: { minTons: 'desc' } });
  let discount = 0;
  for (const t of tiers) {
    if (tons >= t.minTons) { discount = Number(t.discountPercent); break; }
  }
  return { tons, discount };
}

// Пересчитать и сохранить скидку в кэше компании.
export async function recalcCompanyDiscount(companyId) {
  const { tons, discount } = await calcDiscountPercent(companyId);
  await prisma.company.update({ where: { id: companyId }, data: { discountPercent: discount } });
  return { tons, discount };
}

// Прогресс до следующего порога — для отображения в приложении.
export async function loyaltyStatus(companyId) {
  const tons = await getCompanyTons(companyId);
  const tiers = await prisma.loyaltyTier.findMany({ orderBy: { minTons: 'asc' } });
  let current = 0;
  let next = null;
  for (const t of tiers) {
    if (tons >= t.minTons) current = Number(t.discountPercent);
    else { next = t; break; }
  }
  return {
    tons: Number(tons.toFixed(2)),
    currentDiscount: current,
    nextTier: next ? { minTons: next.minTons, discountPercent: Number(next.discountPercent), tonsLeft: Number((next.minTons - tons).toFixed(2)) } : null,
    tiers: tiers.map((t) => ({ minTons: t.minTons, discountPercent: Number(t.discountPercent) })),
  };
}
