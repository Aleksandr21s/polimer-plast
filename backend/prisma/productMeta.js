// Вывод технических характеристик и меток применения марки пластиката по её названию.
// Характеристики (RAL, твёрдость по Шору, температура хрупкости, ПТР, плотность)
// генерируются детерминированно (по хэшу имени), чтобы при повторном импорте значения не менялись.

// ── Метки применения сырья ──────────────────────────────────────────────
export const APPLICATION_TAGS = [
  { slug: 'cable-insulation', name: 'Кабельная изоляция', color: '#1f6feb' },
  { slug: 'cable-sheath', name: 'Кабельная оболочка', color: '#388bfd' },
  { slug: 'footwear', name: 'Обувь', color: '#a371f7' },
  { slug: 'profiles', name: 'Профильно-погонажные изделия', color: '#db6d28' },
  { slug: 'hoses', name: 'Шланги и трубки', color: '#2da44e' },
  { slug: 'medical', name: 'Медицина', color: '#cf222e' },
  { slug: 'frost-resistant', name: 'Морозостойкое', color: '#0aa2c0' },
  { slug: 'non-flammable', name: 'Пониженной горючести (НГ)', color: '#bf3989' },
  { slug: 'acid-alkali', name: 'Кислото-щёлочестойкое (КЩС)', color: '#6e7781' },
  { slug: 'transparent', name: 'Прозрачные изделия', color: '#9a6700' },
  { slug: 'injection', name: 'Литьё под давлением', color: '#8250df' },
  { slug: 'general', name: 'Общего назначения', color: '#57606a' },
];

// ── Цвета по RAL, встречающиеся в номенклатуре ─────────────────────────
const RAL_MAP = {
  '7046': { name: 'серый (тёмно-серый)', hex: '#7e8182' },
  '7035': { name: 'светло-серый', hex: '#d7d7d7' },
  '3020': { name: 'красный', hex: '#cc2c24' },
  '1026': { name: 'жёлтый люминесцентный', hex: '#ffea00' },
  '1012': { name: 'лимонно-жёлтый', hex: '#dab200' },
  '1023': { name: 'жёлтый транспортный', hex: '#f8b500' },
  '1018': { name: 'цинково-жёлтый', hex: '#fac40e' },
  '2008': { name: 'оранжевый', hex: '#ed6b21' },
};

// ── Цвета по словесному описанию ───────────────────────────────────────
const COLOR_WORDS = [
  ['полупрозрачный', '#e8f4f8'],
  ['прозрачный', '#eaf6fb'],
  ['белоснежный', '#ffffff'],
  ['св.серый', '#cccccc'],
  ['светло-серый', '#cccccc'],
  ['темно-серый', '#4d4d4d'],
  ['тёмно-серый', '#4d4d4d'],
  ['серо-оливковый', '#6b6f4a'],
  ['серый', '#808080'],
  ['черный', '#1a1a1a'],
  ['чёрный', '#1a1a1a'],
  ['белый', '#f2f2f2'],
  ['красный', '#c0392b'],
  ['оранжевый', '#e67e22'],
  ['желтый', '#f1c40f'],
  ['жёлтый', '#f1c40f'],
];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Детерминированное значение в диапазоне [min, max] по соли
function det(name, salt, min, max) {
  const h = hashStr(name + '|' + salt);
  return min + (h % (max - min + 1));
}

