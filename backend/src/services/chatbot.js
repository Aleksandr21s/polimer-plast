import { prisma } from '../prismaClient.js';

// Локальный (без внешнего API) интеллектуальный помощник по подбору пластиката.
// Работает на правилах с оценкой уверенности: нормализует текст, распознаёт
// назначение/характеристику/термин/марку, считает «очки» по каждому намерению и
// выбирает лучший ответ. Нетиповые вопросы не упираются в тупик: бот объясняет
// термины, отвечает на широкий список тем, а в крайнем случае мягко уточняет
// запрос и предлагает передать его менеджеру.

// ── Нормализация: нижний регистр, ё→е, убрать пунктуацию, схлопнуть пробелы ──
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// score: сколько ключевых подстрок встретилось в тексте
function score(text, words) {
  let s = 0;
  for (const w of words) if (text.includes(w)) s += 1;
  return s;
}

// Ключевые слова запроса → метка применения (slug). Паттерны без «ё» (нормализованы).
const KEYWORD_TO_TAG = [
  { tag: 'cable-insulation', words: ['кабел', 'изоляц', 'провод', 'жил', 'токопровод'] },
  { tag: 'cable-sheath', words: ['оболочк', 'шланг кабел'] },
  { tag: 'footwear', words: ['обув', 'подошв', 'сапог', 'ботин', 'тапочк', 'галош'] },
  { tag: 'profiles', words: ['профил', 'погонаж', 'уплотнит', 'окон', 'плинтус', 'наличник'] },
  { tag: 'hoses', words: ['шланг', 'трубк', 'рукав', 'поливочн'] },
  { tag: 'medical', words: ['медиц', 'мед ', 'капельниц', 'катетер', 'фармац'] },
  { tag: 'frost-resistant', words: ['мороз', 'холод', 'низк темп', 'зим', 'север', 'улиц'] },
  { tag: 'non-flammable', words: ['негор', 'пожар', ' нг', 'самозатух', 'горюч', 'огнестойк', 'пламя'] },
  { tag: 'acid-alkali', words: ['кислот', 'щелоч', 'кщс', 'агрессив', 'хими', 'реагент'] },
  { tag: 'transparent', words: ['прозрач', 'полупрозрач'] },
  { tag: 'injection', words: ['литье', 'литьем', 'инжекц', 'литьев'] },
  { tag: 'stretch-ceiling', words: ['натяжн', 'потолок', 'потолк'] },
  { tag: 'food-grade', words: ['пищев', 'пищеп', 'продукт питан', 'контакт с пищ', 'для еды', 'пищ контакт'] },
];

