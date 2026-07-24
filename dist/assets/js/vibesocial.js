import {
  analyzeTopic,
  evaluatePublicationGate,
  scanAIDraft,
  toMarkdown,
} from './vibesocial-core.js';

const $ = selector => document.querySelector(selector);
const state = { policies: [], communities: [], cities: [], report: null, draftVersion: 0 };
const SAMPLE = {
  title: 'AI 智能体创业者开始寻找 OPC 落地资源',
  text: '越来越多独立开发者用 AI 智能体完成产品研发、内容运营与客户服务。一人团队除了工具，还在关注算力成本、创业空间、应用场景和不同城市的 OPC 支持，希望找到可核验的落地线索。',
  sourceUrl: '',
};

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 3000);
}

function setError(message = '') {
  const node = $('#formError');
  node.textContent = message;
  node.hidden = !message;
}

function fillSample({ scroll = false } = {}) {
  document.querySelector('input[name="inputMode"][value="sample"]').checked = true;
  $('#topicTitle').value = SAMPLE.title;
  $('#topicText').value = SAMPLE.text;
  $('#topicSource').value = SAMPLE.sourceUrl;
  $('#observedAt').value = new Date().toISOString().slice(0, 10);
  updateTopicCount();
  if (scroll) $('#workbench').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateTopicCount() {
  $('#topicCount').textContent = `${$('#topicText').value.length} / 1800`;
}

async function loadData() {
  const [policyResponse, communityResponse, cityResponse] = await Promise.all([
    fetch('/data/policies.json'), fetch('/data/communities.json'), fetch('/data/cities.json'),
  ]);
  if (![policyResponse, communityResponse, cityResponse].every(response => response.ok)) throw new Error('OPC Gate 数据读取失败');
  const [policyData, communityData, cityData] = await Promise.all([policyResponse.json(), communityResponse.json(), cityResponse.json()]);
  state.policies = policyData.policies || [];
  state.communities = communityData.communities || [];
  state.cities = cityData.cities || [];
  $('#heroPolicyCount').textContent = state.policies.length;
  $('#heroCityCount').textContent = state.cities.length;
  $('#heroCommunityCount').textContent = state.communities.length;
  $('#dataSnapshot').textContent = policyData.updated_at ? `${policyData.updated_at} · 可追溯来源` : '已加载 · 可追溯来源';
}

function topicFromForm() {
  return {
    mode: document.querySelector('input[name="inputMode"]:checked')?.value || 'manual',
    title: $('#topicTitle').value.trim(),
    text: $('#topicText').value.trim(),
    sourceUrl: $('#topicSource').value.trim(),
    observedAt: $('#observedAt').value,
  };
}

function renderTags(report) {
  $('#intentText').textContent = report.extraction.intent;
  $('#keywordList').replaceChildren(...report.extraction.keywords.map(keyword => el('span', '', keyword)));
  $('#themeList').replaceChildren(...report.extraction.themes.map(theme => el('span', '', theme.label)));
}

function renderCities(report) {
  const container = $('#cityInsights');
  container.replaceChildren();
  if (!report.cityInsights.length) {
    container.append(el('div', 'empty-result', '当前话题没有形成可靠的城市机会排序。'));
    return;
  }
  report.cityInsights.forEach(item => {
    const row = el('div', 'city-bar');
    row.append(el('strong', '', item.city));
    const track = el('div', 'city-track');
    const fill = el('div', 'city-fill');
    fill.style.width = `${item.score}%`;
    track.append(fill);
    row.append(track, el('span', '', `${item.score}`));
    row.append(el('small', '', `${item.policyCount} 条政策 · ${item.officialCount} 条含官链 · ${item.communityCount} 个载体线索`));
    container.append(row);
  });
}

function renderPolicies(report) {
  const container = $('#policyGrid');
  container.replaceChildren();
  if (!report.policyMatches.length) {
    container.append(el('div', 'empty-result', '暂未找到足够相关的政策证据。建议补充更具体的行业、城市或资源需求后重新分析。'));
    return;
  }
  report.policyMatches.slice(0, 8).forEach(policy => {
    const card = el('article', 'policy-card');
    const top = el('div', 'policy-top');
    top.append(el('span', 'policy-place', [policy.province, policy.city, policy.district].filter(Boolean).filter((item, index, list) => list.indexOf(item) === index).join(' · ')));
    top.append(el('span', 'confidence', `综合 ${policy.confidenceScore}/100`));
    card.append(top, el('h4', '', policy.name), el('p', 'policy-summary', policy.summary || '数据库未提供摘要，请直接核对原文。'));
    card.append(el('div', 'match-reason', policy.matchReason));
    const tags = el('div', 'policy-tags');
    policy.matchedTerms.forEach(term => tags.append(el('span', '', term)));
    card.append(tags);
    const bottom = el('div', 'policy-bottom');
    const sourceState = el('span', `source-state${policy.officialOriginal ? ' official' : ''}`, policy.sourceLabel);
    bottom.append(sourceState);
    if (policy.officialUrl) {
      const link = el('a', '', policy.officialOriginal ? '核验官方原文 ↗' : '查看参考来源 ↗');
      link.href = policy.officialUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      bottom.append(link);
    } else bottom.append(el('span', 'source-state', policy.freshnessLabel));
    card.append(bottom, el('p', 'policy-boundary', policy.boundary));
    container.append(card);
  });
}

function renderCommunities(report) {
  const container = $('#communityGrid');
  container.replaceChildren();
  if (!report.communityMatches.length) {
    $('#communitySection').hidden = true;
    return;
  }
  $('#communitySection').hidden = false;
  report.communityMatches.slice(0, 8).forEach(item => {
    const card = el('article', 'community-card');
    card.append(el('span', '', `${item.city}${item.district ? ` · ${item.district}` : ''}`), el('h4', '', item.name));
    card.append(el('p', '', item.features.length ? item.features.join(' · ') : '暂无结构化权益信息'));
    card.append(el('small', '', item.boundary));
    container.append(card);
  });
}

function renderChecklist(report) {
  const container = $('#verificationChecklist');
  container.replaceChildren();
  report.verificationChecklist.forEach(item => {
    const label = el('label', 'check-item');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.required = String(item.required !== false);
    checkbox.dataset.id = item.id;
    checkbox.addEventListener('change', updateGate);
    label.append(checkbox, el('span', '', item.text));
    if (item.status === 'blocked') label.append(el('small', '', '存在证据缺口：请确认只作演示，或先修改/补充来源再勾选。'));
    if (item.url) {
      const link = el('a', '', '打开核验来源 ↗');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.addEventListener('click', event => event.stopPropagation());
      label.append(link);
    }
    container.append(label);
  });
  updateGate();
}

function currentGate() {
  return evaluatePublicationGate([...document.querySelectorAll('#verificationChecklist input')].map(box => ({ required: box.dataset.required !== 'false', checked: box.checked })));
}

function updateGate() {
  const gate = currentGate();
  $('#gateCount').textContent = `${gate.completed} / ${gate.total}`;
  $('#gateStatus').textContent = gate.open ? '核验完成，可以复制' : '复制已锁定';
  $('#lockIcon').textContent = gate.open ? '🔓' : '🔒';
  $('#copyButton').disabled = !gate.open;
  $('#copyButton').textContent = gate.open ? '复制已核验草稿' : '完成全部核验后复制';
}

function resetChecklist() {
  document.querySelectorAll('#verificationChecklist input:checked').forEach(box => { box.checked = false; });
  updateGate();
}

function scanCurrentDraft() {
  if (!state.report) return;
  const scan = scanAIDraft($('#draftText').value, state.report);
  const status = $('#scanStatus');
  status.textContent = scan.passed ? '规则扫描通过' : `规则扫描发现 ${scan.violations.length} 项风险`;
  status.className = scan.passed ? 'scan-pass' : 'scan-fail';
  return scan;
}

function renderReport(report) {
  state.report = report;
  state.draftVersion += 1;
  $('#scopePolicies').textContent = report.dataScope.policies;
  $('#scopeMatches').textContent = report.policyMatches.length;
  $('#scopeCities').textContent = report.cityInsights.length;
  $('#scopeCommunities').textContent = report.communityMatches.length;
  renderTags(report);
  renderCities(report);
  renderPolicies(report);
  renderCommunities(report);
  $('#draftText').value = report.draft.text;
  $('#draftCount').textContent = `${report.draft.characterCount} 字`;
  $('#draftState').textContent = '规则草稿 · 可降级使用';
  renderChecklist(report);
  scanCurrentDraft();
  const cities = report.cityInsights.filter(item => item.city !== '全国').slice(0, 3).map(item => item.city);
  $('#compareCitiesLink').href = cities.length ? `/compare.html?cities=${encodeURIComponent(cities.join(','))}` : '/compare.html';
  $('#results').hidden = false;
  $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function parseSseResponse(response, onStatus) {
  if (!response.ok) {
    let body = {};
    try { body = await response.json(); } catch { /* ignore non-JSON error */ }
    throw new Error(body.error || `请求失败（HTTP ${response.status}）`);
  }
  if (!response.body) throw new Error('浏览器未收到流式响应');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = 'message';
      const data = [];
      block.split('\n').forEach(line => {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data.push(line.slice(5).trim());
      });
      let payload = data.join('\n');
      try { payload = JSON.parse(payload); } catch { /* keep text */ }
      if (event === 'status') onStatus(payload.message || '正在分析…');
      if (event === 'error') throw new Error(payload.error || 'AI 分析中断');
      if (event === 'result') result = payload;
    }
  }
  if (!result?.report) throw new Error('AI 没有返回可用报告');
  return result;
}

