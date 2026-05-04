import { expect, test } from '@playwright/test';

const expectedCounts = {
  policies: 106,
  cities: 38,
  communities: 96,
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
  await page.getByRole('button', { name: '浏览全部政策' }).click();
  await expect(page.locator('#modeBrowse')).toBeVisible();
}

async function addCompareItem(page, value) {
  await page.locator('#citySelect').selectOption(value);
  await page.getByRole('button', { name: /添加到对比/ }).click();
}

test('static site starts and home data loads', async ({ page }) => {
  await openHome(page);

  await expect(page).toHaveTitle(/OPC/);
  await expect(page.locator('.version')).toContainText('38 城 · 106 条政策 · 96 条社区/载体记录');
  await expect(page.locator('#cityGrid .city-card')).toHaveCount(expectedCounts.cities);
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
    杭州: '5 条政策',
    无锡: '2 条政策',
    青岛: '3 条政策',
  });
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
