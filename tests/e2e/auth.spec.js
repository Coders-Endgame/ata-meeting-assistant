import { test, expect } from '@playwright/test';

import {
  createAdminClient,
  deleteUserByEmail,
  deleteUserById,
  seedUser,
  uniqueEmail,
} from '../helpers/supabase-admin.mjs';
import { loginThroughUi } from '../helpers/ui.mjs';

const admin = createAdminClient();

test('TC-01 user registration submits credentials and surfaces the auth provider response', async ({ page }) => {
  const email = uniqueEmail('signup');

  try {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await page.getByLabel('First Name').fill('John');
    await page.getByLabel('Last Name').fill('Doe');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('Test1234!');
    await page.getByRole('button', { name: 'Sign Up' }).first().click();

    const authMessage = page.locator('.message');
    await expect(authMessage).toBeVisible();
    await expect(authMessage).toContainText(
      /Check your email for the verification link!|email rate limit exceeded/i,
    );
  } finally {
    await deleteUserByEmail(admin, email);
  }
});

test('TC-02 user login with valid credentials redirects to the dashboard', async ({ page }) => {
  const { user, email, password } = await seedUser({
    admin,
    email: uniqueEmail('login'),
  });

  try {
    await loginThroughUi(page, email, password);
    await expect(page.getByText('Start New Session')).toBeVisible();
  } finally {
    await deleteUserById(admin, user.id);
  }
});

test('TC-03 user login with invalid credentials shows the authentication error', async ({ page }) => {
  await page.goto('/auth');
  await page.getByLabel('Email').fill('missing-user@example.com');
  await page.getByLabel('Password').fill('wrongpass');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByText('Invalid login credentials')).toBeVisible();
});
