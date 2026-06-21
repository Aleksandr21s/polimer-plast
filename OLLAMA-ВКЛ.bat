@echo off
title Ollama ON
REM ====== Model (can switch to qwen2.5:7b) ======
set "MODEL=qwen2.5:14b"
REM ====== Models live on drive D ======
set "OLLAMA_MODELS=D:\ollama-models"

REM -- Find ollama: in PATH, else default install path --
set "OLLAMA_EXE="
where ollama >nul 2>&1 && set "OLLAMA_EXE=ollama"
if not defined OLLAMA_EXE if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"

echo ============================================
echo   OLLAMA ON   (model: %MODEL%)
echo ============================================
echo.

if not defined OLLAMA_EXE (
  echo [X] Ollama not found. Install from https://ollama.com/download then retry.
  echo.
  pause
  exit /b 1
)

REM 1) Restart server cleanly so it uses OLLAMA_MODELS=D:\ollama-models
echo [..] (Re)starting Ollama server with models on D:\ollama-models ...
taskkill /IM "ollama app.exe" /F >nul 2>&1
taskkill /IM "ollama.exe" /F >nul 2>&1
start "Ollama Server" /min "%OLLAMA_EXE%" serve

echo [..] Waiting for server to come up ...
set /a tries=0
:waitloop
ping -n 2 127.0.0.1 >nul
"%OLLAMA_EXE%" list >nul 2>&1
if not errorlevel 1 goto serverup
set /a tries+=1
if %tries% lss 20 goto waitloop
echo [X] Server did not start in time. Open the Ollama app manually and retry.
echo.
pause
exit /b 1

:serverup
echo [OK] Ollama server is running.

REM 2) Make sure the model is present; download once if missing
"%OLLAMA_EXE%" list | findstr /I "%MODEL%" >nul 2>&1
if errorlevel 1 (
  echo.
  echo [..] Model %MODEL% not found. Downloading to %OLLAMA_MODELS% - one time, about 9 GB ...
  "%OLLAMA_EXE%" pull %MODEL%
  if errorlevel 1 (
    echo [X] Download failed. Check internet.
    echo.
    pause
    exit /b 1
  )
)

REM 3) Warm up the model into VRAM for a fast first answer
echo [..] Loading model into VRAM ...
"%OLLAMA_EXE%" run %MODEL% "ready" >nul 2>&1

echo.
echo [OK] Ollama is ON. Model %MODEL% loaded and ready.
echo      Next: start the LLM tunnel (LLM-...-VKL.bat) so the site AI works.
echo.
pause
