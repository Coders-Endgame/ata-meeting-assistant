import { expect } from '@playwright/test';

export async function loginThroughUi(page, email, password) {
  await page.goto('/auth');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function openUserMenu(page) {
  await page.getByLabel('Open user menu').click();
}
