@echo off
title LLM tunnel: Ollama to server
set "KEY=%USERPROFILE%\.ssh\polymer_tunnel"
set "SERVER=root@201.51.8.231"

echo ============================================
echo   LLM TUNNEL: Ollama (this PC) to server
echo ============================================
echo.
echo Keeps the AI chat working on b2b-polimer-plast.ru.
echo Start Ollama first (OLLAMA-VKL / OLLAMA-ON).
echo Do not close this window during the demo. Press Ctrl+C to stop.
echo.

:loop
echo [%date% %time%] Connecting to server...
ssh -i "%KEY%" -N -R 11434:127.0.0.1:11434 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=accept-new %SERVER%
echo.
echo [%date% %time%] Disconnected. Reconnecting in 5 seconds...
ping -n 6 127.0.0.1 >nul
goto loop
