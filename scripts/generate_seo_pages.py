#!/usr/bin/env python3
"""
生成 SEO 对比页矩阵：自动创建高意图长尾关键词页面。
每个页面都是 compare.html 的预填版本（URL 参数自动触发对比）。

用法：
    python3 scripts/generate_seo_pages.py
    生成到 seo/ 目录下，deploy.sh 需要把 seo/ 加入白名单。
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'seo'
OUT.mkdir(exist_ok=True)

FRIEND_LINKS = [
    ('小报童导航', 'https://www.xiaobot.net.cn', '收录优质小报童专栏，助你快速找到所需专栏内容。'),
    ('VibeCoding导航', 'https://vibcoding.cn', 'VibeCoding（氛围编程）资源导航站，收录 VibeCoding 相关资源工具。'),
    ('省省家会员卡券', 'https://buy.lkami.cn', '收录全网优惠会员卡券，折扣低价，每日更新。'),
    ('搜软正版软件', 'https://www.soruan.cn', '收录正版软件优惠渠道。'),
    ('VPS导航', 'https://www.vpswa.com', '收集国内外最新最全的 VPS、云服务器、网络工具网址导航。'),
    ('搜副业', 'https://www.sofuye.com', '副业项目资源搜索引擎，永久免费。'),
    ('AI导航', 'https://www.ainav.link', '收录国内外数百个 AI 工具。'),
    ('Claw龙虾导航', 'https://www.clawnav.cn', 'OpenClaw 人工智能生态平台，提供排行榜、教程和技能插件内容。'),
    ('CPS导航', 'https://www.cpsnav.com', '收录全网支持 CPS 分销返佣资源平台。'),
    ('魔武网络科技工作室', 'http://www.shenzhendeyang.com', '魔武网络科技工作室。'),
]

# 热门对比组合
COMPARISONS = [
    # 一线城市对比
    {'cities': ['广州', '深圳', '苏州'], 'slug': 'guangzhou-vs-shenzhen-vs-suzhou', 'title': '广州 vs 深圳 vs 苏州 OPC 政策对比'},
    {'cities': ['北京', '上海', '深圳'], 'slug': 'beijing-vs-shanghai-vs-shenzhen', 'title': '北京 vs 上海 vs 深圳 OPC 政策对比'},
    {'cities': ['广州', '成都'], 'slug': 'guangzhou-vs-chengdu', 'title': '广州 vs 成都 OPC 创业对比'},
    {'cities': ['苏州', '杭州', '南京'], 'slug': 'suzhou-vs-hangzhou-vs-nanjing', 'title': '苏州 vs 杭州 vs 南京 OPC 政策对比'},
    {'cities': ['广州', '杭州'], 'slug': 'guangzhou-vs-hangzhou', 'title': '广州 vs 杭州 OPC 创业哪个好'},
    {'cities': ['深圳', '苏州'], 'slug': 'shenzhen-vs-suzhou', 'title': '深圳 vs 苏州 OPC 补贴对比'},
    # 区域对比
    {'cities': ['青岛', '郑州', '武汉'], 'slug': 'qingdao-vs-zhengzhou-vs-wuhan', 'title': '青岛 vs 郑州 vs 武汉 OPC 政策对比'},
    {'cities': ['成都', '重庆', '武汉'], 'slug': 'chengdu-vs-chongqing-vs-wuhan', 'title': '成都 vs 重庆 vs 武汉 中西部 OPC 对比'},
    {'cities': ['合肥', '南京', '杭州'], 'slug': 'hefei-vs-nanjing-vs-hangzhou', 'title': '合肥 vs 南京 vs 杭州 长三角 OPC 对比'},
    # 行业导向
    {'cities': ['广州', '深圳'], 'slug': 'ai-voice-guangzhou-vs-shenzhen', 'title': 'AI 语音创业选广州还是深圳'},
    {'cities': ['苏州', '广州', '深圳'], 'slug': 'best-opc-city-2026', 'title': '2026 OPC 创业最佳城市排名'},
]


def render_friend_links():
    links = []
    for name, url, desc in FRIEND_LINKS:
        links.append(
            f'<a class="friend-link" href="{url}" target="_blank" rel="noopener" title="{desc}">{name}</a>'
        )
    return (
        '<div class="friend-links"><div class="friend-title">友情链接</div>'
        f'<div class="friend-grid">{"".join(links)}</div></div>'
    )

TEMPLATE = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} | opcgate.com OPC 选址决策</title>
<meta name="description" content="{description}">
<meta name="keywords" content="{keywords}">
<meta property="og:title" content="{title} | opcgate.com">
<meta property="og:description" content="{description}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://opcgate.com/seo/{slug}.html">
<link rel="canonical" href="https://opcgate.com/seo/{slug}.html">
<link rel="alternate" type="application/rss+xml" title="opcgate.com RSS" href="https://opcgate.com/rss.xml">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<style>
:root{{--bg:#0a0a0f;--card:#12121a;--border:#2a2a3a;--text:#e0e0e8;--dim:#8888a0;--accent:#6c5ce7;--al:#a29bfe;--cyan:#00e5ff;--green:#00e676}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,'PingFang SC',sans-serif;background:var(--bg);color:var(--text);line-height:1.7;text-align:center;padding:60px 20px}}
a{{color:var(--al);text-decoration:none}}a:hover{{color:#fff}}
h1{{font-size:1.8em;font-weight:800;background:linear-gradient(135deg,#fff,var(--cyan),var(--al));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:12px}}
p{{color:var(--dim);font-size:.95em;max-width:600px;margin:0 auto 20px}}
.btn{{display:inline-block;padding:14px 32px;background:var(--accent);border-radius:10px;color:#fff;font-size:1em;font-weight:700;margin:8px;transition:all .2s}}
.btn:hover{{filter:brightness(1.15)}}
.btn-alt{{background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.3);color:var(--cyan)}}
.trust{{font-size:.78em;color:var(--dim);margin-top:30px}}
.cities{{font-size:1.2em;color:var(--cyan);font-weight:700;margin-bottom:16px}}
.friend-links{{max-width:980px;margin:24px auto 0;padding-top:18px;border-top:1px solid rgba(255,255,255,.08)}}
.friend-title{{font-size:.75em;color:var(--dim);margin-bottom:10px;text-align:center}}
.friend-grid{{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;max-width:880px;margin:0 auto}}
.friend-link{{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:999px;color:var(--text);font-size:.8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.friend-link:hover{{border-color:rgba(0,229,255,.3);color:#fff}}
@media(max-width:640px){{.friend-grid{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}
</style>
</head>
<body>
<div class="cities">{cities_display}</div>
<h1>{title}</h1>
<p>{description}</p>
<a class="btn" href="../compare.html#{cities_hash}">⚖️ 查看完整对比表</a>
<a class="btn btn-alt" href="../index.html">🎯 精准匹配我的情况</a>
<p class="trust">opcgate.com · 优先官方原文，缺失明示参考来源 · 拒绝 AI 编造 · <a href="../changelog.html">维护日志</a> · <a href="../rss.xml">RSS 订阅</a></p>
{friend_links_html}

<script>
// 自动跳转到 compare.html 并触发对比
const cities = {cities_json};
if(window.location.hash === '#auto') {{
  window.location.href = '../compare.html#' + cities.map(c=>encodeURIComponent(c)).join(',');
}}
</script>
<script>
(function(){{var bp=document.createElement('script');bp.src='https://zz.bdstatic.com/linksubmit/push.js';document.getElementsByTagName('script')[0].parentNode.insertBefore(bp,document.getElementsByTagName('script')[0])}})();
</script>
</body>
</html>
'''


def main():
    count = 0
    sitemap_entries = []

    for comp in COMPARISONS:
        cities = comp['cities']
        slug = comp['slug']
        title = comp['title']
        cities_display = ' vs '.join(cities)
        description = f'{cities_display} 的 OPC（一人公司）政策、补贴力度、社区数量、算力配额、免租期限全面对比。帮你快速判断哪个城市最适合做 OPC 创业。优先展示政府官网原文，缺失官链时明示参考来源。'
        keywords = ','.join(cities) + ',OPC对比,一人公司,选址,补贴对比,OPC社区,' + ','.join(f'{c}OPC' for c in cities)
        cities_hash = ','.join(cities)
        cities_json = json.dumps(cities, ensure_ascii=False)

        html = TEMPLATE.format(
            title=title,
            description=description,
            keywords=keywords,
            slug=slug,
            cities_display=cities_display,
            cities_hash=cities_hash,
            cities_json=cities_json,
            friend_links_html=render_friend_links(),
        )

        out_file = OUT / f'{slug}.html'
        out_file.write_text(html)
        count += 1
        sitemap_entries.append(f'https://opcgate.com/seo/{slug}.html')

    # 生成 seo/index.html 索引页
    links = ''.join(f'<li><a href="{c["slug"]}.html">{c["title"]}</a></li>\n' for c in COMPARISONS)
    index_html = f'''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>OPC 城市对比页索引 | opcgate.com</title>
<meta name="description" content="全国 OPC 城市政策对比页合集，帮你快速做出 OPC 创业选址决策">
<style>:root{{--bg:#0a0a0f;--text:#e0e0e8;--al:#a29bfe;--dim:#8888a0}}*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:-apple-system,sans-serif;background:var(--bg);color:var(--text);padding:40px 20px;line-height:1.8}}a{{color:var(--al)}}h1{{margin-bottom:20px}}ul{{list-style:none;max-width:600px;margin:0 auto}}li{{padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)}}.friend-links{{max-width:980px;margin:24px auto 0;padding-top:18px;border-top:1px solid rgba(255,255,255,.08);text-align:center}}.friend-title{{font-size:.75em;color:var(--dim);margin-bottom:10px}}.friend-grid{{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;max-width:880px;margin:0 auto}}.friend-link{{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:999px;color:var(--text);font-size:.8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}@media(max-width:640px){{.friend-grid{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}</style>
</head><body>
<h1 style="text-align:center">OPC 城市对比页索引</h1>
<ul>{links}</ul>
<p style="text-align:center;margin-top:30px;color:var(--dim);font-size:.82em"><a href="../index.html">← 返回首页</a> · <a href="../compare.html">自定义对比</a> · <a href="cities/index.html">城市入口</a></p>
{render_friend_links()}
</body></html>'''
    (OUT / 'index.html').write_text(index_html)

    print(f'Generated {count} SEO pages + index in {OUT}/')
    print(f'Sitemap entries:')
    for s in sitemap_entries:
        print(f'  {s}')


if __name__ == '__main__':
    main()