// ── База знаний. kind: glossary (определения) | faq (темы) | social (привет/спасибо) ──
const KB = [
  // ——— Социальные ———
  {
    id: 'greeting', kind: 'social',
    words: ['привет', 'здравств', 'добрыи день', 'добрыи вечер', 'доброе утро', 'хаи', 'здаров', 'hello', 'hi', 'ку '],
    reply: 'Здравствуйте! Я помогу подобрать марку пластиката под вашу задачу. Опишите, для чего нужно сырьё ' +
      '(например: «изоляция кабеля», «морозостойкий шланг», «кислотостойкий пластикат»), либо спросите про образцы, цены, доставку или термины.',
  },
  {
    id: 'thanks', kind: 'social',
    words: ['спасиб', 'благодар', 'спс', 'thanks', 'thank you', 'выручил'],
    reply: 'Пожалуйста! Рад помочь. Если нужно — подберу ещё марки или отвечу на вопрос по заказу, доставке и оплате.',
  },
  // ——— Возможности ———
  {
    id: 'capabilities', kind: 'faq',
    words: ['что ты умеешь', 'что умеешь', 'чем помож', 'чем можешь помоч', 'кто ты', 'что можешь', 'как пользоват', 'помоги', 'команды', 'функци бота'],
    reply: 'Я помогу: подобрать марку пластиката под задачу (изоляция, обувь, шланги, медицина, мороз, КЩС), ' +
      'объясню характеристики (Шор, ПТР, температуру хрупкости, плотность), расскажу про образцы, цены, доставку, ' +
      'оплату, лояльность, оформление и отслеживание заказа. Опишите задачу или задайте вопрос.',
  },
  // ——— Глоссарий (определения терминов) ———
  {
    id: 'g-shore', kind: 'glossary',
    words: ['что такое шор', 'шкала шор', 'шор это', 'что значит шор', 'твердость это', 'что такое твердост', 'как измеряет твердост'],
    reply: 'Твёрдость по Шору A — шкала жёсткости эластичных материалов (0–100 ед.). Чем выше число, тем твёрже и жёстче ' +
      'пластикат: мягкие марки ~50–70 ед. (гибкие шланги, изоляция), жёсткие — 80–95 ед. (профили, подошва).',
  },
  {
    id: 'g-mfi', kind: 'glossary',
    words: ['что такое птр', 'птр это', 'показатель текучест', 'текучест расплав', 'что значит птр'],
    reply: 'ПТР (показатель текучести расплава, г/10 мин) — насколько легко расплав течёт при переработке. ' +
      'Выше ПТР — материал более текучий (удобно для литья под давлением), ниже — для экструзии профилей и кабеля.',
  },
  {
    id: 'g-frost', kind: 'glossary',
    words: ['что такое температура хрупкост', 'температура хрупкости это', 'что такое морозостоик', 'хрупкост это', 'что значит морозостоик'],
    reply: 'Температура хрупкости — температура, при которой пластикат теряет эластичность и становится ломким. ' +
      'Чем ниже это значение (например, −50 °C), тем морозостойче марка и тем для более холодного климата она подходит.',
  },
  {
    id: 'g-density', kind: 'glossary',
    words: ['что такое плотност', 'плотность это', 'удельныи вес', 'что значит плотност'],
    reply: 'Плотность (г/см³) — масса материала в единице объёма. От неё зависит расход сырья на изделие: ' +
      'при большей плотности на одну и ту же деталь уйдёт больше килограммов.',
  },
  {
    id: 'g-pvc', kind: 'glossary',
    words: ['что такое пвх', 'что такое пластикат', 'пвх пластикат это', 'из чего пластикат', 'состав пластиката', 'что значит пластикат'],
    reply: 'ПВХ-пластикат — это пластифицированный (мягкий) поливинилхлорид. Гибкий и стойкий материал; ' +
      'применяется для кабельной изоляции и оболочки, обуви, шлангов, профилей, медицинских изделий и др.',
  },
  // ——— Тематические вопросы ———
  {
    id: 'samples', kind: 'faq',
    words: ['образц', 'пробник', 'пробн', 'навеск', 'тестов парти', 'на пробу'],
    reply: 'Бесплатные образцы можно заказать прямо в карточке любой марки: доступны навески 5, 10, 20 и 30 кг. ' +
      'Укажите регион и город доставки — заявку обработает менеджер.',
  },
  {
    id: 'delivery', kind: 'faq',
    words: ['доставк', 'логист', 'привез', 'отгрузк', 'трансп', 'сдэк', 'деловые лини', 'до двери', 'до склада', 'сроки поставк'],
    reply: 'Доставка осуществляется транспортными компаниями по всей России. После формирования заказа менеджер ' +
      'добавит счёт от ТК за доставку, а вы загрузите платёжные документы за товар и за доставку.',
  },
  {
    id: 'pickup', kind: 'faq',
    words: ['самовывоз', 'забрать сам', 'забрать со склад', 'свои транспорт', 'своим ходом'],
    reply: 'Самовывоз со склада возможен — уточните у менеджера адрес и время отгрузки, он подготовит товар к выдаче.',
  },
  {
    id: 'loyalty', kind: 'faq',
    words: ['скидк', 'лояльн', 'оптов', 'дешевл', 'бонус', 'накопит', 'постоянныи клиент'],
    reply: 'Программа лояльности: при объёме закупок от 200 тонн за 2 года — скидка 2%, от 500 тонн — 5%. ' +
      'Скидка действует для всех сотрудников вашей компании автоматически.',
  },
  {
    id: 'price', kind: 'faq',
    words: ['цен', 'стоим', 'праис', 'сколько стоит', 'почем', 'расценк'],
    reply: 'Актуальные цены указаны в карточке каждой марки (за тонну, с НДС). Прайс-лист обновляется раз в 2 недели. ' +
      'Чтобы получить официальное коммерческое предложение — добавьте марки в заказ и оформите КП.',
  },
  {
    id: 'payment', kind: 'faq',
    words: ['оплат', 'счет', 'реквизит', ' кп', 'коммерческ предлож', 'предоплат', 'постоплат', 'отсрочк', 'безнал', 'ндс'],
    reply: 'Оплата работает без онлайн-эквайринга: приложение формирует коммерческое предложение (счёт) с реквизитами ' +
      'и составом заказа. Вы оплачиваете по счёту и загружаете платёжку в заказ.',
  },
  {
    id: 'how-to-order', kind: 'faq',
    words: ['как заказать', 'оформить заказ', 'сделать заказ', 'как купить', 'как оформить', 'как сделать заказ', 'добавить в заказ'],
    reply: 'Чтобы оформить заказ: добавьте нужные марки в заказ из каталога (укажите массу), перейдите к оформлению и ' +
      'укажите регион и город доставки. Менеджер сформирует КП/счёт. Если в течение 72 часов оплата не подтверждена — заказ автоматически отменяется.',
  },
  {
    id: 'min-order', kind: 'faq',
    words: ['минимальн', 'минималка', 'от скольки', 'опт от', 'минимальная парти', 'минимальныи объем'],
    reply: 'Минимальная партия зависит от марки и фасовки — обычно отгрузка идёт тоннами. Точный минимальный объём по ' +
      'конкретной марке уточнит менеджер. Чтобы попробовать материал, можно заказать бесплатный образец (5–30 кг).',
  },
  {
    id: 'tracking', kind: 'faq',
    words: ['отследить', 'статус заказ', 'где заказ', 'где мои заказ', 'когда приедет', 'отслежив', 'этап заказа'],
    reply: 'Статус заказа виден в разделе «Заказы»: НОВЫЙ → СЧЁТ ВЫСТАВЛЕН → ОПЛАЧЕН → ОТГРУЖЕН → ДОСТАВЛЕН. ' +
      'Там же — история событий и все документы по заказу.',
  },
  {
    id: 'account', kind: 'faq',
    words: ['регистрац', 'зарегистр', 'воит в', 'логин', 'личныи кабинет', 'аккаунт', 'забыл пароль', 'смена пароля'],
    reply: 'Чтобы пользоваться приложением, зарегистрируйте компанию (реквизиты: ИНН, КПП, ОГРН, адрес) и войдите по ' +
      'e-mail и паролю. Скидка по программе лояльности применяется ко всем сотрудникам компании автоматически.',
  },
  {
    id: 'certificates', kind: 'faq',
    words: ['сертификат', 'паспорт качеств', 'гост', 'деклараци', 'соответстви', 'документы на товар', 'качество подтверд'],
    reply: 'На каждую марку предоставляются паспорт качества и сертификаты/декларации соответствия (ГОСТ/ТУ). ' +
      'Запросите нужные документы у менеджера — он приложит их к заказу.',
  },
  {
    id: 'packaging', kind: 'faq',
    words: ['фасовк', 'упаковк', 'мешк', 'биг бэг', 'биг-бэг', 'тара', 'паллет', 'в чем поставля', 'вес мешка'],
    reply: 'Пластикат отгружается в виде гранул; фасовка — мешки или биг-бэги на паллетах. ' +
      'Точную фасовку и вес тары по конкретной марке уточнит менеджер.',
  },
  {
    id: 'storage', kind: 'faq',
    words: ['хранен', 'срок годности', 'срок хранения', 'как хранить', 'условия хранения'],
    reply: 'Храните пластикат в сухом крытом помещении, вдали от источников тепла и прямых солнечных лучей. ' +
      'При соблюдении условий гранулят сохраняет свойства длительно; конкретный срок указан в паспорте качества.',
  },
  {
    id: 'complaint', kind: 'faq',
    words: ['рекламац', 'возврат', 'брак', 'некачеств', 'жалоб', 'претенз', 'недостач', 'пересорт'],
    reply: 'Если есть претензия к качеству или недостача — оформите рекламацию (раздел рекламаций) с описанием и фото. ' +
      'Менеджер рассмотрит обращение и предложит решение.',
  },
  {
    id: 'contacts', kind: 'faq',
    words: ['контакт', 'телефон', 'позвонить', 'режим работы', 'график работы', 'часы работы', 'email', 'почт', 'связаться', 'как с вами связ'],
    reply: 'Связаться с менеджером можно прямо здесь — нажмите «Передать вопрос менеджеру». ' +
      'Контактные данные и реквизиты также есть в коммерческом предложении к заказу.',
  },
  {
    id: 'about', kind: 'faq',
    words: ['о компании', 'кто вы', 'производител', 'завод', 'где находит', 'про компани', 'чем занимает'],
    reply: 'ООО ТПК «Полимер-Пласт» — поставщик ПВХ-пластиката для кабельной изоляции и оболочки, обуви, профилей, ' +
      'шлангов, медицины и других применений. Подберу марку под вашу задачу и помогу оформить заказ.',
  },
  {
    id: 'colors', kind: 'faq',
    words: ['какои цвет', 'какие цвета', 'расцветк', 'палитр', 'колеровк', 'цвета есть', 'покрасить', 'окрашен'],
    reply: 'Пластикат выпускается в разных цветах по шкале RAL, а также натуральный/прозрачный. ' +
      'Укажите нужный цвет или код RAL (например, «чёрный» или «RAL 7046») — подберу подходящие марки.',
  },
];

