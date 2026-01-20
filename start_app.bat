@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
set "BACKEND_DIR=%PROJECT_ROOT%backend"
set "FRONTEND_DIR=%PROJECT_ROOT%frontend"

echo ==========================================
echo Starting Character Trainer...
echo ==========================================

:: 1. Start Backend
echo Starting Backend...
if exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
    start "CharacterTrainer Backend" cmd /k "cd /d "%BACKEND_DIR%" && .venv\Scripts\python.exe run_server.py"
) else (
    echo ERROR: Backend venv not found at %BACKEND_DIR%\.venv
    pause
    exit /b 1
)

:: 2. Start Frontend
echo Starting Frontend...
if exist "%FRONTEND_DIR%\package.json" (
    start "CharacterTrainer Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"
) else (
    echo ERROR: Frontend package.json not found at %FRONTEND_DIR%
    pause
    exit /b 1
)

:: 3. Open Browser
echo Waiting for services to initialize...
start http://localhost:5173

echo.
echo ==========================================
echo App launched!
echo Backend logs: in the Backend window
echo Frontend logs: in the Frontend window
echo ==========================================

