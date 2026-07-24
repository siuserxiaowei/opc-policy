import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  analyzeTopic,
  assessPublicationRisk,
  evaluatePublicationGate,
  extractKeywords,
  matchPolicies,
  scanAIDraft,
  toMarkdown,
} from '../../assets/js/vibesocial-core.js';

const readJson = async path => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
const policies = (await readJson('data/policies.json')).policies;
const communities = (await readJson('data/communities.json')).communities;
const topic = {
  mode: 'sample',
  title: 'AI 智能体创业者开始寻找 OPC 落地资源',
  text: '独立开发者讨论 AI 智能体、算力工具、创业空间和政策支持，希望比较不同城市的落地机会。',
  sourceUrl: '',
  observedAt: '2026-07-24',
};

test('extracts deterministic Chinese concepts from a public-text input', () => {
  const keywords = extractKeywords(topic);
  assert.ok(keywords.includes('智能体'));
  assert.ok(keywords.includes('opc'));
  assert.deepEqual(keywords, extractKeywords(topic));
});

test('matches the full policy dataset with reasons, source and boundaries', () => {
  const matches = matchPolicies(topic, policies, { asOf: '2026-07-24' });
  assert.ok(matches.length >= 5);
  assert.ok(matches[0].matchedTerms.length > 0);
  assert.match(matches[0].matchReason, /话题中的/);
  assert.match(matches[0].boundary, /不等于|仅表示/);
  assert.ok(matches.some(item => item.officialUrl.startsWith('http')));
  assert.ok(matches.some(item => item.officialOriginal === true));
  assert.ok(matches.every(item => item.status !== 'draft'));
});

test('builds a complete topic-to-city-to-policy-to-gate report', () => {
  const report = analyzeTopic(topic, policies, communities, { asOf: '2026-07-24' });
  assert.equal(report.dataScope.policies, 125);
  assert.equal(report.dataScope.communities, 128);
  assert.ok(report.cityInsights.length >= 2);
  assert.ok(new Set(report.cityInsights.map(item => item.score)).size >= 2);
  assert.ok(report.communityMatches.length > 0);
  assert.match(report.draft.text, /【事实】/);
  assert.match(report.draft.text, /【推断】/);
  assert.match(report.draft.text, /【待核验】/);
  assert.match(report.draft.text, /未接入微博实时 API/);
  assert.equal(report.draftScan.passed, true);
  assert.ok(report.verificationChecklist.some(item => item.id === 'human-review'));
});

test('risk scanner rejects approval, qualification and guarantee claims', () => {
  const risk = assessPublicationRisk('官方推荐，保证符合申报条件，补贴到账');
  assert.equal(risk.level, 'high');
  assert.ok(risk.flags.some(item => item.code === 'approval_claim'));
  assert.ok(risk.flags.some(item => item.code === 'qualification_claim'));
  assert.ok(risk.flags.some(item => item.code === 'guaranteed_claim'));
});

test('AI draft must preserve disclosure layers, boundaries and contest tags', () => {
  const report = analyzeTopic(topic, policies, communities, { asOf: '2026-07-24' });
  const unsafe = scanAIDraft('官方背书，符合申报条件，最高可得 987654 万元。', report);
  assert.equal(unsafe.passed, false);
  assert.ok(unsafe.violations.some(item => item.code === 'missing_fact_layer'));
  assert.ok(unsafe.violations.some(item => item.code === 'unsupported_numeric_claim'));
  assert.ok(unsafe.violations.some(item => item.code === 'qualification_claim'));
});

test('publication gate opens only after every required check', () => {
  assert.deepEqual(evaluatePublicationGate([
    { required: true, checked: true },
    { required: true, checked: false },
  ]), { total: 2, completed: 1, open: false });
  assert.equal(evaluatePublicationGate([
    { required: true, checked: true },
    { required: true, checked: true },
  ]).open, true);
});

test('exports the analysis and current draft as Markdown', () => {
  const report = analyzeTopic(topic, policies, communities, { asOf: '2026-07-24' });
  const markdown = toMarkdown(report, report.draft.text);
  assert.match(markdown, /^# OPC 政策热点雷达/);
  assert.match(markdown, /## 政策证据/);
  assert.match(markdown, /非实时热点数据/);
});
