@echo off
chcp 65001 >nul
title Ollama - статус
REM Модели на диске D — задаём явно, чтобы список показывал именно их
set "OLLAMA_MODELS=D:\ollama-models"

REM ── Находим ollama: в PATH, иначе по стандартному пути установки ──
set "OLLAMA_EXE="
where ollama >nul 2>&1 && set "OLLAMA_EXE=ollama"
if not defined OLLAMA_EXE if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"

echo ============================================
echo   СТАТУС Ollama
echo ============================================
echo.

if not defined OLLAMA_EXE (
  echo Ollama: НЕ УСТАНОВЛЕНА
  echo Скачать: https://ollama.com/download
  echo.
  pause
  exit /b 0
)

"%OLLAMA_EXE%" list >nul 2>&1
if errorlevel 1 (
  echo Сервер Ollama: ОСТАНОВЛЕН
  echo Запустите OLLAMA-ВКЛ.bat, чтобы включить.
  echo.
  pause
  exit /b 0
)

echo Сервер Ollama: РАБОТАЕТ
echo.
echo --- Скачанные модели (из %OLLAMA_MODELS%) ---
"%OLLAMA_EXE%" list
echo.
echo --- Загружено в видеопамять сейчас ---
"%OLLAMA_EXE%" ps
echo.
pause
