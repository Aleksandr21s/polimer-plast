@echo off
title Ollama STATUS
REM Models on drive D so the list shows them
set "OLLAMA_MODELS=D:\ollama-models"

REM -- Find ollama: in PATH, else default install path --
set "OLLAMA_EXE="
where ollama >nul 2>&1 && set "OLLAMA_EXE=ollama"
if not defined OLLAMA_EXE if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"

echo ============================================
echo   OLLAMA STATUS
echo ============================================
echo.

if not defined OLLAMA_EXE (
  echo Ollama: NOT INSTALLED
  echo Download: https://ollama.com/download
  echo.
  pause
  exit /b 0
)

"%OLLAMA_EXE%" list >nul 2>&1
if errorlevel 1 (
  echo Ollama server: STOPPED
  echo Run OLLAMA-...-VKL.bat to start it.
  echo.
  pause
  exit /b 0
)

echo Ollama server: RUNNING
echo.
echo --- Downloaded models (from %OLLAMA_MODELS%) ---
"%OLLAMA_EXE%" list
echo.
echo --- Loaded in VRAM right now ---
"%OLLAMA_EXE%" ps
echo.
pause
