import { readFile } from 'node:fs/promises';

import { test, expect } from '@playwright/test';

import {
  createAdminClient,
  cleanupSessionBundle,
  deleteUserById,
  listSessionActionItems,
  seedSessionBundle,
  seedUser,
  uniqueEmail,
} from '../helpers/supabase-admin.mjs';
import { loginThroughUi } from '../helpers/ui.mjs';
import { waitFor } from '../helpers/wait.mjs';

const admin = createAdminClient();

test('TC-20, TC-21, and TC-30 session page exports outputs and updates action items', async ({ page }) => {
  const { user, email, password } = await seedUser({
    admin,
    email: uniqueEmail('session'),
  });
  const { sessionId } = await seedSessionBundle({
    admin,
    ownerId: user.id,
    sourceType: 'Session E2E',
    transcripts: [
      {
        speaker: 'Alice',
        transcript: 'The team approved the release plan.',
        timestamp_ms: 0,
      },
      {
        speaker: 'Bob',
        transcript: 'Alice will share the follow-up notes by Friday.',
        timestamp_ms: 5_000,
      },
    ],
    summary: 'The team approved the release plan and assigned follow-up notes.',
    actionItems: [
      {
        description: 'Share the follow-up notes.',
        status: 'pending',
        assignee: 'Alice',
      },
    ],
  });

  try {
    await loginThroughUi(page, email, password);
    await page.goto(`/session/${sessionId}`);

    await expect(page.getByText('The team approved the release plan and assigned follow-up notes.')).toBeVisible();
    await expect(page.getByText('Share the follow-up notes.')).toBeVisible();

    await page.getByLabel('Export transcript').click();
    const [transcriptDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Export as TXT' }).click(),
    ]);
    const transcriptPath = await transcriptDownload.path();
    const transcriptContents = await readFile(transcriptPath, 'utf8');
    await expect(transcriptContents).toContain('The team approved the release plan.');

    await page.getByLabel('Export summary').click();
    const [summaryDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Export as JSON' }).click(),
    ]);
    const summaryPath = await summaryDownload.path();
    const summaryContents = JSON.parse(await readFile(summaryPath, 'utf8'));
    await expect(summaryContents.summary).toContain('approved the release plan');
    await expect(summaryContents.action_items[0].description).toContain('follow-up notes');

    await page.getByRole('checkbox').click();
    await waitFor(async () => {
      const items = await listSessionActionItems(admin, sessionId);
      return items.find((item) => item.description === 'Share the follow-up notes.' && item.status === 'done');
    }, {
      timeout: 15_000,
      interval: 1_000,
      message: 'Action item status was not updated to done.',
    });
  } finally {
    await cleanupSessionBundle(admin, sessionId);
    await deleteUserById(admin, user.id);
  }
});
