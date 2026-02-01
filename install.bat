@echo off
title Llama.cpp Control Center Setup
color 0A

echo Checking dependencies...
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found! Please install it from nodejs.org
    pause
    exit /b 1
)

:: Set path to the current directory where the batch file is located
set "INSTALL_DIR=%~dp0"
cd /d "%INSTALL_DIR%"

echo Installing in: %INSTALL_DIR%

echo Installing npm dependencies...
call npm install

:: Create local storage folders
if not exist "models" mkdir "models"
if not exist "bin" mkdir "bin"

echo.
echo Setup complete!
echo Put your .gguf files in the "models" folder in this directory.
echo Start the app with: npm start
pause