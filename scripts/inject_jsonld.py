#!/usr/bin/env python3
"""Inject schema.org JSON-LD blocks into city pages and index.html.

Idempotent: replaces content between OPC-JSONLD-START / OPC-JSONLD-END markers.
Run from repo root: python3 scripts/inject_jsonld.py
"""
import json
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "policies.json"
SITE_URL = "https://opcgate.com"

CATEGORY_LABEL = {
    "subsidy": "财政补贴",
    "tax": "税收优惠",
    "space": "空间补贴",
    "talent": "人才政策",
    "computing": "算力券",
    "scenario": "应用场景",
    "competition": "创业大赛",
    "loan": "创业贷款",
    "registration": "注册登记",
    "comprehensive": "综合性政策",
}

LEVEL_LABEL = {
    "national": "国家级",
    "province": "省级",
    "city": "市级",
    "district": "区级",
}

CITY_PAGES = {
    "广州": "guangzhou.html",
    "成都": "chengdu.html",
    "苏州": "suzhou.html",
}

PINYIN_TO_CITY = {
    "guangzhou": "广州", "chengdu": "成都", "shenzhen": "深圳", "hangzhou": "杭州",
    "suzhou": "苏州", "beijing": "北京", "shanghai": "上海", "chongqing": "重庆",
    "wuhan": "武汉", "hefei": "合肥", "nanjing": "南京", "qingdao": "青岛",
    "zhengzhou": "郑州", "tianjin": "天津", "xian": "西安", "fuzhou": "福州",
    "xiamen": "厦门", "ningbo": "宁波", "wenzhou": "温州", "wuxi": "无锡",
    "changzhou": "常州", "nantong": "南通", "yangzhou": "扬州", "xuzhou": "徐州",
    "yancheng": "盐城", "lianyungang": "连云港", "suqian": "宿迁",
    "dongguan": "东莞", "foshan": "佛山", "zhuhai": "珠海", "zhongshan": "中山",
    "huizhou": "惠州", "meizhou": "梅州", "haikou": "海口", "kunming": "昆明",
    "changsha": "长沙", "shijiazhuang": "石家庄", "jinan": "济南",
}

START = "<!-- OPC-JSONLD-START -->"
END = "<!-- OPC-JSONLD-END -->"
BADGE_START = "<!-- OPC-BADGE-START -->"
BADGE_END = "<!-- OPC-BADGE-END -->"


def policy_id(p):
    return f"{SITE_URL}/#policy-{p['id']}"


def best_url(p, fallback):
    links = p.get("links") or {}
    if links.get("official"):
        return links["official"]
    news = links.get("news") or []
    if news:
        return news[0]
    return fallback


def area_served(p):
    parts = [p.get("province"), p.get("city"), p.get("district")]
    name = "".join([x for x in parts if x])
    return {"@type": "AdministrativeArea", "name": name or p.get("city", "")}


def city_page_url(city):
    if city in CITY_PAGES:
        return f"{SITE_URL}/{CITY_PAGES[city]}"
    return f"{SITE_URL}/seo/cities/{quote(city)}.html"


def build_government_service(p, page_url):
    obj = {
        "@type": "GovernmentService",
        "@id": policy_id(p),
        "name": p["name"],
        "description": p.get("summary", ""),
        "serviceType": CATEGORY_LABEL.get(p.get("category", ""), p.get("category", "")),
        "audience": {
            "@type": "BusinessAudience",
            "audienceType": "OPC / 一人公司 / 独立开发者",
        },
        "provider": {
            "@type": "GovernmentOrganization",
            "name": p.get("issuer") or "政府主管部门",
        },
        "areaServed": area_served(p),
        "url": best_url(p, page_url),
        "termsOfService": page_url,
    }
    if p.get("publish_date"):
        obj["datePublished"] = p["publish_date"]
    if p.get("updated_at"):
        obj["dateModified"] = p["updated_at"]
    if p.get("expire_date"):
        obj["validThrough"] = p["expire_date"]
    tags = p.get("tags") or []
    if tags:
        obj["keywords"] = ", ".join(tags)
    return obj


def build_grants(p):
    grants = []
    page_funder = policy_id(p)
    for i, b in enumerate(p.get("benefits") or []):
        amt = b.get("amount_max") or 0
        if not amt or b.get("type") not in ("cash", "voucher", "loan"):
            continue
        g = {
            "@type": "MonetaryGrant",
            "@id": f"{page_funder}-grant-{i}",
            "name": b.get("item") or p["name"],
            "description": b.get("amount") or "",
            "amount": {
                "@type": "MonetaryAmount",
                "currency": "CNY",
                "value": amt,
            },
            "funder": {"@id": page_funder},
            "areaServed": area_served(p),
        }
        grants.append(g)
    return grants


