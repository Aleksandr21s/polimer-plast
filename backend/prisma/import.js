// Импорт реальных данных в БД: каталог марок пластиката (products.csv) и
// база компаний-клиентов (companies.csv). Идемпотентен (upsert / skipDuplicates).
//
// Запуск:  npm run db:import   (после npm run db:seed для базовых справочников — но
//          скрипт сам создаёт категории и метки, если их ещё нет).

import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { APPLICATION_TAGS, deriveMeta, derivePricePerTon } from './productMeta.js';

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../data');

function readCsv(file) {
  const raw = readFileSync(resolve(DATA_DIR, file), 'utf8').replace(/^﻿/, '');
  return parse(raw, { delimiter: ';', relax_quotes: true, relax_column_count: true, skip_empty_lines: true });
}

async function importCategoriesAndTags() {
  const category = await prisma.category.upsert({
    where: { slug: 'plastikat' },
    update: {},
    create: { name: 'Пластикат продукция', slug: 'plastikat' },
  });

  const tagBySlug = {};
  for (const t of APPLICATION_TAGS) {
    const tag = await prisma.applicationTag.upsert({
      where: { slug: t.slug },
      update: { name: t.name, color: t.color },
      create: { slug: t.slug, name: t.name, color: t.color },
    });
    tagBySlug[t.slug] = tag.id;
  }
  return { categoryId: category.id, tagBySlug };
}

async function importProducts({ categoryId, tagBySlug }) {
  const rows = readCsv('products.csv');
  rows.shift(); // заголовок

  // Прайс-лист (партия обновления цен) — стартовый
  const priceUpdate = await prisma.priceUpdate.create({
    data: { comment: 'Стартовый прайс-лист (импорт номенклатуры)' },
  });

  let created = 0;
  for (const r of rows) {
    const extId = (r[0] || '').trim();
    const name = (r[2] || '').trim();
    if (!name) continue;
    const unit = (r[11] || 'тонна').trim() || 'тонна';
    const slug = 'p' + (extId || created + 1);
    const meta = deriveMeta(name);
    const price = derivePricePerTon(name, meta);

    await prisma.product.upsert({
      where: { slug },
      update: {},
      create: {
        externalCode: extId || null,
        name,
        slug,
        unit,
        isActive: true,
        categoryId,
        colorName: meta.colorName,
        colorRal: meta.colorRal,
        colorHex: meta.colorHex,
        shoreHardnessA: meta.shoreHardnessA,
        brittlenessTemp: meta.brittlenessTemp,
        meltFlowIndex: meta.meltFlowIndex,
        density: meta.density,
        tags: { connect: meta.tags.map((s) => ({ id: tagBySlug[s] })).filter((x) => x.id) },
        prices: {
          create: {
            pricePerTon: price,
            currency: 'RUB',
            vatRate: 22,
            vatIncluded: true,
            isCurrent: true,
            priceUpdateId: priceUpdate.id,
          },
        },
      },
    });
    created++;
  }
  return created;
}

async function importCompanies() {
  const rows = readCsv('companies.csv');
  rows.shift(); // заголовок

  const seen = new Set();
  const data = [];
  for (const r of rows) {
    const name = (r[1] || '').trim().replace(/^"|"$/g, '');
    if (!name) continue;
    let inn = (r[38] || '').trim();
    if (!/^\d{6,12}$/.test(inn)) inn = null;
    if (inn) {
      if (seen.has(inn)) continue;
      seen.add(inn);
    }
    const orgForm = /\bИП\b|индивидуальн/i.test(name) ? 'IP' : 'OOO';
    data.push({ name: name.slice(0, 300), inn, orgForm });
  }

  // Пакетная вставка с пропуском дубликатов по уникальному ИНН
  const res = await prisma.company.createMany({ data, skipDuplicates: true });
  return res.count;
}

async function main() {
  console.log('▶ Импорт справочников (категории, метки применения)…');
  const refs = await importCategoriesAndTags();

  console.log('▶ Импорт каталога продукции…');
  const products = await importProducts(refs);
  console.log(`  ✔ марок пластиката: ${products}`);

  console.log('▶ Импорт базы компаний-клиентов…');
  const companies = await importCompanies();
  console.log(`  ✔ компаний: ${companies}`);

  console.log('✅ Импорт завершён.');
}

main()
  .catch((e) => {
    console.error('Ошибка импорта:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
