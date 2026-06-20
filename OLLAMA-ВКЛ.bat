@echo off
chcp 65001 >nul
title Ollama - включение
REM ====== Модель (можно поменять на qwen2.5:7b) ======
set "MODEL=qwen2.5:14b"
REM ====== Модели лежат на диске D — задаём явно, чтобы не зависеть от окружения ======
set "OLLAMA_MODELS=D:\ollama-models"

REM ── Находим ollama: в PATH, иначе по стандартному пути установки ──
set "OLLAMA_EXE="
where ollama >nul 2>&1 && set "OLLAMA_EXE=ollama"
if not defined OLLAMA_EXE if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"

echo ============================================
echo   ВКЛЮЧЕНИЕ Ollama  (модель: %MODEL%)
echo ============================================
echo.

if not defined OLLAMA_EXE (
  echo [X] Ollama не найдена в системе.
  echo     Скачайте и установите с https://ollama.com/download
  echo     затем запустите этот файл снова.
  echo.
  pause
  exit /b 1
)

REM 1) Запускаем сервер, если ещё не работает
"%OLLAMA_EXE%" list >nul 2>&1
if not errorlevel 1 goto serverup

echo [..] Сервер Ollama не запущен - запускаю...
start "Ollama Server" /min "%OLLAMA_EXE%" serve
set /a tries=0

:waitloop
timeout /t 1 /nobreak >nul
"%OLLAMA_EXE%" list >nul 2>&1
if not errorlevel 1 goto serverup
set /a tries+=1
if %tries% lss 15 goto waitloop
echo [X] Не удалось запустить сервер Ollama за 15 секунд.
echo     Откройте приложение Ollama вручную и попробуйте снова.
echo.
pause
exit /b 1

:serverup
echo [OK] Сервер Ollama работает.

REM 2) Проверяем модель; если нет - качаем (разово, ~9 ГБ, на диск D)
"%OLLAMA_EXE%" list | findstr /I "%MODEL%" >nul 2>&1
if errorlevel 1 (
  echo.
  echo [..] Модель %MODEL% ещё не скачана. Загружаю на %OLLAMA_MODELS% (разово)...
  "%OLLAMA_EXE%" pull %MODEL%
  if errorlevel 1 (
    echo [X] Не удалось скачать модель. Проверьте интернет.
    echo.
    pause
    exit /b 1
  )
)

REM 3) Прогреваем модель - загружаем в видеопамять для быстрого первого ответа
echo [..] Загружаю модель в видеопамять...
"%OLLAMA_EXE%" run %MODEL% "Готов к работе" >nul 2>&1

echo.
echo [OK] Ollama включена. Модель %MODEL% загружена и готова.
echo      Бот в приложении использует её в режиме "ИИ".
echo.
pause