def build_city_graph(city_name, page_url, policies):
    nodes = []
    page = {
        "@type": "CollectionPage",
        "@id": f"{page_url}#page",
        "url": page_url,
        "name": f"{city_name} OPC 政策导航",
        "description": f"{city_name} 一人公司 / 独立开发者可申报的政府补贴、空间补贴、人才与算力支持政策汇总。优先展示官方原文，缺失官链时明示参考来源。",
        "inLanguage": "zh-CN",
        "isPartOf": {"@id": f"{SITE_URL}/#website"},
        "about": {"@id": f"{page_url}#dataset"},
    }
    dataset = {
        "@type": "Dataset",
        "@id": f"{page_url}#dataset",
        "name": f"{city_name} OPC 政策数据集",
        "description": f"{city_name} 区/市/省级 OPC 相关政策的结构化数据，含金额、有效期、发文单位与来源链接。",
        "creator": {"@type": "Organization", "name": "OPC 政策导航"},
        "license": "https://creativecommons.org/licenses/by/4.0/",
        "isAccessibleForFree": True,
        "keywords": ["OPC", "一人公司", "独立开发者", city_name, "政府补贴", "创业政策"],
    }
    services = [build_government_service(p, page_url) for p in policies]
    grants = []
    for p in policies:
        grants.extend(build_grants(p))
    dataset["hasPart"] = [{"@id": s["@id"]} for s in services]
    nodes.extend([page, dataset, *services, *grants])
    return {"@context": "https://schema.org", "@graph": nodes}


def build_index_graph(all_policies):
    site = {
        "@type": "WebSite",
        "@id": f"{SITE_URL}/#website",
        "url": f"{SITE_URL}/",
        "name": "OPC 政策导航",
        "description": "全国 OPC（一人公司 / 独立开发者）城市政策与社区导航。优先官方原文，缺失会明示参考来源。",
        "inLanguage": "zh-CN",
        "publisher": {"@type": "Person", "name": "siuser小伟"},
    }
    dataset = {
        "@type": "Dataset",
        "@id": f"{SITE_URL}/#dataset",
        "name": "全国 OPC 政策数据集",
        "description": f"覆盖 38 城共 {len(all_policies)} 条 OPC 相关政策的结构化数据，含金额、申报口径、官方原文或参考来源链接。",
        "creator": {"@type": "Organization", "name": "OPC 政策导航"},
        "license": "https://creativecommons.org/licenses/by/4.0/",
        "isAccessibleForFree": True,
        "keywords": ["OPC", "一人公司", "独立开发者", "政府补贴", "创业政策", "全国政策导航"],
        "distribution": [
            {
                "@type": "DataDownload",
                "encodingFormat": "application/json",
                "contentUrl": f"{SITE_URL}/data/policies.json",
            }
        ],
    }
    cities_with_pages = {
        "广州": "/guangzhou.html",
        "成都": "/chengdu.html",
        "苏州": "/suzhou.html",
    }
    seen = []
    items = []
    for c in cities_with_pages:
        items.append(
            {
                "@type": "ListItem",
                "position": len(items) + 1,
                "url": SITE_URL + cities_with_pages[c],
                "name": f"{c} OPC 政策",
            }
        )
        seen.append(c)
    rest = sorted({p.get("city") for p in all_policies if p.get("city") and p.get("city") not in seen})
    for c in rest:
        items.append(
            {
                "@type": "ListItem",
                "position": len(items) + 1,
                "url": city_page_url(c),
                "name": f"{c} OPC 政策",
            }
        )
    itemlist = {
        "@type": "ItemList",
        "@id": f"{SITE_URL}/#cities",
        "name": "全国 OPC 城市政策列表",
        "numberOfItems": len(items),
        "itemListElement": items,
    }
    return {"@context": "https://schema.org", "@graph": [site, dataset, itemlist]}


def build_compare_graph(page_url, page_name, page_desc, cities, all_policies):
    """Build a graph for a multi-city comparison/collection page."""
    page = {
        "@type": "CollectionPage",
        "@id": f"{page_url}#page",
        "url": page_url,
        "name": page_name,
        "description": page_desc,
        "inLanguage": "zh-CN",
        "isPartOf": {"@id": f"{SITE_URL}/#website"},
    }
    items = []
    for i, c in enumerate(cities):
        items.append({
            "@type": "ListItem",
            "position": i + 1,
            "url": city_page_url(c),
            "name": f"{c} OPC 政策",
        })
    itemlist = {
        "@type": "ItemList",
        "@id": f"{page_url}#cities",
        "name": page_name,
        "numberOfItems": len(items),
        "itemListElement": items,
    }
    services = []
    grants = []
    cps = [p for p in all_policies if p.get("city") in set(cities)]
    for p in cps:
        services.append(build_government_service(p, page_url))
        grants.extend(build_grants(p))
    dataset = {
        "@type": "Dataset",
        "@id": f"{page_url}#dataset",
        "name": page_name + "（结构化数据）",
        "description": f"覆盖 {len(cities)} 城共 {len(cps)} 条 OPC 相关政策的结构化数据，含金额、发文单位、有效期与官方原文或参考来源链接。",
        "creator": {"@type": "Organization", "name": "OPC 政策导航"},
        "license": "https://creativecommons.org/licenses/by/4.0/",
        "isAccessibleForFree": True,
        "keywords": ["OPC", "一人公司", "独立开发者", "政府补贴", *cities],
        "hasPart": [{"@id": s["@id"]} for s in services],
    }
    page["about"] = {"@id": dataset["@id"]}
    return {"@context": "https://schema.org", "@graph": [page, dataset, itemlist, *services, *grants]}, len(cps), len(grants)


