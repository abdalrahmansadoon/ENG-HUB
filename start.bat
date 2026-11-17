@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing ENG HUB dependencies...
  call npm install
  if errorlevel 1 goto error
)
call npm run dev
if errorlevel 1 goto error
goto end
:error
echo.
echo ENG HUB could not start. Check Node.js/npm installation and the messages above.
pause
:end
