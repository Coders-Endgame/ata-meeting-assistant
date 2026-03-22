import { test, expect } from '@playwright/test';

import {
  createAdminClient,
  cleanupSessionBundle,
  deleteUserById,
  seedSessionBundle,
  seedUser,
  uniqueEmail,
} from '../helpers/supabase-admin.mjs';
import { loginThroughUi } from '../helpers/ui.mjs';

const admin = createAdminClient();

test('TC-19 dashboard shows recent sessions and clicking a session opens the detail page', async ({ page }) => {
  const { user, email, password } = await seedUser({
    admin,
    email: uniqueEmail('history'),
  });
  const historyLabel = `History E2E ${Date.now()}`;
  const { sessionId } = await seedSessionBundle({
    admin,
    sourceType: historyLabel,
    ownerId: user.id,
    transcripts: [
      {
        speaker: 'Host',
        transcript: 'History session transcript entry.',
      },
    ],
    summary: 'History session summary.',
  });

  try {
    await loginThroughUi(page, email, password);
    await expect(page.getByText('Recent Sessions')).toBeVisible();
    await expect(page.getByText(historyLabel)).toBeVisible();
    await page.getByText(historyLabel).click();
    await expect(page).toHaveURL(new RegExp(`/session/${sessionId}$`));
    await expect(page.getByText('History session summary.')).toBeVisible();
  } finally {
    await cleanupSessionBundle(admin, sessionId);
    await deleteUserById(admin, user.id);
  }
});
