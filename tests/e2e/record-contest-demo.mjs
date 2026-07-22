import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseURL = process.env.DEMO_BASE_URL || 'https://codex-infinisynapse-contest.opc-policy.pages.dev';
const outputDir = resolve(process.env.DEMO_OUTPUT_DIR || 'test-results/contest-demo');
await mkdir(outputDir, { recursive: true });

const report = {
  executiveSummary: '广州与当前画像的证据匹配最好：同城政策、算力支持和载体样本较完整，建议先核验官方原文与申报窗口。',
  recommendedCity: '广州',
  cityComparison: [
    { city: '广州', fitScore: 88, why: '同城政策、算力支持与载体证据较完整', risks: ['部分来源仍需主管部门确认'] },
    { city: '深圳', fitScore: 76, why: '机器人与智能硬件载体匹配度较高', risks: ['区域准入条件更细'] },
  ],
  opportunities: [
    { name: '广东省支持人工智能 OPC 行动方案', city: '广州', reason: '覆盖算力与场景诉求', evidenceUrl: 'https://www.gd.gov.cn/', confidence: 'high' },
    { name: '广州市人工智能 OPC 沙盒监管实施方案', city: '广州', reason: '适合需要场景验证的 AI 产品', evidenceUrl: 'https://www.gz.gov.cn/', confidence: 'medium' },
  ],
  risks: ['政策适用资格仍需主管部门确认', '缺少官链的条目不能作为最终申报依据'],
  actionPlan: [
    { within: '今天', action: '核验两条候选政策官方原文', evidence: '查看报告中的来源链接' },
    { within: '3天内', action: '联系载体确认入驻与算力支持口径', evidence: '记录联系人与书面答复' },
    { within: '7天内', action: '准备产品、团队和经营材料清单', evidence: '形成申报准备表' },
  ],
  limitations: ['本报告用于信息查询和路线诊断，不构成补贴、法律或税务承诺。'],
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: outputDir, size: { width: 1920, height: 1080 } },
  colorScheme: 'light',
});
const page = await context.newPage();
const video = page.video();

await page.route('**/api/infinisynapse-report', async route => {
  await new Promise(resolveDelay => setTimeout(resolveDelay, 2600));
  const body = [
    `event: meta\ndata: ${JSON.stringify({ taskId: 'demo-task-001', provider: 'InfiniSynapse Server API' })}\n\n`,
    `event: status\ndata: ${JSON.stringify({ stage: 'connected', message: '正在综合候选政策、来源与城市差异…' })}\n\n`,
    `event: result\ndata: ${JSON.stringify({ taskId: 'demo-task-001', report })}\n\n`,
  ].join('');
  await route.fulfill({ status: 200, contentType: 'text/event-stream; charset=utf-8', body });
});

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
  badge.textContent = '比赛演示环境 · AI 结果使用模拟 SSE 响应';
  Object.assign(badge.style, {
    position: 'fixed', top: '76px', right: '22px', zIndex: '99999',
    padding: '9px 14px', borderRadius: '999px', color: '#92400e',
    background: 'rgba(255,251,235,.96)', border: '1px solid #f59e0b',
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
await page.locator('#aiReportResult').getByText('广州与当前画像的证据匹配最好', { exact: false }).waitFor();
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
