#!/usr/bin/env python3
"""
按城市从 policies.json / communities.json 生成静态 SEO 深页。

输出：
  - seo/cities/index.html
  - seo/cities/<城市>.html

说明：
  - 已有专版城市（广州/成都/苏州）保留现有页面，不重复生成城市深页，避免重复内容。
  - 其他城市统一生成静态页，便于 sitemap、内链和搜索引擎收录。
"""
from __future__ import annotations

import html
import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import quote


REPO = Path(__file__).resolve().parent.parent
POLICIES_SRC = REPO / "data" / "policies.json"
CITIES_SRC = REPO / "data" / "cities.json"
COMMUNITIES_SRC = REPO / "data" / "communities.json"
SEO_DIR = REPO / "seo"
OUT_DIR = SEO_DIR / "cities"

SITE = "https://opcgate.com"
SPECIAL_PAGES = {
    "广州": "guangzhou.html",
    "成都": "chengdu.html",
    "苏州": "suzhou.html",
}
FRIEND_LINKS = [
    ("小报童导航", "https://www.xiaobot.net.cn", "收录优质小报童专栏，助你快速找到所需专栏内容。"),
    ("VibeCoding导航", "https://vibcoding.cn", "VibeCoding（氛围编程）资源导航站，收录 VibeCoding 相关资源工具。"),
    ("省省家会员卡券", "https://buy.lkami.cn", "收录全网优惠会员卡券，折扣低价，每日更新。"),
    ("搜软正版软件", "https://www.soruan.cn", "收录正版软件优惠渠道。"),
    ("VPS导航", "https://www.vpswa.com", "收集国内外最新最全的 VPS、云服务器、网络工具网址导航。"),
    ("搜副业", "https://www.sofuye.com", "副业项目资源搜索引擎，永久免费。"),
    ("AI导航", "https://www.ainav.link", "收录国内外数百个 AI 工具。"),
    ("Claw龙虾导航", "https://www.clawnav.cn", "OpenClaw 人工智能生态平台，提供排行榜、教程和技能插件内容。"),
    ("CPS导航", "https://www.cpsnav.com", "收录全网支持 CPS 分销返佣资源平台。"),
    ("魔武网络科技工作室", "http://www.shenzhendeyang.com", "魔武网络科技工作室。"),
]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text())


def normalize_community_name(name: str) -> str:
    return re.sub(r"[·•・\s()（）\[\]【】,.，。:：;；/\\\-_'\"`]+", "", str(name or "").strip().lower())


def parse_date(date_str: str) -> str:
    text = str(date_str or "").strip()
    return text[:10] if re.match(r"\d{4}-\d{2}-\d{2}", text[:10]) else ""


def format_amount(value: int) -> str:
    if not value:
        return "未明确"
    if value >= 100000000:
        return f"{value / 100000000:.1f} 亿元"
    if value >= 10000:
        return f"{round(value / 10000)} 万元"
    return f"{value} 元"


def page_url(rel_path: str) -> str:
    if not rel_path:
        return SITE
    return f"{SITE}/{quote(rel_path, safe='/')}"


def page_href(city_name: str) -> str:
    special = SPECIAL_PAGES.get(city_name)
    if special:
        return f"../../{special}"
    return f"./{quote(city_name)}.html"


def city_index_href(city_name: str) -> str:
    special = SPECIAL_PAGES.get(city_name)
    if special:
        return f"../../{special}"
    return f"./{quote(city_name)}.html"


def build_related_compare_pages(city_name: str) -> list[dict]:
    related = []
    for path in sorted(SEO_DIR.glob("*.html")):
        if path.name == "index.html":
            continue
        text = path.read_text()
        if city_name not in text:
            continue
        match = re.search(r"<title>(.*?)</title>", text, re.S | re.I)
        title = re.sub(r"\s+", " ", match.group(1)).strip() if match else path.stem
        related.append({"href": f"../{path.name}", "title": title})
    return related[:6]


def tag_list_html(items: list[str], cls: str) -> str:
    if not items:
        return '<span class="empty-inline">暂无</span>'
    return "".join(f'<span class="tag {cls}">{html.escape(item)}</span>' for item in items)


def render_friend_links() -> str:
    items = []
    for name, url, desc in FRIEND_LINKS:
        items.append(
            f'<a class="friend-link" href="{url}" target="_blank" rel="noopener" title="{desc}">'
            f'{html.escape(name)}</a>'
        )
    return (
        '<div class="friend-links"><div class="friend-title">友情链接</div>'
        f'<div class="friend-grid">{"".join(items)}</div></div>'
    )


