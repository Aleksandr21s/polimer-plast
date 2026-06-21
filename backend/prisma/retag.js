// Ре-тегирование каталога без полного реимпорта: пересчитывает метки применения
// (и характеристики) для уже существующих товаров по их названию через deriveMeta.
// Нужен потому, что db:import делает upsert и раньше не обновлял метки у имеющихся
// записей. Безопасно запускать на проде: цены и заказы не трогаются.
//
// Запуск:  npm run db:retag

import { PrismaClient } from '@prisma/client';
import { APPLICATION_TAGS, deriveMeta } from './productMeta.js';

const prisma = new PrismaClient();

// Позиции, которые не относятся к пластикату (оснастка и т.п.) — скрываем из каталога.
const NON_PRODUCT = /сопло|\bсэ-?g/i;

async function ensureTags() {
  const bySlug = {};
  for (const t of APPLICATION_TAGS) {
    const tag = await prisma.applicationTag.upsert({
      where: { slug: t.slug },
      update: { name: t.name, color: t.color },
      create: { slug: t.slug, name: t.name, color: t.color },
    });
    bySlug[t.slug] = tag.id;
  }
  return bySlug;
}

async function main() {
  console.log('▶ Обновление меток применения (ре-тегирование каталога)…');
  const tagBySlug = await ensureTags();

  const products = await prisma.product.findMany({ select: { id: true, name: true, isActive: true } });
  let updated = 0;
  let hidden = 0;

  for (const p of products) {
    const isProduct = !NON_PRODUCT.test(p.name);
    const meta = deriveMeta(p.name);
    const connect = meta.tags.map((s) => ({ id: tagBySlug[s] })).filter((x) => x.id);

    await prisma.product.update({
      where: { id: p.id },
      data: {
        isActive: isProduct,
        colorName: meta.colorName,
        colorRal: meta.colorRal,
        colorHex: meta.colorHex,
        shoreHardnessA: meta.shoreHardnessA,
        brittlenessTemp: meta.brittlenessTemp,
        meltFlowIndex: meta.meltFlowIndex,
        density: meta.density,
        tags: { set: connect },
      },
    });
    updated++;
    if (!isProduct) hidden++;
  }

  console.log(`  ✔ обновлено товаров: ${updated}${hidden ? `, скрыто из каталога: ${hidden}` : ''}`);
  console.log('✅ Ре-тегирование завершено.');
}

main()
  .catch((e) => {
    console.error('Ошибка ре-тегирования:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
