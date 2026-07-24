const DAY_MS = 24 * 60 * 60 * 1000;

const STOP_WORDS = new Set([
  '一个', '一些', '以及', '相关', '这个', '我们', '他们', '可以', '进行', '发布',
  '关注', '今日', '最新', '正式', '成为', '如何', '什么', '是否', '已经', '正在',
  'with', 'from', 'that', 'this', 'into', 'your', 'about', 'will', 'have', 'agent',
]);

const CONCEPTS = [
  { id: 'ai-agent', label: 'AI 智能体', terms: ['ai', '人工智能', '智能体', 'agent', '大模型', '模型', 'mcp', 'openclaw'] },
  { id: 'opc', label: 'OPC 创业', terms: ['opc', '一人公司', '独立开发', '超级个体', '创业', '初创', '单人公司'] },
  { id: 'computing', label: '算力与工具', terms: ['算力', 'token', '云服务', '模型开发', '开发工具', '工具链'] },
  { id: 'space', label: '空间与载体', terms: ['空间', '场地', '工位', '孵化器', '社区', '产业园', '入驻', '免租'] },
  { id: 'funding', label: '资金与融资', terms: ['补贴', '资助', '融资', '贷款', '基金', '奖励', '现金', '成本'] },
  { id: 'talent', label: '人才与团队', terms: ['人才', '团队', '招聘', '社保', '公寓', '住房'] },
  { id: 'scenario', label: '场景与市场', terms: ['场景', '订单', '市场', '应用', '采购', '供需', '客户'] },
  { id: 'competition', label: '赛事与内容', terms: ['比赛', '赛事', 'vibesocial', 'vibe coding', '微博', '内容', '热点', '传播'] },
];