export function deriveMeta(name) {
  const low = name.toLowerCase();
  const h = hashStr(name);

  // ── Цвет ──
  let colorRal = null;
  let colorName = null;
  let colorHex = '#9aa0a6';
  const ralMatch = name.match(/\b(\d{4})\b/);
  if (ralMatch && RAL_MAP[ralMatch[1]]) {
    colorRal = 'RAL ' + ralMatch[1];
    colorName = RAL_MAP[ralMatch[1]].name;
    colorHex = RAL_MAP[ralMatch[1]].hex;
  }
  for (const [word, hex] of COLOR_WORDS) {
    if (low.includes(word)) {
      if (!colorName) colorName = word;
      if (colorHex === '#9aa0a6') colorHex = hex;
      break;
    }
  }
  if (ralMatch && !colorRal) colorRal = 'RAL ' + ralMatch[1];

  // ── Применение / метки ──
  const tags = new Set();
  if (low.includes('кщс')) tags.add('acid-alkali');
  if (/\bнг\b/i.test(name) || low.includes(' нг ') || low.endsWith(' нг')) tags.add('non-flammable');
  if (/politex l\b/i.test(name) || low.includes('морозост')) tags.add('frost-resistant');
  if (low.includes('прозрач')) tags.add('transparent');

  // По сериям: O-plex/PLP/PL — оболочка; Iplex/Teplast/Politex базовые — изоляция
  if (/o-?plex/i.test(name) || /\bplp\b/i.test(name) || /\bpl\b/i.test(name)) tags.add('cable-sheath');
  if (/iplex|teplast|teplex|politex/i.test(name)) tags.add('cable-insulation');

  // Высокие индексы (120М/150М/160М) — литьё/профиль
  const grade = name.match(/\b(\d{2,3})\s*М/i);
  if (grade && parseInt(grade[1], 10) >= 100) {
    tags.add('injection');
    tags.add('profiles');
  }

  // Мягкие марки (50–55) — обувь и шланги (демонстрация меток применения)
  const seriesNum = name.match(/\b(5\d|6\d|7\d)\b/);
  const sn = seriesNum ? parseInt(seriesNum[1], 10) : null;
  if (sn !== null && sn <= 55) {
    tags.add('footwear');
    tags.add('hoses');
  }
  if (sn !== null && sn >= 50 && sn <= 60) tags.add('profiles');

  // Прозрачные/полупрозрачные — частый материал для медицинских трубок
  if (low.includes('прозрач')) {
    tags.add('medical');
    tags.add('hoses');
  }

  if (tags.size === 0) tags.add('general');
  if (tags.size === 1 && tags.has('general')) tags.add('cable-insulation');

  // ── Технические характеристики (детерминированные, реалистичные) ──
  // Твёрдость по Шору А: морозостойкие и оболочечные мягче, профиль/литьё твёрже
  let shore = sn !== null && sn >= 50 && sn <= 99 ? sn + det(name, 'sh', 10, 22) : det(name, 'sh', 65, 92);
  shore = Math.max(58, Math.min(95, shore));

  // Температура хрупкости, °C: морозостойкие холоднее
  let brittle = -(det(name, 'br', 40, 50));
  if (tags.has('frost-resistant')) brittle = -(det(name, 'br', 55, 65));

  // ПТР (показатель текучести расплава), г/10 мин
  const mfr = (det(name, 'mfr', 20, 130) / 10).toFixed(1);

  // Плотность, г/см³
  const density = (1.2 + det(name, 'den', 0, 220) / 1000).toFixed(3);

  return {
    colorName,
    colorRal,
    colorHex,
    shoreHardnessA: shore,
    brittlenessTemp: brittle,
    meltFlowIndex: Number(mfr),
    density: Number(density),
    tags: [...tags],
  };
}

// Реалистичная цена за тонну (руб) — детерминированно, т.к. в выгрузке цена-заглушка 140.
export function derivePricePerTon(name, meta) {
  let base = 105000 + det(name, 'price', 0, 60000); // 105 000 – 165 000
  if (meta.tags.includes('frost-resistant')) base += 12000;
  if (meta.tags.includes('non-flammable')) base += 15000;
  if (meta.tags.includes('acid-alkali')) base += 18000;
  if (meta.tags.includes('transparent')) base += 9000;
  if (meta.tags.includes('medical')) base += 14000;
  // округление до 500 руб
  return Math.round(base / 500) * 500;
}
