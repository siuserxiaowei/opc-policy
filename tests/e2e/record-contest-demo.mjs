import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseURL = process.env.DEMO_BASE_URL || 'https://opcgate.com';
const outputDir = resolve(process.env.DEMO_OUTPUT_DIR || 'test-results/contest-demo-real');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: outputDir, size: { width: 1920, height: 1080 } },
  colorScheme: 'light',
});
const page = await context.newPage();
const video = page.video();

const pause = milliseconds => page.waitForTimeout(milliseconds);
const smoothScrollTo = async locator => {
  await locator.evaluate(element => {
    const top = element.getBoundingClientRect().top + window.scrollY - 92;
    window.scrollTo({ top, behavior: 'smooth' });
  });
  await pause(1200);
};

await page.goto(baseURL, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const badge = document.createElement('div');
  badge.textContent = '正式环境 · InfiniSynapse Server API 真实调用';
  Object.assign(badge.style, {
    position: 'fixed', top: '76px', right: '22px', zIndex: '99999',
    padding: '9px 14px', borderRadius: '999px', color: '#065f46',
    background: 'rgba(236,253,245,.96)', border: '1px solid #10b981',
    boxShadow: '0 8px 24px rgba(15,23,42,.12)', font: '600 14px system-ui',
  });
  document.body.appendChild(badge);
});

await pause(2500);
await page.mouse.move(950, 420, { steps: 24 });
await page.getByRole('button', { name: '开始路线诊断' }).evaluate(button => button.click());
await pause(1000);
await smoothScrollTo(page.locator('#modeMatch'));
await pause(1800);

await page.getByRole('button', { name: '用示例填充' }).evaluate(button => button.click());
await page.locator('#fCity').waitFor({ state: 'visible' });
await page.waitForFunction(() => document.querySelector('#fCity')?.value === '广州');
await pause(2200);
await page.locator('#btnMatch').evaluate(button => button.click());
await page.locator('#panelResults').waitFor({ state: 'visible' });
await smoothScrollTo(page.locator('#panelResults'));
await pause(3200);

await smoothScrollTo(page.locator('#aiReportPanel'));
await pause(2200);
await page.getByRole('button', { name: '生成 AI 深度选址报告' }).evaluate(button => button.click());
await pause(1500);
await page.locator('#aiReportResult').waitFor({ state: 'visible', timeout: 150000 });
await pause(2800);

await smoothScrollTo(page.locator('#aiReportResult'));
await pause(2600);
await page.evaluate(() => window.scrollBy({ top: 460, behavior: 'smooth' }));
await pause(2500);
await page.evaluate(() => window.scrollBy({ top: 520, behavior: 'smooth' }));
await pause(2800);

await page.screenshot({ path: resolve(outputDir, 'final-report.png'), fullPage: false });
await page.close();
await context.close();
await browser.close();

const videoPath = await video.path();
process.stdout.write(`${videoPath}\n`);
