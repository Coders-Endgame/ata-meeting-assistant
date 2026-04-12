## Backend API Server

### Folder Structure

services/api/
|
├── server.js                       ← define routers, /health, /api/config
│
├── lib/
│   └── supabase.js                 ← initializes Supabase client
│
│
└── routes/
    ├── summarizerRouter.js          ← /api/transcribe, /api/summarize, /api/chat, /api/models
    ├── preferenceRoutes.js          ← /api/preferences/:userId (GET and PUT)
    └── botRouter.js                 ← /api/bot/*

### Running the service

Install dependencies:

```bash
cd services/api
npm install
```

Start the server:

```bash
npm start
```

The API server runs at `http://localhost:3001`. It starts independently, other services (summarizer, bot) do not need to be running, but their related endpoints will return `503` until they are available.