const RISK_PATTERNS = [
  { code: 'guaranteed_claim', pattern: /(保证|必得|必拿|100%|百分之百|稳赚|零风险)/i, message: '包含保证性或绝对化表述' },
  { code: 'approval_claim', pattern: /(已获批|已经通过审核|官方背书|政府指定|独家认证|官方推荐)/i, message: '可能暗示未经证明的审批或官方背书' },
  { code: 'qualification_claim', pattern: /(符合(?:申报|申请|补贴)?条件|满足(?:申报|申请)?资格|有资格|可(?:直接)?(?:申领|领取)(?:补贴|奖励|资助)?)/i, message: '把政策关联写成了确定资格或可领取结论' },
  { code: 'urgency_claim', pattern: /(最后一天|仅剩\d+天|马上截止|今日截止)/i, message: '包含需要回到官方来源核验的强时效断言' },
  { code: 'financial_claim', pattern: /(补贴到账|最高可得|(?:领取|奖励|补贴|资助)[^，。；\n]{0,12}\d+(?:\.\d+)?\s*(?:万|亿|元|万元|亿元))/i, message: '包含金额或到账断言，需逐字核对适用条件' },
];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function normalizeText(value = '') {
  return String(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function safeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function policyCorpus(policy) {
  return normalizeText([
    policy.name, policy.city, policy.province, policy.district, policy.issuer,
    policy.summary, policy.category, policy.actual_cases,
    ...(policy.tags || []),
    ...((policy.requirements?.industries) || []),
    ...((policy.benefits || []).flatMap(item => [item.item, item.amount, item.type])),
  ].join(' '));
}

function communityCorpus(community) {
  return normalizeText([
    community.name, community.city, community.province, community.district,
    community.track, community.operator, ...(community.features || []),
  ].join(' '));
}

function urlOrEmpty(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function isOfficialSourceUrl(value) {
  const url = urlOrEmpty(value);
  if (!url) return false;
  const host = new URL(url).hostname.toLowerCase();
  return host.endsWith('.gov.cn')
    || host.endsWith('.cnbayarea.org.cn')
    || host.endsWith('.ccpit.org');
}

export function extractKeywords(input, { limit = 10 } = {}) {
  const text = normalizeText(typeof input === 'string' ? input : `${input?.title || ''} ${input?.text || input?.summary || ''}`);
  if (!text) return [];
  const frequencies = new Map();
  const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
  for (const { segment, isWordLike } of segmenter.segment(text)) {
    const token = segment.trim();
    if (!isWordLike || STOP_WORDS.has(token) || /^\d+$/.test(token)) continue;
    if (!/[\p{Script=Han}]{2,}|[a-z][a-z0-9.+#-]{1,}/u.test(token)) continue;
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }
  for (const concept of CONCEPTS) {
    for (const term of concept.terms) {
      if (text.includes(term)) frequencies.set(term, (frequencies.get(term) || 0) + 3);
    }
  }
  return [...frequencies.entries()]
    .sort(([a, aCount], [b, bCount]) => bCount - aCount || b.length - a.length || a.localeCompare(b, 'zh-CN'))
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

export function inferIntent(input, keywords = extractKeywords(input)) {
  const text = normalizeText(`${typeof input === 'string' ? input : `${input?.title || ''} ${input?.text || input?.summary || ''}`} ${keywords.join(' ')}`);
  const themes = CONCEPTS
    .map(concept => ({
      id: concept.id,
      label: concept.label,
      matchedTerms: concept.terms.filter(term => text.includes(term)),
    }))
    .filter(item => item.matchedTerms.length)
    .sort((a, b) => b.matchedTerms.length - a.matchedTerms.length);
  const intent = themes.some(item => ['funding', 'computing', 'space'].includes(item.id))
    ? '寻找可核验的 OPC 落地资源与政策线索'
    : themes.some(item => item.id === 'competition')
      ? '将公开话题转成有来源、可复核的专业内容'
      : '理解话题与 OPC 创业落地的关联';
  return { intent, themes: themes.length ? themes : [{ id: 'general', label: '创业观察', matchedTerms: [] }] };
}

export function scoreSource(policy) {
  const officialUrl = urlOrEmpty(policy?.links?.official || policy?.officialUrl);
  const officialOriginal = isOfficialSourceUrl(officialUrl);
  let score = officialOriginal ? 86 : officialUrl ? 68 : 34;
  if (policy?.verified === true) score += officialOriginal ? 10 : 7;
  if (policy?.status === 'active' || policy?.landing_status === 'active') score += 4;
  if (policy?.status === 'draft') score -= 18;
  return {
    score: clamp(score),
    officialUrl,
    officialOriginal,
    label: officialOriginal ? (policy?.verified ? '官方原文 · 已校验记录' : '官方原文') : officialUrl ? '参考来源 · 待回到官方核验' : '缺少官方原文',
  };
}

export function scoreFreshness(policy, asOf = new Date()) {
  const updated = safeDate(policy?.updated_at || policy?.publish_date);
  const reference = safeDate(asOf) || new Date();
  if (!updated) return { score: 20, ageDays: null, date: '', label: '未记录快照日期' };
  const ageDays = Math.max(0, Math.floor((reference - updated) / DAY_MS));
  let score = 12;
  if (ageDays <= 30) score = 100;
  else if (ageDays <= 90) score = 88;
  else if (ageDays <= 180) score = 74;
  else if (ageDays <= 365) score = 58;
  else if (ageDays <= 730) score = 38;
  return { score, ageDays, date: updated.toISOString().slice(0, 10), label: `数据快照 ${updated.toISOString().slice(0, 10)}` };
}

export function matchPolicies(input, policies, { asOf = new Date(), limit = 12 } = {}) {
  const keywords = extractKeywords(input);
  const inferred = inferIntent(input, keywords);
  const topicText = normalizeText(typeof input === 'string' ? input : `${input?.title || ''} ${input?.text || input?.summary || ''}`);
  const activeConcepts = CONCEPTS.filter(concept => concept.terms.some(term => topicText.includes(term) || keywords.includes(term)));
  return (Array.isArray(policies) ? policies : []).map(policy => {
    const corpus = policyCorpus(policy);
    const keywordMatches = keywords.filter(term => term.length > 1 && corpus.includes(normalizeText(term)));
    const conceptMatches = activeConcepts.filter(concept => concept.terms.some(term => corpus.includes(term)));
    const placeMatches = unique([policy.city, policy.province, policy.district].map(normalizeText).filter(place => place && topicText.includes(place)));
    const source = scoreSource(policy);
    const freshness = scoreFreshness(policy, asOf);
    const title = normalizeText(policy.name);
    const genericTerms = new Set(['ai', 'opc', '创业', '内容', '应用', '政策', '支持', '发展']);
    const keywordScore = Math.min(38, keywordMatches.reduce((total, term) => total + (genericTerms.has(term) ? 3 : term.length >= 4 ? 8 : 6), 0));
    const titleScore = Math.min(18, keywordMatches.reduce((total, term) => total + (title.includes(term) ? (genericTerms.has(term) ? 2 : 6) : 0), 0));
    const conceptScore = Math.min(24, conceptMatches.length * 6);
    const placeScore = Math.min(22, placeMatches.length * 16);
    const relevance = clamp(keywordScore + titleScore + conceptScore + placeScore);
    const confidence = clamp(relevance * 0.68 + source.score * 0.22 + freshness.score * 0.1);
    const matchedTerms = unique([...placeMatches, ...keywordMatches, ...conceptMatches.map(item => item.label)]).slice(0, 6);
    return {
      id: policy.id,
      name: policy.name,
      city: policy.city || '全国',
      province: policy.province || '',
      district: policy.district || '',
      category: policy.category || '',
      summary: policy.summary || '',
      status: policy.status || '',
      updatedAt: policy.updated_at || policy.publish_date || '',
      benefits: (policy.benefits || []).slice(0, 4),
      requirements: policy.requirements || {},
      officialUrl: source.officialUrl,
      officialOriginal: source.officialOriginal,
      sourceScore: source.score,
      sourceLabel: source.label,
      freshnessScore: freshness.score,
      freshnessLabel: freshness.label,
      relevanceScore: relevance,
      confidenceScore: confidence,
      matchedTerms,
      matchReason: matchedTerms.length ? `话题中的「${matchedTerms.slice(0, 3).join('、')}」与该条目的名称、摘要或标签重合` : '',
      boundary: '仅表示内容关联，适用对象、有效期与申报资格仍需回到官方原文核验。',
    };
  }).filter(item => item.status !== 'draft' && item.relevanceScore >= 18 && item.matchedTerms.length)
    .sort((a, b) => b.confidenceScore - a.confidenceScore || b.relevanceScore - a.relevanceScore || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function aggregateCities(matches, communities = [], { limit = 6 } = {}) {
  const byCity = new Map();
  for (const match of matches || []) {
    const city = match.city || '全国';
    const item = byCity.get(city) || { city, score: 0, topScore: 0, policyCount: 0, officialCount: 0, policyIds: [], reasons: [] };
    item.score += match.confidenceScore;
    item.topScore = Math.max(item.topScore, match.confidenceScore);
    item.policyCount += 1;
    item.officialCount += match.officialOriginal ? 1 : 0;
    item.policyIds.push(match.id);
    item.reasons.push(...match.matchedTerms);
    byCity.set(city, item);
  }
  return [...byCity.values()].map(item => {
    const relatedCommunities = (communities || []).filter(community => community.city === item.city);
    return {
      ...item,
      score: clamp(
        item.topScore * 0.62
        + Math.min(18, item.policyCount * 4.5)
        + (item.officialCount / Math.max(1, item.policyCount)) * 10
        + Math.min(8, relatedCommunities.length * 1.5)
      ),
      communityCount: relatedCommunities.length,
      reasons: unique(item.reasons).slice(0, 4),
    };
  }).sort((a, b) => b.score - a.score || b.policyCount - a.policyCount || a.city.localeCompare(b.city, 'zh-CN')).slice(0, limit);
}

export function matchCommunities(input, communities, cityInsights, { limit = 8 } = {}) {
  const keywords = extractKeywords(input);
  const inferred = inferIntent(input, keywords);
  const desiredCities = new Map((cityInsights || []).map((item, index) => [item.city, Math.max(0, 20 - index * 3)]));
  return (communities || []).map(community => {
    const corpus = communityCorpus(community);
    const matchedTerms = unique([
      ...keywords.filter(term => corpus.includes(normalizeText(term))),
      ...inferred.themes.filter(theme => CONCEPTS.find(item => item.id === theme.id)?.terms.some(term => corpus.includes(term))).map(theme => theme.label),
    ]);
    const score = clamp((desiredCities.get(community.city) || 0) + Math.min(42, matchedTerms.length * 9) + (community.verified ? 10 : 0));
    return {
      id: community.id,
      name: community.name,
      city: community.city,
      district: community.district || '',
      address: community.address || '',
      features: (community.features || []).slice(0, 5),
      sourceUrl: urlOrEmpty(community.source),
      verified: community.verified === true,
      score,
      matchedTerms,
      boundary: community.verified && community.source ? '已有来源记录，入驻条件仍需联系运营方确认。' : '载体信息仅作线索，地址、权益与入驻状态需再次确认。',
    };
  }).filter(item => desiredCities.has(item.city) || item.matchedTerms.length)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function assessPublicationRisk(text, context = {}) {
  const value = String(text || '');
  const flags = RISK_PATTERNS.filter(item => item.pattern.test(value)).map(({ code, message }) => ({ code, message }));
  if (context.sourceProvided === false) flags.push({ code: 'missing_topic_source', message: '话题没有可供读者复核的原始链接' });
  return {
    score: clamp(flags.reduce((total, flag) => total + (flag.code === 'missing_topic_source' ? 22 : 20), 0)),
    level: flags.length === 0 ? 'low' : flags.length >= 3 ? 'high' : 'medium',
    flags,
  };
}

export function generateLayeredDraft(topic, matches, cityInsights, { maxLength = 1200 } = {}) {
  const topPolicies = (matches || []).slice(0, 3);
  const topCities = (cityInsights || []).filter(item => item.city !== '全国').slice(0, 3);
  const inputLabel = topic?.mode === 'sample' ? '非实时演示场景' : '手动输入待核验';
  const sourceLine = topic?.sourceUrl
    ? `话题来源：${urlOrEmpty(topic.sourceUrl) || '链接格式待核验'}`
    : '话题来源：未提供原始链接，不能把输入内容直接当作已核实事实';
  const facts = topPolicies.length
    ? topPolicies.map(item => `- OPC Gate 数据库收录「${item.name}」（${item.city}，${item.freshnessLabel}）${item.officialOriginal ? '，附官方原文' : item.officialUrl ? '，附参考来源，仍需核验官方原文' : '，暂缺官方原文'}`).join('\n')
    : '- 暂未匹配到足够相关的政策条目，不附会政策结论';
  const inference = topCities.length
    ? `- 按关键词重合、来源完整度与数据快照综合，${topCities.map(item => item.city).join('、')}值得优先继续核验。这里是内容线索排序，不是资格或获批概率。`
    : '- 当前证据不足以形成城市机会排序。';
  const verify = topPolicies.length
    ? topPolicies.map(item => `- 核对「${item.name}」的适用对象、有效期、申报入口与当前版本`).join('\n')
    : '- 补充公开来源并换用更具体的话题描述后重新分析';
  const keywords = extractKeywords(topic, { limit: 4 }).map(item => `#${item.replace(/\s+/g, '')}#`).join(' ');
  const text = [
    `【${inputLabel}】${topic?.title || '公开话题的 OPC 机会解读'}`,
    '',
    '【事实】', facts,
    '',
    '【推断】', inference,
    '',
    '【待核验】', verify, `- ${sourceLine}`,
    '',
    '边界：当前未接入微博实时 API；政策关联不等于资格判断；本工具不自动发布。',
    `${keywords} #微博VibeLab# #VibeSocial#`,
  ].join('\n').trim();
  const bounded = text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
  return { text: bounded, characterCount: bounded.length, risk: assessPublicationRisk(bounded, { sourceProvided: Boolean(topic?.sourceUrl) }) };
}

export function scanAIDraft(text, report) {
  const value = String(text || '').trim();
  const violations = [];
  const need = (code, pattern, message) => { if (!pattern.test(value)) violations.push({ code, message }); };
  need('missing_input_label', report?.topic?.mode === 'sample' ? /【非实时演示场景】/ : /【手动输入待核验】/, '输入类型标识与实际模式不一致');
  need('missing_fact_layer', /【事实】/, '缺少事实层');
  need('missing_inference_layer', /【推断】/, '缺少推断层');
  need('missing_verify_layer', /【待核验】/, '缺少待核验层');
  need('missing_api_boundary', /未接入\s*微博(?:实时)?\s*API/i, '缺少未接入微博实时 API 的说明');
  need('missing_qualification_boundary', /政策关联不等于资格判断/, '缺少政策关联的资格边界');
  need('missing_publish_boundary', /(不自动发布|手动发布)/, '缺少不自动发布说明');
  need('missing_contest_tags', /#微博VibeLab#.*#VibeSocial#|#VibeSocial#.*#微博VibeLab#/s, '缺少完整赛事标签');
  const risk = assessPublicationRisk(value, { sourceProvided: true });
  violations.push(...risk.flags);
  const evidence = JSON.stringify({ topic: report?.topic, matches: report?.policyMatches, cities: report?.cityInsights }).replace(/\s+/g, '');
  for (const claim of unique(value.match(/\d+(?:\.\d+)?\s*(?:%|％|万元|亿元|元|万|亿)/g) || [])) {
    if (!evidence.includes(claim.replace(/\s+/g, ''))) violations.push({ code: 'unsupported_numeric_claim', message: `出现证据上下文中不存在的数字断言：${claim}` });
  }
  const deduped = [...new Map(violations.map(item => [item.code, item])).values()];
  return { passed: deduped.length === 0, method: 'deterministic_boundary_rules', violations: deduped, note: '规则扫描只检查边界、结构和高风险措辞，不等于事实核验。' };
}

export function buildVerificationChecklist(report) {
  const topic = report.topic;
  const checklist = [
    { id: 'topic-label', required: true, text: `确认保留“${topic.mode === 'sample' ? '非实时演示场景' : '手动输入待核验'}”标识，不冒充实时热搜`, status: 'pending' },
    { id: 'topic-source', required: true, text: topic.sourceUrl ? '打开话题原始链接，核对正文、时间与上下文' : '当前没有话题原始链接：只允许作为方法演示，不得写成已核实热点', status: topic.sourceUrl ? 'pending' : 'blocked', url: topic.sourceUrl || '' },
    { id: 'claim-boundary', required: true, text: '确认未把政策关联写成资格、获批、到账或官方背书', status: report.draft.risk.flags.length ? 'blocked' : 'pending' },
  ];
  for (const policy of (report.policyMatches || []).slice(0, 4)) {
    checklist.push({
      id: `policy-${policy.id}`,
      required: true,
      text: policy.officialOriginal ? `打开「${policy.name}」官方原文，核对适用对象、时效与入口` : policy.officialUrl ? `「${policy.name}」当前是参考来源，需继续找到并核对官方原文` : `「${policy.name}」缺少官方原文，只能保留为待核验线索`,
      status: policy.officialOriginal ? 'pending' : 'blocked',
      url: policy.officialUrl,
    });
  }
  checklist.push({ id: 'human-review', required: true, text: '由发布者完成最终人工复核，再手动发布；OPC Gate 不代替本人发博', status: 'pending' });
  return checklist;
}

export function evaluatePublicationGate(items) {
  const required = (items || []).filter(item => item.required !== false);
  const completed = required.filter(item => item.checked === true).length;
  return { total: required.length, completed, open: required.length > 0 && completed === required.length };
}

export function analyzeTopic(topic, policies, communities, { asOf = new Date() } = {}) {
  const title = String(topic?.title || '').trim().slice(0, 120);
  const text = String(topic?.text || topic?.summary || '').trim().slice(0, 1800);
  const mode = topic?.mode === 'sample' ? 'sample' : 'manual';
  if (!title || text.length < 12) throw new Error('请填写标题，并输入至少 12 个字的公开话题文本');
  const normalizedTopic = { title, text, mode, sourceUrl: urlOrEmpty(topic?.sourceUrl), observedAt: String(topic?.observedAt || '').slice(0, 10) };
  const keywords = extractKeywords(normalizedTopic);
  const intent = inferIntent(normalizedTopic, keywords);
  const policyMatches = matchPolicies(normalizedTopic, policies, { asOf });
  const cityInsights = aggregateCities(policyMatches, communities);
  const communityMatches = matchCommunities(normalizedTopic, communities, cityInsights);
  const draft = generateLayeredDraft(normalizedTopic, policyMatches, cityInsights);
  const report = {
    topic: normalizedTopic,
    extraction: { keywords, ...intent },
    policyMatches,
    cityInsights,
    communityMatches,
    draft,
    dataScope: { policies: policies?.length || 0, communities: communities?.length || 0, matchedPolicies: policyMatches.length },
    limitations: [
      '当前不接微博实时 API；输入来自明确标注的演示场景或用户手动粘贴的公开文本。',
      '政策与载体排序是内容相关性线索，不是资格判断、获批概率或政府评分。',
      '本站不自动发布，复制和导出前必须完成人工核验。',
    ],
  };
  report.verificationChecklist = buildVerificationChecklist(report);
  report.draftScan = scanAIDraft(report.draft.text, report);
  return report;
}

export function toMarkdown(report, draftText = report?.draft?.text || '') {
  const policyLines = (report?.policyMatches || []).map(item => `- [${item.name}](${item.officialUrl || '#'}) · ${item.city} · 关联 ${item.relevanceScore}/100 · ${item.boundary}`).join('\n') || '- 暂无匹配';
  const cityLines = (report?.cityInsights || []).map(item => `- ${item.city}：${item.policyCount} 条关联政策，${item.communityCount} 个载体线索，综合 ${item.score}/100`).join('\n') || '- 暂无城市排序';
  return `# OPC 政策热点雷达\n\n> 生成时间：${new Date().toISOString()}\n> 非实时热点数据；仅作内容研究和人工核验参考。\n\n## 话题\n\n${report?.topic?.title || ''}\n\n${report?.topic?.text || ''}\n\n## 关键词与意图\n\n- 意图：${report?.extraction?.intent || ''}\n- 关键词：${(report?.extraction?.keywords || []).join('、')}\n\n## 城市机会分布\n\n${cityLines}\n\n## 政策证据\n\n${policyLines}\n\n## 待发布草稿\n\n${draftText}\n\n## 使用边界\n\n${(report?.limitations || []).map(item => `- ${item}`).join('\n')}\n`;
}
