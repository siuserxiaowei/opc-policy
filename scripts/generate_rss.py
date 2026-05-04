#!/usr/bin/env python3
"""
生成 rss.xml：从 policies.json 按 publish_date 倒序输出所有政策条目。
订阅者用 Feedly/Inoreader 等 RSS 阅读器可以立刻收到新政策。
每次 policies.json 更新后跑一次：
    python3 scripts/generate_rss.py
"""
import json
import html
from pathlib import Path
from datetime import datetime, timezone

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / 'data' / 'policies.json'
OUT = REPO / 'rss.xml'

SITE = 'https://opcgate.com'
TITLE = 'OPC 政策情报站 · opcgate.com'
DESC = '全国 OPC（一人公司）创业政策情报站。每条政策附官方来源链接，拒绝 AI 编造，多源交叉核实。覆盖 36+ 城市 79+ 条政策 130+ OPC 社区。'
LANG = 'zh-CN'


def rfc822(date_str):
    """把 2026-04-15 这样的日期转成 RFC822 格式"""
    if not date_str:
        return datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S +0000')
    try:
        dt = datetime.strptime(date_str[:10], '%Y-%m-%d')
        dt = dt.replace(tzinfo=timezone.utc)
        return dt.strftime('%a, %d %b %Y %H:%M:%S +0000')
    except Exception:
        return datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S +0000')


def level_label(level):
    return {'province': '省级', 'city': '市级', 'district': '区级'}.get(level, '')


def build_description(p):
    """把政策的核心字段拼成 RSS item description"""
    parts = []
    if p.get('summary'):
        parts.append(f'<p><strong>摘要</strong>：{html.escape(p["summary"])}</p>')

    benefits = p.get('benefits', [])
    if benefits:
        rows = ''.join(
            f'<tr><td>{html.escape(b.get("item",""))}</td><td>{html.escape(b.get("amount",""))}</td></tr>'
            for b in benefits
        )
        parts.append(f'<p><strong>主要补贴</strong>：</p><table border="1">{rows}</table>')

    req = p.get('requirements', {})
    req_lines = []
    if req.get('registration_location'):
        req_lines.append(f'注册地：{html.escape(req["registration_location"])}')
    if req.get('industries'):
        req_lines.append(f'行业：{", ".join(html.escape(x) for x in req["industries"])}')
    if req_lines:
        parts.append(f'<p><strong>申请条件</strong>：{" · ".join(req_lines)}</p>')

    # 官方来源
    links = p.get('links', {}) or {}
    src_parts = []
    if links.get('official'):
        src_parts.append(f'<a href="{html.escape(links["official"])}">政策原文</a>')
    for n in links.get('news', []) or []:
        src_parts.append(f'<a href="{html.escape(n)}">新闻报道</a>')
    if src_parts:
        parts.append(f'<p><strong>官方来源</strong>：{" · ".join(src_parts)}</p>')

    # 社区
    communities = p.get('communities', []) or []
    if communities:
        lis = ''.join(
            f'<li><strong>{html.escape(c.get("name",""))}</strong>'
            + (f' · {html.escape(c["address"])}' if c.get('address') else '')
            + (f' · <a href="{html.escape(c["source"])}">来源 ↗</a>' if c.get('source') else '')
            + '</li>'
            for c in communities
        )
        parts.append(f'<p><strong>关联 OPC 社区</strong>：</p><ul>{lis}</ul>')

    verified = '<p><em>✓ 已多源核实</em></p>' if p.get('verified') else ''
    parts.append(verified)

    return ''.join(parts)


def main():
    data = json.loads(SRC.read_text())
    policies = data.get('policies', [])

    # 按 publish_date 倒序，无日期的放后面
    def sort_key(p):
        d = p.get('publish_date') or p.get('updated_at') or '0000-00-00'
        return d
    policies.sort(key=sort_key, reverse=True)

    # 只取最近 50 条（RSS 合理数量）
    policies = policies[:50]

    latest_dt = rfc822(policies[0].get('publish_date') if policies else None)

    items_xml = []
    for p in policies:
        pid = p.get('id', 'unknown')
        name = p.get('name', 'OPC 政策')
        city = p.get('city', '')
        district = p.get('district', '')
        level = level_label(p.get('level', ''))
        publish = p.get('publish_date', '')

        # item title: [城市] 政策名
        loc = f'[{city}{" · "+district if district else ""}] '
        if level:
            loc = f'[{city} {level}] '
        item_title = f'{loc}{name}'

        item_link = f'{SITE}/index.html#{pid}'
        desc_html = build_description(p)
        pub_date = rfc822(publish)

        # categories = tags
        cats = ''.join(
            f'<category>{html.escape(t)}</category>'
            for t in (p.get('tags') or [])
        )

        items_xml.append(f'''
    <item>
      <title>{html.escape(item_title)}</title>
      <link>{item_link}</link>
      <guid isPermaLink="false">opcgate-{pid}</guid>
      <pubDate>{pub_date}</pubDate>
      <description><![CDATA[{desc_html}]]></description>
      {cats}
    </item>''')

    items = ''.join(items_xml)
    now = datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S +0000')

    rss = f'''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{TITLE}</title>
    <link>{SITE}</link>
    <atom:link href="{SITE}/rss.xml" rel="self" type="application/rss+xml"/>
    <description>{DESC}</description>
    <language>{LANG}</language>
    <lastBuildDate>{now}</lastBuildDate>
    <pubDate>{latest_dt}</pubDate>
    <ttl>720</ttl>
    <image>
      <url>{SITE}/assets/avatar.jpg</url>
      <title>{TITLE}</title>
      <link>{SITE}</link>
    </image>
{items}
  </channel>
</rss>
'''
    OUT.write_text(rss)
    print(f'Wrote {OUT} ({len(rss)} bytes, {len(items_xml)} items)')


if __name__ == '__main__':
    main()
