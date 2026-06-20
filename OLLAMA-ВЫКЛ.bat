@echo off
chcp 65001 >nul
title Ollama - выключение
set "MODEL=qwen2.5:14b"

REM ── Находим ollama: в PATH, иначе по стандартному пути установки ──
set "OLLAMA_EXE="
where ollama >nul 2>&1 && set "OLLAMA_EXE=ollama"
if not defined OLLAMA_EXE if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"

echo ============================================
echo   ВЫКЛЮЧЕНИЕ Ollama
echo ============================================
echo.

REM 1) Мягко выгружаем модель из видеопамяти (если ollama доступна)
if defined OLLAMA_EXE "%OLLAMA_EXE%" stop %MODEL% >nul 2>&1

REM 2) Останавливаем процессы Ollama, чтобы полностью освободить память
taskkill /IM "ollama.exe" /F >nul 2>&1
taskkill /IM "ollama app.exe" /F >nul 2>&1

echo [OK] Ollama остановлена. Видеопамять освобождена.
echo      Чат-бот продолжит работать на правилах (режим "Правила").
echo.
pause
