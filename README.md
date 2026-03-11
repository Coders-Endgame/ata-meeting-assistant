# Ata Meeting Assistant

This is a React-based meeting assistant application built with Vite and Supabase. It allows users to manage meeting sessions, automatically transcribe Zoom meetings in real-time, and generate AI-powered summaries and action items.

## Features

- **Zoom Bot Integration**: Automatically join Zoom meetings and transcribe audio in real-time
- **Real-time Transcripts**: Watch transcripts appear as they're spoken
- **AI Summary & Action Items**: Generate meeting summaries and action items using a local LLM (Ollama)
- **Session Management**: Create and join meeting sessions
- **Audio Upload**: Upload audio files for transcription and summarization

## Project Structure

```
ata-meeting-assistant/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/               #   Reusable UI components
│   ├── pages/                    #   Page-level components
│   ├── assets/                   #   Static assets
│   ├── App.tsx                   #   Root component & routing
│   └── supabaseClient.ts        #   Supabase client init
│
├── services/                     # Backend services
│   ├── api/                      #   Express.js API gateway (port 3001)
│   │   ├── server.js             #     API routes & bot orchestration
│   │   └── package.json          #     Node.js dependencies
│   ├── bot/                      #   Zoom meeting bot (Docker)
│   │   ├── bot.py                #     Playwright + Whisper transcription
│   │   ├── config.json           #     Bot & model configuration
│   │   ├── Dockerfile            #     Container build
│   │   ├── docker-compose.yml    #     Container orchestration
│   │   └── start.sh              #     PulseAudio + bot entrypoint
│   └── summarizer/               #   AI summarizer (FastAPI, port 8000)
│       ├── main.py               #     Summarize, transcribe & chat endpoints
│       └── requirements.txt      #     Python dependencies
│
├── supabase/                     # Database configuration
│   ├── config.toml               #   Supabase local config
│   └── snippets/                 #   SQL migration snippets
│
├── .env                          # Environment variables (not committed)
├── .env.example                  # Environment variable template
└── README.md
```

## Prerequisites

Before you begin, ensure you have met the following requirements:

