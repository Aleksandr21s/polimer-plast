// Базовое наполнение БД: уровни лояльности, компания-продавец, менеджер,
// демонстрационные клиенты с историей заказов (для показа скидок 2% / 5%).
//
// Запуск:  npm run db:seed   (после npm run db:import — нужны товары и цены)

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SELLER } from '../src/config/seller.js';

const prisma = new PrismaClient();
const hash = (pwd) => bcrypt.hashSync(pwd, 10);

async function seedLoyaltyTiers() {
  await prisma.loyaltyTier.deleteMany();
  await prisma.loyaltyTier.createMany({
    data: [
      { minTons: 200, discountPercent: 2 },
      { minTons: 500, discountPercent: 5 },
    ],
  });
}

async function seedSellerCompany() {
  // Компания-продавец как организация менеджеров
  return prisma.company.upsert({
    where: { inn: SELLER.inn },
    update: {},
    create: {
      name: SELLER.name,
      orgForm: 'OOO',
      inn: SELLER.inn,
      kpp: SELLER.kpp,
      ogrn: SELLER.ogrn,
      legalAddress: SELLER.legalAddress,
      bankName: SELLER.bank.name,
      bankBik: SELLER.bank.bik,
      bankAccount: SELLER.bank.account,
      corrAccount: SELLER.bank.corrAccount,
    },
  });
}

async function ensureUser({ email, password, firstName, lastName, middleName, position, role, companyId, phone }) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: hash(password), firstName, lastName, middleName, position, role, companyId, phone },
  });
}

async function ensureClientCompany({ name, inn, kpp, ogrn, legalAddress }) {
  return prisma.company.upsert({
    where: { inn },
    update: {},
    create: {
      name, orgForm: 'OOO', inn, kpp, ogrn, legalAddress,
      bankName: 'ПАО «ВТБ»', bankBik: '044525187',
      bankAccount: '40702810900000054321', corrAccount: '30101810700000000187',
    },
  });
}

let orderCounter = 0;
async function createCompletedOrder(company, user, items, monthsAgo) {
  orderCounter++;
  const created = new Date();
  created.setMonth(created.getMonth() - monthsAgo);

  // Подтянуть текущие цены
  const enriched = [];
  let subtotal = 0;
  let totalWeightKg = 0;
  for (const it of items) {
    const price = await prisma.price.findFirst({ where: { productId: it.productId, isCurrent: true } });
    const pricePerTon = Number(price?.pricePerTon ?? 120000);
    const lineTotal = (it.weightKg / 1000) * pricePerTon;
    subtotal += lineTotal;
    totalWeightKg += it.weightKg;
    enriched.push({ productId: it.productId, weightKg: it.weightKg, pricePerTon, lineTotal });
  }
  const vatRate = 22;
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;
  const number = `КП-2026-${String(1000 + orderCounter).slice(1)}`;

  const issued = new Date(created); issued.setHours(issued.getHours() + 2);
  const paid = new Date(created); paid.setDate(paid.getDate() + 1);

  await prisma.order.create({
    data: {
      number,
      status: 'COMPLETED',
      companyId: company.id,
      createdById: user.id,
      deliveryRegion: 'Республика Башкортостан',
      deliveryCity: 'Уфа',
      totalWeightKg,
      subtotal: subtotal.toFixed(2),
      discountPercent: 0,
      discountAmount: 0,
      vatRate,
      vatAmount: vatAmount.toFixed(2),
      total: total.toFixed(2),
      createdAt: created,
      invoiceIssuedAt: issued,
      paidAt: paid,
      items: { create: enriched.map((e) => ({ ...e, lineTotal: e.lineTotal.toFixed(2), pricePerTon: e.pricePerTon.toFixed(2), weightKg: e.weightKg.toFixed(2) })) },
      history: {
        create: [
          { status: 'NEW', createdAt: created },
          { status: 'INVOICE_ISSUED', createdAt: issued },
          { status: 'PAID', createdAt: paid },
          { status: 'COMPLETED', createdAt: new Date(paid.getTime() + 5 * 864e5) },
        ],
      },
    },
  });
}

