@echo off
chcp 65001 >nul
title Полимер-Пласт — Первичная настройка
echo ============================================================
echo   ПОЛИМЕР-ПЛАСТ — установка и подготовка (один раз)
echo ============================================================
echo.
echo Требуется заранее установленный PostgreSQL (служба запущена).
echo.

echo [1/5] Зависимости бэкенда...
cd /d "%~dp0backend"
call npm install
echo.

echo [2/5] Файл .env...
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo   .env создан.
) else (
  echo   .env уже есть.
)
echo.

echo [3/5] База данных: создаю «polymerplast» (если ещё нет)...
set PGPASSWORD=postgres
if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" (
  "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -p 5432 -c "CREATE DATABASE polymerplast;" 2>nul
)
echo.

echo [4/5] Миграции и наполнение данными...
call npx prisma migrate deploy
call npm run db:setup
echo.

echo [5/5] Зависимости приложения...
cd /d "%~dp0mobile"
call npm install
echo.

echo ============================================================
echo   ГОТОВО. Теперь запускайте  ЗАПУСТИТЬ-ВСЁ.bat
echo ============================================================
pause