def aggregate_city_pages() -> tuple[list[dict], list[dict]]:
    policies = load_json(POLICIES_SRC).get("policies", [])
    city_meta = {c["name"]: c for c in load_json(CITIES_SRC).get("cities", [])}
    standalone_communities = load_json(COMMUNITIES_SRC).get("communities", [])

    city_names = sorted({p.get("city") for p in policies if p.get("city")})
    generated_pages = []
    city_cards = []

    for city_name in city_names:
        city_policies = [p for p in policies if p.get("city") == city_name]
        if not city_policies:
            continue

        city_info = city_meta.get(city_name, {})
        community_map = {}

        def merge_community(raw: dict, policy: dict | None = None) -> None:
            name = str(raw.get("name") or "").strip()
            key = normalize_community_name(name)
            if not key:
                return
            existing = community_map.setdefault(
                key,
                {
                    "name": name,
                    "district": raw.get("district") or (policy or {}).get("district") or "",
                    "address": raw.get("address") or "",
                    "operator": raw.get("operator") or "",
                    "track": raw.get("track") or "",
                    "features": [],
                    "policy_names": [],
                    "website": raw.get("website") or raw.get("url") or "",
                    "source": raw.get("source") or ((policy or {}).get("links") or {}).get("official") or "",
                },
            )
            if len(name) > len(existing["name"]):
                existing["name"] = name
            if not existing["district"]:
                existing["district"] = raw.get("district") or (policy or {}).get("district") or ""
            if not existing["address"] and raw.get("address"):
                existing["address"] = raw.get("address")
            if not existing["operator"] and raw.get("operator"):
                existing["operator"] = raw.get("operator")
            if not existing["track"] and raw.get("track"):
                existing["track"] = raw.get("track")
            if not existing["website"]:
                existing["website"] = raw.get("website") or raw.get("url") or ""
            if not existing["source"]:
                existing["source"] = raw.get("source") or ((policy or {}).get("links") or {}).get("official") or ""

            features = [f for f in (existing["features"] + list(raw.get("features") or [])) if f]
            existing["features"] = list(dict.fromkeys(features))

            if policy and policy.get("name"):
                existing["policy_names"] = list(dict.fromkeys(existing["policy_names"] + [policy["name"]]))

        for community in standalone_communities:
            if community.get("city") == city_name:
                merge_community(community)

        for policy in city_policies:
            for community in policy.get("communities") or []:
                merge_community(community, policy)

        communities = sorted(
            community_map.values(),
            key=lambda item: ((item.get("district") or "zz"), item.get("name") or ""),
        )

        max_amount = max(
            (
                benefit.get("amount_max") or 0
                for policy in city_policies
                for benefit in (policy.get("benefits") or [])
            ),
            default=0,
        )

        official_count = sum(1 for policy in city_policies if ((policy.get("links") or {}).get("official")))
        verified_count = sum(1 for policy in city_policies if policy.get("verified"))
        benefit_count = sum(len(policy.get("benefits") or []) for policy in city_policies)
        dates = sorted(
            [d for d in (parse_date(policy.get("updated_at")) or parse_date(policy.get("publish_date")) for policy in city_policies) if d],
            reverse=True,
        )
        last_update = dates[0] if dates else datetime.now().strftime("%Y-%m-%d")

        tags = {
            tag
            for policy in city_policies
            for tag in (policy.get("tags") or [])
        }
        benefit_types = {
            benefit.get("type")
            for policy in city_policies
            for benefit in (policy.get("benefits") or [])
            if benefit.get("type")
        }

        suit_for = []
        if any(re.search(r"AI|算力|大模型|模型|语音|智能", tag or "", re.I) for tag in tags):
            suit_for.append("AI / 大模型创业")
        if any(re.search(r"硬件|制造", tag or "", re.I) for tag in tags):
            suit_for.append("智能硬件 / 制造")
        if any(re.search(r"跨境|电商|出海", tag or "", re.I) for tag in tags):
            suit_for.append("跨境 / 电商")
        if any(re.search(r"医药|生物", tag or "", re.I) for tag in tags):
            suit_for.append("生物医药")
        if "rent_free" in benefit_types:
            suit_for.append("想先低成本试错")
        if len(communities) >= 4:
            suit_for.append("想直接找社区 / 孵化器落地")
        if not suit_for:
            suit_for.append("通用型 OPC 创业")

        not_for = []
        if len(city_policies) < 2:
            not_for.append("政策覆盖还比较少")
        if "rent_free" not in benefit_types:
            not_for.append("公开免租 / 工位信息偏少")
        if max_amount and max_amount < 500000:
            not_for.append("大额补贴相对有限")
        if not official_count:
            not_for.append("公开官方入口偏少，需要人工核实")

        flat_benefits = []
        benefit_seen = set()
        for policy in city_policies:
            for benefit in sorted(policy.get("benefits") or [], key=lambda item: item.get("amount_max") or 0, reverse=True):
                key = (benefit.get("item"), benefit.get("amount"), benefit.get("amount_max"))
                if key in benefit_seen:
                    continue
                benefit_seen.add(key)
                flat_benefits.append(
                    {
                        "item": benefit.get("item") or "补贴项目",
                        "amount": benefit.get("amount") or format_amount(benefit.get("amount_max") or 0),
                        "amount_max": benefit.get("amount_max") or 0,
                        "policy": policy.get("name") or "",
                    }
                )
        top_benefits = flat_benefits[:8]

        top_policies = sorted(
            city_policies,
            key=lambda policy: (
                max(((benefit.get("amount_max") or 0) for benefit in (policy.get("benefits") or [])), default=0),
                parse_date(policy.get("updated_at")) or parse_date(policy.get("publish_date")),
                policy.get("verified", False),
            ),
            reverse=True,
        )[:8]

        page = {
            "city": city_name,
            "province": city_policies[0].get("province") or city_info.get("province") or "",
            "highlight": city_info.get("highlight") or "",
            "policy_count": len(city_policies),
            "benefit_count": benefit_count,
            "communities": communities,
            "community_count": len(communities),
            "max_amount": max_amount,
            "official_count": official_count,
            "verified_count": verified_count,
            "last_update": last_update,
            "top_benefits": top_benefits,
            "top_policies": top_policies,
            "suit_for": suit_for[:5],
            "not_for": not_for[:4],
            "related_pages": build_related_compare_pages(city_name),
            "link": city_info.get("link") or "",
        }
        city_cards.append(page)
        if city_name not in SPECIAL_PAGES:
            generated_pages.append(page)

    return city_cards, generated_pages


