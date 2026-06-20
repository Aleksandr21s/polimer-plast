@echo off
chcp 65001 >nul
title PostgreSQL - выключение
set "SVC=postgresql-x64-17"

REM ── Самоповышение прав: управление службой требует администратора ──
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Требуются права администратора - открываю запрос UAC...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo ============================================
echo   ВЫКЛЮЧЕНИЕ PostgreSQL  (%SVC%)
echo ============================================
echo.

sc query "%SVC%" | find "RUNNING" >nul
if %errorlevel% neq 0 (
  echo [OK] PostgreSQL уже остановлен.
) else (
  echo [..] Останавливаю службу...
  net stop "%SVC%" >nul 2>&1
  sc query "%SVC%" | find "STOPPED" >nul
  if %errorlevel%==0 (
    echo [OK] PostgreSQL остановлен. Память освобождена.
  ) else (
    echo [X] Не удалось остановить службу "%SVC%".
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Внимание: бэкенд и приложение без БД работать не будут.
echo Перед запуском приложения снова включите PostgreSQL (POSTGRES-ВКЛ.bat).
echo.
pause
