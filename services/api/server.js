const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const express = require('express');
const cors = require('cors');

// Initialize supabase early to trigger warnings at startup
require('./lib/supabase');

const botRouter = require('./routers/botRouter');
const summarizerRouter = require('./routers/summarizerRouter');
const preferencesRouter = require('./routers/preferencesRouter');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Load shared config
const configPath = path.join(__dirname, '..', 'bot', 'config.json');
let appConfig = {};
try {
    appConfig = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'));
    console.log('Loaded config:', appConfig);
} catch (err) {
    console.warn('Could not load config.json, using defaults');
}


/* --- APPLICATION-LEVEL ENDPOINTS --- */ 

// Health chech endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Expose live interval seconds to endpoint (only relevant settings exported)
app.get('/api/config', (req, res) => {
    res.json({ live_summary_interval_sec: appConfig.live_summary_interval_sec || 15 });
});


// Pass the incoming requests to relevant routers
app.use('/api/bot', botRouter);
app.use('/api', summarizerRouter);
app.use('/api/preferences', preferencesRouter);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});