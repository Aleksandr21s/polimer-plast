# Архитектура приложения

## Общая схема

```
┌──────────────────────────┐         HTTPS/JSON          ┌───────────────────────────┐
│  Мобильное приложение     │  ◄──────────────────────►  │  API-сервер (Node.js)      │
│  React Native (Expo)      │      REST + JWT (Bearer)    │  Express + Prisma          │
│  - клиент (телефон)       │                             │  - бизнес-логика           │
│  - менеджер (веб-версия)  │                             │  - генерация PDF (PDFKit)  │
└──────────────────────────┘                             │  - чат-бот (правила)       │
                                                          │  - планировщик 72ч (cron)  │
                                                          └─────────────┬─────────────┘
                                                                        │ SQL (Prisma)
                                                                ┌───────▼────────┐
                                                                │  PostgreSQL     │
                                                                └─────────────────┘
```

Один кодовая база Expo работает и как нативное приложение (клиенты), и как
веб-интерфейс (менеджеры работают за компьютером). Экраны разграничены по роли.

## Модель данных (PostgreSQL / Prisma)

| Сущность | Назначение |
|----------|-----------|
| `Company` | Компания-клиент: реквизиты (ИНН/КПП/ОГРН/адрес), кэш скидки лояльности |
| `User` | Пользователь (роль CLIENT/MANAGER), относится к компании |
| `Product` | Марка пластиката + характеристики (RAL, Шор A, темп. хрупкости, ПТР, плотность) |
| `ApplicationTag` | Метка применения (обувь, кабель, медицина…), M:N к продуктам |
| `Category` | Раздел каталога (иерархия) |
| `Price` / `PriceUpdate` | Цены в отдельной таблице; партии обновления (раз в 2 нед.) |
| `Order` / `OrderItem` | Заказ (КП/счёт) и позиции; денежный снимок, окно 72ч |
| `OrderDocument` | Документы заказа (КП, счёт ТК, платёжки) с типом и автором |
| `OrderStatusHistory` | История статусов для отслеживания |
| `SampleRequest` | Заявки на бесплатные образцы (5/10/20/30 кг) |
| `LoyaltyTier` | Пороги скидок (200 т → 2%, 500 т → 5%) |
| `Complaint` | Рекламации по заказу |
| `CatalogFile` | Единый файл каталога (PDF) |
| `ChatMessage` | История чат-бота с возможностью эскалации |

## Жизненный цикл заказа

```
NEW ──issue-invoice──► INVOICE_ISSUED ──confirm-payment──► PAID ──► SHIPPED ──► DELIVERED ──► COMPLETED
 │                          │  (менеджер)                                                    
 └──── 72ч без оплаты ──────┴──► CANCELLED (автоотмена / ручная отмена)
```

- При создании заказа фиксируется снимок цен и скидки компании, ставится
  `autoCancelAt = now + 72ч`.
- Формирование КП (`issue-invoice`) генерирует PDF (PDFKit) и переводит в
  `INVOICE_ISSUED`.
- Планировщик (`node-cron`, каждые 10 мин) отменяет просроченные заказы.
- Подтверждение оплаты и завершение пересчитывают скидку лояльности компании.

## Разграничение доступа к документам

| Тип документа | Кто загружает |
|---------------|---------------|
| `COMMERCIAL_OFFER` (КП/счёт) | система (генерируется) |
| `TRANSPORT_INVOICE` (счёт ТК) | **только менеджер** |
| `PAYMENT_GOODS`, `PAYMENT_DELIVERY` (платёжки) | **только клиент** |

Проверка выполняется на сервере (`order.routes.js`) по роли пользователя.

## Программа лояльности

`services/loyalty.js`: суммирует объём заказов компании (статусы PAID+…) за
последние 2 года, сравнивает с порогами `LoyaltyTier`. Скидка хранится в кэше
`Company.discountPercent` и применяется ко всем сотрудникам компании при
формировании заказа.

## Чат-бот (локальный, без внешнего API)

`services/chatbot.js`: распознаёт назначение (ключевые слова → метки применения)
и характеристики (морозостойкость, твёрдость) в запросе, подбирает марки запросом
к БД, отвечает на типовые вопросы (FAQ) и предлагает эскалацию менеджеру при
нераспознанном запросе. Не требует ключей и затрат.

## Основные эндпоинты API

```
POST   /api/auth/register | login            GET /api/auth/me
GET    /api/catalog/products | /:id | /tags  GET /api/catalog/catalog-file[/:id/download]
GET    /api/prices/current                   POST /api/prices/update (менеджер) | PUT /product/:id
POST   /api/orders                           GET /api/orders | /:id
POST   /api/orders/:id/issue-invoice | confirm-payment | cancel
PATCH  /api/orders/:id/status                POST /api/orders/:id/documents (по ролям)
GET    /api/orders/:id/documents/:docId/download
POST   /api/samples  GET /api/samples  PATCH /api/samples/:id/status
GET    /api/company | /loyalty  PUT /api/company
POST   /api/chat  GET /api/chat/:sessionId  POST /api/chat/:sessionId/escalate
POST   /api/complaints  GET /api/complaints  PATCH /api/complaints/:id/status
```

## Безопасность

- Пароли — bcrypt (хеш, 10 раундов).
- Авторизация — JWT (Bearer-токен; для прямых ссылок на файлы — параметр `?token=`).
- Роли — middleware `requireRole('MANAGER')`.
- Валидация входных данных — Zod-схемы.

## Технологический стек (соответствует Стек.docx)

| Слой | Технология |
|------|-----------|
| Мобильное приложение | React Native (Expo SDK 56), React Navigation |
| Хранение токена | AsyncStorage |
| Бэкенд | Node.js + Express |
| ORM / БД | Prisma + PostgreSQL |
| Аутентификация | JWT + bcrypt |
| Генерация PDF | PDFKit |
| Планировщик | node-cron |
| Чат-бот | локальная логика по правилам |