async function generateAIReport() {
  if (!state.report) return;
  const button = $('#aiButton');
  const status = $('#aiStatus');
  button.disabled = true;
  button.textContent = '正在整理证据…';
  status.hidden = false;
  status.textContent = '正在安全连接 InfiniSynapse 服务端接口…';
  try {
    const response = await fetch('/api/vibesocial-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        topic: state.report.topic,
        keywords: state.report.extraction.keywords,
        intent: state.report.extraction.intent,
        policies: state.report.policyMatches,
        cities: state.report.cityInsights,
      }),
    });
    const result = await parseSseResponse(response, message => { status.textContent = message; });
    const scan = scanAIDraft(result.report.draft, state.report);
    if (!scan.passed) throw new Error(`AI 草稿未通过确定性后扫（${scan.violations.map(item => item.message).join('；')}）`);
    $('#draftText').value = result.report.draft;
    $('#draftCount').textContent = `${result.report.draft.length} 字`;
    $('#draftState').textContent = `AI 可信解读 · ${result.taskId.slice(0, 8)}`;
    state.report.ai = { ...result.report, taskId: result.taskId, provider: 'InfiniSynapse Server API' };
    resetChecklist();
    scanCurrentDraft();
    status.textContent = `AI 改写已通过规则扫描。Task ID：${result.taskId}`;
    showToast('AI 草稿已生成；请重新完成全部人工核验。');
  } catch (error) {
    status.textContent = `未采用 AI 输出：${error.message}。规则草稿仍可继续核验使用。`;
    showToast('AI 未完成，已保留可用的规则草稿。');
  } finally {
    button.disabled = false;
    button.textContent = '生成 AI 可信解读';
  }
}

