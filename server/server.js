const path = require('path');
// Load environment variables from parent directory's .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY not set. Database operations will fail.');
}

// Initialize Supabase client (only if key is available)
let supabase = null;
if (SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase client initialized successfully');
}

// Track running bot processes
const runningBots = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start bot endpoint
app.post('/api/bot/start', async (req, res) => {
    const { zoomUrl, sessionId } = req.body;

    if (!zoomUrl || !sessionId) {
        return res.status(400).json({ error: 'zoomUrl and sessionId are required' });
    }

    // Check if bot is already running for this session
    if (runningBots.has(sessionId)) {
        return res.status(409).json({ error: 'Bot already running for this session' });
    }

    let botId = null;
    try {
        // Insert into bots table
        if (supabase) {
            const { data: botData, error: insertError } = await supabase
                .from('bots')
                .insert({ session: sessionId })
                .select('id')
                .single();

            if (insertError) {
                console.error('Error inserting bot:', insertError);
            } else {
                botId = botData?.id;
                console.log(`[Bot ${sessionId}] Created bot record with id: ${botId}`);
            }
        }

        // Path to bot directory
        const botDir = path.join(__dirname, '..', 'bot');

        // Convert localhost to host.docker.internal for Docker container access
        let dockerSupabaseUrl = SUPABASE_URL;
        if (dockerSupabaseUrl.includes('127.0.0.1') || dockerSupabaseUrl.includes('localhost')) {
            dockerSupabaseUrl = dockerSupabaseUrl
                .replace('127.0.0.1', 'host.docker.internal')
                .replace('localhost', 'host.docker.internal');
            console.log(`Using Docker-compatible URL: ${dockerSupabaseUrl}`);
        }

        // Start docker compose with environment variables
        // Note: --add-host is only needed on Linux; Windows/macOS Docker Desktop has host.docker.internal built-in
        const dockerProcess = spawn('docker', [
            'compose',
            'run',
            '--rm',
            '-e', `ZOOM_URL=${zoomUrl}`,
            '-e', `SESSION_ID=${sessionId}`,
            '-e', `SUPABASE_URL=${dockerSupabaseUrl}`,
            '-e', `SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}`,
            'zoom-bot',
            '--url', zoomUrl,
            '--session-id', sessionId,
            '--name', 'ATA Smart Meeting Assistant'
        ], {
            cwd: botDir,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // Track the process with status
        runningBots.set(sessionId, {
            process: dockerProcess,
            zoomUrl,
            startedAt: new Date(),
            status: 'starting', // starting -> joining -> active -> ended
            botId: botId
        });

        // Log output
        dockerProcess.stdout.on('data', (data) => {
            console.log(`[Bot ${sessionId}] ${data.toString()}`);
        });

        dockerProcess.stderr.on('data', (data) => {
            console.error(`[Bot ${sessionId}] ${data.toString()}`);
        });

        // Handle process exit
        dockerProcess.on('close', async (code) => {
            console.log(`[Bot ${sessionId}] Process exited with code ${code}`);
            const botInfo = runningBots.get(sessionId);
            runningBots.delete(sessionId);

            // Update bot terminated_at
            if (supabase && botInfo?.botId) {
                await supabase
                    .from('bots')
                    .update({ terminated_at: new Date().toISOString() })
                    .eq('id', botInfo.botId);
            }
        });

        dockerProcess.on('error', (err) => {
            console.error(`[Bot ${sessionId}] Failed to start:`, err);
            runningBots.delete(sessionId);
        });

        res.json({
            success: true,
            message: 'Bot started successfully',
            sessionId
        });

    } catch (error) {
        console.error('Error starting bot:', error);
        res.status(500).json({ error: 'Failed to start bot' });
    }
});

// Stop bot endpoint
app.post('/api/bot/stop', async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
    }

    const botInfo = runningBots.get(sessionId);
    if (!botInfo) {
        return res.status(404).json({ error: 'No bot running for this session' });
    }

    try {
        // Kill the process
        botInfo.process.kill('SIGTERM');
        runningBots.delete(sessionId);

        res.json({ success: true, message: 'Bot stopped' });
    } catch (error) {
        console.error('Error stopping bot:', error);
        res.status(500).json({ error: 'Failed to stop bot' });
    }
});

// Get bot status
app.get('/api/bot/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const botInfo = runningBots.get(sessionId);

    if (botInfo) {
        res.json({
            running: true,
            sessionId,
            status: botInfo.status || 'starting',
            zoomUrl: botInfo.zoomUrl,
            startedAt: botInfo.startedAt
        });
    } else {
        res.json({ running: false, sessionId, status: 'stopped' });
    }
});

// Update bot status (called by bot to report its status)
app.post('/api/bot/status/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { status } = req.body;

    const botInfo = runningBots.get(sessionId);
    if (botInfo) {
        const previousStatus = botInfo.status;
        botInfo.status = status;
        console.log(`[Bot ${sessionId}] Status updated to: ${status}`);

        // Update started_at in bots table when bot becomes active
        if (status === 'active' && previousStatus !== 'active' && supabase && botInfo.botId) {
            await supabase
                .from('bots')
                .update({ started_at: new Date().toISOString() })
                .eq('id', botInfo.botId);
        }

        res.json({ success: true, status });
    } else {
        res.status(404).json({ error: 'Bot not found' });
    }
});

// List all running bots
app.get('/api/bot/list', (req, res) => {
    const bots = Array.from(runningBots.entries()).map(([sessionId, info]) => ({
        sessionId,
        zoomUrl: info.zoomUrl,
        status: info.status,
        startedAt: info.startedAt
    }));
    res.json({ bots });
});

// Transcribe endpoint - proxy to Python summarizer service
app.post('/api/transcribe', async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
    }

    try {
        const response = await fetch('http://localhost:8000/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            console.error(`[Transcribe] Error from Python service:`, errorData);
            return res.status(response.status).json({
                error: errorData.detail || 'Transcription failed'
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[Transcribe] Error:', error.message);
        if (error.cause && error.cause.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'Summarizer service is not running. Start it with: cd services/summarizer && uvicorn main:app --reload'
            });
        }
        res.status(500).json({ error: 'Failed to connect to summarizer service' });
    }
});

// Summarize endpoint - proxy to Python summarizer service
app.post('/api/summarize', async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
    }

    try {
        const response = await fetch('http://localhost:8000/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            console.error(`[Summarize] Error from Python service:`, errorData);
            return res.status(response.status).json({
                error: errorData.detail || 'Summarization failed'
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[Summarize] Error:', error.message);
        if (error.cause && error.cause.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'Summarizer service is not running. Start it with: cd services/summarizer && uvicorn main:app --reload'
            });
        }
        res.status(500).json({ error: 'Failed to connect to summarizer service' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
