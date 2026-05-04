#!/usr/bin/env python3
"""
opcgate.com IndexNow 推送脚本

用法:
  python3 scripts/push_indexnow.py              # 从 sitemap.xml 读取全部 URL 推送
  python3 scripts/push_indexnow.py url1 url2    # 只推送指定 URL

Bing/Yandex/Seznam 等基于 IndexNow 协议的搜索引擎会在分钟级内抓取新页面。
官方入口: https://www.bing.com/indexnow

每次部署后自动在 deploy.sh 末尾调用，推送当次 build 的 sitemap 全量。
单次请求上限 10000 URL，我们远远不到。
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

HOST = "opcgate.com"
KEY = "68e9073b030f4852a274c50c19ae6cc65694c0f4137946a0"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
# IndexNow 是联邦协议: 任何一家节点收下后会把 URL 广播给所有参与方 (Bing/Yandex/Seznam/Naver等)
# 新域名首次提交给 Bing (api.indexnow.org) 可能返回 403, 改走 Yandex 直接节点, 同效果
ENDPOINTS = [
    "https://yandex.com/indexnow",
    "https://api.indexnow.org/indexnow",
]

REPO = Path(__file__).resolve().parent.parent
SITEMAP = REPO / "sitemap.xml"


def load_urls_from_sitemap() -> list[str]:
    if not SITEMAP.exists():
        print(f"!! sitemap 不存在: {SITEMAP}", file=sys.stderr)
        return []
    text = SITEMAP.read_text(encoding="utf-8")
    return re.findall(r"<loc>(https?://[^<]+)</loc>", text)


def push(urls: list[str]) -> None:
    urls = [u.strip() for u in urls if u.strip().startswith("http")]
    if not urls:
        print("没有可推送的 URL")
        return
    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls,
    }
    data = json.dumps(payload).encode("utf-8")

    last_err = None
    for endpoint in ENDPOINTS:
        req = urllib.request.Request(
            endpoint,
            data=data,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                code = resp.status
                body = resp.read().decode("utf-8", errors="ignore")
        except urllib.error.HTTPError as e:
            code = e.code
            body = e.read().decode("utf-8", errors="ignore")
        except Exception as e:
            print(f"   {endpoint} 网络错误: {e}", file=sys.stderr)
            last_err = str(e)
            continue

        print(f"   {endpoint} -> HTTP {code}")
        if body:
            print(f"     {body[:300]}")
        if code in (200, 202):
            print(f"IndexNow 推送 {len(urls)} 个 URL 成功 ({endpoint})")
            return
        last_err = f"HTTP {code}"

    print(f"!! 所有 IndexNow 节点都失败: {last_err}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if len(sys.argv) > 1:
        urls = sys.argv[1:]
    else:
        urls = load_urls_from_sitemap()
        print(f"从 sitemap.xml 读到 {len(urls)} 个 URL")
    push(urls)


if __name__ == "__main__":
    main()
