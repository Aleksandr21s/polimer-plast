// Сквозной тест API: проверяет основные пользовательские сценарии.
const BASE = 'http://localhost:4000/api';
let pass = 0, fail = 0;

function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.log('  ✗ FAIL:', msg); }
}
async function api(path, { method = 'GET', token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !raw) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: raw ? body : body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

console.log('\n── АУТЕНТИФИКАЦИЯ ──');
const mgr = await api('/auth/login', { method: 'POST', body: { email: 'manager@polymer-plast.ru', password: 'manager123' } });
ok(mgr.status === 200 && mgr.data.token, 'Менеджер вошёл');
const mgrT = mgr.data.token;

const cli = await api('/auth/login', { method: 'POST', body: { email: 'client@demo.ru', password: 'client123' } });
ok(cli.status === 200 && cli.data.user.company.discountPercent === 2, `Клиент вошёл, скидка ${cli.data?.user?.company?.discountPercent}%`);
const cliT = cli.data.token;

const big = await api('/auth/login', { method: 'POST', body: { email: 'big@demo.ru', password: 'client123' } });
ok(big.data?.user?.company?.discountPercent === 5, `Крупный клиент: скидка ${big.data?.user?.company?.discountPercent}%`);

console.log('\n── РЕГИСТРАЦИЯ НОВОГО ПОЛЬЗОВАТЕЛЯ ──');
const rnd = Math.floor(Math.random() * 1e6);
const reg = await api('/auth/register', { method: 'POST', body: {
  email: `test${rnd}@demo.ru`, password: 'secret123', firstName: 'Тест', lastName: 'Тестов', middleName: 'Тестович', position: 'Снабженец',
  company: { name: `ООО «Тест-${rnd}»`, orgForm: 'OOO', inn: String(7700000000 + rnd), kpp: '770001001', ogrn: '1027700000000', legalAddress: 'г. Москва' },
}});
ok(reg.status === 201 && reg.data.token, 'Регистрация: компания + пользователь созданы');
const newT = reg.data.token;

console.log('\n── КАТАЛОГ ──');
const cat = await api('/catalog/products?pageSize=5');
ok(cat.data.total === 158, `Всего марок: ${cat.data.total}`);
ok(cat.data.products[0].pricePerTon > 0, 'У товара есть цена');
const filtered = await api('/catalog/products?tag=frost-resistant');
ok(filtered.data.products.every((p) => p.tags.some((t) => t.slug === 'frost-resistant')), `Фильтр по метке: ${filtered.data.total} морозостойких`);
const prod = await api(`/catalog/products/${cat.data.products[0].id}`);
ok(prod.data.shoreHardnessA != null && prod.data.brittlenessTemp != null, 'Карточка: характеристики (Шор, хрупкость) присутствуют');

console.log('\n── ФОРМИРОВАНИЕ ЗАКАЗА (клиент, скидка 2%) ──');
const pid1 = cat.data.products[0].id, pid2 = cat.data.products[1].id;
const order = await api('/orders', { method: 'POST', token: cliT, body: {
  deliveryRegion: 'Республика Татарстан', deliveryCity: 'Казань', comment: 'Срочно',
  items: [{ productId: pid1, weightKg: 25000 }, { productId: pid2, weightKg: 5000 }],
}});
ok(order.status === 201, 'Заказ создан (статус NEW)');
ok(order.data.discountPercent === 2 && order.data.discountAmount > 0, `Скидка применена: ${order.data.discountPercent}% = ${order.data.discountAmount}₽`);
ok(order.data.totalWeightKg === 30000, `Объём: ${order.data.totalWeightKg} кг`);
ok(order.data.remainingHours > 71 && order.data.remainingHours <= 72, `Окно автоотмены: ${order.data.remainingHours} ч`);
const orderId = order.data.id;

console.log('\n── ФОРМИРОВАНИЕ КП/СЧЁТА (PDF) ──');
const inv = await api(`/orders/${orderId}/issue-invoice`, { method: 'POST', token: cliT });
ok(inv.status === 200 && inv.data.status === 'INVOICE_ISSUED', 'Статус → INVOICE_ISSUED');
ok(inv.data.documents.some((d) => d.type === 'COMMERCIAL_OFFER'), 'КП/счёт (PDF) сформирован и прикреплён');

console.log('\n── ЗАГРУЗКА ДОКУМЕНТОВ (разграничение ролей) ──');
// Клиент пытается загрузить счёт ТК (только менеджер) → 403
const fd1 = new FormData();
fd1.append('type', 'TRANSPORT_INVOICE');
fd1.append('file', new Blob(['fake'], { type: 'application/pdf' }), 'tk.pdf');
const wrong = await fetch(`${BASE}/orders/${orderId}/documents`, { method: 'POST', headers: { Authorization: `Bearer ${cliT}` }, body: fd1 });
ok(wrong.status === 403, 'Клиенту запрещено грузить счёт ТК (403)');

// Менеджер грузит счёт ТК → ok
const fd2 = new FormData();
fd2.append('type', 'TRANSPORT_INVOICE');
fd2.append('file', new Blob(['fake-tk-invoice'], { type: 'application/pdf' }), 'tk-invoice.pdf');
const tk = await fetch(`${BASE}/orders/${orderId}/documents`, { method: 'POST', headers: { Authorization: `Bearer ${mgrT}` }, body: fd2 });
ok(tk.status === 201, 'Менеджер загрузил счёт ТК за доставку');

// Клиент грузит платёжку за товар → ok
const fd3 = new FormData();
fd3.append('type', 'PAYMENT_GOODS');
fd3.append('file', new Blob(['payment'], { type: 'application/pdf' }), 'pay-goods.pdf');
const pay = await fetch(`${BASE}/orders/${orderId}/documents`, { method: 'POST', headers: { Authorization: `Bearer ${cliT}` }, body: fd3 });
ok(pay.status === 201, 'Клиент загрузил платёжку за товар');

console.log('\n── ПОДТВЕРЖДЕНИЕ ОПЛАТЫ И СТАТУСЫ (менеджер) ──');
const paid = await api(`/orders/${orderId}/confirm-payment`, { method: 'POST', token: mgrT });
ok(paid.data.status === 'PAID', 'Менеджер подтвердил оплату → PAID');
const shipped = await api(`/orders/${orderId}/status`, { method: 'PATCH', token: mgrT, body: { status: 'SHIPPED', comment: 'Передано в ТК' } });
ok(shipped.data.status === 'SHIPPED', 'Статус → SHIPPED');
const tracked = await api(`/orders/${orderId}`, { token: cliT });
ok(tracked.data.history.length >= 4, `Отслеживание: ${tracked.data.history.length} событий в истории`);

console.log('\n── ОБРАЗЦЫ (5/10/20/30 кг) ──');
const sample = await api('/samples', { method: 'POST', token: cliT, body: { productId: pid1, weightKg: 10, region: 'Москва' } });
ok(sample.status === 201 && sample.data.weightKg === 10, 'Заявка на образец 10 кг создана');
const badSample = await api('/samples', { method: 'POST', token: cliT, body: { productId: pid1, weightKg: 7, region: 'Москва' } });
ok(badSample.status === 400, 'Недопустимая навеска (7 кг) отклонена');

console.log('\n── ЛОЯЛЬНОСТЬ ──');
const loy = await api('/company/loyalty', { token: cliT });
ok(loy.data.currentDiscount === 2 && loy.data.nextTier?.discountPercent === 5, `Объём ${loy.data.tons}т → ${loy.data.currentDiscount}%, до 5% осталось ${loy.data.nextTier?.tonsLeft}т`);

console.log('\n── ЦЕНЫ: ПРОЦЕДУРА ОБНОВЛЕНИЯ (менеджер) ──');
const upd = await api('/prices/update', { method: 'POST', token: mgrT, body: { comment: 'Тест', items: [{ productId: pid1, pricePerTon: 199000 }] } });
ok(upd.status === 201, `Обновление цен: ${upd.data.message}`);
const prodAfter = await api(`/catalog/products/${pid1}`);
ok(prodAfter.data.pricePerTon === 199000, `Новая цена применена: ${prodAfter.data.pricePerTon}₽`);
// клиенту обновление цен запрещено
const updForbidden = await api('/prices/update', { method: 'POST', token: cliT, body: { items: [{ productId: pid1, pricePerTon: 1 }] } });
ok(updForbidden.status === 403, 'Клиенту обновление цен запрещено (403)');

console.log('\n── ЧАТ-БОТ (локальный подбор) ──');
const chat1 = await api('/chat', { method: 'POST', token: cliT, body: { message: 'нужен морозостойкий пластикат для кабеля' } });
ok(chat1.data.recommendations.length > 0, `Бот подобрал ${chat1.data.recommendations.length} марок по запросу о морозостойком кабеле`);
const chat2 = await api('/chat', { method: 'POST', token: cliT, body: { message: 'как заказать образцы?' } });
ok(/образц/i.test(chat2.data.reply), 'Бот ответил на вопрос об образцах (FAQ)');
const chat3 = await api('/chat', { method: 'POST', token: cliT, body: { message: 'абвгдеёжз непонятный запрос' } });
ok(chat3.data.escalate === true, 'Непонятный запрос → предложена эскалация менеджеру');

console.log('\n── СПИСОК ЗАКАЗОВ ──');
const myOrders = await api('/orders', { token: cliT });
ok(myOrders.data.length >= 1, `Заказы клиента: ${myOrders.data.length}`);
const allOrders = await api('/orders', { token: mgrT });
ok(allOrders.data.length >= myOrders.data.length, `Менеджер видит все заказы: ${allOrders.data.length}`);

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nИТОГ: ✓ ${pass} пройдено, ✗ ${fail} провалено\n`);
process.exit(fail ? 1 : 0);
