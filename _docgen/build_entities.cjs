const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign,
} = require("docx");

const PAGE_W = 11906;
const M_LEFT = 1701, M_RIGHT = 850, M_TOP = 1134, M_BOTTOM = 1134;

const BD = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDERS = { top: BD, bottom: BD, left: BD, right: BD, insideHorizontal: BD, insideVertical: BD };
const CELL_BD = { top: BD, bottom: BD, left: BD, right: BD };
const CELL_M = { top: 40, bottom: 40, left: 90, right: 90 };

function cell(text, width, bold = false) {
  const lines = String(text).split("\n");
  return new TableCell({
    borders: CELL_BD, width: { size: width, type: WidthType.DXA }, margins: CELL_M,
    verticalAlign: VerticalAlign.CENTER,
    children: lines.map((ln) => new Paragraph({ children: [new TextRun({ text: ln, bold })] })),
  });
}
function fieldTable(rows) {
  const widths = [2150, 2050, 2150, 3005];
  const head = new TableRow({ tableHeader: true,
    children: ["Поле", "Тип", "Ключ / ограничения", "Описание"].map((h, i) => cell(h, widths[i], true)) });
  const body = rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, widths[i])) }));
  return new Table({ width: { size: 9355, type: WidthType.DXA }, columnWidths: widths, borders: BORDERS, rows: [head, ...body] });
}
function h1(text) {
  return new Paragraph({ spacing: { before: 240, after: 160 }, keepNext: true,
    children: [new TextRun({ text, bold: true, size: 32, color: "000000" })] });
}
function h2(text) {
  return new Paragraph({ spacing: { before: 220, after: 100 }, keepNext: true,
    children: [new TextRun({ text, bold: true, size: 28, color: "000000" })] });
}
function p(text, opts = {}) {
  return new Paragraph({ spacing: { after: opts.after ?? 120, line: 276 }, alignment: opts.align,
    children: [new TextRun({ text, italics: opts.italics })] });
}
// Описание под таблицей: ведущее слово курсивом + текст
function desc(text) {
  return new Paragraph({ spacing: { before: 80, after: 200, line: 276 },
    children: [ new TextRun({ text: "Описание. ", italics: true }), new TextRun({ text }) ] });
}

const children = [];

children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
  children: [new TextRun({ text: "Описание сущностей базы данных", bold: true, size: 34 })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text: "Мобильное B2B-приложение ООО ТПК «Полимер-Пласт» · PostgreSQL 17 · Prisma", size: 28 })] }));
children.push(p("По каждой сущности приведены таблица полей (поле, тип, ключ или ограничение, описание поля) и общее описание назначения сущности и её связей.", { after: 200 }));

// helper для одной сущности
function entity(title, rows, description) {
  children.push(h2(title));
  children.push(fieldTable(rows));
  children.push(desc(description));
}

children.push(h1("Сущности"));

entity("1. Company — компания-клиент", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["name", "TEXT", "индекс", "Наименование организации"],
  ["orgForm", "ENUM OrgForm", "default OOO", "Организационная форма (ООО/ИП)"],
  ["inn", "TEXT", "UNIQUE, NULL", "ИНН"],
  ["kpp", "TEXT", "NULL", "КПП"],
  ["ogrn", "TEXT", "NULL", "ОГРН"],
  ["legalAddress", "TEXT", "NULL", "Юридический адрес"],
  ["bankName", "TEXT", "NULL", "Наименование банка"],
  ["bankBik", "TEXT", "NULL", "БИК банка"],
  ["bankAccount", "TEXT", "NULL", "Расчётный счёт"],
  ["corrAccount", "TEXT", "NULL", "Корреспондентский счёт"],
  ["discountPercent", "DECIMAL(5,2)", "default 0", "Текущая скидка лояльности, % (кэш)"],
  ["createdAt", "TIMESTAMP", "default now()", "Дата создания"],
  ["updatedAt", "TIMESTAMP", "авто", "Дата изменения"],
], "Хранит юридическое лицо — покупателя пластиката. Создаётся отдельно от пользователя: при регистрации компания ищется по ИНН и переиспользуется, если уже существует, иначе создаётся новая. К одной компании относятся несколько пользователей-сотрудников, её заказы и заявки на образцы. Поле discountPercent — кэш текущей скидки по программе лояльности; пересчитывается после оплаты и завершения заказов и распространяется на всех сотрудников компании. Банковские реквизиты используются при формировании КП и счёта.");

