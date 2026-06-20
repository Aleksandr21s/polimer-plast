import PDFDocument from 'pdfkit';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SELLER } from '../config/seller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT = resolve(__dirname, '../assets/fonts/Arial.ttf');
const FONT_BOLD = resolve(__dirname, '../assets/fonts/Arial-Bold.ttf');
const OUT_DIR = resolve(__dirname, '../../uploads/orders');

const money = (n) => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Генерирует PDF коммерческого предложения / счёта по заказу.
// order — заказ с полями company, createdBy, items.product.
// Возвращает абсолютный путь к файлу.
export function generateOfferPdf(order) {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const filePath = resolve(OUT_DIR, `KP-${order.number.replace(/[^\dА-Яа-я-]/g, '_')}.pdf`);

  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.registerFont('main', FONT);
    doc.registerFont('bold', FONT_BOLD);
    const stream = createWriteStream(filePath);
    doc.pipe(stream);

    const c = order.company;
    const b = SELLER.bank;

    // ── Шапка: банковские реквизиты продавца (как в форме счёта) ──
    doc.font('bold').fontSize(9);
    const boxTop = doc.y;
    doc.font('main').fontSize(8);
    doc.text(`${b.name}`, 40, boxTop, { width: 320 });
    doc.text(`БИК: ${b.bik}`, 40, doc.y, { width: 320 });
    doc.text(`Кор. счёт: ${b.corrAccount}`, 40, doc.y, { width: 320 });
    doc.font('bold').fontSize(8).text(`Сч. №: ${b.account}`, 380, boxTop, { width: 175 });
    doc.font('main').text(`Получатель: ${SELLER.name}`, 380, doc.y, { width: 175 });
    doc.text(`ИНН ${SELLER.inn} / КПП ${SELLER.kpp}`, 380, doc.y, { width: 175 });
    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // ── Заголовок ──
    doc.font('bold').fontSize(15).text(`Коммерческое предложение (счёт) № ${order.number}`, { align: 'left' });
    doc.font('main').fontSize(9).text(`от ${new Date(order.createdAt).toLocaleDateString('ru-RU')}`);
    doc.moveDown(0.6);

    // ── Поставщик / Покупатель ──
    doc.font('bold').fontSize(9).text('Поставщик:');
    doc.font('main').fontSize(9).text(`${SELLER.fullName}`);
    doc.text(`ИНН ${SELLER.inn}, КПП ${SELLER.kpp}, ОГРН ${SELLER.ogrn}`);
    doc.text(`${SELLER.legalAddress}`);
    doc.text(`Тел.: ${SELLER.phone}, e-mail: ${SELLER.email}`);
    doc.moveDown(0.4);

    doc.font('bold').fontSize(9).text('Покупатель:');
    doc.font('main').fontSize(9).text(`${c.name}`);
    doc.text(`ИНН ${c.inn || '—'}${c.kpp ? ', КПП ' + c.kpp : ''}${c.ogrn ? ', ОГРН ' + c.ogrn : ''}`);
    if (c.legalAddress) doc.text(`${c.legalAddress}`);
    doc.text(`Контактное лицо: ${order.createdBy.lastName} ${order.createdBy.firstName} ${order.createdBy.middleName || ''}`.trim());
    doc.moveDown(0.4);

    doc.font('main').fontSize(9).text(`Регион доставки: ${order.deliveryRegion}${order.deliveryCity ? ', ' + order.deliveryCity : ''}`);
    doc.moveDown(0.6);

    // ── Таблица позиций ──
    const cols = { n: 40, name: 70, qty: 320, price: 400, sum: 480 };
    const headerY = doc.y;
    doc.font('bold').fontSize(9);
    doc.text('№', cols.n, headerY);
    doc.text('Наименование (марка)', cols.name, headerY);
    doc.text('Кол-во, т', cols.qty, headerY, { width: 70, align: 'right' });
    doc.text('Цена, ₽/т', cols.price, headerY, { width: 70, align: 'right' });
    doc.text('Сумма, ₽', cols.sum, headerY, { width: 75, align: 'right' });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.2);

    doc.font('main').fontSize(9);
    order.items.forEach((it, i) => {
      const y = doc.y;
      const tons = Number(it.weightKg) / 1000;
      doc.text(String(i + 1), cols.n, y);
      doc.text(it.product.name, cols.name, y, { width: 245 });
      const rowH = doc.y - y;
      doc.text(tons.toLocaleString('ru-RU', { maximumFractionDigits: 3 }), cols.qty, y, { width: 70, align: 'right' });
      doc.text(money(it.pricePerTon), cols.price, y, { width: 70, align: 'right' });
      doc.text(money(it.lineTotal), cols.sum, y, { width: 75, align: 'right' });
      doc.y = y + Math.max(rowH, 12);
      doc.moveDown(0.1);
    });
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.4);

    // ── Итоги ──
    const right = (label, val, bold = false) => {
      doc.font(bold ? 'bold' : 'main').fontSize(9);
      doc.text(label, 320, doc.y, { width: 150, align: 'right', continued: true });
      doc.text('  ' + val, { width: 85, align: 'right' });
    };
    right('Итого без скидки и НДС:', money(order.subtotal) + ' ₽');
    if (Number(order.discountPercent) > 0) {
      right(`Скидка по лояльности (${Number(order.discountPercent)}%):`, '−' + money(order.discountAmount) + ' ₽');
    }
    right(`НДС ${order.vatRate}%:`, money(order.vatAmount) + ' ₽');
    right('ИТОГО к оплате:', money(order.total) + ' ₽', true);
    doc.moveDown(1);

    // ── Подвал ──
    doc.font('main').fontSize(8).fillColor('#555');
    doc.text(`Всего наименований ${order.items.length}, на сумму ${money(order.total)} ₽ (включая НДС ${order.vatRate}%).`, 40);
    doc.text('Предложение действительно в течение 72 часов с момента формирования. Оплата по настоящему счёту означает согласие с условиями поставки.', { width: 515 });
    doc.moveDown(1.5);
    doc.fillColor('#000').fontSize(9);
    doc.text(`Руководитель: _______________ / ${SELLER.director} /`, 40);
    doc.moveDown(0.3);
    doc.text(`Бухгалтер: _______________ / ${SELLER.accountant} /`, 40);

    doc.end();
    stream.on('finish', () => resolvePromise(filePath));
    stream.on('error', reject);
  });
}
