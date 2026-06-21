@echo off
title Ollama OFF
set "MODEL=qwen2.5:14b"

REM -- Find ollama: in PATH, else default install path --
set "OLLAMA_EXE="
where ollama >nul 2>&1 && set "OLLAMA_EXE=ollama"
if not defined OLLAMA_EXE if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"

echo ============================================
echo   OLLAMA OFF
echo ============================================
echo.

REM 1) Unload model from VRAM if possible
if defined OLLAMA_EXE "%OLLAMA_EXE%" stop %MODEL% >nul 2>&1

REM 2) Stop Ollama processes to free memory
taskkill /IM "ollama.exe" /F >nul 2>&1
taskkill /IM "ollama app.exe" /F >nul 2>&1

echo [OK] Ollama stopped. VRAM freed.
echo      The chatbot keeps working in Rules mode.
echo.
pause
