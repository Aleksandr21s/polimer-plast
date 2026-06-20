@echo off
chcp 65001 >nul
title Полимер-Пласт — Веб-версия
cd /d "%~dp0mobile"

echo ============================================================
echo   ПОЛИМЕР-ПЛАСТ — Веб-версия приложения
echo   Откроется в браузере: http://localhost:8081
echo ============================================================
echo.

if not exist "node_modules" (
  echo [setup] Устанавливаю зависимости приложения...
  call npm install
  echo.
)

echo Запуск веб-версии... (остановить: Ctrl+C)
echo.
call npx expo start --web

echo.
pause >nul
