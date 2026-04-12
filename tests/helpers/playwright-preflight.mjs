import { chromium } from '@playwright/test';

let browser;

try {
  browser = await chromium.launch({ headless: true });
  await browser.close();
  console.log('Playwright browser preflight passed.');
} catch (error) {
  if (browser) {
    await browser.close().catch(() => {});
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error('Playwright browser preflight failed.');
  console.error(
    'Chromium could not launch on this machine. Install the Playwright browser and any missing OS dependencies, then rerun the E2E suite.',
  );
  console.error(
    'Suggested commands: PLAYWRIGHT_BROWSERS_PATH=/tmp/ms-playwright npx playwright install chromium',
  );
  console.error(
    'If launch errors mention missing shared libraries, run: npx playwright install-deps chromium',
  );
  console.error(message);
  process.exit(1);
}
