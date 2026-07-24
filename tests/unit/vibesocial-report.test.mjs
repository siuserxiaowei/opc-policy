import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrompt,
  normalizeInput,
  onRequestPost,
  parseReport,
} from '../../functions/api/vibesocial-report.js';

const payload = {
  topic: { mode: 'sample', title: 'AI 智能体创业', text: '独立开发者讨论智能体、算力与创业空间的城市机会。', sourceUrl: 'javascript:alert(1)' },
  keywords: ['智能体', '算力'],
  intent: '寻找 OPC 落地资源',
  policies: [{ id: 'p1', name: 'OPC 政策', city: '广州', officialUrl: 'https://example.gov.cn/p1', relevanceScore: 88 }],
  cities: [{ city: '广州', score: 86, policyCount: 3, officialCount: 2, communityCount: 5 }],
};

test('normalizes bounded topic and evidence without accepting unsafe URLs', () => {
  const input = normalizeInput({ ...payload, policies: Array.from({ length: 20 }, (_, index) => ({ ...payload.policies[0], id: `p${index}` })) });
  assert.equal(input.topic.sourceUrl, '');
  assert.equal(input.policies.length, 10);
  assert.equal(input.cities[0].score, 86);
});

test('prompt forbids search, fabricated eligibility and realtime claims', () => {
  const prompt = buildPrompt(normalizeInput(payload));
  assert.match(prompt, /禁止浏览器、搜索和外部知识/);
  assert.match(prompt, /不等于适用资格/);
  assert.match(prompt, /当前没有微博实时 API 数据/);
  assert.match(prompt, /【非实时演示场景】/);
});

test('parses fenced JSON while rejecting plain prose', () => {
  assert.equal(parseReport('普通文本'), null);
  assert.deepEqual(parseReport('```json\n{"draft":"ok"}\n```'), { draft: 'ok' });
});

test('returns a clear configuration error without a server API key', async () => {
  const response = await onRequestPost({ env: {}, request: new Request('https://opcgate.com/api/vibesocial-report', { method: 'POST', body: JSON.stringify(payload) }) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'INFINISYNAPSE_NOT_CONFIGURED');
});

test('connects SSE before newTask and streams a structured report', async t => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/events?')) {
      const event = {
        taskId: '',
        message: { ts: 1, say: 'completion_result', text: JSON.stringify({ executiveSummary: '城市线索需要继续核验。', interpretation: '只基于给定证据。', draft: '【非实时演示场景】\n【事实】给定证据\n【推断】仅为关联\n【待核验】核验原文\n当前未接入微博实时 API；政策关联不等于资格判断；本工具不自动发布。\n#微博VibeLab# #VibeSocial#', verificationPriorities: ['核验原文'], limitations: ['非实时'] }) },
      };
      const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(`event: message.add\ndata: ${JSON.stringify(event)}\n\n`)); controller.close(); } });
      return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }
    return new Response(JSON.stringify({ code: 200 }), { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const response = await onRequestPost({
    env: { INFINISYNAPSE_API_KEY: 'test-only', INFINISYNAPSE_BASE_URL: 'https://provider.test' },
    request: new Request('https://opcgate.com/api/vibesocial-report', { method: 'POST', body: JSON.stringify(payload) }),
  });
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(calls[0].url.includes('/events?'));
  assert.ok(calls[1].url.endsWith('/api/ai/message'));
  assert.match(text, /event: meta/);
  assert.match(text, /event: result/);
  assert.match(text, /城市线索需要继续核验/);
  assert.match(text, /【事实】.*\\n【推断】/);
});
