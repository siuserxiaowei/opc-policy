import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const noProxyHosts = ['127.0.0.1', 'localhost', '::1'];
const mergedNoProxy = [process.env.NO_PROXY, process.env.no_proxy, ...noProxyHosts]
  .filter(Boolean)
  .join(',');
process.env.NO_PROXY = mergedNoProxy;
process.env.no_proxy = mergedNoProxy;

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const port = Number(process.env.E2E_PORT || 4173);
const externalBaseURL = process.env.E2E_BASE_URL;
const staticDir = resolve(
  repoRoot,
  process.env.E2E_STATIC_DIR || (existsSync(resolve(repoRoot, 'dist/index.html')) ? 'dist' : '.'),
);
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: `python3 -m http.server ${port} -d ${JSON.stringify(staticDir)}`,
        url: baseURL,
        cwd: repoRoot,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