entity("2. User — пользователь приложения", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["email", "TEXT", "UNIQUE", "E-mail (логин)"],
  ["passwordHash", "TEXT", "—", "Хэш пароля (bcrypt)"],
  ["firstName", "TEXT", "—", "Имя"],
  ["lastName", "TEXT", "—", "Фамилия"],
  ["middleName", "TEXT", "NULL", "Отчество"],
  ["position", "TEXT", "NULL", "Должность"],
  ["phone", "TEXT", "NULL", "Телефон"],
  ["role", "ENUM Role", "default CLIENT", "Роль пользователя"],
  ["companyId", "INTEGER", "FK → Company, NULL", "Компания пользователя"],
  ["createdAt", "TIMESTAMP", "default now()", "Дата создания"],
  ["updatedAt", "TIMESTAMP", "авто", "Дата изменения"],
], "Учётная запись сотрудника, принадлежащая компании (поле companyId). Роль (role) определяет права: CLIENT — клиент, MANAGER — менеджер ООО ТПК «Полимер-Пласт». Пароль хранится только в виде bcrypt-хэша. Пользователь выступает автором заказов, загруженных документов, изменений статусов, заявок на образцы, сообщений чата и рекламаций — на эти сущности он ссылается как создатель.");

entity("3. Category — раздел каталога", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["name", "TEXT", "—", "Название раздела"],
  ["slug", "TEXT", "UNIQUE", "Машинное имя"],
  ["parentId", "INTEGER", "FK → Category, NULL", "Родительский раздел"],
], "Иерархический справочник разделов каталога. Поле parentId ссылается на эту же таблицу (самосвязь), образуя дерево произвольной вложенности: parentId = NULL — раздел верхнего уровня, иначе — подраздел внутри родителя. В текущих данных задействован слабо: каталог в основном строится по меткам применения, а поле categoryId у товара необязательно. Сущность заложена как задел на структурированный каталог.");

entity("4. ApplicationTag — метка применения", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["name", "TEXT", "UNIQUE", "Название метки (напр. «Обувь»)"],
  ["slug", "TEXT", "UNIQUE", "Машинное имя"],
  ["color", "TEXT", "default #1f6feb", "Цвет чипа в интерфейсе"],
  ["icon", "TEXT", "NULL", "Имя иконки"],
], "Справочник меток применения сырья (например: Обувь, Кабельная изоляция, Медицина). Связь с товарами — многие-ко-многим (через служебную таблицу связей). Метки — основной способ навигации и фильтрации в каталоге; поле color задаёт цвет чипа метки в интерфейсе приложения.");

entity("5. Product — марка пластиката (товар)", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["externalCode", "TEXT", "UNIQUE, NULL", "Внешний код / артикул"],
  ["name", "TEXT", "индекс", "Название марки"],
  ["slug", "TEXT", "UNIQUE", "Машинное имя"],
  ["description", "TEXT", "NULL", "Описание"],
  ["unit", "TEXT", "default «тонна»", "Единица измерения"],
  ["isActive", "BOOLEAN", "default true", "Активность в каталоге"],
  ["colorName", "TEXT", "NULL", "Цвет (словесно)"],
  ["colorRal", "TEXT", "NULL", "Цвет по RAL"],
  ["colorHex", "TEXT", "NULL", "HEX-код образца цвета"],
  ["shoreHardnessA", "INTEGER", "NULL", "Твёрдость по Шору, шкала A"],
  ["brittlenessTemp", "INTEGER", "NULL", "Температура хрупкости, °C"],
  ["meltFlowIndex", "DECIMAL(6,2)", "NULL", "ПТР, г/10 мин"],
  ["density", "DECIMAL(5,3)", "NULL", "Плотность, г/см³"],
  ["categoryId", "INTEGER", "FK → Category, NULL", "Раздел каталога"],
  ["createdAt", "TIMESTAMP", "default now()", "Дата создания"],
  ["updatedAt", "TIMESTAMP", "авто", "Дата изменения"],
], "Карточка товара каталога — марки ПВХ-пластиката. Хранит название, артикул (externalCode), описание, единицу измерения и технические характеристики: цвет и RAL, твёрдость по Шору, температуру хрупкости, ПТР и плотность. Цена вынесена в отдельную таблицу Price (для ведения истории цен). Товар связан с метками применения (многие-ко-многим), ценами, позициями заказов и заявками на образцы. Флаг isActive позволяет скрыть товар из каталога без удаления.");

