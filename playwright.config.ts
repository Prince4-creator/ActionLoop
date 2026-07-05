import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    headless: true,
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
});
