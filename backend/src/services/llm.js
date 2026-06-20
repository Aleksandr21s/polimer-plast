import { config } from '../config/env.js';
import { searchProductsByText } from './chatbot.js';

// Локальная LLM (Ollama) поверх правилового бота. Классический RAG: сначала
// детерминированно ищем марки в каталоге по сообщению пользователя
// (searchProductsByText), затем кладём найденное в контекст модели — она отвечает
// строго по этим данным и не выдумывает марки/цены. Форма ответа совпадает с botReply:
// { reply, recommendations, escalate, intent, engineUsed }.

const SYSTEM_PROMPT = `Ты — виртуальный помощник компании ООО ТПК «Полимер-Пласт», поставщика ПВХ-пластиката (пластифицированного поливинилхлорида) для B2B-клиентов.

ВАЖНО: пиши ответы СТРОГО на русском языке. Категорически не используй китайские или любые другие иероглифы, не вставляй слова на английском или иных языках. Только русский.

Правила общения:
- Отвечай всегда на русском языке, вежливо, по делу и кратко (обычно 2–5 предложений). Начинай сразу с сути, без вводных слов и междометий.
- Ниже к запросу может прилагаться блок «Найденные в каталоге марки». Если он есть — отвечай ТОЛЬКО по этим данным (названия, твёрдость по Шору A, температура хрупкости, цвет, цена) и обязательно перечисли подходящие марки. НЕ утверждай, что марки нет, если она присутствует в этом блоке.
- Если блока с марками нет, а спрашивали про конкретную марку — честно скажи, что такой марки в каталоге нет, и предложи уточнить название или подобрать аналог. Общие вопросы (определения, образцы, доставка, оплата, лояльность) отвечай по справке ниже.
- Никогда не придумывай названия марок, числа и цены. Точные сроки, фасовку, минимальную партию и наличие предлагай уточнить у менеджера.

Справка о компании (можешь использовать в ответах):
- Применение пластиката: изоляция и оболочка кабеля, обувь, профильно-погонажные изделия, шланги и трубки, медицинские изделия, морозостойкие и негорючие исполнения, кислото-щёлочестойкие (КЩС).
- Бесплатные образцы: навески 5, 10, 20 и 30 кг, заказываются в карточке марки.
- Программа лояльности: от 200 тонн закупок за 2 года — скидка 2%, от 500 тонн — 5%; действует на всю компанию.
- Оформление заказа: добавить марки в заказ → менеджер формирует КП/счёт → оплата по счёту. Если оплата не подтверждена за 72 часа — заказ автоматически отменяется.
- Цены указываются за тонну, с НДС; обновляются раз в 2 недели.
- Доставка транспортными компаниями по всей России; возможен самовывоз.`;

// Признак «модель съехала на иероглифы» (CJK) — для страховки качества ответа.
const hasCJK = (s) => /[㐀-鿿豈-﫿]/.test(s || '');

// Компактное представление марки для передачи модели в ответе инструмента.
function shapeForModel(r) {
  return {
    name: r.name,
    shoreA: r.shoreHardnessA,
    brittlenessTempC: r.brittlenessTemp,
    color: r.colorName,
    pricePerTon: r.pricePerTon,
    applications: r.tags,
  };
}

async function ollamaFetch(path, body, timeoutMs = 60000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(config.ollamaUrl + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Доступна ли Ollama сейчас (для индикатора в интерфейсе). Кэшируем на 15 секунд.
let availabilityCache = { value: false, at: 0 };
export async function isOllamaAvailable() {
  const now = Date.now();
  if (now - availabilityCache.at < 15000) return availabilityCache.value;
  let value = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      // считаем доступной, если нужная модель скачана
      const models = (data.models || []).map((m) => m.name || m.model || '');
      value = models.some((n) => n.startsWith(config.ollamaModel.split(':')[0]));
    }
  } catch {
    value = false;
  }
  availabilityCache = { value, at: now };
  return value;
}

// Лёгкая чистка ответа: убираем служебные артефакты и мусорные вводные токены,
// которыми модель иногда начинает реплику («ᐈ», маркеры, «Почемучто»).
function cleanReply(s) {
  return (s || '')
    .replace(/^[\s>•ᐈ*`-]+/, '')
    .replace(/^Почемучто[,:\s]*/i, '')
    .trim();
}

// Основной вызов LLM: RAG (retrieve-then-generate) по каталогу.
export async function llmReply(message) {
  // 1) Детерминированно ищем марки в каталоге по запросу пользователя.
  const recs = await searchProductsByText(message, 6);

  // 2) Контекст: системный промпт + найденные марки (если есть) + вопрос.
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (recs.length) {
    messages.push({
      role: 'system',
      content: 'Найденные в каталоге марки по запросу пользователя (отвечай ТОЛЬКО по ним, '
        + 'не выдумывай другие марки и цифры):\n' + JSON.stringify(recs.map(shapeForModel)),
    });
  }
  messages.push({ role: 'user', content: message });

  // 3) Генерация. До 2 попыток — на случай «съезда» на иероглифы.
  for (let step = 0; step < 2; step++) {
    const data = await ollamaFetch('/api/chat', {
      model: config.ollamaModel,
      messages,
      stream: false,
      options: { temperature: 0.2 },
    });
    const reply = cleanReply(data.message?.content || '');
    if (reply && hasCJK(reply) && step < 1) {
      messages.push(data.message);
      messages.push({ role: 'user', content: 'Перепиши свой ответ полностью на русском языке, без иероглифов и иностранных слов.' });
      continue;
    }
    if (reply) {
      return { reply, recommendations: recs, escalate: false, intent: 'llm', engineUsed: 'ollama' };
    }
    break;
  }

  // Модель не дала текста — мягкий ответ (карточки уже подобраны, если что-то нашлось).
  return {
    reply: recs.length
      ? 'Подобрал по вашему запросу несколько марок — посмотрите карточки ниже.'
      : 'Уточните, пожалуйста, задачу — назначение или нужные характеристики материала.',
    recommendations: recs,
    escalate: recs.length === 0,
    intent: 'llm',
    engineUsed: 'ollama',
  };
}