function downloadMarkdown() {
  if (!state.report) return;
  const markdown = toMarkdown(state.report, $('#draftText').value);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `OPC政策热点雷达-${new Date().toISOString().slice(0, 10)}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('完整 Markdown 报告已导出。');
}

$('#topicText').addEventListener('input', updateTopicCount);
$('#fillSampleButton').addEventListener('click', () => fillSample());
$('#heroSampleButton').addEventListener('click', () => fillSample({ scroll: true }));
$('#topicForm').addEventListener('submit', event => {
  event.preventDefault();
  setError();
  const button = $('#analyzeButton');
  button.disabled = true;
  button.querySelector('span').textContent = '正在关联政策与城市…';
  try {
    const topic = topicFromForm();
    if (!state.policies.length) throw new Error('主站数据仍在加载，请稍后重试');
    if (topic.sourceUrl && !safeUrl(topic.sourceUrl)) throw new Error('原始来源链接必须是 http 或 https 地址');
    const report = analyzeTopic(topic, state.policies, state.communities, { asOf: new Date() });
    renderReport(report);
  } catch (error) {
    setError(error.message);
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = '开始关联 OPC Gate 全量数据';
  }
});
$('#draftText').addEventListener('input', event => {
  $('#draftCount').textContent = `${event.target.value.length} 字`;
  $('#draftState').textContent = '人工修改 · 需重新核验';
  resetChecklist();
  scanCurrentDraft();
});
$('#draftText').addEventListener('copy', event => {
  if (!currentGate().open) {
    event.preventDefault();
    showToast('复制已锁定，请先完成全部人工核验项。');
  }
});
$('#copyButton').addEventListener('click', async () => {
  if (!currentGate().open) return showToast('复制已锁定，请先完成全部人工核验项。');
  try {
    await navigator.clipboard.writeText($('#draftText').value);
    showToast('草稿已复制；请本人再次确认后手动发布。');
  } catch {
    $('#draftText').select();
    showToast('草稿已选中，请手动复制。');
  }
});
$('#exportButton').addEventListener('click', downloadMarkdown);
$('#aiButton').addEventListener('click', generateAIReport);
$('#resetButton').addEventListener('click', () => {
  $('#workbench').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#topicTitle').focus({ preventScroll: true });
});

$('#observedAt').value = new Date().toISOString().slice(0, 10);
loadData().catch(error => {
  $('#dataSnapshot').textContent = '数据加载失败';
  setError(`${error.message}，请刷新页面重试。`);
});
