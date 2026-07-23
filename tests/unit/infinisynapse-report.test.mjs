import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPrompt,
  normalizeInput,
  onRequestPost,
  parseReport,
} from '../../functions/api/infinisynapse-report.js';

const validBody = {
  profile: { city: '广州', district: '越秀', employees: 5, industries: ['AI语音/对话'], needs: ['算力券/API/模型'] },
  candidates: [{
    id: 'policy-1', name: '候选政策', city: '广州', score: 82,
    officialUrl: 'https://example.gov.cn/policy', benefits: [{ item: '算力券', amount: '最高100万元', type: 'voucher' }],
  }],
};

test('normalizeInput bounds untrusted profile and candidate input', () => {
  const result = normalizeInput({
    profile: { city: '广\u0000州', employees: 9999999, industries: ['AI', '语音'] },
    candidates: [{ name: 'A', city: '广州', officialUrl: 'javascript:alert(1)' }],
  });
  assert.equal(result.profile.city, '广 州');
  assert.equal(result.profile.employees, 100000);
  assert.deepEqual(result.profile.industries, ['AI', '语音']);
  assert.equal(result.candidates[0].officialUrl, '');
});

test('prompt explicitly separates 全国 scope from city ranking', () => {
  const prompt = buildPrompt(normalizeInput(validBody));
  assert.match(prompt, /“全国”是适用范围，不是城市/);
  assert.match(prompt, /不能写成用户可直接获得的补贴/);
  assert.match(prompt, /只输出一个 JSON 对象/);
});

test('parseReport accepts plain and fenced JSON', () => {
  assert.deepEqual(parseReport('{"recommendedCity":"广州"}'), { recommendedCity: '广州' });
  assert.deepEqual(parseReport('```json\n{"recommendedCity":"深圳"}\n```'), { recommendedCity: '深圳' });
  assert.equal(parseReport('not-json'), null);
});

test('endpoint fails closed when the server-side key is missing', async () => {
  const response = await onRequestPost({
    env: {},
    request: new Request('https://opcgate.test/api/infinisynapse-report', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validBody),
    }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'INFINISYNAPSE_NOT_CONFIGURED');
});

test('endpoint connects SSE before newTask and streams a structured result', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let createdTaskId = '';
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (String(url).includes('/api/ai/events')) {
      const payload = JSON.stringify({
        message: {
          ts: 1,
          say: 'completion_result',
          text: JSON.stringify({
            executiveSummary: '广州与当前画像的证据匹配最好。',
            recommendedCity: '广州',
            cityComparison: [{ city: '广州', fitScore: 88, why: '同城且来源明确', risks: [] }],
            opportunities: [], risks: [], actionPlan: [], limitations: [],
          }),
        },
      });
      return new Response(`event: message.add\ndata: ${payload}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }
    if (String(url).includes('/api/ai/message')) {
      const requestBody = JSON.parse(options.body);
      createdTaskId = requestBody.taskId;
      assert.deepEqual(requestBody.chatSettings, { mode: 'act' });
      assert.equal(requestBody.autoApprovalSettings.enableBrowser, false);
      assert.equal(requestBody.autoApprovalSettings.enableWebSearch, false);
      assert.equal(requestBody.autoApprovalSettings.maxRequests, 40);
      return new Response(JSON.stringify({ success: true, taskId: createdTaskId }), { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  };
  try {
    const response = await onRequestPost({
      env: { INFINISYNAPSE_API_KEY: 'test-only', INFINISYNAPSE_BASE_URL: 'https://provider.test' },
      request: new Request('https://opcgate.test/api/infinisynapse-report', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validBody),
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.deepEqual(calls.slice(0, 2).map(call => call.method), ['GET', 'POST']);
    assert.match(body, /event: meta/);
    assert.match(body, /event: result/);
    assert.match(body, /广州与当前画像/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('endpoint rejects a successful HTTP response when newTask reports business failure', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/api/ai/events')) {
      return new Response('event: heartbeat\ndata: "ping"\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }
    if (String(url).includes('/api/ai/message')) {
      return new Response(JSON.stringify({
        success: false,
        notification: { type: 'error', message: '额度不足' },
      }), { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  };
  try {
    const response = await onRequestPost({
      env: { INFINISYNAPSE_API_KEY: 'test-only', INFINISYNAPSE_BASE_URL: 'https://provider.test' },
      request: new Request('https://opcgate.test/api/infinisynapse-report', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validBody),
      }),
    });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, '额度不足');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('endpoint combines incremental SSE chunks that share the same message timestamp', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/api/ai/events')) {
      const first = JSON.stringify({ message: { ts: 7, type: 'say', text: '{"executiveSummary":"增量' } });
      const second = JSON.stringify({ message: { ts: 7, type: 'say', say: 'completion_result', text: '结果","recommendedCity":"广州"}' } });
      return new Response(`event: message.partial\ndata: ${first}\n\nevent: message.add\ndata: ${second}\n\n`, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }
    if (String(url).includes('/api/ai/message')) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  };
  try {
    const response = await onRequestPost({
      env: { INFINISYNAPSE_API_KEY: 'test-only', INFINISYNAPSE_BASE_URL: 'https://provider.test' },
      request: new Request('https://opcgate.test/api/infinisynapse-report', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validBody),
      }),
    });
    const body = await response.text();
    assert.match(body, /event: result/);
    assert.match(body, /增量结果/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
