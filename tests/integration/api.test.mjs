import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAdminClient,
  createRunId,
  getSessionSummary,
  getUserPreferences,
  listSessionActionItems,
  seedSessionBundle,
  seedUser,
  cleanupSessionBundle,
  deleteUserById,
} from '../helpers/supabase-admin.mjs';

const admin = createAdminClient();
const apiBaseUrl = 'http://127.0.0.1:3001';

async function fetchJson(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { response, body };
}

test('TC-04 API health check returns status and timestamp', async () => {
  const { response, body } = await fetchJson('/health');
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.ok(typeof body.timestamp === 'string' && body.timestamp.length > 0);
});

test('TC-05 summarize endpoint rejects requests without a sessionId', async () => {
  const { response, body } = await fetchJson('/api/summarize', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
  assert.equal(body.error, 'sessionId is required');
});

test('TC-06 transcribe endpoint rejects requests without a sessionId', async () => {
  const { response, body } = await fetchJson('/api/transcribe', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
  assert.equal(body.error, 'sessionId is required');
});

test('TC-07 chat endpoint rejects requests without the required fields', async () => {
  const { response, body } = await fetchJson('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ sessionId: '' }),
  });
  assert.equal(response.status, 400);
  assert.equal(body.error, 'sessionId and message are required');
});

test('TC-08 bot start rejects requests without a zoomUrl', async () => {
  const { response, body } = await fetchJson('/api/bot/start', {
    method: 'POST',
    body: JSON.stringify({ sessionId: 'missing-url' }),
  });
  assert.equal(response.status, 400);
  assert.equal(body.error, 'zoomUrl and sessionId are required');
});

test('Live API config endpoint exposes the summary interval used by the UI', async () => {
  const { response, body } = await fetchJson('/api/config');
  assert.equal(response.status, 200);
  assert.equal(typeof body.live_summary_interval_sec, 'number');
});

test('Live API models endpoint proxies the summarizer models list', async () => {
  const { response, body } = await fetchJson('/api/models');
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.models));
  assert.equal(typeof body.default, 'string');
});

test('TC-13 and TC-14 summarize forwards to the live summarizer and persists results', async (t) => {
  const runId = createRunId('summarize');
  const transcripts = [
    {
      speaker: 'Alice',
      transcript: `Project ${runId} is on track and we approved the final timeline.`,
      timestamp_ms: 0,
    },
    {
      speaker: 'Bob',
      transcript: `Alice will send the budget follow-up for ${runId} by tomorrow morning.`,
      timestamp_ms: 4_000,
    },
  ];

  const { sessionId } = await seedSessionBundle({
    admin,
    sourceType: 'offline',
    processingStatus: 'completed',
    transcripts,
  });
  t.after(async () => {
    await cleanupSessionBundle(admin, sessionId);
  });

  const { response, body } = await fetchJson('/api/summarize', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });

  assert.equal(response.status, 200);
  assert.equal(typeof body.summary, 'string');
  assert.ok(body.summary.length > 0);
  assert.ok(Array.isArray(body.action_items));

  const savedSummary = await getSessionSummary(admin, sessionId);
  assert.equal(savedSummary?.summary, body.summary);

  const savedActionItems = await listSessionActionItems(admin, sessionId);
  assert.ok(Array.isArray(savedActionItems));
});

test('Live chat endpoint answers from transcript context through the running stack', async (t) => {
  const { sessionId } = await seedSessionBundle({
    admin,
    sourceType: 'offline',
    processingStatus: 'completed',
    transcripts: [
      {
        speaker: 'Dana',
        transcript: 'The deployment window is Thursday at 10 AM.',
        timestamp_ms: 0,
      },
    ],
  });
  t.after(async () => {
    await cleanupSessionBundle(admin, sessionId);
  });

  const { response, body } = await fetchJson('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      message: 'When is the deployment window?',
      history: [],
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(typeof body.reply, 'string');
  assert.ok(body.reply.length > 0);
});

test('TC-15 preferences save and load through the live API and database', async (t) => {
  const { user } = await seedUser({
    admin,
    email: `${createRunId('prefs')}@example.com`,
  });
  t.after(async () => {
    await deleteUserById(admin, user.id);
  });

  const putResult = await fetchJson(`/api/preferences/${user.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      preferred_model: process.env.OLLAMA_MODEL || 'llama3.1',
      preferred_language: 'tr',
    }),
  });

  assert.equal(putResult.response.status, 200);
  assert.equal(putResult.body.preferred_language, 'tr');

  const getResult = await fetchJson(`/api/preferences/${user.id}`);
  assert.equal(getResult.response.status, 200);
  assert.equal(getResult.body.preferred_language, 'tr');

  const dbPreferences = await getUserPreferences(admin, user.id);
  assert.equal(dbPreferences.preferred_language, 'tr');
});

test('Bot status and list endpoints report an idle system when no bot is running', async () => {
  const statusResult = await fetchJson('/api/bot/status/non-existent-session');
  assert.equal(statusResult.response.status, 200);
  assert.equal(statusResult.body.running, false);
  assert.equal(statusResult.body.status, 'stopped');

  const listResult = await fetchJson('/api/bot/list');
  assert.equal(listResult.response.status, 200);
  assert.ok(Array.isArray(listResult.body.bots));
});
