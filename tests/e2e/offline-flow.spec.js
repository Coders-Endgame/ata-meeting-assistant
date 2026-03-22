import assert from 'node:assert/strict';

import { test, expect } from '@playwright/test';

import {
  createAdminClient,
  cleanupSessionBundle,
  deleteUserById,
  fixturePath,
  getSessionSummary,
  listSessionTranscripts,
  seedUser,
  uniqueEmail,
} from '../helpers/supabase-admin.mjs';
import { loginThroughUi } from '../helpers/ui.mjs';
import { waitFor } from '../helpers/wait.mjs';

const admin = createAdminClient();

test('TC-17 offline audio flow uploads audio, creates a session, and shows generated results', async ({ page }) => {
  const { user, email, password } = await seedUser({
    admin,
    email: uniqueEmail('offline'),
  });

  let sessionId = null;

  try {
    await loginThroughUi(page, email, password);
    await page.locator('#audioUpload').setInputFiles(fixturePath('audio', 'offline-meeting.wav'));
    await page.getByRole('button', { name: 'Summarize' }).click();

    await page.waitForURL(/\/session\/[0-9a-f-]+$/i, { timeout: 30_000 });
    sessionId = page.url().split('/session/')[1];
    assert.ok(sessionId, 'Expected the browser to navigate to a session detail page.');

    const pipelineResult = await waitFor(async () => {
      const transcripts = await listSessionTranscripts(admin, sessionId);
      const summary = await getSessionSummary(admin, sessionId);
      if (transcripts.length === 0 || !summary?.summary) {
        return null;
      }
      return { transcripts, summary };
    }, {
      timeout: 180_000,
      interval: 5_000,
      message: 'Offline pipeline did not produce transcripts and summary in time.',
    });

    await page.reload();
    const transcriptSnippet = pipelineResult.transcripts[0].transcript.split(' ').slice(0, 4).join(' ');
    const summarySnippet = pipelineResult.summary.summary.split(' ').slice(0, 6).join(' ');

    await expect(page.getByText(transcriptSnippet, { exact: false })).toBeVisible();
    await expect(page.getByText(summarySnippet, { exact: false })).toBeVisible();
  } finally {
    if (sessionId) {
      await cleanupSessionBundle(admin, sessionId);
    }
    await deleteUserById(admin, user.id);
  }
});
