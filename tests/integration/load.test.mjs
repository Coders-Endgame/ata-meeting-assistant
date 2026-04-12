import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAdminClient,
  cleanupSessionBundle,
  seedSessionBundle,
} from '../helpers/supabase-admin.mjs';

const admin = createAdminClient();
const apiBaseUrl = 'http://127.0.0.1:3001';

test('TC-26 summarize handles five concurrent real-stack requests without crashing', async (t) => {
  const { sessionId } = await seedSessionBundle({
    admin,
    sourceType: 'offline',
    processingStatus: 'completed',
    transcripts: [
      {
        speaker: 'Lead',
        transcript: 'We will finish the regression suite this week.',
      },
      {
        speaker: 'Owner',
        transcript: 'Sam will verify the release checklist tomorrow.',
      },
    ],
  });

  t.after(async () => {
    await cleanupSessionBundle(admin, sessionId);
  });

  const requestBody = JSON.stringify({ sessionId });
  const requests = Array.from({ length: 5 }, () =>
    fetch(`${apiBaseUrl}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    }),
  );

  const responses = await Promise.all(requests);
  for (const response of responses) {
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(typeof body.summary, 'string');
  }

  const healthResponse = await fetch(`${apiBaseUrl}/health`);
  assert.equal(healthResponse.status, 200);
});