entity("6. PriceUpdate — партия обновления цен", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["comment", "TEXT", "NULL", "Комментарий к обновлению"],
  ["effectiveAt", "TIMESTAMP", "default now()", "Дата вступления в силу"],
  ["createdById", "INTEGER", "NULL", "Идентификатор автора (менеджера)"],
  ["createdAt", "TIMESTAMP", "default now()", "Дата создания записи"],
], "Одна процедура загрузки нового прайс-листа (по регламенту — примерно раз в две недели). Группирует набор новых цен, хранит комментарий и дату вступления в силу. Позволяет вести историю обновлений и понимать, какие цены пришли одной партией. С таблицей Price связана как один-ко-многим.");

entity("7. Price — цена марки", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["productId", "INTEGER", "FK → Product, Cascade", "Товар"],
  ["pricePerTon", "DECIMAL(12,2)", "—", "Цена за тонну"],
  ["currency", "TEXT", "default RUB", "Валюта"],
  ["vatRate", "INTEGER", "default 22", "Ставка НДС, %"],
  ["vatIncluded", "BOOLEAN", "default true", "НДС включён в цену"],
  ["effectiveFrom", "TIMESTAMP", "default now()", "Дата начала действия"],
  ["isCurrent", "BOOLEAN", "default true", "Признак текущей цены"],
  ["priceUpdateId", "INTEGER", "FK → PriceUpdate, NULL", "Партия обновления"],
], "Цена товара за тонну на момент действия прайс-листа. При обновлении прежняя цена помечается как неактуальная (isCurrent = false), а новая добавляется как текущая (isCurrent = true) — так сохраняется история цен. Поля vatRate и vatIncluded задают параметры НДС. Запись удаляется каскадно вместе с товаром. Индекс (productId, isCurrent) ускоряет выбор текущей цены товара.");

entity("8. Order — заказ (КП / счёт)", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["number", "TEXT", "UNIQUE", "Человекочитаемый номер"],
  ["status", "ENUM OrderStatus", "default NEW", "Статус заказа"],
  ["companyId", "INTEGER", "FK → Company, индекс", "Компания-заказчик"],
  ["createdById", "INTEGER", "FK → User", "Кто оформил заказ"],
  ["deliveryRegion", "TEXT", "—", "Регион доставки"],
  ["deliveryCity", "TEXT", "NULL", "Город доставки"],
  ["comment", "TEXT", "NULL", "Комментарий"],
  ["totalWeightKg", "DECIMAL(12,2)", "default 0", "Суммарный вес, кг"],
  ["subtotal", "DECIMAL(14,2)", "default 0", "Сумма без скидки и НДС"],
  ["discountPercent", "DECIMAL(5,2)", "default 0", "Скидка, %"],
  ["discountAmount", "DECIMAL(14,2)", "default 0", "Сумма скидки"],
  ["vatRate", "INTEGER", "default 22", "Ставка НДС, %"],
  ["vatAmount", "DECIMAL(14,2)", "default 0", "Сумма НДС"],
  ["total", "DECIMAL(14,2)", "default 0", "Итого с НДС и скидкой"],
  ["invoiceIssuedAt", "TIMESTAMP", "NULL", "Когда выставлен счёт"],
  ["autoCancelAt", "TIMESTAMP", "NULL", "Срок автоотмены (72 ч)"],
  ["paidAt", "TIMESTAMP", "NULL", "Когда оплачен"],
  ["cancelledAt", "TIMESTAMP", "NULL", "Когда отменён"],
  ["cancelReason", "TEXT", "NULL", "Причина отмены"],
  ["createdAt", "TIMESTAMP", "default now()", "Дата создания"],
  ["updatedAt", "TIMESTAMP", "авто", "Дата изменения"],
], "Центральная транзакционная сущность. Создаётся клиентом как заявка (статус NEW) и проходит цикл статусов: выставлен счёт → оплачен → отгружен → доставлен → завершён (либо отменён). Денежные итоги (вес, подытог, скидка, НДС, итого) фиксируются снимком на момент формирования КП. Поле autoCancelAt задаёт 72-часовое окно на оплату; по его истечении заказ автоматически отменяется планировщиком (cron). Заказ связан с позициями, документами, историей статусов и рекламациями; индексы по companyId и status ускоряют выборки.");

