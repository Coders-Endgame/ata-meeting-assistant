#!/bin/zsh
# ──────────────────────────────────────────────────────────────
#  Ata Meeting Assistant — Start / Stop all services
# ──────────────────────────────────────────────────────────────
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS=()

# ─── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${CYAN}[ata]${NC} $1"; }
ok()   { echo -e "${GREEN}[ata]${NC} $1"; }
warn() { echo -e "${YELLOW}[ata]${NC} $1"; }
err()  { echo -e "${RED}[ata]${NC} $1"; }

# ─── Cleanup on exit ─────────────────────────────────────────
cleanup() {
    echo ""
    log "Shutting down all services..."

    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
        fi
    done

    # Wait briefly for processes to terminate
    sleep 1

    # Force-kill any remaining
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            warn "Force-killing PID $pid"
            kill -9 "$pid" 2>/dev/null
        fi
    done

    ok "All services stopped. Goodbye!"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ─── Preflight checks ────────────────────────────────────────
log "Running preflight checks..."

if ! command -v node &>/dev/null; then
    err "Node.js is not installed."; exit 1
fi

if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
    err "Python is not installed."; exit 1
fi

if ! command -v docker &>/dev/null; then
    warn "Docker is not installed — Zoom bot will not be available."
fi

PYTHON_CMD="python3"
if ! command -v python3 &>/dev/null; then
    PYTHON_CMD="python"
fi

# Check for .env file
if [ ! -f "$ROOT_DIR/.env" ]; then
    err ".env file not found! Copy .env.example to .env and fill in values."
    exit 1
fi

# ─── 1. Ollama ───────────────────────────────────────────────
if command -v ollama &>/dev/null; then
    if ! curl -s http://localhost:11434/api/tags &>/dev/null; then
        log "Starting Ollama..."
        ollama serve &>/dev/null &
        PIDS+=($!)
        sleep 2
        ok "Ollama started (PID ${PIDS[-1]})"
    else
        ok "Ollama is already running."
    fi
else
    warn "Ollama not found — summarizer will not work without it."
fi

# ─── 2. Summarizer service (FastAPI) ─────────────────────────
SUMMARIZER_DIR="$ROOT_DIR/services/summarizer"

echo ""
echo -n "Use Python virtual environment for summarizer? [y/N]: "
read USE_VENV

if [[ "$USE_VENV" == "y" || "$USE_VENV" == "Y" ]]; then
    log "Using virtual environment for summarizer..."
    VENV_DIR="$SUMMARIZER_DIR/venv"
    if [ ! -d "$VENV_DIR" ]; then
        log "Creating Python virtual environment for summarizer..."
        $PYTHON_CMD -m venv "$VENV_DIR"
        "$VENV_DIR/bin/pip" install -q -r "$SUMMARIZER_DIR/requirements.txt"
        ok "Virtual environment created and dependencies installed."
    fi
    SUMMARIZER_PYTHON="$VENV_DIR/bin/python"
else
    # Default is system Python
    log "Using system Python for summarizer..."
    # Check that required Python packages are installed
    if ! $PYTHON_CMD -c "import whisper, httpx, fastapi, uvicorn" 2>/dev/null; then
        warn "Some Python dependencies are missing for the summarizer service."
        warn "Install them with: pip install -r services/summarizer/requirements.txt"
        warn "Summarizer may fail to start."
    fi
    SUMMARIZER_PYTHON="$PYTHON_CMD"
fi

log "Starting Summarizer service..."
(
    cd "$SUMMARIZER_DIR"
    $SUMMARIZER_PYTHON -m uvicorn main:app --reload --port 8000
) &
PIDS+=($!)
ok "Summarizer starting on http://localhost:8000 (PID ${PIDS[-1]})"

# ─── 3. API server (Express) ─────────────────────────────────
log "Starting API server..."
(
    cd "$ROOT_DIR/services/api"
    node server.js
) &
PIDS+=($!)
ok "API server starting on http://localhost:3001 (PID ${PIDS[-1]})"

# ─── 4. Frontend (Vite) ──────────────────────────────────────
log "Starting Frontend dev server..."
(
    cd "$ROOT_DIR"
    npx vite --host
) &
PIDS+=($!)
ok "Frontend starting on http://localhost:5173 (PID ${PIDS[-1]})"

# ─── Ready ────────────────────────────────────────────────────
sleep 2
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Ata Meeting Assistant is running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Frontend:     ${CYAN}http://localhost:5173${NC}"
echo -e "  API Server:   ${CYAN}http://localhost:3001${NC}"
echo -e "  Summarizer:   ${CYAN}http://localhost:8000${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services."
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Wait for all background processes
wait
