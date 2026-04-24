import { test, expect } from '@playwright/test';

import {
  createAdminClient,
  cleanupSessionBundle,
  deleteUserById,
  seedUser,
  uniqueEmail,
  fixturePath,
} from '../helpers/supabase-admin.mjs';
import { loginThroughUi } from '../helpers/ui.mjs';
import { sleep } from '../helpers/wait.mjs';

const admin = createAdminClient();

/**
 * Measures per-segment transcription latency as the delta between
 *   (1) when the audio snippet starts in the source file (timestamp_ms)
 *   and   (2) when that snippet is rendered in the browser UI.
 *
 * Formula for each segment:
 *   latencyMs = (uiVisibleTime - uploadTime) - audioTimestampMs
 *
 * In offline mode Whisper processes the whole file before persisting,
 * so later segments may show very small (or slightly negative) values.
 * This is expected — the test still records the true delta.
 */
test('TC-22 per-segment transcription latency (audio timestamp → UI)', async ({ page }) => {
  const { user, email, password } = await seedUser({
    admin,
    email: uniqueEmail('latency'),
  });

  let sessionId = null;

  try {
    await loginThroughUi(page, email, password);

    // 1. Upload audio fixture
    await page.locator('#audioUpload').setInputFiles(fixturePath('audio', 'offline-meeting.wav'));

    // 2. Click Summarize — this is T0 for latency calculations
    const uploadTime = Date.now();
    await page.getByRole('button', { name: 'Summarize' }).click();

    // 3. Wait for redirect to the session detail page
    await page.waitForURL(/\/session\/[0-9a-f-]+$/i, { timeout: 30_000 });
    sessionId = page.url().split('/session/')[1];

    // 4. Poll DB and record latency for every new transcript segment
    const tracked = new Set();
    const segmentLatencies = [];
    let lastNewTranscriptAt = Date.now();

    const POLL_INTERVAL_MS = 1_000;
    const MAX_IDLE_MS = 15_000;
    const MAX_TOTAL_MS = 300_000;

    while (Date.now() - uploadTime < MAX_TOTAL_MS) {
      const { data: transcripts, error } = await admin
        .from('transcripts')
        .select('id, speaker, transcript, timestamp_ms, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      let newFound = false;
      for (const t of transcripts) {
        if (tracked.has(t.id)) continue;
        tracked.add(t.id);
        newFound = true;
        lastNewTranscriptAt = Date.now();

        // Wait for this exact text to appear in the UI
        const preview = t.transcript.length > 60
          ? t.transcript.substring(0, 60)
          : t.transcript;
        const locator = page.getByText(preview, { exact: false });
        await expect(locator).toBeVisible({ timeout: 30_000 });

        const uiVisibleTime = Date.now();
        const timeSinceUploadMs = uiVisibleTime - uploadTime;
        const latencyMs = timeSinceUploadMs - (t.timestamp_ms ?? 0);

        segmentLatencies.push({
          index: tracked.size,
          speaker: t.speaker,
          textPreview: preview,
          audioTimestampMs: t.timestamp_ms ?? 0,
          timeSinceUploadMs,
          latencyMs,
        });
      }

      // Stop if the backend says processing is completed and we already captured segments
      const { data: sessionData } = await admin
        .from('sessions')
        .select('processing_status')
        .eq('id', sessionId)
        .maybeSingle();

      if (sessionData?.processing_status === 'completed' && tracked.size > 0) {
        break;
      }

      // Also stop if no new segment arrived for a while
      if (!newFound && tracked.size > 0 && Date.now() - lastNewTranscriptAt > MAX_IDLE_MS) {
        break;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    if (segmentLatencies.length === 0) {
      throw new Error('No transcript segments were found for latency measurement.');
    }

    // 5. Report per-segment latencies
    // eslint-disable-next-line no-console
    console.log(`\n=== Per-Segment Transcription Latency (${segmentLatencies.length} segments) ===`);
    // eslint-disable-next-line no-console
    console.table(segmentLatencies.map((s) => ({
      index: s.index,
      speaker: s.speaker,
      audioPosSec: (s.audioTimestampMs / 1000).toFixed(1),
      latencySec: (s.latencyMs / 1000).toFixed(2),
    })));

    const lats = segmentLatencies.map((s) => s.latencyMs);
    const avg = (arr) => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
    const min = Math.min(...lats);
    const max = Math.max(...lats);

    // eslint-disable-next-line no-console
    console.log(`\nLatency stats (ms)  min: ${min}, max: ${max}, avg: ${avg(lats)}`);
    // eslint-disable-next-line no-console
    console.log(`Latency stats (sec) min: ${(min / 1000).toFixed(2)}, max: ${(max / 1000).toFixed(2)}, avg: ${(avg(lats) / 1000).toFixed(2)}`);
    // eslint-disable-next-line no-console
    console.log(`===========================================================\n`);

    // 6. Sanity assertions — allow slightly negative values for offline Whisper
    expect(segmentLatencies.length).toBeGreaterThan(0);
    expect(min).toBeGreaterThan(-30_000); // no more than 30 s "early"
    expect(max).toBeLessThan(300_000);    // 5 min ceiling
  } finally {
    if (sessionId) {
      await cleanupSessionBundle(admin, sessionId);
    }
    await deleteUserById(admin, user.id);
  }
});