// ── Характеристики: морозостойкость, твёрдость (мягкий/твёрдый или число «шор N»),
//    температура, цвет/RAL ──
const COLOR_WORDS = [
  { word: 'черн', name: 'черн' }, { word: 'белыи', name: 'бел' }, { word: 'бел ', name: 'бел' },
  { word: 'красн', name: 'красн' }, { word: 'син', name: 'син' }, { word: 'голуб', name: 'голуб' },
  { word: 'зелен', name: 'зелен' }, { word: 'серы', name: 'сер' }, { word: 'серо', name: 'сер' },
  { word: 'желт', name: 'желт' }, { word: 'коричнев', name: 'коричнев' }, { word: 'оранжев', name: 'оранжев' },
];

function detectCharacteristic(text) {
  const filters = {};
  if (/мороз|холод|низк|зим|север/.test(text)) filters.frost = true;
  if (/мягк|эластичн|гибк|пластичн/.test(text)) filters.soft = true;
  if (/тверд|жестк|жесткост|упруг/.test(text)) filters.hard = true;

  // явная температура: «-40», «40 c», «до 45 градусов»
  const tempMatch = text.match(/(\d{2})\s?(?:c|град|°)/) || (filters.frost ? text.match(/(\d{2})/) : null);
  if (tempMatch) filters.minColdC = -Number(tempMatch[1]);

  // числовая твёрдость: «шор 70», «твёрдость 80», «70 шор»
  const shoreMatch = text.match(/шор[а-я]*\s*(\d{2})/) || text.match(/(\d{2})\s*шор/) || text.match(/тверд[а-я]*\s*(\d{2})/);
  if (shoreMatch) filters.shoreTarget = Number(shoreMatch[1]);

  // цвет
  const ral = text.match(/ral\s*(\d{3,4})/);
  if (ral) filters.ral = ral[1];
  for (const c of COLOR_WORDS) {
    if (text.includes(c.word)) { filters.color = c.name; break; }
  }
  return filters;
}

