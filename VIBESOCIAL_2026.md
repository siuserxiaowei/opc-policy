# OPC Gate × VibeSocial 参赛补充说明

## 作品定位

VibeSocial 专项能力已整合到主产品：[https://opcgate.com/vibesocial](https://opcgate.com/vibesocial)。

它不是一个“抓热搜、自动发博”的工具，而是 OPC Gate 的政策内容研究与发布前核验入口：用户输入公开话题文本后，系统用主站全量数据关联政策、城市与载体，输出可追溯证据、适用边界和分层草稿，并在人工核验完成前锁定复制。

## 三层产品关系

1. **OPC Gate 主站**：政策查询、城市比较、载体筛选、窗口期和落地路线诊断。
2. **VibeSocial 专项能力**：公开话题理解、政策证据关联、可信解读草稿和发布门禁。
3. **Trust Agent 技术 Demo**：保留初版风险扫描与门禁原型，作为独立技术证明，不再承担主产品叙事。

原专项 Demo：[https://opc-vibesocial-trust-agent.siuserxy.workers.dev/](https://opc-vibesocial-trust-agent.siuserxy.workers.dev/)

## 完整闭环

```text
公开文本 / 非实时演示场景
  → 关键词、主题与意图
  → 125 条政策相关性匹配
  → 城市机会和 128 个载体线索聚合
  → 官方来源、数据快照、匹配理由与适用边界
  → 事实 / 推断 / 待核验草稿
  → InfiniSynapse 受限证据改写（可选）
  → 确定性后扫
  → 人工核验门禁
  → 手动复制 / Markdown 导出
  → 城市对比、窗口期、路线诊断
```

## 边界

- 当前不接微博实时 API，不把离线演示或用户输入冒充当前热搜。
- 不抓取私信、Cookie、账号凭据或未授权个人信息。
- 政策相关性不是资格判断、获批概率、政府评分或补贴承诺。
- 不自动发布微博；复制也不等于发布。
- AI 仅可使用规则引擎提供的政策和来源，不允许浏览器、搜索或外部知识；结构解析或规则后扫失败时不采用 AI 输出。

## 关键实现

- `vibesocial/index.html`：专项页面和完整产品闭环。
- `assets/js/vibesocial-core.js`：关键词 / 意图、政策匹配、城市 / 载体聚合、风险扫描、分层草稿和发布门禁。
- `assets/js/vibesocial.js`：浏览器交互、草稿重锁、SSE 报告和 Markdown 导出。
- `functions/api/vibesocial-report.js`：InfiniSynapse 服务端受限证据改写。
- `tests/unit/vibesocial-*.test.mjs`：规则和接口回归测试。

## 对外说明建议

> 之前发布的是“可信解读与发布门禁”的专项技术 Demo，现在已经把它接回主产品 OPC Gate：`opcgate.com/vibesocial` 会用主站 125 条政策、42 个城市范围和 128 个载体数据，把公开话题拆成事实 / 推断 / 待核验内容，附上来源、城市机会和适用边界；全部人工核验前不能复制。原 Demo 保留做技术证明，主入口和后续落地决策都回到 OPC Gate。当前不接微博实时 API，也不会自动发布。