entity("9. OrderItem — позиция заказа", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["orderId", "INTEGER", "FK → Order, Cascade", "Заказ"],
  ["productId", "INTEGER", "FK → Product", "Товар"],
  ["weightKg", "DECIMAL(12,2)", "—", "Объём позиции, кг"],
  ["pricePerTon", "DECIMAL(12,2)", "—", "Снимок цены за тонну"],
  ["lineTotal", "DECIMAL(14,2)", "—", "Сумма строки"],
], "Строка заказа: товар, требуемый объём в килограммах и снимок цены за тонну на момент оформления (pricePerTon), а также рассчитанная сумма строки (lineTotal = вес/1000 × цена). Снимок цены фиксирует стоимость позиции, даже если прайс впоследствии изменится. Удаляется каскадно вместе с заказом.");

entity("10. OrderDocument — документ заказа", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["orderId", "INTEGER", "FK → Order, Cascade", "Заказ"],
  ["type", "ENUM DocumentType", "—", "Тип документа"],
  ["fileName", "TEXT", "—", "Имя файла"],
  ["filePath", "TEXT", "—", "Путь к файлу на сервере"],
  ["mimeType", "TEXT", "NULL", "MIME-тип"],
  ["sizeBytes", "INTEGER", "NULL", "Размер файла, байт"],
  ["uploadedById", "INTEGER", "FK → User, NULL", "Кто загрузил"],
  ["createdAt", "TIMESTAMP", "default now()", "Дата загрузки"],
], "Файлы, привязанные к заказу: сгенерированный системой КП/счёт (COMMERCIAL_OFFER), счёт от транспортной компании (загружает менеджер), платёжки за товар и за доставку (загружает клиент). Тип документа (type) определяет, кто вправе его загружать — права разграничены по ролям. Хранятся путь к файлу, имя, MIME-тип и размер. Удаляется каскадно вместе с заказом.");

entity("11. OrderStatusHistory — история статусов заказа", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["orderId", "INTEGER", "FK → Order, Cascade", "Заказ"],
  ["status", "ENUM OrderStatus", "—", "Установленный статус"],
  ["comment", "TEXT", "NULL", "Комментарий к изменению"],
  ["changedById", "INTEGER", "FK → User, NULL", "Кто изменил"],
  ["createdAt", "TIMESTAMP", "default now()", "Дата изменения"],
], "Журнал смены статусов заказа: какой статус установлен, когда, кем и с каким комментарием. Обеспечивает отслеживание (трекинг) заказа для клиента и аудит действий менеджера. Запись добавляется при каждом изменении статуса; удаляется каскадно вместе с заказом.");

entity("12. SampleRequest — заявка на образец", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["productId", "INTEGER", "FK → Product", "Товар"],
  ["userId", "INTEGER", "FK → User", "Заявитель"],
  ["companyId", "INTEGER", "FK → Company, NULL", "Компания"],
  ["weightKg", "INTEGER", "—", "Масса образца (5/10/20/30 кг)"],
  ["region", "TEXT", "—", "Регион доставки"],
  ["city", "TEXT", "NULL", "Город доставки"],
  ["comment", "TEXT", "NULL", "Комментарий"],
  ["status", "ENUM SampleStatus", "default NEW", "Статус заявки"],
  ["createdAt", "TIMESTAMP", "default now()", "Дата создания"],
], "Запрос бесплатного образца марки (5, 10, 20 или 30 кг), оформляемый с карточки товара. Привязан к товару, пользователю-заявителю и (необязательно) компании. Регион и город — адрес доставки; при отсутствии берутся реквизиты компании. Статусы: новая → одобрена → отправлена либо отклонена; статусом управляет менеджер.");

