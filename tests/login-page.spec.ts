import { test, expect } from '@playwright/test';

test('login page exposes a sign-up path', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();
});
