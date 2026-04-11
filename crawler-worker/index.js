/**
 * OPC 政策爬虫 — Cloudflare Worker (Cron Trigger)
 * 每12小时自动扫描政府网站，发现新OPC政策
 * 用 Google Gemini API 提取结构化政策数据
 * 自动检测政策变动（新增/修改/过期/废止）
 */

// 全局关键词库（所有源共用）
const KEYWORDS_CORE = ['OPC', '一人公司', '一人企业', '超级个体', '个人经济体'];
const KEYWORDS_POLICY = ['创业补贴', '创业资助', '算力补贴', '算力券', '免租', '孵化'];
const KEYWORDS_AI = ['人工智能', 'AI创业', 'AI应用', '智能体', '大模型', 'AIGC'];
const KEYWORDS_SCENE = ['场景应用', '场景征集', '应用示范', '数据券', '流量券'];
const KEYWORDS_TALENT = ['人才补贴', '创业带动就业', '创业租金', '创业担保贷款'];
const ALL_KEYWORDS = [...KEYWORDS_CORE, ...KEYWORDS_POLICY, ...KEYWORDS_AI, ...KEYWORDS_SCENE, ...KEYWORDS_TALENT];

// 精简关键词（核心+政策类）
const KW_STANDARD = [...KEYWORDS_CORE, ...KEYWORDS_POLICY];
// 完整关键词（含AI和场景）
const KW_FULL = ALL_KEYWORDS;

const SOURCES = [
  // === 广东（重点监控）===
  { name: '广州市政府', url: 'https://www.gz.gov.cn/zwgk/zdly/', keywords: KW_FULL },
  { name: '海珠区政府', url: 'https://www.haizhu.gov.cn/gzhzrgzn/', keywords: KW_FULL },
  { name: '越秀区政府', url: 'http://www.yuexiu.gov.cn/yxdt/yxkx/', keywords: KW_FULL },
  { name: '黄埔区政府', url: 'http://www.hp.gov.cn/', keywords: KW_FULL },
  { name: '南沙区政府', url: 'http://www.gzns.gov.cn/zwgk/', keywords: KW_FULL },
  { name: '番禺区政府', url: 'https://www.panyu.gov.cn/', keywords: KW_FULL },
  { name: '天河区政府', url: 'https://www.thnet.gov.cn/', keywords: KW_FULL },
  { name: '深圳市政府', url: 'https://www.sz.gov.cn/cn/xxgk/zfxxgj/tzgg/', keywords: KW_FULL },
  { name: '东莞市政府', url: 'https://www.dg.gov.cn/zwgk/', keywords: KW_STANDARD },
  { name: '惠州市政府', url: 'https://www.huizhou.gov.cn/', keywords: KW_STANDARD },
  { name: '佛山市政府', url: 'https://www.foshan.gov.cn/', keywords: KW_STANDARD },
  { name: '珠海市政府', url: 'https://www.zhuhai.gov.cn/', keywords: KW_STANDARD },
  { name: '中山市政府', url: 'https://www.zs.gov.cn/', keywords: KW_STANDARD },
  { name: '梅州市政府', url: 'https://www.meizhou.gov.cn/', keywords: KW_STANDARD },
  { name: '广东省发改委', url: 'https://drc.gd.gov.cn/', keywords: KW_FULL },
  // === 长三角 ===
  { name: '苏州市政府', url: 'https://www.suzhou.gov.cn/szsrmzf/szyw/', keywords: KW_FULL },
  { name: '杭州市政府', url: 'https://www.hangzhou.gov.cn/', keywords: KW_FULL },
  { name: '上海市经信委', url: 'https://jxj.sh.gov.cn/', keywords: KW_FULL },
  { name: '南京市政府', url: 'https://www.nanjing.gov.cn/', keywords: KW_STANDARD },
  { name: '无锡市政府', url: 'https://www.wuxi.gov.cn/', keywords: KW_STANDARD },
  { name: '常州市政府', url: 'https://www.changzhou.gov.cn/', keywords: KW_STANDARD },
  { name: '宁波市政府', url: 'https://www.ningbo.gov.cn/', keywords: KW_STANDARD },
  { name: '温州市政府', url: 'https://www.wenzhou.gov.cn/', keywords: KW_STANDARD },
  { name: '扬州市政府', url: 'https://www.yangzhou.gov.cn/', keywords: KW_STANDARD },
  { name: '南通市政府', url: 'https://www.nantong.gov.cn/', keywords: KW_STANDARD },
  { name: '徐州市政府', url: 'https://www.xuzhou.gov.cn/', keywords: KW_STANDARD },
  { name: '盐城市政府', url: 'https://www.yancheng.gov.cn/', keywords: KW_STANDARD },
  { name: '连云港市政府', url: 'https://www.lyg.gov.cn/', keywords: KW_STANDARD },
  { name: '宿迁市政府', url: 'https://www.suqian.gov.cn/', keywords: KW_STANDARD },
  // === 北方 ===
  { name: '北京市经信局', url: 'https://jxj.beijing.gov.cn/zwgk/', keywords: KW_FULL },
  { name: '青岛市政府', url: 'http://gxj.qingdao.gov.cn/', keywords: KW_STANDARD },
  { name: '济南市政府', url: 'https://www.jinan.gov.cn/', keywords: KW_STANDARD },
  { name: '天津市政府', url: 'https://www.tj.gov.cn/', keywords: KW_STANDARD },
  { name: '石家庄市政府', url: 'https://www.sjz.gov.cn/', keywords: KW_STANDARD },
  // === 中西部 ===
  { name: '武汉市政府', url: 'https://www.wuhan.gov.cn/zwgk/', keywords: KW_STANDARD },
  { name: '成都市政府', url: 'https://www.chengdu.gov.cn/', keywords: KW_STANDARD },
  { name: '西安市政府', url: 'https://www.xa.gov.cn/', keywords: KW_STANDARD },
  { name: '长沙市政府', url: 'https://www.changsha.gov.cn/', keywords: KW_STANDARD },
  { name: '重庆市政府', url: 'https://www.cq.gov.cn/', keywords: KW_STANDARD },
  { name: '合肥市政府', url: 'https://www.hefei.gov.cn/', keywords: KW_STANDARD },
  { name: '昆明市政府', url: 'https://www.km.gov.cn/', keywords: KW_STANDARD },
  // === 东南沿海 ===
  { name: '厦门市政府', url: 'https://www.xm.gov.cn/', keywords: KW_STANDARD },
  { name: '福州市政府', url: 'https://www.fuzhou.gov.cn/', keywords: KW_STANDARD },
  { name: '海口市政府', url: 'https://www.haikou.gov.cn/', keywords: KW_STANDARD },
];

