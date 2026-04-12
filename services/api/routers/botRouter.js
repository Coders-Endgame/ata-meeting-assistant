const express = require('express');
const router = express.Router();
const path = require('path');
const { spawn } = require('child_process');
const supabase = require('../lib/supabase');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const runningBots = new Map();

// Start bot endpoint
router.post('/start', async (req, res) => {
    const { zoomUrl, sessionId, language } = req.body;

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
        const botDir = path.join(__dirname, '..', '..', 'bot');

        // Start docker compose with environment variables
        // Note: --add-host is only needed on Linux; Windows/macOS Docker Desktop has host.docker.internal built-in
        const dockerProcess = spawn('docker', [
            'compose',
            'run',
            '--rm',
            '-e', `ZOOM_URL=${zoomUrl}`,
            '-e', `SESSION_ID=${sessionId}`,
            '-e', `SUPABASE_URL=${SUPABASE_URL}`,
            '-e', `SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}`,
            '-e', `TRANSCRIPTION_LANGUAGE=${language || 'en'}`,
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
router.post('/stop', async (req, res) => {
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
router.get('/status/:sessionId', (req, res) => {
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
router.post('/status/:sessionId', async (req, res) => {
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
router.get('/list', (req, res) => {
    const bots = Array.from(runningBots.entries()).map(([sessionId, info]) => ({
        sessionId,
        zoomUrl: info.zoomUrl,
        status: info.status,
        startedAt: info.startedAt
    }));
    res.json({ bots });
});

module.exports = router;