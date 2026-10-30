import { defineConfig, devices } from '@playwright/test';
const externalURL = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: externalURL || 'http://127.0.0.1:4174/vcf-bricks/', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalURL ? undefined : {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174/vcf-bricks/',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