function detectTags(text) {
  const found = [];
  for (const { tag, words } of KEYWORD_TO_TAG) {
    if (words.some((w) => text.includes(w))) found.push(tag);
  }
  return [...new Set(found)];
}

function serializeRecs(products) {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    shoreHardnessA: p.shoreHardnessA,
    brittlenessTemp: p.brittlenessTemp,
    colorName: p.colorName,
    pricePerTon: p.prices[0] ? Number(p.prices[0].pricePerTon) : null,
    tags: p.tags.map((t) => t.name),
  }));
}

const RECS_INCLUDE = { tags: true, prices: { where: { isCurrent: true }, take: 1 } };

// «Базовая марка» — название без цвета/RAL/фасовки, чтобы в выдаче не шли подряд
// цветовые варианты одной марки (ПЛ-1 бежевый / белый / чёрный → одна «ПЛ-1»).
const COLOR_STEMS = [
  'полупроз', 'прозрач', 'белосне', 'натур', 'светло', 'темно', 'лимонно', 'без ',
  'серо', 'сер', 'бел', 'бежев', 'черн', 'красн', 'син', 'голуб', 'зелен', 'желт',
  'оранж', 'коричн', 'оливк', 'розов', 'св.сер',
];
function baseGrade(name) {
  const low = name.toLowerCase().replace(/ё/g, 'е');
  let cut = low.length;
  const mark = (i) => { if (i > 0 && i < cut) cut = i; };
  for (const w of COLOR_STEMS) mark(low.indexOf(w));
  for (const w of [' ral', ' rall', ' рал', '(']) mark(low.indexOf(w));
  const dm = low.match(/\b\d{4}\b/);            // 4-значные коды цвета/RAL (7046, 3020…)
  if (dm) mark(low.indexOf(dm[0]));
  let key = low.slice(0, cut).replace(/[\s,.-]+$/, '').trim();
  // Схлопываем модификации одной марки: ПЛ-1/1 → ПЛ-1, ПЛ-1М/Н/Д → ПЛ-1, ОМ-40Н → ОМ-40
  key = key.replace(/\/\d+$/, '').replace(/(\d)[a-zа-я]{1,2}$/, '$1').replace(/[\s.-]+$/, '');
  return key;
}

