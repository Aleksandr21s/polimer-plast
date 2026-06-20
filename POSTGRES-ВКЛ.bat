@echo off
chcp 65001 >nul
title PostgreSQL - включение
set "SVC=postgresql-x64-17"

REM ── Самоповышение прав: управление службой требует администратора ──
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Требуются права администратора - открываю запрос UAC...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo ============================================
echo   ВКЛЮЧЕНИЕ PostgreSQL  (%SVC%)
echo ============================================
echo.

sc query "%SVC%" | find "RUNNING" >nul
if %errorlevel%==0 (
  echo [OK] PostgreSQL уже запущен.
) else (
  echo [..] Запускаю службу...
  net start "%SVC%" >nul 2>&1
  sc query "%SVC%" | find "RUNNING" >nul
  if %errorlevel%==0 (
    echo [OK] PostgreSQL запущен.
  ) else (
    echo [X] Не удалось запустить PostgreSQL. Проверьте службу "%SVC%".
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Теперь можно запускать бэкенд и приложение.
echo.
pause