entity("13. LoyaltyTier — порог программы лояльности", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["minTons", "INTEGER", "—", "От скольких тонн за 2 года"],
  ["discountPercent", "DECIMAL(5,2)", "—", "Скидка, %"],
], "Справочник порогов скидки: от какого объёма (тонн за последние 2 года) предоставляется какая скидка (например, 200 т → 2 %, 500 т → 5 %). Глобальный для всех клиентов и потому не имеет внешних связей. Сервис лояльности сравнивает суммарный объём компании с порогами и сохраняет полученную скидку в поле Company.discountPercent.");

entity("14. Complaint — рекламация", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["orderId", "INTEGER", "FK → Order, NULL", "Заказ (необязательно)"],
  ["userId", "INTEGER", "FK → User", "Заявитель"],
  ["subject", "TEXT", "—", "Тема обращения"],
  ["text", "TEXT", "—", "Текст обращения"],
  ["status", "ENUM ComplaintStatus", "default NEW", "Статус рассмотрения"],
  ["createdAt", "TIMESTAMP", "default now()", "Дата создания"],
], "Обращение или жалоба клиента, при необходимости привязанные к конкретному заказу (поле orderId необязательно — рекламация может быть и общей). Хранит тему и текст обращения. Статусы рассмотрения: новая → на рассмотрении → решена либо отклонена; статусом управляет менеджер.");

entity("15. CatalogFile — файл каталога", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["title", "TEXT", "—", "Заголовок"],
  ["fileName", "TEXT", "—", "Имя файла"],
  ["filePath", "TEXT", "—", "Путь к файлу на сервере"],
  ["version", "TEXT", "NULL", "Версия каталога"],
  ["isCurrent", "BOOLEAN", "default true", "Признак актуального файла"],
  ["createdAt", "TIMESTAMP", "default now()", "Дата загрузки"],
], "Метаданные единого файла полного каталога продукции (PDF или DOCX) для просмотра и скачивания. Не привязан к конкретным записям других таблиц — это один документ на всё приложение, поэтому внешних связей не имеет. Флаг isCurrent помечает действующую версию каталога.");

entity("16. ChatMessage — сообщение чат-бота", [
  ["id", "INTEGER", "PK, автоинкремент", "Идентификатор"],
  ["userId", "INTEGER", "FK → User, NULL", "Пользователь"],
  ["sessionId", "TEXT", "индекс", "Идентификатор диалога"],
  ["role", "ENUM ChatRole", "—", "Автор сообщения"],
  ["text", "TEXT", "—", "Текст сообщения"],
  ["escalated", "BOOLEAN", "default false", "Передано менеджеру"],
  ["meta", "JSON", "NULL", "Доп. данные (рекомендации и т.п.)"],
  ["createdAt", "TIMESTAMP", "default now()", "Дата сообщения"],
], "Одно сообщение диалога с чат-ботом. Поле sessionId группирует сообщения в один диалог (индексировано); role указывает автора — пользователь, бот или менеджер. Флаг escalated помечает обращения, переданные менеджеру. Поле meta (JSON) хранит дополнительные данные, например рекомендованные ботом марки. Привязано к пользователю (может быть NULL).");

const doc = new Document({
  styles: { default: { document: { run: { font: "Times New Roman", size: 28 } } } },
  sections: [{
    properties: { page: {
      size: { width: PAGE_W, height: 16838 },
      margin: { top: M_TOP, right: M_RIGHT, bottom: M_BOTTOM, left: M_LEFT },
    } },
    children,
  }],
});

const out = "C:/Users/bqqst/OneDrive/Рабочий стол/diplom_project/docs/Описание_сущностей_БД.docx";
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("OK:", out, buf.length, "bytes"); });
