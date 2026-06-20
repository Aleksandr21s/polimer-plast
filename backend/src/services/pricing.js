// Расчёт денежных итогов заказа.
// Цена задаётся за тонну; объём позиции — в кг.
//   lineTotal = weightKg / 1000 * pricePerTon
//   subtotal  = Σ lineTotal (без скидки и НДС)
//   discount  = subtotal * discountPercent / 100
//   base      = subtotal - discount
//   vat       = base * vatRate / 100
//   total     = base + vat
//
// items: [{ productId, weightKg, pricePerTon }]
export function computeOrderTotals(items, discountPercent = 0, vatRate = 22) {
  let subtotal = 0;
  let totalWeightKg = 0;
  const lines = items.map((it) => {
    const weightKg = Number(it.weightKg);
    const pricePerTon = Number(it.pricePerTon);
    const lineTotal = round2((weightKg / 1000) * pricePerTon);
    subtotal += lineTotal;
    totalWeightKg += weightKg;
    return { productId: it.productId, weightKg, pricePerTon, lineTotal };
  });
  subtotal = round2(subtotal);
  const discountAmount = round2((subtotal * discountPercent) / 100);
  const base = round2(subtotal - discountAmount);
  const vatAmount = round2((base * vatRate) / 100);
  const total = round2(base + vatAmount);
  return { lines, totalWeightKg: round2(totalWeightKg), subtotal, discountPercent, discountAmount, vatRate, vatAmount, total };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
