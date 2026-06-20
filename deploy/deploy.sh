#!/usr/bin/env bash
# Деплой на VPS: подтянуть код из git, обновить зависимости и БД,
# пересобрать фронтенд и перезапустить API. Запускать на сервере: bash deploy/deploy.sh
set -euo pipefail

APP_DIR=/opt/polymer-plast
API_URL=https://api.b2b-polimer-plast.ru/api

cd "$APP_DIR"
echo ">> git pull"
git pull --ff-only

echo ">> backend: зависимости + клиент Prisma"
cd "$APP_DIR/backend"
npm install
npx prisma generate

echo ">> backend: миграции БД (без сброса данных)"
npx prisma migrate deploy

echo ">> frontend: установка зависимостей и сборка статики"
cd "$APP_DIR/mobile"
npm install
EXPO_PUBLIC_API_URL="$API_URL" npx expo export --platform web

echo ">> перезапуск API"
systemctl restart polymer-plast-api

echo ">> Готово. Текущий статус сервиса:"
systemctl --no-pager status polymer-plast-api | head -n 6
