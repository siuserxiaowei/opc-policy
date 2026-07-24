#!/usr/bin/env python3
"""
生成 sitemap.xml，覆盖首页、核心工具页、热门对比页和城市静态 SEO 页。
"""
from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape


REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "sitemap.xml"
SITE = "https://opcgate.com"


STATIC_PAGES = {
    "": ("daily", "1.0"),
    "learn.html": ("weekly", "0.92"),
    "navigation.html": ("weekly", "0.88"),
    "aliyun-opc.html": ("weekly", "0.88"),
    "miniprogram.html": ("weekly", "0.76"),
    "compare.html": ("daily", "0.95"),
    "guangzhou.html": ("daily", "0.93"),
    "chengdu.html": ("daily", "0.90"),
    "suzhou.html": ("daily", "0.90"),
    "yuexiu.html": ("daily", "0.84"),
    "dashboard.html": ("weekly", "0.78"),
    "vibesocial/index.html": ("weekly", "0.88"),
    "tax.html": ("weekly", "0.74"),
    "tax-cases.html": ("weekly", "0.68"),
    "city.html": ("weekly", "0.42"),
    "changelog.html": ("daily", "0.82"),
    "now-open.html": ("daily", "0.90"),
    "chengdu-guide.html": ("weekly", "0.72"),
    "seo/index.html": ("weekly", "0.84"),
    "seo/cities/index.html": ("weekly", "0.86"),
}

VIRTUAL_PAGES = {
    "now-open.xml": ("daily", "0.50"),
    "api/index.html": ("weekly", "0.50"),
}

CLEAN_URLS = {
    "learn.html": "learn",
    "navigation.html": "navigation",
    "aliyun-opc.html": "aliyun-opc",
    "miniprogram.html": "miniprogram",
    "vibesocial/index.html": "vibesocial",
}


def page_url(rel_path: str) -> str:
    if not rel_path:
        return SITE + "/"
    if rel_path in CLEAN_URLS:
        return f"{SITE}/{CLEAN_URLS[rel_path]}"
    return f"{SITE}/{quote(rel_path, safe='/')}"


def lastmod_for(path: Path) -> str:
    dt = datetime.fromtimestamp(path.stat().st_mtime)
    return dt.strftime("%Y-%m-%d")


def build_entry(rel_path: str, changefreq: str, priority: str) -> str:
    file_path = REPO / rel_path if rel_path else REPO / "index.html"
    if not file_path.exists():
        return ""
    return (
        "  <url>"
        f"<loc>{escape(page_url(rel_path))}</loc>"
        f"<lastmod>{lastmod_for(file_path)}</lastmod>"
        f"<changefreq>{changefreq}</changefreq>"
        f"<priority>{priority}</priority>"
        "</url>"
    )


def build_virtual_entry(rel_path: str, lastmod: str, changefreq: str, priority: str) -> str:
    return (
        "  <url>"
        f"<loc>{escape(page_url(rel_path))}</loc>"
        f"<lastmod>{escape(lastmod)}</lastmod>"
        f"<changefreq>{changefreq}</changefreq>"
        f"<priority>{priority}</priority>"
        "</url>"
    )


def iter_generated_pages() -> list[tuple[str, str, str]]:
    pages = []
    for path in sorted((REPO / "seo").glob("*.html")):
        rel = path.relative_to(REPO).as_posix()
        if rel == "seo/index.html":
            continue
        pages.append((rel, "weekly", "0.80"))

    for path in sorted((REPO / "seo" / "cities").glob("*.html")):
        rel = path.relative_to(REPO).as_posix()
        if rel == "seo/cities/index.html":
            continue
        pages.append((rel, "weekly", "0.82"))
    return pages


def iter_policy_pages() -> list[tuple[str, str]]:
    payload = json.loads((REPO / "data" / "policies.json").read_text())
    pages = []
    for policy in payload.get("policies", []):
        if policy.get("status") == "draft" or not policy.get("id"):
            continue
        lastmod = policy.get("updated_at") or payload.get("updated_at") or datetime.now().strftime("%Y-%m-%d")
        pages.append((f"p/{policy['id']}.html", lastmod))
    return sorted(pages)


def main() -> None:
    entries = []
    for rel_path, (changefreq, priority) in STATIC_PAGES.items():
        entry = build_entry(rel_path, changefreq, priority)
        if entry:
            entries.append(entry)

    for rel_path, changefreq, priority in iter_generated_pages():
        entry = build_entry(rel_path, changefreq, priority)
        if entry:
            entries.append(entry)

    virtual_lastmod = lastmod_for(REPO / "data" / "policies.json")
    for rel_path, (changefreq, priority) in VIRTUAL_PAGES.items():
        entries.append(build_virtual_entry(rel_path, virtual_lastmod, changefreq, priority))

    for rel_path, lastmod in iter_policy_pages():
        entries.append(build_virtual_entry(rel_path, lastmod, "weekly", "0.70"))

    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    OUT.write_text(sitemap)
    print(f"Wrote {OUT} with {len(entries)} URLs")


if __name__ == "__main__":
    main()
