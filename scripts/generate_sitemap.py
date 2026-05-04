#!/usr/bin/env python3
"""
生成 sitemap.xml，覆盖首页、核心工具页、热门对比页和城市静态 SEO 页。
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape


REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "sitemap.xml"
SITE = "https://opcgate.com"


STATIC_PAGES = {
    "": ("daily", "1.0"),
    "compare.html": ("daily", "0.95"),
    "guangzhou.html": ("daily", "0.93"),
    "chengdu.html": ("daily", "0.90"),
    "suzhou.html": ("daily", "0.90"),
    "yuexiu.html": ("daily", "0.84"),
    "dashboard.html": ("weekly", "0.78"),
    "tax.html": ("weekly", "0.74"),
    "tax-cases.html": ("weekly", "0.68"),
    "city.html": ("weekly", "0.42"),
    "changelog.html": ("daily", "0.82"),
    "chengdu-guide.html": ("weekly", "0.72"),
    "seo/index.html": ("weekly", "0.84"),
    "seo/cities/index.html": ("weekly", "0.86"),
}


def page_url(rel_path: str) -> str:
    if not rel_path:
        return SITE + "/"
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
