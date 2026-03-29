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

# Detect Python (Windows usually has 'python', not 'python3')
if (Get-Command python -ErrorAction SilentlyContinue) {
    $PYTHON_CMD = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $PYTHON_CMD = "python3"
} else {
    Err "Python not found"; exit 1
}
Ok "Using Python command: $PYTHON_CMD"

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
Log "Starting Summarizer service..."
$summarizerProc = Start-Process -FilePath $PYTHON_CMD `
    -ArgumentList "-m uvicorn main:app --reload --port 8000" `
    -WorkingDirectory "$ROOT_DIR\services\summarizer" `
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
$frontendProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npx vite --host" `
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
