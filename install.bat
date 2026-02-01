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

:: Set path to Desktop [cite: 3]
set "INSTALL_DIR=%USERPROFILE%\Desktop\LlamaControlCenter"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
cd /d "%INSTALL_DIR%"

echo Installing in: %INSTALL_DIR% [cite: 4]

:: Note: This assumes you have the files in this folder already
echo Installing npm dependencies...
call npm install [cite: 5]

if not exist "models" mkdir "models"
if not exist "bin" mkdir "bin"

echo Setup complete! [cite: 8]
echo Put your .gguf files in the "models" folder on your Desktop.
echo Start the app with: npm start
pause