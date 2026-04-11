# OPC 政策自动爬虫 — 技术文档

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                  Cloudflare Worker (免费)                 │
│                                                         │
│   ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│   │ 定时触发  │───→│ 爬取链接  │───→│ Gemini AI 提取   │  │
│   │ 每12小时  │    │ 44个政府  │    │ 结构化政策数据   │  │
│   └──────────┘    │ 网站源    │    └────────┬─────────┘  │
│                   └──────────┘             │            │
│                                    ┌───────▼─────────┐  │
│                                    │ 政策变动检测     │  │
│                                    │ 新增/修改/过期   │  │
│                                    └───────┬─────────┘  │
│                                            │            │
│                                    ┌───────▼─────────┐  │
│                                    │ Cloudflare KV   │  │
│                                    │ 持久化存储      │  │
│                                    └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 工作流程

### Phase 1: 链接发现

1. 按批次（每批4个）并发请求各政府网站
2. 用正则匹配页面中包含关键词的 `<a>` 标签
3. 提取标题和完整URL
4. 与已知URL去重，保留新发现的链接
5. 每批次间隔 **2秒**，避免给服务器造成压力

### Phase 2: AI 政策提取（需配置 Gemini API Key）

1. 对新发现的链接，抓取页面纯文本内容（去除 script/style 标签）
2. 发送给 **Google Gemini 2.0 Flash** API
3. Gemini 按预定义 JSON Schema 提取结构化政策数据
4. 提取字段包括：政策名称、城市、级别、发文单位、补贴明细、申请条件、社区信息等
5. 每次调用间隔 **3秒**，每次运行最多处理 **10条** 新链接
6. 不相关的页面（Gemini返回 `relevant: false`）自动跳过

### Phase 3: 政策变动检测

自动对比新旧政策数据，检测三类变动：
- **新增** (`added`)：新发现的政策
- **状态变更** (`status_changed`)：如从 draft 变为 active
- **过期** (`expired`)：截止日期已过但状态仍为 active

变动日志保留最近 **200条**。

## 爬取源（44个政府网站）

### 广东省（重点监控，15个源）

| 源 | URL | 关键词级别 |
|---|---|---|
| 广州市政府 | gz.gov.cn | 完整（22个关键词） |
| 海珠区政府 | haizhu.gov.cn | 完整 |
| 越秀区政府 | yuexiu.gov.cn | 完整 |
| 黄埔区政府 | hp.gov.cn | 完整 |
| 南沙区政府 | gzns.gov.cn | 完整 |
| 番禺区政府 | panyu.gov.cn | 完整 |
| 天河区政府 | thnet.gov.cn | 完整 |
| 深圳市政府 | sz.gov.cn | 完整 |
| 广东省发改委 | drc.gd.gov.cn | 完整 |
| 东莞市政府 | dg.gov.cn | 标准（11个关键词） |
| 惠州市政府 | huizhou.gov.cn | 标准 |
| 佛山市政府 | foshan.gov.cn | 标准 |
| 珠海市政府 | zhuhai.gov.cn | 标准 |
| 中山市政府 | zs.gov.cn | 标准 |
| 梅州市政府 | meizhou.gov.cn | 标准 |

### 长三角（14个源）

| 源 | URL | 关键词级别 |
|---|---|---|
| 苏州市政府 | suzhou.gov.cn | 完整 |
| 杭州市政府 | hangzhou.gov.cn | 完整 |
| 上海市经信委 | jxj.sh.gov.cn | 完整 |
| 南京市政府 | nanjing.gov.cn | 标准 |
| 无锡市政府 | wuxi.gov.cn | 标准 |
| 常州市政府 | changzhou.gov.cn | 标准 |
| 宁波市政府 | ningbo.gov.cn | 标准 |
| 温州市政府 | wenzhou.gov.cn | 标准 |
| 扬州市政府 | yangzhou.gov.cn | 标准 |
| 南通市政府 | nantong.gov.cn | 标准 |
| 徐州市政府 | xuzhou.gov.cn | 标准 |
| 盐城市政府 | yancheng.gov.cn | 标准 |
| 连云港市政府 | lyg.gov.cn | 标准 |
| 宿迁市政府 | suqian.gov.cn | 标准 |

### 北方（5个源）

