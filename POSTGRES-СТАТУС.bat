@echo off
chcp 65001 >nul
title PostgreSQL - статус
set "SVC=postgresql-x64-17"

echo ============================================
echo   СТАТУС PostgreSQL  (%SVC%)
echo ============================================
echo.

sc query "%SVC%" >nul 2>&1
if %errorlevel% neq 0 (
  echo Служба "%SVC%" не найдена.
  echo.
  pause
  exit /b 0
)

sc query "%SVC%" | find "RUNNING" >nul
if %errorlevel%==0 ( echo Состояние:  РАБОТАЕТ ) else ( echo Состояние:  ОСТАНОВЛЕН )

echo.
echo --- Тип запуска (AUTO_START = при загрузке Windows, DEMAND_START = вручную) ---
sc qc "%SVC%" | find "START_TYPE"
echo.
pause
