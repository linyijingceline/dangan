@echo off
set "PATH=C:\Users\lenovo\AppData\Local\Programs\Git\cmd;%PATH%"
cd /d "C:\Users\lenovo\WorkBuddy\partner-profile"
echo ==========================================
echo  Push partner-profile to GitHub
echo  Repo: linyijingceline/dangan
echo ==========================================
echo.
echo A GitHub login window should pop up. Log in once.
echo If instead you see:  Username for 'https://github.com':
echo   type your GitHub user name
echo   and for the password paste a Personal Access Token
echo   (not your account password)
echo.
git --version
git push -u origin main
echo.
if %errorlevel%==0 (
  echo ===== PUSH SUCCEEDED :) You can close this window. =====
) else (
  echo ===== PUSH FAILED :( Copy the red error text above. =====
)
pause
