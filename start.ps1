# ──────────────────────────────────────────────────────────────
#  Ata Meeting Assistant — Start / Stop all services (Windows)
# ──────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"

$ROOT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$Processes = @()

# ─── Colors ───────────────────────────────────────────────────
function Log($msg)  { Write-Host "[ata] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[ata] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[ata] $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "[ata] $msg" -ForegroundColor Red }

# ─── Cleanup on exit ─────────────────────────────────────────
function Cleanup {
    Write-Host ""
    Log "Shutting down all services..."

    foreach ($proc in $script:Processes) {
        try {
            if (!$proc.HasExited) {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                Log "Stopped PID $($proc.Id)"
            }
        } catch {}
    }

    Ok "All services stopped. Goodbye!"
}

# Register cleanup on Ctrl+C
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup }
[Console]::TreatControlCAsInput = $false

# ─── Preflight checks ────────────────────────────────────────
Log "Running preflight checks..."

if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Err "Node.js is not installed."; exit 1
}

if (!(Get-Command python -ErrorAction SilentlyContinue) -and !(Get-Command python3 -ErrorAction SilentlyContinue)) {
    Err "Python is not installed."; exit 1
}

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Warn "Docker is not installed — Zoom bot will not be available."
}

$PYTHON_CMD = if (Get-Command python3 -ErrorAction SilentlyContinue) { "python3" } else { "python" }

# Check for .env file
if (!(Test-Path "$ROOT_DIR\.env")) {
    Err ".env file not found! Copy .env.example to .env and fill in values."
    exit 1
}

# ─── 1. Ollama ───────────────────────────────────────────────
if (Get-Command ollama -ErrorAction SilentlyContinue) {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 2 -ErrorAction Stop
        Ok "Ollama is already running."
    } catch {
        Log "Starting Ollama..."
        $ollamaProc = Start-Process -FilePath "ollama" -ArgumentList "serve" -PassThru -WindowStyle Hidden
        $script:Processes += $ollamaProc
        Start-Sleep -Seconds 2
        Ok "Ollama started (PID $($ollamaProc.Id))"
    }
} else {
    Warn "Ollama not found — summarizer will not work without it."
}

# ─── 2. Summarizer service (FastAPI) ─────────────────────────
$SUMMARIZER_DIR = "$ROOT_DIR\services\summarizer"

Write-Host ""
$USE_VENV = Read-Host "Use Python virtual environment for summarizer? [y/N]"

if ($USE_VENV -match "^[yY]$") {
    Log "Using virtual environment for summarizer..."
    $VENV_DIR = "$SUMMARIZER_DIR\venv"
    if (-Not (Test-Path "$VENV_DIR")) {
        Log "Creating Python virtual environment for summarizer..."
        & $PYTHON_CMD -m venv "$VENV_DIR"
        & "$VENV_DIR\Scripts\pip.exe" install -q -r "$SUMMARIZER_DIR\requirements.txt"
        Ok "Virtual environment created and dependencies installed."
    }
    $SUMMARIZER_PYTHON = "$VENV_DIR\Scripts\python.exe"
} else {
    Log "Using system Python for summarizer..."
    # Check that required Python packages are installed
    $null = & $PYTHON_CMD -c "import whisper, httpx, fastapi, uvicorn" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Warn "Some Python dependencies are missing for the summarizer service."
        Warn "Install them with: pip install -r services\summarizer\requirements.txt"
        Warn "Summarizer may fail to start."
    }
    $SUMMARIZER_PYTHON = $PYTHON_CMD
}

Log "Starting Summarizer service..."
$summarizerProc = Start-Process -FilePath $SUMMARIZER_PYTHON `
    -ArgumentList "-m uvicorn main:app --reload --port 8000" `
    -WorkingDirectory $SUMMARIZER_DIR `
    -PassThru -NoNewWindow
$script:Processes += $summarizerProc
Ok "Summarizer starting on http://localhost:8000 (PID $($summarizerProc.Id))"

# ─── 3. API server (Express) ─────────────────────────────────
Log "Starting API server..."
$apiProc = Start-Process -FilePath "node" `
    -ArgumentList "server.js" `
    -WorkingDirectory "$ROOT_DIR\services\api" `
    -PassThru -NoNewWindow
$script:Processes += $apiProc
Ok "API server starting on http://localhost:3001 (PID $($apiProc.Id))"

# ─── 4. Frontend (Vite) ──────────────────────────────────────
Log "Starting Frontend dev server..."
$frontendProc = Start-Process -FilePath "npx" `
    -ArgumentList "vite --host" `
    -WorkingDirectory "$ROOT_DIR" `
    -PassThru -NoNewWindow
$script:Processes += $frontendProc
Ok "Frontend starting on http://localhost:5173 (PID $($frontendProc.Id))"

# ─── Ready ────────────────────────────────────────────────────
Start-Sleep -Seconds 2
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  Ata Meeting Assistant is running!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:     " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor Cyan
Write-Host "  API Server:   " -NoNewline; Write-Host "http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Summarizer:   " -NoNewline; Write-Host "http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press " -NoNewline; Write-Host "Ctrl+C" -ForegroundColor Yellow -NoNewline; Write-Host " to stop all services."
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green

# Wait for all processes — poll until Ctrl+C
try {
    while ($true) {
        # Check if any critical process has exited
        $exited = $script:Processes | Where-Object { $_.HasExited }
        foreach ($p in $exited) {
            Warn "Process PID $($p.Id) has exited with code $($p.ExitCode)"
        }
        Start-Sleep -Seconds 2
    }
} finally {
    Cleanup
}