| 源 | URL | 关键词级别 |
|---|---|---|
| 北京市经信局 | jxj.beijing.gov.cn | 完整 |
| 青岛市政府 | gxj.qingdao.gov.cn | 标准 |
| 济南市政府 | jinan.gov.cn | 标准 |
| 天津市政府 | tj.gov.cn | 标准 |
| 石家庄市政府 | sjz.gov.cn | 标准 |

### 中西部（7个源）

| 源 | URL | 关键词级别 |
|---|---|---|
| 武汉市政府 | wuhan.gov.cn | 标准 |
| 成都市政府 | chengdu.gov.cn | 标准 |
| 西安市政府 | xa.gov.cn | 标准 |
| 长沙市政府 | changsha.gov.cn | 标准 |
| 重庆市政府 | cq.gov.cn | 标准 |
| 合肥市政府 | hefei.gov.cn | 标准 |
| 昆明市政府 | km.gov.cn | 标准 |

### 东南沿海（3个源）

| 源 | URL | 关键词级别 |
|---|---|---|
| 厦门市政府 | xm.gov.cn | 标准 |
| 福州市政府 | fuzhou.gov.cn | 标准 |
| 海口市政府 | haikou.gov.cn | 标准 |

## 关键词体系（22个）

关键词分为两个级别：

### 完整关键词（22个，用于重点城市）

| 类别 | 关键词 | 说明 |
|------|--------|------|
| **核心** | `OPC` `一人公司` `一人企业` `超级个体` `个人经济体` | OPC直接相关 |
| **政策** | `创业补贴` `创业资助` `算力补贴` `算力券` `免租` `孵化` | 补贴扶持类 |
| **AI** | `人工智能` `AI创业` `AI应用` `智能体` `大模型` `AIGC` | AI技术类 |
| **场景** | `场景应用` `场景征集` `应用示范` `数据券` `流量券` | 应用落地类 |
| **人才** | `人才补贴` `创业带动就业` `创业租金` `创业担保贷款` | 人才就业类 |

### 标准关键词（11个，用于一般城市）

核心（5个）+ 政策（6个），覆盖最常见的OPC政策表述。

## API 端点

部署地址：`https://opc-crawler.siuserxy.workers.dev`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/status` | 爬虫运行状态、历史记录 |
| GET | `/new` | 最新发现的链接 |
| GET | `/extracted` | AI 提取的结构化政策数据 |
| GET | `/changes` | 政策变动日志（新增/修改/过期） |
| POST | `/crawl` | 手动触发一次爬取 |

## 技术栈 & 成本

| 组件 | 服务 | 费用 |
|------|------|------|
| 运行时 | Cloudflare Workers | 免费（每天10万次请求） |
| 存储 | Cloudflare KV | 免费（每天10万次读写） |
| 定时任务 | Cron Triggers | 免费（每12小时执行） |
| AI 提取 | Google Gemini 2.0 Flash | $300 额度（约200万次调用） |

**总成本：$0/月**（在免费额度内）

## 合规说明

1. **数据来源合法**：所有源均为政府官网，属于《政府信息公开条例》规定的主动公开信息
2. **礼貌爬取**：每批次间隔2秒，Gemini调用间隔3秒，设置了合理的 User-Agent
3. **不绕过限制**：只抓取公开页面，不绕过登录、验证码或 robots.txt 限制
4. **标注来源**：所有政策数据均保留原始链接，注明来源

## 部署 & 配置

```bash
# 1. 进入目录
cd crawler-worker

# 2. 设置 Gemini API Key
#    从 https://aistudio.google.com/apikey 获取
wrangler secret put GEMINI_API_KEY

# 3. 部署
wrangler deploy

# 4. 手动触发测试
curl -X POST https://opc-crawler.siuserxy.workers.dev/crawl

# 5. 查看状态
curl https://opc-crawler.siuserxy.workers.dev/status
```

## 数据流转

```
政府网站 ──爬取──→ 新链接（KV: crawl_results）
    │
    └─ 新链接 ──Gemini──→ 结构化政策（KV: extracted_latest）
                              │
                              ├──→ 与旧数据对比 ──→ 变动日志（KV: change_log）
                              │
                              └──→ 快照更新（KV: policies_snapshot）
```

## 后续扩展

- 变动通知推送（微信服务号/邮件）
- 自动 PR 更新 policies.json
- 更多源：省级发改委、工信厅、科技厅
- 新闻媒体源：21经济网、南方财经等
