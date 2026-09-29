@echo off
setlocal
set "PORT=8081"
set "DIR=C:\Users\lenovo\WorkBuddy\partner-profile"
set "PY="

for %%P in (
  "C:\Users\lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe"
  "C:\Users\lenovo\Desktop\xiaobulaoshi\celiang\Anaconda3\python.exe"
) do (
  if not defined PY if exist %%P set "PY=%%~P"
)

if not defined PY (
  where python >nul 2>nul
  if %errorlevel%==0 set "PY=python"
)

if not defined PY (
  echo.
  echo [ERROR] python not found on this computer.
  echo Send a screenshot of this window to WorkBuddy.
  echo.
  pause
  exit /b 1
)

echo ==========================================
echo  partner-profile  local preview
echo ==========================================
echo  python  : %PY%
echo  folder  : %DIR%
echo  address : http://localhost:%PORT%/
echo.
echo  A new window titled [partner-profile server] will open.
echo  KEEP that window open. Closing it stops the site.
echo.

start "partner-profile server" "%PY%" -m http.server %PORT% --bind 127.0.0.1 --directory "%DIR%"

ping -n 3 127.0.0.1 >nul
start "" http://localhost:%PORT%/

echo Browser opened. If it says refused connection, press F5.
echo.
echo To stop: close the [partner-profile server] window.
echo.
pause