*   **Node.js**: You need to have Node.js installed on your machine.
*   **npm**: This project uses npm for package management.
*   **Docker Desktop**: You need Docker Desktop installed and running for both Supabase and the Zoom bot.
*   **Python 3.9+**: Required for the AI summarizer service.
*   **Ollama**: Local LLM runtime for AI-powered summaries. Install from [ollama.ai](https://ollama.ai) or `brew install ollama`.

## Getting Started

Follow these steps to get the project up and running on your local machine.

### Quick Start (All-in-One)

After completing the setup steps below once, you can start everything with a single command:

```bash
./start.sh
```

This starts Supabase, Ollama, the Summarizer, API server, and Frontend. Press **Ctrl+C** to stop all services.

### 1. Clone the repository

```bash
git clone https://github.com/Coders-Endgame/ata-meeting-assistant.git
cd ata-meeting-assistant
```

### 2. Install Dependencies

Install the frontend dependencies:

```bash
npm install
```

Install API server dependencies:

```bash
cd services/api
npm install
cd ../..
```

### 3. Start Local Supabase (Backend)

We use the Supabase CLI to run the entire backend stack locally using Docker.

**Start the Supabase services:**
```bash
npx supabase start
```

This command will download the necessary Docker images and start the Supabase containers. Once complete, it will output your local API URL, Anon Key, and Service Role Key.

**Access the Supabase Studio (Dashboard):**
You can manage your local database and view tables at:
[http://localhost:54323](http://localhost:54323)

### 4. Configure Environment Variables

Create a file named `.env` in the root directory of the project. Use the output from the `npx supabase start` command to fill in the values.

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your_local_anon_key_from_CLI_output
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_CLI_output

# For backend server and bot
SUPABASE_URL=http://127.0.0.1:54321

# For summarizer service (Ollama)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

### 5. Database Setup

The local Supabase instance should pick up the configuration. If you need to manually apply the schema, you can run the SQL script located in `table.sql` inside the SQL Editor of your local Supabase Studio running at [http://localhost:54323](http://localhost:54323).

### 6. Build the Zoom Bot Docker Image

Build the Docker image for the Zoom bot:

```bash
cd services/bot
docker compose build
cd ../..
```

### 7. Set Up the AI Summarizer Service

Start Ollama and pull the language model:

```bash
ollama serve           # Start the Ollama server (keep running)
ollama pull llama3.1   # Pull the model (~4.7GB, one-time)
```

Install Python dependencies and start the service:

```bash
cd services/summarizer
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
cd ../..
```

The summarizer service will run at `http://localhost:8000`.

### 8. Start the Backend API Server

The API server manages bot instances and proxies summarization requests:

```bash
cd services/api
npm start
```

The server will run at `http://localhost:3001`.

### 9. Run the Frontend Application

In a new terminal, start the Vite development server:

```bash
npm run dev
```

The application should now be running at `http://localhost:5173` (or another port if 5173 is occupied).

## Usage

1. Open the application in your browser
2. Enter a Zoom meeting URL in the dashboard
3. The bot will automatically join the meeting and start transcribing
4. Transcripts appear in real-time on the session page
5. Click **"Generate"** in the summary panel to produce an AI summary and action items
6. Toggle action item checkboxes to mark them as completed

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │   services/api   │     │  services/bot   │
│   Frontend      │────▶│  (Express.js)    │────▶│  (Python +      │
│   (React)       │     │  Port 3001       │     │   Docker)       │
│                 │     │                  │     │                 │
└────────┬────────┘     └────────┬─────┬──┘     └────────┬────────┘
         │                       │     │                  │
         │                       │     │                  │
         │               ┌───────┘     └───────┐          │
         │               │                     │          │
         │               ▼                     │          │
         │      ┌─────────────────┐            │          │
         │      │   services/     │            │          │
         │      │   summarizer    │            │          │
         │      │  (FastAPI +     │            │          │
         │      │   Ollama LLM)   │            │          │
         │      │  Port 8000      │            │          │
         │      └────────┬────────┘            │          │
         │               │                     │          │
         ▼               ▼                     ▼          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Supabase                                │
│              (PostgreSQL + Realtime Subscriptions)              │
└─────────────────────────────────────────────────────────────────┘
```

### Service Boundaries

| Service | Location | Language | Port | Responsibility |
|---|---|---|---|---|
| **Frontend** | `src/` | TypeScript (React) | 5173 | UI, real-time subscriptions |
| **API Gateway** | `services/api/` | JavaScript (Express) | 3001 | Bot orchestration, proxy to summarizer, user preferences |
| **Zoom Bot** | `services/bot/` | Python (Playwright + Whisper) | — | Join Zoom meetings, capture audio, real-time transcription |
| **Summarizer** | `services/summarizer/` | Python (FastAPI + Ollama) | 8000 | AI summarization, transcription, chat |
| **Database** | `supabase/` | SQL (PostgreSQL) | 54321 | Data persistence, auth, real-time |

## Managing Local Services

**Stop Supabase:**
When you are done working, you can stop the local Docker containers to free up resources:
```bash
npx supabase stop
```

## Scripts

*   `npm run dev`: Starts the development server.
*   `npm run build`: Compiles the TypeScript code and builds the application for production.
*   `npm run lint`: Runs ESLint to check for code quality issues.
*   `npm run preview`: Locally previews the production build.

## API Endpoints (Backend Server)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/bot/start` | POST | Start bot for a session |
| `/api/bot/stop` | POST | Stop bot for a session |
| `/api/bot/status/:sessionId` | GET | Check bot status |
| `/api/bot/list` | GET | List all running bots |
| `/api/summarize` | POST | Generate AI summary & action items |
| `/api/transcribe` | POST | Transcribe uploaded audio |
| `/api/chat` | POST | Chat with transcript context |
| `/api/models` | GET | List available LLM models |
| `/api/preferences/:userId` | GET/PUT | User model preferences |

## Technologies Used

*   [React](https://react.dev/)
*   [Vite](https://vitejs.dev/)
*   [TypeScript](https://www.typescriptlang.org/)
*   [Supabase](https://supabase.com/)
*   [Express.js](https://expressjs.com/)
*   [FastAPI](https://fastapi.tiangolo.com/) (Python summarizer service)
*   [Ollama](https://ollama.ai/) (local LLM runtime)
*   [Docker](https://www.docker.com/)
*   [Playwright](https://playwright.dev/) (for browser automation)
*   [Faster-Whisper](https://github.com/guillaumekln/faster-whisper) (for speech-to-text)
