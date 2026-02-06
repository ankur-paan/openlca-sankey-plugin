@echo off
setlocal

echo ==========================================
echo Starting openLCA Sankey Plugin (v2.6.0)
echo ==========================================

REM --- Backend Setup ---
cd backend
if not exist venv (
    echo [Backend] Creating Python virtual environment...
    python -m venv venv
)

echo [Backend] Activating venv...
call venv\Scripts\activate

echo [Backend] Installing/upgrading dependencies...
pip install -U -r requirements.txt

echo [Backend] Starting FastAPI Server on port 8000...
start "Sankey Backend" cmd /k "venv\Scripts\python.exe main.py"

REM --- Frontend Setup ---
cd ..\frontend
if not exist node_modules (
    echo [Frontend] Installing npm dependencies...
    npm install
)

echo [Frontend] Starting Vite Server...
start "Sankey Frontend" cmd /k "npm run dev"

echo ==========================================
echo Services started!
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo Make sure openLCA 2.6.0 IPC server is
echo running on port 8080.
echo ==========================================
