# opcgate — OPC 选址决策工具

> **全网第一个按条件精准匹配 OPC（一人公司）政策与补贴的工具，38 城 106 条政策、96 条社区 / 孵化器记录，优先展示官方原文，缺失官链会明示参考来源。**

**官网：[https://opcgate.com](https://opcgate.com)** · **对比工具：[opcgate.com/compare](https://opcgate.com/compare)** · **城市入口大全：[opcgate.com/seo/cities](https://opcgate.com/seo/cities)**

[![Site](https://img.shields.io/badge/site-opcgate.com-2563EB)](https://opcgate.com)
[![Cloudflare Pages](https://img.shields.io/badge/host-Cloudflare%20Pages-F38020)](https://opcgate.com)
[![Sitemap](https://img.shields.io/badge/sitemap-60%20URLs-15803D)](https://opcgate.com/sitemap.xml)
[![RSS](https://img.shields.io/badge/RSS-policy%20updates-B45309)](https://opcgate.com/rss.xml)
[![License](https://img.shields.io/badge/license-MIT-0F766E)](#license)

## 为什么做这件事

OPC（One-Person Company，一人公司）是 2026 年地方招商的核心抓手。广州、深圳、苏州、成都、杭州等 20+ 城市推出了形式各异的政策：有的给算力补贴，有的给免租工位，有的给 AI 示范项目奖。问题是：

- 政府公告散落在几十个区、市、省的不同门户
- 中介 / 孵化器口头描述的"优惠"经常货不对板
- OPC 论坛有氛围没有结构化数据
- Excel 横向对比做到第 5 个城市就会崩

`opcgate.com` 专做结构化政策数据库 + 决策工具：输入公司情况 → 输出匹配度排序、倒计时、材料清单、官方原文链接。不做论坛、不做代办、不做软文。

## 核心能力

| 能力 | 入口 | 适合场景 |
|------|------|---------|
| **智能匹配** | [首页](https://opcgate.com) | 填身份、城市、行业，返回 top 可申政策 + 倒计时 |
| **城市对比** | [compare](https://opcgate.com/compare) | 两到四座城市并排对比补贴额、社区、税务、申报门槛 |
| **城市深页** | [seo/cities](https://opcgate.com/seo/cities) | 单城聚合页：政策列表 + 孵化器 + 最新核验时间 |
| **数据看板** | [dashboard](https://opcgate.com/dashboard) | 城市覆盖图、补贴分布、申报日历、Top 10 榜单 |
| **广州专版** | [guangzhou](https://opcgate.com/guangzhou) | 各区 OPC 政策 + 琶洲模方 + 海珠十条原文 |
| **税务对比** | [tax](https://opcgate.com/tax) + [tax-cases](https://opcgate.com/tax-cases) | OPC vs 个独 vs 有限公司 综合税负计算 |
| **维护日志** | [changelog](https://opcgate.com/changelog) | 每条新增 / 改动 / 废止都留痕，可追溯 |
| **RSS 订阅** | [rss.xml](https://opcgate.com/rss.xml) | 政策更新实时推送 |

## 热门城市对比页

每一页都是带官方来源的长文深页，直接点进去能做决策：

- [广州 vs 深圳 vs 苏州 OPC 政策对比](https://opcgate.com/seo/guangzhou-vs-shenzhen-vs-suzhou)
- [北京 vs 上海 vs 深圳 OPC 对比](https://opcgate.com/seo/beijing-vs-shanghai-vs-shenzhen)
- [苏州 vs 杭州 vs 南京 OPC 对比](https://opcgate.com/seo/suzhou-vs-hangzhou-vs-nanjing)
- [成都 vs 重庆 vs 武汉 OPC 对比](https://opcgate.com/seo/chengdu-vs-chongqing-vs-wuhan)
- [合肥 vs 南京 vs 杭州 OPC 对比](https://opcgate.com/seo/hefei-vs-nanjing-vs-hangzhou)
- [AI 语音创业：广州 vs 深圳 谁更划算](https://opcgate.com/seo/ai-voice-guangzhou-vs-shenzhen)
- [2026 年最适合做 OPC 的城市榜](https://opcgate.com/seo/best-opc-city-2026)

## 36 城城市入口

除了广州、成都、苏州三个专版外，其他 35 个城市也都有结构化深页（合计 38 城）：

[北京](https://opcgate.com/seo/cities/北京) · [上海](https://opcgate.com/seo/cities/上海) · [深圳](https://opcgate.com/seo/cities/深圳) · [杭州](https://opcgate.com/seo/cities/杭州) · [南京](https://opcgate.com/seo/cities/南京) · [武汉](https://opcgate.com/seo/cities/武汉) · [重庆](https://opcgate.com/seo/cities/重庆) · [西安](https://opcgate.com/seo/cities/西安) · [合肥](https://opcgate.com/seo/cities/合肥) · [郑州](https://opcgate.com/seo/cities/郑州) · [长沙](https://opcgate.com/seo/cities/长沙) · [济南](https://opcgate.com/seo/cities/济南) · [青岛](https://opcgate.com/seo/cities/青岛) · [天津](https://opcgate.com/seo/cities/天津) · [宁波](https://opcgate.com/seo/cities/宁波) · [无锡](https://opcgate.com/seo/cities/无锡) · [常州](https://opcgate.com/seo/cities/常州) · [南通](https://opcgate.com/seo/cities/南通) · [徐州](https://opcgate.com/seo/cities/徐州) · [扬州](https://opcgate.com/seo/cities/扬州) · [盐城](https://opcgate.com/seo/cities/盐城) · [连云港](https://opcgate.com/seo/cities/连云港) · [宿迁](https://opcgate.com/seo/cities/宿迁) · [温州](https://opcgate.com/seo/cities/温州) · [东莞](https://opcgate.com/seo/cities/东莞) · [佛山](https://opcgate.com/seo/cities/佛山) · [中山](https://opcgate.com/seo/cities/中山) · [珠海](https://opcgate.com/seo/cities/珠海) · [惠州](https://opcgate.com/seo/cities/惠州) · [梅州](https://opcgate.com/seo/cities/梅州) · [厦门](https://opcgate.com/seo/cities/厦门) · [福州](https://opcgate.com/seo/cities/福州) · [昆明](https://opcgate.com/seo/cities/昆明) · [海口](https://opcgate.com/seo/cities/海口) · [石家庄](https://opcgate.com/seo/cities/石家庄)

## 和 OPC 圈 / 其他工具的差异

| 维度 | opcgate.com | OPC 圈 / 论坛类 | Excel / PDF 汇总贴 |
|---|---|---|---|
| 数据形态 | 结构化字段（金额、截止、行业、身份） | 攻略帖 / 群聊 | 平铺文档 |
| 匹配方式 | 条件组合 → 自动排序 | 人工爬楼 / 问群主 | Ctrl+F |
| 官方链接 | 每条政策带 gov.cn 原文 + 主管部门 | 少数 | 零散 |
| 政策变动 | changelog + RSS 可追溯 | 不留痕 | 不留痕 |
| 倒计时 / 日历 | 结构化 schedule 字段自动计算 | 口头提醒 | 无 |
| 城市覆盖 | 38 城，每城都有独立深页 | 大城市为主 | 1–2 个城市 |

## 项目结构（公开部分）

```
├── index.html                     # 首页：智能匹配 + 浏览 + AI 顾问
├── guangzhou.html / chengdu.html  # 广州、成都、苏州专版
├── suzhou.html                    #
├── compare.html                   # 城市对比工具
├── dashboard.html                 # 数据看板
├── city.html                      # 城市总览壳页
├── tax.html / tax-cases.html      # 税务指南与案例
├── changelog.html / rss.xml       # 维护日志 + RSS 订阅
├── assets/js/schedule.js          # 申报窗口计算（deadline/window/recurring）
├── data/
│   ├── policies.json              # 结构化政策数据库（106 条）
│   ├── cities.json                # 城市索引
│   ├── communities.json           # OPC 社区 / 孵化器
│   └── schema.json                # 数据格式定义
├── seo/
│   ├── cities/                    # 38 个城市 SEO 深页
│   ├── guangzhou-vs-shenzhen-vs-suzhou.html 等对比深页
│   └── index.html                 # 热门对比入口
├── cities/                        # 各城市人工核验原文（markdown）
└── sitemap.xml / robots.txt       # 搜索引擎入口
```

## 数据规范

每条政策都是一条 JSON，包含：

- **基础信息**：城市、区、发文机关、status（active / draft / expired）
- **补贴项** `benefits[]`：拆到具体项目（一次性 / 年度 / 免租 / 补贴比例）和金额上限
- **申请要求** `requirements`：注册地、身份、学历、行业、其他
- **申报窗口** `application.schedule`：deadline / window / recurring / rolling 四种类型，前端可直接计算倒计时
- **官方链接** `links.official + links.department + links.news`：优先用 gov.cn，多源互证
- **社区** `communities[]`：关联的产业园 / 孵化器 / 智算中心
- **标签** `tags[]`：AI / 算力 / 制造 / 跨境等，辅助匹配
- **最近核验** `updated_at + verified`：让读者知道是哪天的数据

完整 schema 见 [data/schema.json](data/schema.json)。

## 运营节奏

- **核验频率**：高频城市每两周、全量每季度
- **新增渠道**：政府门户 RSS / 媒体推送 / 社群同步
- **数据透明**：所有变更进 [changelog](https://opcgate.com/changelog)，对外可订阅 [RSS](https://opcgate.com/rss.xml)
- **纠错入口**：每条政策卡片底下都有"发现问题"按钮直接打开 GitHub Issue 模板

## 适合谁

- 准备把 OPC 落到哪座城市的 **独立开发者 / AI 创业者**
- 在对比城市补贴做决策的 **中小企业 / 咨询顾问**
- 写"创业选址"内容需要结构化数据的 **自媒体作者**
- 想收录 OPC 政策到自己知识库的 **孵化器 / 园区 / 服务商**

## 团队

| 角色 | 人 | 方向 |
|---|---|---|
| 产品 + 开发 | **siuser 小伟** | AI 语音机器人方案商 / 独立开发者 |
| 税务顾问 | **张永航** | 盈丰税务规划 / OPC 财税合规 |

## 合作与咨询

- 对政策数据有意见 / 补充 → 直接提 [Issue](https://github.com/siuserxiaowei/opc-policy/issues)
- 孵化器 / 服务商合作 → 站内联系按钮
- AI 语音机器人 / OPC 落地咨询 → 微信 `siuserxiaowei`（备注 OPC）

## License

MIT. 数据引用请保留 `opcgate.com` 来源标注。