// ===== 爬取链接 =====
async function crawlSource(source) {
  try {
    const resp = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OPCBot/1.0; +https://opcgate.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return { source: source.name, status: 'error', code: resp.status, links: [] };

    const html = await resp.text();
    const links = [];

    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const text = match[2].trim();
      if (text.length < 4) continue;
      if (source.keywords.some(kw => text.includes(kw))) {
        let fullUrl = href;
        if (href.startsWith('/')) {
          const u = new URL(source.url);
          fullUrl = `${u.protocol}//${u.host}${href}`;
        } else if (!href.startsWith('http')) {
          fullUrl = source.url.replace(/\/$/, '') + '/' + href;
        }
        links.push({ title: text.substring(0, 100), url: fullUrl });
      }
    }

    return { source: source.name, status: 'ok', links };
  } catch (e) {
    return { source: source.name, status: 'error', message: e.message, links: [] };
  }
}

// ===== Gemini AI 提取政策结构化数据 =====
async function extractWithGemini(pageContent, pageUrl, apiKey) {
  const prompt = `你是一个政策信息提取助手。请从以下政府网页内容中提取OPC（一人公司）相关政策信息。

如果内容中没有OPC/一人公司/超级个体相关政策，返回 {"relevant": false}。

如果有相关政策，请返回JSON格式：
{
  "relevant": true,
  "policy": {
    "name": "政策全名",
    "city": "所属城市",
    "province": "所属省份",
    "district": "所属区（如果是区级政策）",
    "level": "province/city/district",
    "issuer": "发文单位",
    "publish_date": "YYYY-MM-DD",
    "status": "active/draft/planned",
    "category": "comprehensive/subsidy/space/computing/scenario/competition/registration/talent/tax",
    "summary": "一句话摘要（50字内）",
    "benefits": [
      {"item": "补贴项", "amount": "描述", "amount_max": 数字(元), "type": "cash/voucher/rent_free/loan/tax/other"}
    ],
    "requirements": {
      "registration_location": "注册地要求",
      "industries": ["适用行业"],
      "registration_months": 月数或null,
      "min_employees": 数字或null
    },
    "application": {
      "method": "申请方式",
      "deadline": "YYYY-MM-DD或null"
    },
    "communities": [
      {"name": "社区名", "address": "地址", "operator": "运营方", "features": ["特色"]}
    ]
  }
}

只返回JSON，不要其他文字。

网页URL: ${pageUrl}
网页内容:
${pageContent.substring(0, 8000)}`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      console.error(`Gemini API error: ${resp.status} ${err}`);
      return null;
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    return JSON.parse(text);
  } catch (e) {
    console.error(`Gemini extract error: ${e.message}`);
    return null;
  }
}

