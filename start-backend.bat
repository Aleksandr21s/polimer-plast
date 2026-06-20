@echo off
chcp 65001 >nul
title Полимер-Пласт — API (порт 4000)
cd /d "%~dp0backend"

echo ============================================================
echo   ПОЛИМЕР-ПЛАСТ — Бэкенд (API + база данных)
echo   Адрес:  http://localhost:4000
echo   Проверка: http://localhost:4000/api/health
echo ============================================================
echo.

if not exist "node_modules" (
  echo [setup] Устанавливаю зависимости бэкенда...
  call npm install
  echo.
)
if not exist ".env" (
  echo [setup] Создаю .env из .env.example...
  copy ".env.example" ".env" >nul
  echo.
)

echo Запуск сервера... (остановить: Ctrl+C)
echo.
call npm run dev

echo.
echo Сервер остановлен.
pause >nul
