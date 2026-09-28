@echo off
setlocal
set "PORT=8081"
set "DIR=C:\Users\lenovo\WorkBuddy\partner-profile"
set "PY="

rem ---- 1) 先找确定能用的 python（写死几个常见位置，不依赖 PATH）----
for %%P in (
  "C:\Users\lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe"
  "C:\Users\lenovo\Desktop\xiaobulaoshi\celiang\Anaconda3\python.exe"
) do (
  if not defined PY if exist %%P set "PY=%%~P"
)

rem ---- 2) 再退一步，用 PATH 里的 python ----
if not defined PY (
  where python >nul 2>nul
  if %errorlevel%==0 set "PY=python"
)

if not defined PY (
  echo.
  echo [ERROR] 找不到 python。
  echo 把这个窗口截图发给 WorkBuddy，它会给你别的办法。
  echo.
  pause
  exit /b 1
)

echo ==========================================
echo  partner-profile 本地预览
echo ==========================================
echo  python : %PY%
echo  文件夹 : %DIR%
echo  地址   : http://localhost:%PORT%/
echo.
echo  即将打开一个「服务窗口」（标题：partner-profile server）
echo  那个窗口就是服务器，关掉它服务就停了。
echo.

rem ---- 3) 用独立窗口起服务器，避免浏览器跑在前面 ----
start "partner-profile server" "%PY%" -m http.server %PORT% --bind 127.0.0.1 --directory "%DIR%"

rem ---- 4) 等 2 秒，让服务器先起来，再开浏览器 ----
ping -n 3 127.0.0.1 >nul
start "" http://localhost:%PORT%/

echo 浏览器已打开。如果显示"拒绝连接"，请按 F5 刷新一次。
echo.
echo 停止服务：关掉那个标题为 partner-profile server 的窗口。
echo.
pause
