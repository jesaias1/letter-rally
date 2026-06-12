@echo off
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm are required to run Letter Rally.
  echo Install Node.js from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing Letter Rally dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting Letter Rally...
call npm run dev -- --host 0.0.0.0 --open
