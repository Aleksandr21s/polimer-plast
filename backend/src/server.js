import { createApp } from './app.js';
import { config } from './config/env.js';
import { startAutoCancelJob } from './jobs/autocancel.js';
import { prisma } from './prismaClient.js';

async function main() {
  // Проверка соединения с БД
  await prisma.$connect();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`\n🟢 API ООО ТПК «Полимер-Пласт» запущен на http://localhost:${config.port}`);
    console.log(`   health-check: http://localhost:${config.port}/api/health`);
  });

  // Планировщик авто-отмены заказов (72ч)
  startAutoCancelJob();
}

main().catch((e) => {
  console.error('Не удалось запустить сервер:', e);
  process.exit(1);
});