async function recalcDiscount(companyId) {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 2);
  const agg = await prisma.order.aggregate({
    _sum: { totalWeightKg: true },
    where: { companyId, status: { in: ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'] }, createdAt: { gte: since } },
  });
  const tons = Number(agg._sum.totalWeightKg ?? 0) / 1000;
  const tiers = await prisma.loyaltyTier.findMany({ orderBy: { minTons: 'desc' } });
  let discount = 0;
  for (const t of tiers) if (tons >= t.minTons) { discount = Number(t.discountPercent); break; }
  await prisma.company.update({ where: { id: companyId }, data: { discountPercent: discount } });
  return { tons, discount };
}

async function main() {
  console.log('▶ Уровни лояльности (200 т → 2%, 500 т → 5%)…');
  await seedLoyaltyTiers();

  console.log('▶ Компания-продавец и менеджер…');
  const seller = await seedSellerCompany();
  await ensureUser({
    email: 'manager@polymer-plast.ru', password: 'manager123', firstName: 'Дмитрий', lastName: 'Полупанов',
    middleName: 'Сергеевич', position: 'Менеджер отдела продаж', role: 'MANAGER', companyId: seller.id, phone: '+7 (3473) 24-00-01',
  });

  console.log('▶ Демонстрационные клиенты…');
  // Несколько марок для истории заказов
  const prods = await prisma.product.findMany({ take: 6, orderBy: { id: 'asc' } });
  const pid = (i) => prods[i].id;

  // Клиент A — выйдет на скидку 2% (≈250 т за 2 года)
  const compA = await ensureClientCompany({ name: 'ООО «ТехноКабель»', inn: '7701234567', kpp: '770101001', ogrn: '1157746000111', legalAddress: 'г. Москва, ул. Кабельная, д. 5' });
  const userA = await ensureUser({ email: 'client@demo.ru', password: 'client123', firstName: 'Анна', lastName: 'Сидорова', middleName: 'Игоревна', position: 'Менеджер по закупкам', role: 'CLIENT', companyId: compA.id, phone: '+7 (495) 100-20-30' });

  // Клиент B — выйдет на скидку 5% (≈560 т за 2 года)
  const compB = await ensureClientCompany({ name: 'ООО «ПромСнаб»', inn: '6300123456', kpp: '631001001', ogrn: '1126300004567', legalAddress: 'г. Самара, пр. Кирова, д. 24' });
  const userB = await ensureUser({ email: 'big@demo.ru', password: 'client123', firstName: 'Сергей', lastName: 'Кузнецов', middleName: 'Павлович', position: 'Директор по снабжению', role: 'CLIENT', companyId: compB.id, phone: '+7 (846) 200-30-40' });

  // Клиент C — новый, без истории (скидка 0%)
  const compC = await ensureClientCompany({ name: 'ООО «СтартПласт»', inn: '5008123456', kpp: '500801001', ogrn: '1185000007890', legalAddress: 'Московская обл., г. Долгопрудный, ул. Заводская, д. 1' });
  await ensureUser({ email: 'new@demo.ru', password: 'client123', firstName: 'Игорь', lastName: 'Морозов', position: 'Технолог', role: 'CLIENT', companyId: compC.id });

  // История заказов (только если ещё нет)
  const existing = await prisma.order.count({ where: { companyId: compA.id } });
  if (existing === 0) {
    // A ≈ 250 т
    await createCompletedOrder(compA, userA, [{ productId: pid(0), weightKg: 90000 }], 20);
    await createCompletedOrder(compA, userA, [{ productId: pid(1), weightKg: 80000 }, { productId: pid(2), weightKg: 20000 }], 10);
    await createCompletedOrder(compA, userA, [{ productId: pid(3), weightKg: 60000 }], 3);
    // B ≈ 560 т
    await createCompletedOrder(compB, userB, [{ productId: pid(0), weightKg: 200000 }], 18);
    await createCompletedOrder(compB, userB, [{ productId: pid(4), weightKg: 180000 }], 9);
    await createCompletedOrder(compB, userB, [{ productId: pid(5), weightKg: 180000 }], 2);
  }

  const a = await recalcDiscount(compA.id);
  const b = await recalcDiscount(compB.id);
  const c = await recalcDiscount(compC.id);
  console.log(`  ТехноКабель: ${a.tons.toFixed(0)} т → ${a.discount}%`);
  console.log(`  ПромСнаб:   ${b.tons.toFixed(0)} т → ${b.discount}%`);
  console.log(`  СтартПласт: ${c.tons.toFixed(0)} т → ${c.discount}%`);

  console.log('✅ Базовое наполнение завершено.');
  console.log('\nДемо-доступы:');
  console.log('  Менеджер:      manager@polymer-plast.ru / manager123');
  console.log('  Клиент (2%):   client@demo.ru / client123');
  console.log('  Клиент (5%):   big@demo.ru / client123');
  console.log('  Клиент (0%):   new@demo.ru / client123');
}

main()
  .catch((e) => { console.error('Ошибка seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
