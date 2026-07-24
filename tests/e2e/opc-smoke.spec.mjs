import { expect, test } from '@playwright/test';

const expectedCounts = {
  policies: 125,
  cities: 42,
  communities: 128,
};

const newPolicyNames = [
  '杭州市市场监督管理局支持一人公司OPC创新创业发展的若干举措',
  '广州市人工智能OPC沙盒监管实施方案',
  '锡东新城OPC伙伴计划',
  '龙岗区国际机器人产业园OPC入驻标准',
  '城阳区加快建设北方OPC先行示范城核心承载区行动方案',
];

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!(127\.0\.0\.1|localhost)(:\d+)?\/).*/i, route => route.abort());
});

async function openHome(page) {
  await page.goto('/');
  await expect(page.locator('#browseCount')).toHaveText(`共 ${expectedCounts.policies} 条政策`);
  await expect(page.locator('#cityGrid .city-card')).toHaveCount(expectedCounts.cities);
}

async function switchToBrowse(page) {
  await page.getByRole('button', { name: '查询政策信息' }).click();
  await expect(page.locator('#modeBrowse')).toBeVisible();
}

async function addCompareItem(page, value) {
  await page.locator('#citySelect').selectOption(value);
  await page.getByRole('button', { name: /添加到对比/ }).click();
}

test('static site starts and home data loads', async ({ page }) => {
  await openHome(page);

  await expect(page).toHaveTitle(/OPC/);
  await expect(page.getByText('InfiniSynapse × CSDN Vibe Coding 2026 参赛作品', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '一键生成 AI 路线 · 约 60 秒' })).toBeVisible();
  await expect(page.getByText('03 · AI 跨城研判', { exact: true })).toBeVisible();
  await expect(page.getByText('Task ID：850b9073-e8d9-49cb-9d03-9434f1f76a68', { exact: true })).toBeVisible();
  await expect(page.locator('#cityGrid .city-card')).toHaveCount(expectedCounts.cities);
});

test('home links the VibeSocial capability back into OPC Gate', async ({ page }) => {
  await openHome(page);
  await expect(page.getByRole('link', { name: '打开政策热点雷达 →' })).toHaveAttribute('href', '/vibesocial');
  await expect(page.getByRole('heading', { name: '把公开话题变成带政策证据的可信内容' })).toBeVisible();
});

test('VibeSocial demo uses full data and keeps copy locked until verification', async ({ page }) => {
  await page.goto('/vibesocial/');
  await expect(page).toHaveTitle(/OPC 政策热点雷达/);
  await expect(page.getByText('125', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('128', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: '填入演示场景' }).click();
  await page.getByRole('button', { name: '开始关联 OPC Gate 全量数据' }).click();

  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#scopePolicies')).toHaveText('125');
  await expect(page.locator('#scopeMatches')).not.toHaveText('0');
  await expect(page.locator('#policyGrid .policy-card')).toHaveCount(8);
  await expect(page.locator('#draftText')).toHaveValue(/【事实】/);
  await expect(page.locator('#draftText')).toHaveValue(/【推断】/);
  await expect(page.locator('#draftText')).toHaveValue(/【待核验】/);
  await expect(page.locator('#copyButton')).toBeDisabled();

  const checks = page.locator('#verificationChecklist input');
  await checks.evaluateAll(inputs => inputs.forEach(input => input.click()));
  await expect(page.locator('#copyButton')).toBeEnabled();

  await page.locator('#draftText').pressSequentially('补充');
  await expect(page.locator('#copyButton')).toBeDisabled();
  await expect(page.locator('#gateCount')).toContainText('0 /');
});

test('VibeSocial accepts only AI drafts that pass the deterministic scan', async ({ page }) => {
  await page.route('**/api/vibesocial-report', async route => {
    const body = route.request().postDataJSON();
    expect(body.policies.length).toBeGreaterThan(0);
    expect(body.policies[0]).toHaveProperty('officialUrl');
    const draft = [
      '【非实时演示场景】AI 智能体创业者开始寻找 OPC 落地资源',
      '【事实】OPC Gate 数据库收录给定政策条目。',
      '【推断】相关城市值得继续核验，不代表落地推荐。',
      '【待核验】请回到官方原文核对适用对象、时效与入口。',
      '当前未接入微博实时 API；政策关联不等于资格判断；本工具不自动发布。',
      '#微博VibeLab# #VibeSocial#',
    ].join('\n');
    const stream = [
      `event: meta\ndata: ${JSON.stringify({ taskId: 'vibesocial-task-123', provider: 'InfiniSynapse Server API' })}\n\n`,
      `event: result\ndata: ${JSON.stringify({ taskId: 'vibesocial-task-123', report: { executiveSummary: '仅基于给定证据。', interpretation: '需继续核验。', draft, verificationPriorities: [], limitations: [] } })}\n\n`,
    ].join('');
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: stream });
  });

  await page.goto('/vibesocial/');
  await page.getByRole('button', { name: '填入演示场景' }).click();
  await page.getByRole('button', { name: '开始关联 OPC Gate 全量数据' }).click();
  await page.getByRole('button', { name: '生成 AI 可信解读' }).click();

  await expect(page.locator('#draftState')).toContainText('AI 可信解读');
  await expect(page.locator('#aiStatus')).toContainText('Task ID：vibesocial-task-123');
  await expect(page.locator('#scanStatus')).toHaveText('规则扫描通过');
});

