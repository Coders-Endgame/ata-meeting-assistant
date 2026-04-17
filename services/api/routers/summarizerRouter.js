const express = require('express');
const router = express.Router(); // to attach routers

const SUMMARIZER_URL = 'http://localhost:8000';
const ECONNREFUSED_MSG = 'Summarizer service is not running. Start it with: cd services/summarizer && uvicorn main:app --reload';

// helper function to proxy to the summarizer service
async function proxyToSummarizer(path, body, res, errorMessage = 'Request failed.') {
    try {
        const response = await fetch(`${SUMMARIZER_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            console.error(`[Summarizer proxy ${path}] Error from Python service:`, errorData);
            return res.status(response.status).json({ error: errorData.detail || errorMessage });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error(`[Summarizer proxy ${path}] Error:`, error.message);
        if (error.cause?.code === 'ECONNREFUSED') {
            return res.status(503).json({ error: ECONNREFUSED_MSG });
        }
        res.status(500).json({ error: 'Failed to connect to summarizer service' });
    }
}

// list existing models
router.get('/models', async (req, res) => {
    try {
        const response = await fetch(`${SUMMARIZER_URL}/models`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            return res.status(response.status).json({ error: errorData.detail || 'Failed to list models' });
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[Models] Error:', error.message);
        if (error.cause && error.cause.code === 'ECONNREFUSED') {
            return res.status(503).json({ error: 'Summarizer service is not running.' });
        }
        res.status(500).json({ error: 'Failed to list models' });
    }
});

// Transcribe endpoint - proxy to Python summarizer service
router.post('/transcribe', async (req, res) => {
    const { sessionId, model, language } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    await proxyToSummarizer('/transcribe', { session_id: sessionId, model: model || undefined, language: language || 'en' }, res, 'Transcription failed')
});

// Summarize endpoint - proxy to Python summarizer service
router.post('/summarize', async (req, res) => {
    const { sessionId, model, language } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    await proxyToSummarizer('/summarize', { session_id: sessionId, model: model || undefined, language: language || 'en' }, res, 'Summarization failed')
});

// Chat endpoint - proxy to Python summarizer service
router.post('/chat', async (req, res) => {
    const { sessionId, model, message, history } = req.body;
    if (!sessionId || !message) return res.status(400).json({ error: 'sessionId and message are required' });
    await proxyToSummarizer('/chat', { session_id: sessionId, message, history: history || [], model: model || undefined }, res, 'Chat request failed')
});

// expose the router
module.exports = router