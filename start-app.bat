@echo off
chcp 65001 >nul
title Полимер-Пласт — Приложение (Expo)
cd /d "%~dp0mobile"

echo ============================================================
echo   ПОЛИМЕР-ПЛАСТ — Мобильное приложение (Expo)
echo.
echo   - нажмите  w  — открыть веб-версию в браузере
echo   - отсканируйте QR в приложении Expo Go на телефоне
echo     (телефон и компьютер в одной Wi-Fi сети)
echo ============================================================
echo.

if not exist "node_modules" (
  echo [setup] Устанавливаю зависимости приложения...
  call npm install
  echo.
)

echo Запуск Expo... (остановить: Ctrl+C)
echo.
call npx expo start

echo.
pause >nul