// Ранжирование кандидатов по релевантности запросу. Ключевая идея: для конкретного
// назначения выше идут СПЕЦИАЛИЗИРОВАННЫЕ под него марки (у которых эта метка —
// основная), а широкие/общего назначения опускаются ниже. Детерминированно
// (стабильная сортировка по id), чтобы для разных задач выдавались разные марки.
function rankCandidates(products, tags, ch) {
  const want = new Set(tags);
  const scored = products.map((p) => {
    const slugs = (p.tags || []).map((t) => t.slug);
    let score = 0;
    if (want.size) {
      const matched = slugs.filter((s) => want.has(s)).length;
      const specificity = slugs.length ? matched / slugs.length : 0; // насколько марка «заточена» под задачу
      score += matched * 1000 + Math.round(specificity * 200);
      if (slugs.includes('general')) score -= 60; // широкие — ниже специализированных
      score -= slugs.length;                       // меньше «лишних» меток — выше
    }
    // близость к характеристикам (мороз/твёрдость) как вторичный сигнал
    if (ch.shoreTarget != null && p.shoreHardnessA != null) score -= Math.abs(p.shoreHardnessA - ch.shoreTarget);
    if ((ch.frost || ch.minColdC != null) && p.brittlenessTemp != null) score -= (p.brittlenessTemp + 50); // холоднее → выше
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score || a.p.id - b.p.id);
  return scored.map((x) => x.p);
}

async function recommendProducts(tags, ch, limit = 4) {
  const where = { isActive: true };
  if (tags.length) where.tags = { some: { slug: { in: tags } } };
  if (ch.frost || ch.minColdC != null) where.brittlenessTemp = { lte: ch.minColdC ?? -50 };
  if (ch.shoreTarget != null) where.shoreHardnessA = { gte: ch.shoreTarget - 5, lte: ch.shoreTarget + 5 };
  else if (ch.soft) where.shoreHardnessA = { lte: 70 };
  else if (ch.hard) where.shoreHardnessA = { gte: 80 };
  if (ch.color) where.colorName = { contains: ch.color, mode: 'insensitive' };
  if (ch.ral) where.colorRal = { contains: ch.ral };

  // Берём всех подходящих кандидатов (каталог небольшой) и ранжируем в памяти.
  let products = await prisma.product.findMany({ where, include: RECS_INCLUDE });

  // Если по строгим фильтрам пусто — ослабляем: сначала до меток, затем до характеристики
  if (products.length === 0 && tags.length) {
    products = await prisma.product.findMany({
      where: { isActive: true, tags: { some: { slug: { in: tags } } } },
      include: RECS_INCLUDE,
    });
  }
  if (products.length === 0 && (ch.frost || ch.minColdC != null)) {
    products = await prisma.product.findMany({
      where: { isActive: true, brittlenessTemp: { lte: ch.minColdC ?? -50 } },
      include: RECS_INCLUDE,
    });
  }
  // Дедуп по базовой марке: показываем РАЗНЫЕ марки, а не цвета одной и той же.
  const out = [];
  const seen = new Set();
  for (const p of rankCandidates(products, tags, ch)) {
    const key = baseGrade(p.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= limit) break;
  }
  return serializeRecs(out);
}

// Варианты разделителя между буквами и цифрами марки. В БД встречается и дефис
// («ПЛ-1», «FHP-60»), и пробел («Iplex 55», «Politex 65»), и слитно — поэтому из
// токена «пл1» / «пл 1» / «пл-1» собираем все формы, чтобы contains нашёл нужную.
function gradeVariants(token) {
  const t = token.trim();
  const set = new Set([t, t.replace(/[-\s]+/g, '')]);
  const m = t.match(/^([a-zа-яё]+)[-\s]*(\d.*)$/i);
  if (m) { set.add(`${m[1]}-${m[2]}`); set.add(`${m[1]} ${m[2]}`); }
  return [...set].filter((s) => s.length >= 2);
}

// Поиск марки по названию/артикулу (для запросов вида «есть ли Teplast 55?», «марка ПЛ-1»).
// Важно: искать короткие марки («ПЛ-1», «О-40») именно с цифрой/разделителем — подстрока
// «пл»/«о» есть в каждом «Пластикат…» и сама по себе бесполезна.
async function findProductsByName(text, rawText) {
  const src = rawText || text || '';
  const cands = new Set();
  // марки с цифрой: «ПЛ-1», «И-40-13», «FHP-60», «Iplex 55», «пл1»
  for (const m of src.matchAll(/[a-zа-яё]{1,12}(?:[-\s]?\d{1,4}){1,3}[а-яёa-z]{0,2}/giu)) cands.add(m[0].trim());
  // бренд + короткий буквенный суффикс: «Politex PLP», «Politex L», «Iplex Т», «Teplast PLP»
  for (const m of src.matchAll(/[a-z]{4,}\s+[a-zа-яё]{1,4}(?![a-zа-яё])/giu)) cands.add(m[0].trim());
  // латинские слова — бренды и суффиксы: «Teplast», «Politex», «PLP»
  for (const m of src.matchAll(/[a-z]{3,}/gi)) cands.add(m[0].trim());
  if (!cands.size) return [];

  // более длинные/специфичные кандидаты — первыми
  const ordered = [...cands].sort((a, b) => b.length - a.length);
  for (const cand of ordered) {
    const vs = gradeVariants(cand);
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          ...vs.map((v) => ({ name: { contains: v, mode: 'insensitive' } })),
          ...vs.map((v) => ({ externalCode: { contains: v } })),
        ],
      },
      include: RECS_INCLUDE, take: 6, orderBy: { id: 'asc' },
    });
    if (products.length) return serializeRecs(products);
  }
  return [];
}