test('contest demo runs the explainable analysis and starts the InfiniSynapse API', async ({ page }) => {
  let aiRequests = 0;
  await page.route('**/api/infinisynapse-report', async route => {
    aiRequests += 1;
    const stream = [
      `event: meta\ndata: ${JSON.stringify({taskId:'task-one-click-123',provider:'InfiniSynapse Server API'})}\n\n`,
      `event: result\ndata: ${JSON.stringify({taskId:'task-one-click-123',report:{executiveSummary:'一键演示已完成规则匹配与 AI 综合。',recommendedCity:'广州',cityComparison:[{city:'广州',fitScore:88,why:'同城证据完整',risks:[]}],opportunities:[],risks:[],actionPlan:[],limitations:[]}})}\n\n`,
    ].join('');
    await route.fulfill({status:200,contentType:'text/event-stream',body:stream});
  });

  await openHome(page);
  await page.getByRole('button', { name: '一键生成 AI 路线 · 约 60 秒' }).click();

  await expect(page.locator('#panelResults')).toBeVisible();
  await expect(page.locator('#fCity')).toHaveValue('广州');
  await expect(page.locator('#aiReportPanel')).toBeInViewport();
  await expect(page.locator('#aiReportResult')).toContainText('Task ID：task-one-click-123');
  await expect(page.getByText('候选可核验上限', { exact: true })).toBeVisible();
  const ceilingText = await page.locator('#summaryStats .summary-stat').last().locator('.num').innerText();
  expect(Number.parseInt(ceilingText, 10)).toBeLessThanOrEqual(5000);
  expect(aiRequests).toBe(1);
});

test('home browse can find the five newly added policies', async ({ page }) => {
  await openHome(page);
  await switchToBrowse(page);

  await expect(page.locator('#browseCount')).toHaveText(`共 ${expectedCounts.policies} 条政策`);

  for (const name of newPolicyNames) {
    await page.locator('#browseSearch').fill(name);
    await expect(page.locator('#browseCount')).toHaveText('共 1 条政策');
    await expect(page.locator('#browseList')).toContainText(name);
  }
});

test('home city cards expose key policy counts', async ({ page }) => {
  await openHome(page);

  const cardCounts = await page.locator('#cityGrid .city-card').evaluateAll(cards =>
    Object.fromEntries(
      cards.map(card => [
        card.querySelector('.city-name')?.textContent?.trim(),
        card.querySelector('.city-count')?.textContent?.trim(),
      ]),
    ),
  );

  expect(cardCounts).toMatchObject({
    广州: '23 条政策',
    深圳: '8 条政策',
    杭州: '6 条政策',
    无锡: '3 条政策',
    青岛: '3 条政策',
  });
});

