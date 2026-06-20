@echo off
chcp 65001 >nul
title Полимер-Пласт — Остановка серверов
echo Останавливаю серверы на портах 4000 (API) и 8081 (приложение)...
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":4000"') do (
  taskkill /F /PID %%a >nul 2>&1 && echo   API (PID %%a) остановлен.
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":8081"') do (
  taskkill /F /PID %%a >nul 2>&1 && echo   Приложение (PID %%a) остановлено.
)

echo.
echo Готово.
timeout /t 4 /nobreak >nul