def parse_cities_from_filename(name):
    stem = name.replace(".html", "").lower()
    found = []
    for token in re.split(r"[-_]", stem):
        c = PINYIN_TO_CITY.get(token)
        if c and c not in found:
            found.append(c)
    return found


def render_block(graph):
    body = json.dumps(graph, ensure_ascii=False, separators=(",", ":"))
    return f'{START}\n<script type="application/ld+json">\n{body}\n</script>\n{END}'


def upsert(html: str, block: str) -> str:
    pattern = re.compile(re.escape(START) + ".*?" + re.escape(END), re.DOTALL)
    if pattern.search(html):
        return pattern.sub(block, html, count=1)
    # insert before </head>
    if "</head>" in html:
        return html.replace("</head>", block + "\n</head>", 1)
    return block + "\n" + html


def update_badge(html: str, text: str) -> str:
    pattern = re.compile(re.escape(BADGE_START) + ".*?" + re.escape(BADGE_END), re.DOTALL)
    if pattern.search(html):
        return pattern.sub(BADGE_START + text + BADGE_END, html, count=1)
    return html


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    policies = data["policies"]

    cities_count = len({p.get("city") for p in policies if p.get("city")})
    policy_count = len(policies)
    grant_count = sum(1 for p in policies for b in p.get("benefits", [])
                      if b.get("amount_max", 0) > 0 and b.get("type") in ("cash", "voucher", "loan"))
    badge_text = f"已结构化 {cities_count} 城 · {policy_count} 条政策 · {grant_count} 项金额，优先官方原文，缺失明示参考来源"

    summary = []

    # City pages
    for city, fname in CITY_PAGES.items():
        path = ROOT / fname
        if not path.exists():
            continue
        page_url = f"{SITE_URL}/{fname}"
        city_policies = [p for p in policies if p.get("city") == city]
        graph = build_city_graph(city, page_url, city_policies)
        block = render_block(graph)
        html = path.read_text(encoding="utf-8")
        new_html = upsert(html, block)
        path.write_text(new_html, encoding="utf-8")
        summary.append((fname, len(city_policies), sum(1 for p in city_policies for b in p.get("benefits", []) if b.get("amount_max", 0) > 0 and b.get("type") in ("cash", "voucher", "loan"))))

    # index.html
    idx = ROOT / "index.html"
    if idx.exists():
        graph = build_index_graph(policies)
        block = render_block(graph)
        html = idx.read_text(encoding="utf-8")
        new_html = upsert(html, block)
        idx.write_text(new_html, encoding="utf-8")
        summary.append(("index.html", len(policies), 0))

    # compare.html — overview of all cities
    cmp_path = ROOT / "compare.html"
    if cmp_path.exists():
        all_cities = sorted({p.get("city") for p in policies if p.get("city")})
        graph, n_p, n_g = build_compare_graph(
            f"{SITE_URL}/compare.html",
            "OPC 城市/社区对比",
            "并排对比全国 OPC 城市与社区：补贴力度、免租期限、算力配额、适配人群。",
            all_cities,
            policies,
        )
        block = render_block(graph)
        html = cmp_path.read_text(encoding="utf-8")
        new_html = upsert(html, block)
        new_html = update_badge(new_html, badge_text)
        cmp_path.write_text(new_html, encoding="utf-8")
        summary.append(("compare.html", n_p, n_g))

    # seo/*.html — vs comparison pages
    seo_dir = ROOT / "seo"
    if seo_dir.exists():
        all_cities = sorted({p.get("city") for p in policies if p.get("city")})
        for f in sorted(seo_dir.glob("*.html")):
            page_url = f"{SITE_URL}/seo/{f.name}"
            cities = parse_cities_from_filename(f.name)
            if not cities:
                # overview pages (best-opc-city-2026.html, index.html)
                cities = all_cities
                page_name = "OPC 城市政策综合对比"
                page_desc = f"全国 {len(cities)} 城 OPC 政策综合对比，统一字段：补贴金额、有效期、申报口径、来源链接。"
            else:
                page_name = " vs ".join(cities) + " OPC 政策对比"
                page_desc = f"{page_name}：每条政策含金额、发文单位、有效期与来源链接，优先官方原文，缺失明示参考来源。"
            graph, n_p, n_g = build_compare_graph(page_url, page_name, page_desc, cities, policies)
            block = render_block(graph)
            html = f.read_text(encoding="utf-8")
            new_html = upsert(html, block)
            f.write_text(new_html, encoding="utf-8")
            summary.append((f"seo/{f.name}", n_p, n_g))

    print("Injected JSON-LD blocks:")
    for fname, n_policies, n_grants in summary:
        if fname == "index.html":
            print(f"  {fname:18s}  WebSite + Dataset + ItemList ({n_policies} policies indexed)")
        else:
            print(f"  {fname:18s}  CollectionPage + Dataset + {n_policies} GovernmentService + {n_grants} MonetaryGrant")


if __name__ == "__main__":
    main()
