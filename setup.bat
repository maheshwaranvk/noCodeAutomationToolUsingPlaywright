@echo off
REM Setup script for No-Code UI Automation (Windows)
REM This script installs dependencies and guides through startup

echo.
echo 🤖 No-Code UI Automation - Setup Script (Windows)
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install from https://nodejs.org/
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js detected: %NODE_VERSION%
echo.

REM Install backend dependencies
echo 📦 Installing backend dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install backend dependencies
    exit /b 1
)
echo ✅ Backend dependencies installed
echo.

REM Build backend
echo 🔨 Building backend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to build backend
    exit /b 1
)
echo ✅ Backend built successfully
echo.

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install frontend dependencies
    cd ..
    exit /b 1
)
cd ..
echo ✅ Frontend dependencies installed
echo.

echo 🎉 Setup complete!
echo.
echo 📝 To start the application:
echo.
echo    Terminal 1 (Backend - port 3001):
echo    $ npm start
echo.
echo    Terminal 2 (Frontend - port 3000):
echo    $ cd frontend
echo    $ npm start
echo.
echo Then open http://localhost:3000 in your browser
echo.
echo For more details, see QUICKSTART_SEPARATE_SERVERS.md
echo.
pause
