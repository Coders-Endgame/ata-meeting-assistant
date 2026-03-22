import { test, expect } from '@playwright/test';

import {
  createAdminClient,
  deleteUserById,
  getUserPreferences,
  seedUser,
  uniqueEmail,
  upsertUserPreferences,
} from '../helpers/supabase-admin.mjs';
import { loginThroughUi, openUserMenu } from '../helpers/ui.mjs';

const admin = createAdminClient();

test('TC-15 settings loads live preferences and persists updated language selection', async ({ page }) => {
  const { user, email, password } = await seedUser({
    admin,
    email: uniqueEmail('settings'),
  });
  await upsertUserPreferences(admin, user.id, {
    preferred_language: 'en',
  });

  try {
    await loginThroughUi(page, email, password);
    await openUserMenu(page);
    await page.getByRole('menuitem', { name: 'Settings' }).click();

    await expect(page.getByText('Choose which LLM model to use for summarization and chat.')).toBeVisible();

    await page.getByLabel('Transcription Language').click();
    await page.getByRole('option', { name: 'Türkçe' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved successfully!')).toBeVisible();

    const preferences = await getUserPreferences(admin, user.id);
    expect(preferences.preferred_language).toBe('tr');
  } finally {
    await deleteUserById(admin, user.id);
  }
});