test('AI report card serializes candidates and renders streamed InfiniSynapse proof', async ({ page }) => {
  await page.route('**/api/infinisynapse-report', async route => {
    const request = route.request();
    const body = request.postDataJSON();
    expect(body.profile.city).toBe('广州');
    expect(body.candidates.length).toBeGreaterThan(0);
    expect(body.candidates[0]).toHaveProperty('officialUrl');
    const stream = [
      `event: meta\ndata: ${JSON.stringify({taskId:'task-demo-123',provider:'InfiniSynapse Server API'})}\n\n`,
      `event: result\ndata: ${JSON.stringify({taskId:'task-demo-123',report:{executiveSummary:'广州与当前画像的证据匹配最好。',recommendedCity:'广州',cityComparison:[{city:'广州',fitScore:88,why:'同城政策与载体证据完整',risks:[]}],opportunities:[{name:'广东省支持人工智能 OPC 行动方案',city:'广州',reason:'覆盖算力与场景诉求',evidenceUrl:'https://example.gov.cn/policy',confidence:'high'}],risks:['补贴资格仍需主管部门确认'],actionPlan:[{within:'今天',action:'核验官方原文',evidence:'查看政策来源'}],limitations:['仅作路线诊断参考']}})}\n\n`,
    ].join('');
    await route.fulfill({status:200,contentType:'text/event-stream',body:stream});
  });

  await openHome(page);
  await page.getByRole('button', { name: '用示例填充' }).click();
  await expect(page.locator('#fCity')).toHaveValue('广州');
  await page.getByRole('button', { name: '开始匹配' }).click();
  await expect(page.locator('#panelResults')).toBeVisible();
  await page.getByRole('button', { name: '生成 AI 深度选址报告' }).click();
  await expect(page.locator('#aiReportResult')).toContainText('广州与当前画像的证据匹配最好');
  await expect(page.locator('#aiReportResult')).toContainText('Task ID：task-demo-123');
  await expect(page.locator('#aiReportResult')).toContainText('InfiniSynapse Server API');
});

test('city compare covers Guangzhou, Shenzhen, Wuxi and Wuxi additions', async ({ page }) => {
  await page.goto(`/compare.html?cities=${encodeURIComponent('广州,深圳,无锡')}`);

  await expect(page.locator('.compare-table thead')).toContainText('广州');
  await expect(page.locator('.compare-table thead')).toContainText('深圳');
  await expect(page.locator('.compare-table thead')).toContainText('无锡');
  await expect(page.locator('#compareArea')).toContainText('创业资助: 算力补贴、模型研发、数据语料等累计最高300万');
  await expect(page.locator('#compareArea')).toContainText('长三角（无锡）国际人才港EAST+OPC创新社区');
});

test('community compare can select comm-095 and comm-096', async ({ page }) => {
  await page.goto('/compare.html');
  await page.getByRole('button', { name: /社区\/孵化器对比/ }).click();

  await addCompareItem(page, 'comm-095');
  await addCompareItem(page, 'comm-096');

  await expect(page.locator('.compare-table thead')).toContainText('龙岗区国际机器人产业园OPC社区');
  await expect(page.locator('.compare-table thead')).toContainText('长三角（无锡）国际人才港EAST+OPC创新社区');
  await expect(page.locator('#compareArea')).toContainText('OpenClaw智能体');
});

test('mobile match form surfaces Shenzhen Longgang robot park policy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  await page.locator('#fProvince').selectOption('广东');
  await page.locator('#fCity').selectOption('深圳');
  await page.locator('#fDistrict').selectOption('龙岗');
  await page.locator('#fEmployees').fill('3');
  await page.locator('#fAge').fill('1');
  await page.locator('#chipsCompanyType .chip[data-val="一人有限公司"]').click();
  await page.locator('#chipsIndustry .chip[data-val="智能硬件"]').click();
  await page.locator('#chipsQualification .chip[data-val="有产品上线"]').click();
  await page.locator('#chipsFounder .chip[data-val="以上都不是"]').click();
  await page.locator('#btnMatch').click();

  await expect(page.locator('#panelResults')).toBeVisible();
  await expect(page.locator('#resultDesc')).toContainText('深圳龙岗区');
  await expect(page.locator('#resultsList')).toContainText('龙岗区国际机器人产业园OPC入驻标准');
});