// ===== 获取页面内容 =====
async function fetchPageContent(url) {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OPCBot/1.0; +https://opcgate.com)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    // 简单清理HTML标签，保留文本
    return html.replace(/<script[\s\S]*?<\/script>/gi, '')
               .replace(/<style[\s\S]*?<\/style>/gi, '')
               .replace(/<[^>]+>/g, ' ')
               .replace(/\s+/g, ' ')
               .trim();
  } catch (e) {
    return null;
  }
}

// ===== 政策变动检测 =====
function detectChanges(oldPolicies, newPolicies) {
  const changes = [];
  const oldMap = {};
  (oldPolicies || []).forEach(p => { oldMap[p.id] = p; });

  const newMap = {};
  (newPolicies || []).forEach(p => { newMap[p.id] = p; });

  // 新增
  for (const id in newMap) {
    if (!oldMap[id]) {
      changes.push({ type: 'added', policy: newMap[id], timestamp: new Date().toISOString() });
    }
  }

  // 修改（status变化）
  for (const id in newMap) {
    if (oldMap[id] && oldMap[id].status !== newMap[id].status) {
      changes.push({
        type: 'status_changed',
        policy: newMap[id],
        old_status: oldMap[id].status,
        new_status: newMap[id].status,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 过期检测
  const now = new Date();
  for (const id in newMap) {
    const dl = newMap[id].application?.deadline;
    if (dl) {
      const d = new Date(dl);
      if (d < now && oldMap[id]?.status === 'active') {
        changes.push({ type: 'expired', policy: newMap[id], timestamp: new Date().toISOString() });
      }
    }
  }

  return changes;
}

// ===== 主爬取流程 =====
async function runCrawl(env) {
  const timestamp = new Date().toISOString();
  console.log(`[OPC Crawler] Starting at ${timestamp}`);

  // Load existing data
  let existing = {};
  try {
    const data = await env.OPC_DATA.get('crawl_results', 'json');
    if (data) existing = data;
  } catch (e) {}

  const seenUrls = new Set(Object.keys(existing.urls || {}));
  const newFinds = [];
  const errors = [];

  // Phase 1: Crawl all sources (batches of 4, rate limited)
  for (let i = 0; i < SOURCES.length; i += 4) {
    const batch = SOURCES.slice(i, i + 4);
    const results = await Promise.all(batch.map(s => crawlSource(s)));

    for (const result of results) {
      if (result.status === 'error') {
        errors.push({ source: result.source, error: result.message || `HTTP ${result.code}` });
      }
      for (const link of result.links) {
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          newFinds.push({ ...link, source: result.source, found_at: timestamp });
        }
      }
    }

    // Rate limit: 2s between batches
    if (i + 4 < SOURCES.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Phase 2: AI extraction for new finds (if Gemini API key configured)
  const geminiKey = env.GEMINI_API_KEY;
  const extractedPolicies = [];

  if (geminiKey && newFinds.length > 0) {
    // Process max 10 new links per run to stay within limits
    const toProcess = newFinds.slice(0, 10);
    for (const find of toProcess) {
      const content = await fetchPageContent(find.url);
      if (!content || content.length < 100) continue;

      const result = await extractWithGemini(content, find.url, geminiKey);
      if (result?.relevant && result.policy) {
        const policy = result.policy;
        policy.id = `auto-${find.source.replace(/\s/g, '-')}-${Date.now()}`;
        policy.links = { official: find.url };
        policy.auto_extracted = true;
        policy.extracted_at = timestamp;
        extractedPolicies.push(policy);
      }

      // Rate limit Gemini: 3s between calls
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // Phase 3: Detect policy changes
  let existingPolicies = [];
  try {
    const pData = await env.OPC_DATA.get('policies_snapshot', 'json');
    if (pData) existingPolicies = pData;
  } catch (e) {}

  const allPolicies = [...existingPolicies, ...extractedPolicies];
  const changes = detectChanges(existingPolicies, allPolicies);

  // Save everything
  const urls = existing.urls || {};
  for (const find of newFinds) {
    urls[find.url] = find;
  }

  const crawlData = {
    urls,
    last_crawl: timestamp,
    total_urls: Object.keys(urls).length,
    history: [
      ...(existing.history || []).slice(-100),
      {
        timestamp,
        new_links: newFinds.length,
        extracted: extractedPolicies.length,
        changes: changes.length,
        errors: errors.length,
        sources_checked: SOURCES.length,
      }
    ]
  };

  await env.OPC_DATA.put('crawl_results', JSON.stringify(crawlData));
  await env.OPC_DATA.put('last_crawl_time', timestamp);
  await env.OPC_DATA.put('new_finds_latest', JSON.stringify(newFinds));

  if (extractedPolicies.length > 0) {
    await env.OPC_DATA.put('policies_snapshot', JSON.stringify(allPolicies));
    await env.OPC_DATA.put('extracted_latest', JSON.stringify(extractedPolicies));
  }

  if (changes.length > 0) {
    // Append to change log
    let changeLog = [];
    try {
      const cl = await env.OPC_DATA.get('change_log', 'json');
      if (cl) changeLog = cl;
    } catch (e) {}
    changeLog = [...changeLog.slice(-200), ...changes];
    await env.OPC_DATA.put('change_log', JSON.stringify(changeLog));
  }

  const summary = {
    new_links: newFinds.length,
    extracted: extractedPolicies.length,
    changes: changes.length,
    errors: errors.length,
    total_urls: crawlData.total_urls,
    timestamp,
  };
  console.log(`[OPC Crawler] Done.`, JSON.stringify(summary));
  return summary;
}

export default {
  // Cron trigger - runs every 12 hours
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCrawl(env));
  },

  // HTTP handler
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    };

    // GET / or /status
    if (url.pathname === '/status' || url.pathname === '/') {
      const lastCrawl = await env.OPC_DATA.get('last_crawl_time');
      const data = await env.OPC_DATA.get('crawl_results', 'json');
      return new Response(JSON.stringify({
        status: 'running',
        last_crawl: lastCrawl || 'never',
        total_urls: data?.total_urls || 0,
        sources: SOURCES.length,
        schedule: 'every 12 hours',
        gemini_enabled: !!env.GEMINI_API_KEY,
        history: (data?.history || []).slice(-10),
      }), { headers });
    }

    // GET /new - latest new findings
    if (url.pathname === '/new') {
      const finds = await env.OPC_DATA.get('new_finds_latest', 'json');
      return new Response(JSON.stringify({ finds: finds || [] }), { headers });
    }

    // GET /extracted - latest AI extracted policies
    if (url.pathname === '/extracted') {
      const extracted = await env.OPC_DATA.get('extracted_latest', 'json');
      return new Response(JSON.stringify({ policies: extracted || [] }), { headers });
    }

    // GET /changes - policy change log
    if (url.pathname === '/changes') {
      const changes = await env.OPC_DATA.get('change_log', 'json');
      return new Response(JSON.stringify({ changes: changes || [] }), { headers });
    }

    // POST /crawl - manual trigger
    if (url.pathname === '/crawl' && request.method === 'POST') {
      const result = await runCrawl(env);
      return new Response(JSON.stringify(result), { headers });
    }

    return new Response(JSON.stringify({
      error: 'Not found',
      endpoints: [
        'GET  /status    - 爬虫状态',
        'GET  /new       - 最新发现的链接',
        'GET  /extracted - AI提取的政策（需配置GEMINI_API_KEY）',
        'GET  /changes   - 政策变动日志',
        'POST /crawl     - 手动触发爬取',
      ]
    }), { status: 404, headers });
  },
};
