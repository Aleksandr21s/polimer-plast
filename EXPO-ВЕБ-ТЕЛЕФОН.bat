@echo off
chcp 65001 >nul
title Expo ВЕБ для телефона (через браузер)

REM --- Определяем локальный IP: PowerShell пишет его в temp-файл (IP это ASCII) ---
del "%TEMP%\pp_lanip.txt" >nul 2>&1
powershell -NoProfile -Command "$c = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' -and $_.InterfaceAlias -notlike '*Amnezia*' -and $_.InterfaceAlias -notlike '*WireGuard*' -and $_.InterfaceAlias -notlike '*VPN*' } | Select-Object -First 1; if ($c) { ($c.IPv4Address | Select-Object -First 1).IPAddress | Out-File -FilePath %TEMP%\pp_lanip.txt -Encoding ascii }"
set "LANIP="
set /p LANIP=<"%TEMP%\pp_lanip.txt"
del "%TEMP%\pp_lanip.txt" >nul 2>&1

if not defined LANIP (
  echo [X] Не удалось определить локальный IP.
  echo     Проверьте, что Wi-Fi подключён, а VPN отключён, и запустите снова.
  echo.
  pause
  exit /b 1
)

echo ============================================
echo   ВЕБ-ВЕРСИЯ приложения для телефона
echo ============================================
echo.
echo На телефоне (тот же Wi-Fi, VPN отключён) откройте в браузере:
echo.
echo        http://%LANIP%:8090
echo.
echo Перед этим убедитесь, что запущены:
echo   - PostgreSQL   (POSTGRES-ВКЛ.bat)
echo   - Бэкенд :4000 (start-backend.bat)
echo.
echo Сейчас соберётся веб-сборка (первый раз - минуту-две). Держите окно открытым.
echo Остановить: Ctrl+C в этом окне.
echo.

set "REACT_NATIVE_PACKAGER_HOSTNAME=%LANIP%"
set "EXPO_NO_TELEMETRY=1"

cd /d "%~dp0mobile"
call npx expo start --web --port 8090

echo.
echo Веб-сервер остановлен.
pause