// Поиск по каталогу для RAG-инструмента LLM: свободный текст → метки/характеристики →
// подбор, с откатом на поиск по названию. Возвращает те же сериализованные карточки.
export async function searchProductsByText(query, limit = 5) {
  const raw = String(query || '').trim();
  const text = normalize(raw);
  if (!text) return [];
  // 1) явное упоминание марки/артикула — высший приоритет (точнее подбора)
  const byName = await findProductsByName(text, raw);
  if (byName.length) return byName.slice(0, limit);
  // 2) подбор по назначению/характеристикам
  const tags = detectTags(text);
  const ch = detectCharacteristic(text);
  if (tags.length || Object.keys(ch).length) return recommendProducts(tags, ch, limit);
  return [];
}

function describeTags(tags) {
  const map = {
    'cable-insulation': 'изоляции кабеля',
    'cable-sheath': 'кабельной оболочки',
    footwear: 'производства обуви',
    profiles: 'профильно-погонажных изделий',
    hoses: 'шлангов и трубок',
    medical: 'медицинских изделий',
    'frost-resistant': 'эксплуатации на морозе',
    'non-flammable': 'изделий пониженной горючести',
    'acid-alkali': 'агрессивных (кислото-щёлочных) сред',
    transparent: 'прозрачных изделий',
    injection: 'литья под давлением',
    'stretch-ceiling': 'натяжных потолков',
    'food-grade': 'пищевой промышленности (контакт с продуктами)',
  };
  return tags.map((t) => map[t] || 'вашей задачи').join(' / ');
}

function recommendReply(tags, ch, recs) {
  const names = recs
    .map((r) => `• ${r.name}${r.pricePerTon ? ` — ${r.pricePerTon.toLocaleString('ru-RU')} ₽/т` : ''}`)
    .join('\n');
  let purpose = tags.length ? describeTags(tags) : 'вашей задачи';
  const extra = [];
  if (ch.frost || ch.minColdC != null) extra.push('морозостойкие');
  if (ch.shoreTarget != null) extra.push(`с твёрдостью около ${ch.shoreTarget} ед. Шор A`);
  else if (ch.soft) extra.push('мягкие');
  else if (ch.hard) extra.push('жёсткие');
  if (ch.color) extra.push('нужного цвета');
  const extraStr = extra.length ? ` (${extra.join(', ')})` : '';
  return `Для ${purpose}${extraStr} рекомендую обратить внимание на марки:\n${names}\n\n` +
    'Откройте карточку, чтобы увидеть характеристики (Шор, температуру хрупкости, ПТР) и заказать образцы.';
}

