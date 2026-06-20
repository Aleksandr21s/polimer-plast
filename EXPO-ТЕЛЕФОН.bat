@echo off
chcp 65001 >nul
title Expo для телефона (Expo Go)

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
echo   ЗАПУСК Expo для телефона (Expo Go)
echo   IP компьютера: %LANIP%
echo ============================================
echo.
echo Перед сканированием убедитесь, что:
echo   1) VPN отключён, телефон в той же Wi-Fi сети, что и ПК
echo   2) PostgreSQL включён          (POSTGRES-ВКЛ.bat)
echo   3) Бэкенд запущен на порту 4000 (start-backend.bat)
echo   4) На телефоне установлен Expo Go
echo.
echo Откроется Expo с QR-кодом - отсканируйте его в Expo Go.
echo Остановить сервер: Ctrl+C в этом окне.
echo.

set "REACT_NATIVE_PACKAGER_HOSTNAME=%LANIP%"
set "EXPO_NO_TELEMETRY=1"

cd /d "%~dp0mobile"
call npx expo start --lan

echo.
echo Expo остановлен.
pause