def render_city_page(page: dict) -> str:
    city = page["city"]
    policy_count = page["policy_count"]
    community_count = page["community_count"]
    max_amount = format_amount(page["max_amount"])
    description = (
        f"{city} OPC（一人公司）政策汇总，覆盖 {policy_count} 条政策、{community_count} 个社区/孵化器，"
        f"最高补贴 {max_amount}，最后更新 {page['last_update']}。每条带官方来源，适合做 {city} 选址决策和社区对比。"
    )
    canonical_path = f"seo/cities/{city}.html"
    canonical_url = page_url(canonical_path)
    json_ld = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"{city} OPC政策汇总与社区对比",
        "description": description,
        "url": canonical_url,
        "dateModified": page["last_update"],
        "isPartOf": {
            "@type": "WebSite",
            "name": "opcgate.com",
            "url": SITE,
        },
        "about": [
            {"@type": "Thing", "name": city},
            {"@type": "Thing", "name": "OPC 政策"},
        ],
    }

    policy_cards = []
    for policy in page["top_policies"]:
        max_policy_amount = max(((benefit.get("amount_max") or 0) for benefit in (policy.get("benefits") or [])), default=0)
        links = policy.get("links") or {}
        official = links.get("official") or ""
        department = links.get("department") or ""
        news_urls = [u for u in (links.get("news") or []) if u]
        application = (policy.get("application") or {}).get("url") or ""
        tags = " · ".join(item for item in [policy.get("district"), policy.get("issuer"), parse_date(policy.get("publish_date")) or parse_date(policy.get("updated_at"))] if item)
        top_items = (policy.get("benefits") or [])[:3]
        benefit_html = "".join(
            f'<li><strong>{html.escape(item.get("item") or "补贴")}</strong>：{html.escape(item.get("amount") or format_amount(item.get("amount_max") or 0))}</li>'
            for item in top_items
        )
        link_chips = []
        if official:
            link_chips.append(f'<a href="{html.escape(official)}" target="_blank" rel="noopener">查看官方原文</a>')
        if department and department != official:
            link_chips.append(f'<a href="{html.escape(department)}" target="_blank" rel="noopener">主管部门</a>')
        for news_url in news_urls[:1]:
            if news_url != official:
                link_chips.append(f'<a href="{html.escape(news_url)}" target="_blank" rel="noopener">新闻来源</a>')
        if not link_chips and application:
            link_chips.append(f'<a href="{html.escape(application)}" target="_blank" rel="noopener">{html.escape((policy.get("application") or {}).get("method") or "申报入口")}</a>')
        if not link_chips:
            link_chips.append('<span class="muted-link">官方链接待补</span>')
        policy_cards.append(
            f"""
        <article class="policy-card">
          <div class="policy-head">
            <h3>{html.escape(policy.get('name') or '政策')}</h3>
            <span class="amount">{html.escape(format_amount(max_policy_amount))}</span>
          </div>
          <p class="policy-meta">{html.escape(tags) if tags else '城市级/区级政策'}</p>
          <p class="policy-summary">{html.escape(policy.get('summary') or '')}</p>
          <ul class="bullet-list">{benefit_html or '<li>补贴信息待补充</li>'}</ul>
          <div class="card-links">
            {''.join(link_chips)}
          </div>
        </article>
        """
        )

    community_cards = []
    for community in page["communities"][:10]:
        detail_bits = [community.get("district"), community.get("address"), community.get("operator")]
        feature_bits = community.get("features") or []
        website = community.get("website") or ""
        source = community.get("source") or ""
        link_html_parts = []
        if website:
            link_html_parts.append(
                f'<a href="{html.escape(website)}" target="_blank" rel="noopener">社区官网</a>'
            )
        if source and source != website:
            link_html_parts.append(
                f'<a href="{html.escape(source)}" target="_blank" rel="noopener">关联政策原文</a>'
            )
        link_html_parts.extend(
            f'<span class="mini-chip">{html.escape(name)}</span>'
            for name in community.get('policy_names', [])[:2]
        )
        if not link_html_parts:
            link_html_parts.append('<span class="mini-chip">关联政策整理中</span>')
        community_cards.append(
            f"""
        <article class="community-card">
          <h3>{html.escape(community.get('name') or 'OPC 社区')}</h3>
          <p class="policy-meta">{html.escape(' · '.join([bit for bit in detail_bits if bit])) or '社区信息持续补充中'}</p>
          <p class="policy-summary">{html.escape('；'.join(feature_bits[:4])) if feature_bits else '暂无更多公开特征，建议点开关联政策核实。'}</p>
          <div class="card-links">
            {''.join(link_html_parts)}
          </div>
        </article>
        """
        )

    related_links = [
        {"href": "../../compare.html?cities=" + quote(city), "label": f"{city} 进入对比工具"},
        {"href": "../../index.html", "label": "重新做匹配"},
        {"href": "../../dashboard.html", "label": "看全国数据看板"},
        {"href": "../../changelog.html", "label": "查看维护日志"},
        {"href": "../../seo/index.html", "label": "查看热门对比页"},
        {"href": "./index.html", "label": "全部城市入口"},
    ]
    for item in page["related_pages"]:
        related_links.append({"href": item["href"], "label": item["title"]})

    links_html = "".join(
        f'<a href="{html.escape(item["href"])}">{html.escape(item["label"])}</a>'
        for item in related_links[:10]
    )

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{city} OPC政策汇总与社区对比 | {policy_count}条政策 {community_count}个社区 | opcgate.com</title>
<meta name="description" content="{html.escape(description)}">
<meta name="keywords" content="{city},OPC,{city} OPC,一人公司,{city} 政策,{city} 社区,{city} 孵化器,城市对比">
<meta property="og:title" content="{city} OPC政策汇总与社区对比 | opcgate.com">
<meta property="og:description" content="{html.escape(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="{canonical_url}">
<link rel="canonical" href="{canonical_url}">
<link rel="alternate" type="application/rss+xml" title="opcgate.com RSS" href="{SITE}/rss.xml">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏙️</text></svg>">
<style>
:root{{--bg:#F7F8FA;--card:#FFFFFF;--surface:#F1F5F9;--border:#E2E8F0;--text:#0F172A;--dim:#64748B;--primary:#2563EB;--primary-hover:#1D4ED8;--success:#15803D;--success-soft:#DCFCE7;--warning:#B45309;--warning-soft:#FEF3C7;--danger:#B91C1C;--danger-soft:#FEE2E2;--info:#0F766E;--info-soft:#CCFBF1}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:var(--bg);color:var(--text);line-height:1.75}}
a{{color:var(--primary);text-decoration:none}}
a:hover{{color:var(--primary-hover)}}
.topnav{{display:flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(255,255,255,.95);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:20;backdrop-filter:blur(12px);overflow-x:auto}}
.topnav .logo{{font-weight:800;font-size:1em;color:var(--primary)}}
.topnav a{{padding:6px 14px;border-radius:6px;font-size:.82em;color:var(--dim);white-space:nowrap;transition:all .2s}}
.topnav a:hover,.topnav a.active{{color:var(--primary);background:rgba(37,99,235,.08)}}
.hero{{padding:52px 20px 30px;background:linear-gradient(135deg,#EFF6FF 0%,#F0FDFA 48%,#F7F8FA 100%)}}
.hero-inner{{max-width:1120px;margin:0 auto}}
.crumbs{{font-size:.82em;color:var(--dim);margin-bottom:14px}}
.crumbs a{{color:var(--dim)}}
.crumbs a:hover{{color:var(--primary)}}
h1{{font-size:2.2em;line-height:1.2;margin-bottom:10px}}
.sub{{max-width:760px;color:var(--dim);font-size:.98em}}
.hero-cta{{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}}
.btn{{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:10px;font-size:.92em;font-weight:700;border:1px solid transparent}}
.btn-primary{{background:var(--primary);color:#fff}}
.btn-primary:hover{{background:var(--primary-hover);color:#fff}}
.btn-secondary{{background:#fff;color:var(--text);border-color:var(--border)}}
.btn-secondary:hover{{background:var(--surface);color:var(--text)}}
.container{{max-width:1120px;margin:0 auto;padding:24px 20px 40px}}
.stats{{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:-12px;margin-bottom:24px}}
.stat{{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px}}
.stat .n{{font-size:1.85em;font-weight:800;line-height:1.1}}
.stat .l{{font-size:.78em;color:var(--dim);margin-top:4px}}
.highlight-box{{background:linear-gradient(135deg,rgba(37,99,235,.06),rgba(15,118,110,.06));border:1px solid rgba(37,99,235,.16);border-radius:14px;padding:20px;margin-bottom:24px}}
.highlight-box h2{{font-size:1.05em;margin-bottom:8px}}
.section{{margin-bottom:26px}}
.section h2{{font-size:1.1em;margin-bottom:12px}}
.two-col{{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}}
.card{{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px}}
.tag-row{{display:flex;gap:8px;flex-wrap:wrap}}
.tag{{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;font-size:.78em;font-weight:600}}
.tag-go{{background:var(--success-soft);color:var(--success)}}
.tag-no{{background:var(--danger-soft);color:var(--danger)}}
.empty-inline{{font-size:.82em;color:var(--dim)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}}
.policy-card,.community-card{{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px}}
.policy-head{{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;margin-bottom:6px}}
.policy-card h3,.community-card h3{{font-size:1em;line-height:1.45}}
.amount{{flex-shrink:0;padding:4px 10px;border-radius:999px;background:rgba(37,99,235,.08);color:var(--primary);font-size:.78em;font-weight:700}}
.policy-meta{{font-size:.78em;color:var(--dim);margin-bottom:8px}}
.policy-summary{{font-size:.86em;color:var(--text);margin-bottom:10px}}
.bullet-list{{padding-left:18px;color:var(--dim);font-size:.84em}}
.bullet-list li + li{{margin-top:4px}}
.card-links{{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}}
.card-links a,.mini-chip,.muted-link{{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;font-size:.76em;border:1px solid var(--border)}}
.card-links a{{background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.16)}}
.mini-chip{{background:var(--surface);color:var(--dim)}}
.muted-link{{color:var(--dim);background:#fff}}
.link-cloud{{display:flex;gap:8px;flex-wrap:wrap}}
.link-cloud a{{display:inline-flex;align-items:center;padding:8px 12px;background:#fff;border:1px solid var(--border);border-radius:999px;font-size:.82em}}
.friend-links{{margin-top:14px;padding-top:14px;border-top:1px solid rgba(148,163,184,.18)}}
.friend-title{{font-size:.75em;color:var(--dim);margin-bottom:10px;text-align:center}}
.friend-grid{{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;max-width:880px;margin:0 auto}}
.friend-link{{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.16);border-radius:999px;color:inherit;font-size:.78em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.friend-link:hover{{border-color:rgba(37,99,235,.28);color:var(--primary)}}
@media(max-width:640px){{.friend-grid{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}
footer{{text-align:center;padding:30px 20px;color:var(--dim);font-size:.78em;border-top:1px solid var(--border)}}
@media(max-width:820px){{h1{{font-size:1.7em}}.two-col{{grid-template-columns:1fr}}}}
</style>
<script type="application/ld+json">{json.dumps(json_ld, ensure_ascii=False)}</script>
</head>
<body>
<nav class="topnav">
  <span class="logo">OPC</span>
  <a href="../../index.html">首页</a>
  <a href="../../compare.html">对比</a>
  <a href="../../dashboard.html">数据看板</a>
  <a href="../../changelog.html">维护日志</a>
  <a href="../index.html">热门对比</a>
</nav>

<div class="hero">
  <div class="hero-inner">
    <div class="crumbs"><a href="../../index.html">首页</a> / <a href="./index.html">城市入口</a> / <span>{city}</span></div>
    <h1>{city} OPC政策汇总与社区对比</h1>
    <p class="sub">{html.escape(page['highlight']) if page['highlight'] else html.escape(description)}</p>
    <div class="hero-cta">
      <a class="btn btn-primary" href="../../compare.html?cities={quote(city)}">带着 {city} 进入对比工具</a>
      <a class="btn btn-secondary" href="../../index.html">重新做匹配</a>
      <a class="btn btn-secondary" href="../index.html">看热门对比页</a>
    </div>
  </div>
</div>

<div class="container">
  <div class="stats">
    <div class="stat"><div class="n" style="color:var(--primary)">{policy_count}</div><div class="l">城市政策数</div></div>
    <div class="stat"><div class="n" style="color:var(--success)">{community_count}</div><div class="l">社区 / 孵化器</div></div>
    <div class="stat"><div class="n" style="color:var(--warning)">{html.escape(max_amount)}</div><div class="l">最高单项支持</div></div>
    <div class="stat"><div class="n" style="color:var(--info)">{page['official_count']}</div><div class="l">带官方入口</div></div>
    <div class="stat"><div class="n" style="color:var(--success)">{page['last_update']}</div><div class="l">最近核验时间</div></div>
  </div>

  <div class="highlight-box">
    <h2>这页适合怎么用</h2>
    <p>先看这座城市适合谁、公开政策力度和社区供给，再跳到对比页把 {city} 和其他候选城市并排看。对创业者，这是选址情报页；对孵化器和服务商，这是竞品观察入口。</p>
  </div>

  <div class="section two-col">
    <div class="card">
      <h2>更适合谁</h2>
      <div class="tag-row">{tag_list_html(page['suit_for'], 'tag-go')}</div>
    </div>
    <div class="card">
      <h2>当前要注意</h2>
      <div class="tag-row">{tag_list_html(page['not_for'], 'tag-no')}</div>
    </div>
  </div>

  <div class="section">
    <h2>重点政策</h2>
    <div class="grid">
      {''.join(policy_cards) or '<div class="card">暂无重点政策卡片</div>'}
    </div>
  </div>

  <div class="section">
    <h2>社区 / 孵化器入口</h2>
    <div class="grid">
      {''.join(community_cards) or '<div class="card">该城市暂未收录明确的社区 / 孵化器公开信息。</div>'}
    </div>
  </div>

  <div class="section">
    <h2>高频支持项</h2>
    <div class="card">
      <div class="link-cloud">
        {''.join(f'<a href="../../compare.html?cities={quote(city)}">{html.escape(item["item"])} · {html.escape(item["amount"])}</a>' for item in page['top_benefits'][:10]) or '<span class="empty-inline">高频支持项整理中</span>'}
      </div>
    </div>
  </div>

  <div class="section">
    <h2>继续看这些页面</h2>
    <div class="card">
      <div class="link-cloud">{links_html}</div>
    </div>
  </div>
</div>

<footer>
  <p>opcgate.com · 每条政策附官方来源 · 拒绝 AI 编造 · 多源交叉核实</p>
  <p style="margin-top:4px"><a href="../../index.html">首页</a> · <a href="../../compare.html">对比工具</a> · <a href="../../rss.xml">RSS 订阅</a></p>
  {render_friend_links()}
</footer>
</body>
</html>
"""


def render_city_index(city_cards: list[dict]) -> str:
    sorted_cards = sorted(city_cards, key=lambda item: (item["policy_count"], item["community_count"], item["max_amount"]), reverse=True)
    items_html = []
    for page in sorted_cards:
        href = city_index_href(page["city"])
        items_html.append(
            f"""
      <a class="city-card" href="{html.escape(href)}">
        <div class="city-head">
          <h2>{html.escape(page['city'])}</h2>
          <span>{page['policy_count']} 条政策</span>
        </div>
        <p>{html.escape(page['highlight']) if page['highlight'] else html.escape(f"{page['city']} OPC 政策与社区入口")}</p>
        <div class="city-meta">
          <span>{page['community_count']} 个社区</span>
          <span>最高 {html.escape(format_amount(page['max_amount']))}</span>
          <span>{page['last_update']}</span>
        </div>
      </a>
      """
        )

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OPC 城市入口大全 | 静态城市深页索引 | opcgate.com</title>
<meta name="description" content="全国 OPC 城市静态 SEO 深页索引。按城市查看政策数量、社区供给、最高补贴和最后核验时间，方便搜索和选址对比。">
<meta property="og:title" content="OPC 城市入口大全 | opcgate.com">
<meta property="og:description" content="全国 OPC 城市静态深页索引，帮你快速进入具体城市页面。">
<meta property="og:type" content="website">
<meta property="og:url" content="{page_url('seo/cities/index.html')}">
<link rel="canonical" href="{page_url('seo/cities/index.html')}">
<style>
:root{{--bg:#F7F8FA;--card:#FFFFFF;--border:#E2E8F0;--text:#0F172A;--dim:#64748B;--primary:#2563EB;--info:#0F766E}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:var(--bg);color:var(--text);line-height:1.7}}
a{{color:var(--primary);text-decoration:none}}
.wrap{{max-width:1120px;margin:0 auto;padding:40px 20px}}
h1{{font-size:2em;margin-bottom:10px}}
.sub{{color:var(--dim);margin-bottom:20px}}
.cta{{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px}}
.cta a{{padding:10px 16px;border:1px solid var(--border);border-radius:10px;background:#fff}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}}
.city-card{{display:block;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;transition:all .2s;color:inherit}}
.city-card:hover{{transform:translateY(-2px);border-color:rgba(37,99,235,.25)}}
.city-head{{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px}}
.city-head h2{{font-size:1.05em}}
.city-head span{{font-size:.78em;color:var(--primary);font-weight:700}}
.city-card p{{font-size:.86em;color:var(--dim);margin-bottom:12px}}
.city-meta{{display:flex;gap:10px;flex-wrap:wrap;font-size:.78em;color:var(--info)}}
.friend-links{{max-width:980px;margin:24px auto 0;padding-top:18px;border-top:1px solid rgba(148,163,184,.18);text-align:center}}
.friend-title{{font-size:.75em;color:var(--dim);margin-bottom:10px}}
.friend-grid{{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;max-width:880px;margin:0 auto}}
.friend-link{{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.16);border-radius:999px;color:inherit;font-size:.78em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
@media(max-width:640px){{.friend-grid{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}
</style>
</head>
<body>
<div class="wrap">
  <h1>OPC 城市入口大全</h1>
  <p class="sub">这是给搜索引擎和用户都能直接进入的城市入口。优先看重点城市或直接进入对比页，不用再先落到通用壳页。</p>
  <div class="cta">
    <a href="../../index.html">返回首页</a>
    <a href="../../compare.html">自定义对比</a>
    <a href="../index.html">热门对比页</a>
    <a href="../../changelog.html">维护日志</a>
  </div>
  <div class="grid">
    {''.join(items_html)}
  </div>
  {render_friend_links()}
</div>
</body>
</html>
"""


def main() -> None:
    city_cards, generated_pages = aggregate_city_pages()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for path in OUT_DIR.glob("*.html"):
        path.unlink()

    for page in generated_pages:
        out_path = OUT_DIR / f"{page['city']}.html"
        out_path.write_text(render_city_page(page))

    (OUT_DIR / "index.html").write_text(render_city_index(city_cards))
    print(f"Generated {len(generated_pages)} city SEO pages in {OUT_DIR}")


if __name__ == "__main__":
    main()
