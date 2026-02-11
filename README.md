# Ata Meeting Assistant

This is a React-based meeting assistant application built with Vite and Supabase. It allows users to manage meeting sessions, automatically transcribe Zoom meetings in real-time, and generate summaries.

## Features

- **Zoom Bot Integration**: Automatically join Zoom meetings and transcribe audio in real-time
- **Real-time Transcripts**: Watch transcripts appear as they're spoken
- **Session Management**: Create and join meeting sessions
- **Audio Upload**: Upload audio files for transcription and summarization

## Prerequisites

Before you begin, ensure you have met the following requirements:

*   **Node.js**: You need to have Node.js installed on your machine.
*   **npm**: This project uses npm for package management.
*   **Docker Desktop**: You need Docker Desktop installed and running for both Supabase and the Zoom bot.

## Getting Started

Follow these steps to get the project up and running on your local machine.

### 1. Clone the repository

```bash
git clone https://github.com/Coders-Endgame/ata-meeting-assistant.git
cd ata-meeting-assistant
```

### 2. Install Dependencies

Install the project dependencies using npm:

```bash
npm install
```

Also install server dependencies:

```bash
cd server
npm install
cd ..
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
```

### 5. Database Setup

The local Supabase instance should pick up the configuration. If you need to manually apply the schema, you can run the SQL script located in `table.sql` inside the SQL Editor of your local Supabase Studio running at [http://localhost:54323](http://localhost:54323).

### 6. Build the Zoom Bot Docker Image

Build the Docker image for the Zoom bot:

```bash
cd bot
docker compose build
cd ..
```

### 7. Start the Backend API Server

The API server manages bot instances and communicates with Docker:

```bash
cd server
npm start
```

The server will run at `http://localhost:3001`.

### 8. Run the Frontend Application

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

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Frontend      │────▶│  Backend API    │────▶│  Docker Bot     │
│   (React)       │     │  (Express.js)   │     │  (Python)       │
│                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Supabase                                │
│              (PostgreSQL + Realtime Subscriptions)              │
└─────────────────────────────────────────────────────────────────┘
```

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

## Technologies Used

*   [React](https://react.dev/)
*   [Vite](https://vitejs.dev/)
*   [TypeScript](https://www.typescriptlang.org/)
*   [Supabase](https://supabase.com/)
*   [Express.js](https://expressjs.com/)
*   [Docker](https://www.docker.com/)
*   [Playwright](https://playwright.dev/) (for browser automation)
*   [Faster-Whisper](https://github.com/guillaumekln/faster-whisper) (for speech-to-text)

