// Генерация единого файла каталога продукции (PDF) и регистрация его в БД (CatalogFile).
// Соответствует требованию: «просмотр каталога продукции компании (весь каталог в отдельном файле)».

import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SELLER } from '../src/config/seller.js';

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT = resolve(__dirname, '../src/assets/fonts/Arial.ttf');
const FONT_BOLD = resolve(__dirname, '../src/assets/fonts/Arial-Bold.ttf');
const OUT_DIR = resolve(__dirname, '../uploads/catalog');

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const filePath = resolve(OUT_DIR, 'catalog-polymer-plast.pdf');

  const tags = await prisma.applicationTag.findMany({
    where: { products: { some: {} } },
    include: {
      products: {
        where: { isActive: true },
        include: { prices: { where: { isCurrent: true }, take: 1 } },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  await new Promise((res, rej) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    doc.registerFont('main', FONT);
    doc.registerFont('bold', FONT_BOLD);
    const stream = createWriteStream(filePath);
    doc.pipe(stream);

    // Титул
    doc.font('bold').fontSize(22).text('Каталог продукции', { align: 'center' });
    doc.font('main').fontSize(13).text(SELLER.name, { align: 'center' });
    doc.fontSize(10).fillColor('#666').text('Поливинилхлоридный (ПВХ) пластикат', { align: 'center' });
    doc.fillColor('#000').moveDown(1);
    doc.fontSize(9).text(`Дата формирования: ${new Date().toLocaleDateString('ru-RU')}`, { align: 'center' });
    doc.moveDown(1.5);

    for (const tag of tags) {
      if (doc.y > 720) doc.addPage();
      doc.font('bold').fontSize(13).fillColor('#1f6feb').text(tag.name);
      doc.fillColor('#000').moveDown(0.2);
      doc.font('main').fontSize(9);
      for (const p of tag.products) {
        if (doc.y > 780) doc.addPage();
        const price = p.prices[0] ? Number(p.prices[0].pricePerTon).toLocaleString('ru-RU') + ' ₽/т' : '—';
        const chars = [
          p.colorName ? `цвет: ${p.colorName}${p.colorRal ? ' (' + p.colorRal + ')' : ''}` : null,
          p.shoreHardnessA ? `Шор A: ${p.shoreHardnessA}` : null,
          p.brittlenessTemp ? `хрупкость: ${p.brittlenessTemp}°C` : null,
          p.meltFlowIndex != null ? `ПТР: ${Number(p.meltFlowIndex)}` : null,
        ].filter(Boolean).join(', ');
        doc.font('bold').text(`• ${p.name}`, { continued: true }).font('main').text(`   ${price}`);
        if (chars) doc.fillColor('#555').fontSize(8).text(`   ${chars}`).fillColor('#000').fontSize(9);
      }
      doc.moveDown(0.8);
    }

    // Нумерация страниц
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font('main').fontSize(8).fillColor('#999')
        .text(`${SELLER.name} · стр. ${i + 1} из ${range.count}`, 40, 810, { align: 'center', width: 515 });
    }

    doc.end();
    stream.on('finish', res);
    stream.on('error', rej);
  });

  const total = tags.reduce((s, t) => s + t.products.length, 0);
  await prisma.catalogFile.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
  await prisma.catalogFile.create({
    data: {
      title: 'Каталог продукции ООО ТПК «Полимер-Пласт»',
      fileName: 'Каталог-Полимер-Пласт.pdf',
      filePath,
      version: new Date().toLocaleDateString('ru-RU'),
      isCurrent: true,
    },
  });

  console.log(`✅ Каталог сгенерирован: ${filePath}`);
  console.log(`   Разделов (меток): ${tags.length}, позиций (с повторами по меткам): ${total}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
