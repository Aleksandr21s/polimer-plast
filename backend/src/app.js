import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use(morgan('dev'));

  // Статика загруженных файлов (на случай прямого доступа)
  app.use('/uploads', express.static(resolve(__dirname, '../uploads')));
  // Статические ресурсы приложения (фото продукции и т.п.)
  app.use('/static', express.static(resolve(__dirname, '../public')));

  // Приветственная страница на корне (чтобы при ручном заходе была понятная инфо)
  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>API · Полимер-Пласт</title>
<style>body{font-family:system-ui,Segoe UI,Arial;background:#f5f7fa;color:#1b1f24;max-width:680px;margin:40px auto;padding:0 20px}
h1{color:#1f6feb}a{color:#1f6feb}code{background:#e7f0ff;padding:2px 6px;border-radius:6px}
.card{background:#fff;border:1px solid #e3e7ed;border-radius:14px;padding:20px;margin:14px 0}
li{margin:6px 0}</style></head><body>
<h1>API ООО ТПК «Полимер-Пласт»</h1>
<div class="card"><b>🟢 Сервер работает.</b> Это REST API для мобильного приложения —
открывать его адреса в браузере вручную не нужно. Большинство маршрутов требуют авторизацию.</div>
<div class="card"><b>Открытые для проверки эндпоинты:</b>
<ul>
<li><a href="/api/health">/api/health</a> — статус сервера</li>
<li><a href="/api/catalog/tags">/api/catalog/tags</a> — метки применения</li>
<li><a href="/api/catalog/products">/api/catalog/products</a> — каталог продукции</li>
<li><a href="/api/catalog/catalog-file">/api/catalog/catalog-file</a> — файл каталога (PDF)</li>
</ul></div>
<div class="card">Приложение запускается в папке <code>mobile</code> командой <code>npx expo start</code>.</div>
</body></html>`);
  });

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