// ── Главная функция: ответ бота на сообщение пользователя ──
export async function botReply(message) {
  const raw = (message || '').trim();
  const text = normalize(raw);
  if (!text) {
    return { reply: 'Опишите, пожалуйста, вашу задачу — подберу подходящую марку пластиката.', recommendations: [], escalate: false, intent: 'empty' };
  }

  // 1. Лучшие совпадения по базе знаний (отдельно: глоссарий, темы, соц.)
  let glossaryBest = null, faqBest = null, socialBest = null;
  for (const it of KB) {
    const s = score(text, it.words);
    if (s === 0) continue;
    if (it.kind === 'glossary') { if (!glossaryBest || s > glossaryBest.s) glossaryBest = { it, s }; }
    else if (it.kind === 'social') { if (!socialBest || s > socialBest.s) socialBest = { it, s }; }
    else { if (!faqBest || s > faqBest.s) faqBest = { it, s }; }
  }

  // 2. Сигналы подбора по товару
  const tags = detectTags(text);
  const ch = detectCharacteristic(text);
  const recommendScore = tags.length * 2 + Object.keys(ch).length * 2;

  // A. Определения терминов — высший приоритет (вопрос «что такое…» не должен превращаться в подбор)
  if (glossaryBest) {
    return { reply: glossaryBest.it.reply, recommendations: [], escalate: false, intent: 'glossary' };
  }

  // B. Подбор по товару, если сигнал сильнее тематического вопроса
  if (recommendScore > 0 && recommendScore >= (faqBest?.s ?? 0)) {
    const recs = await recommendProducts(tags, ch);
    if (recs.length) {
      return { reply: recommendReply(tags, ch, recs), recommendations: recs, escalate: false, intent: 'recommend' };
    }
  }

  // C. Тематический вопрос (FAQ / возможности)
  if (faqBest) {
    return { reply: faqBest.it.reply, recommendations: [], escalate: false, intent: 'faq' };
  }

  // D. Подбор по товару (если сигнал был, но шаг B не сработал)
  if (recommendScore > 0) {
    const recs = await recommendProducts(tags, ch);
    if (recs.length) {
      return { reply: recommendReply(tags, ch, recs), recommendations: recs, escalate: false, intent: 'recommend' };
    }
  }

  // E. Поиск марки по названию/артикулу
  const byName = await findProductsByName(text, raw);
  if (byName.length) {
    const names = byName.map((r) => `• ${r.name}${r.pricePerTon ? ` — ${r.pricePerTon.toLocaleString('ru-RU')} ₽/т` : ''}`).join('\n');
    return { reply: `Нашёл по вашему запросу:\n${names}\n\nОткройте карточку для характеристик и заказа образца.`, recommendations: byName, escalate: false, intent: 'product-search' };
  }

  // F. Социальные (привет/спасибо) — если ничего содержательного не нашли
  if (socialBest) {
    return { reply: socialBest.it.reply, recommendations: [], escalate: false, intent: socialBest.it.id };
  }

  // G. Умный fallback: пытаемся извлечь хоть какой-то сигнал и мягко уточняем
  const hasNumber = /\d{2}/.test(text);
  let hint = 'Уточните, пожалуйста, назначение (изоляция, оболочка, обувь, профили, шланги, медицина) ' +
    'или характеристику (морозостойкость, твёрдость по Шору, цвет).';
  if (hasNumber) {
    hint = 'Вижу в запросе число — это твёрдость по Шору A или температура эксплуатации? ' +
      'Например: «шор 75» или «морозостойкий до -45».';
  }
  return {
    reply: `Не уверен, что правильно понял запрос. ${hint}\n\nМогу подобрать марку, рассказать про образцы, цены, ` +
      'доставку и оплату, объяснить характеристики. Если вопрос сложный — передам его менеджеру.',
    recommendations: [],
    escalate: true,
    intent: 'fallback',
  };
}
