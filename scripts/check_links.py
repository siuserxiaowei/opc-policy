#!/usr/bin/env python3
"""
opcgate.com 链接健康度检查
- 扫 data/policies.json 所有政策的核心链接（application.url + links.official）
- 识别 official 字段是否混入非官方域名，并统计缺失官链的政策
- HEAD + GET 双重核验（内容关键词）
- 输出 data/link-health.json（线上可消费）
- 可选参数 --fail-on-dead N：核心死链超过 N 条则 exit(1)（给 deploy.sh 用）
- 可选参数 --fail-on-fake-official N：official 字段里混入非官方域名超过 N 条则 exit(1)

用法：
  python3 scripts/check_links.py             # 全量扫描
  python3 scripts/check_links.py --fail-on-dead 5
  python3 scripts/check_links.py --fail-on-fake-official 0
  python3 scripts/check_links.py --only active   # 只扫 status=active
"""
import json, os, sys, ssl, re, html as _html, urllib.request, gzip, zlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

ROOT = Path(__file__).parent.parent
POLICIES = ROOT / "data" / "policies.json"
OUT = ROOT / "data" / "link-health.json"

TIMEOUT = 15
WORKERS = 8
BINARY_EXTS = ('.pdf', '.doc', '.docx', '.xlsx', '.xls', '.zip')
# 官方域名白名单（其他一律判为新闻/二手来源）
# .gov.cn: 各级政府
# cnbayarea.org.cn: 粤港澳大湾区门户(省政府办)
# ccopyright.com.cn: 中国版权保护中心(国家版权局直属事业单位)
# ccpit.org: 中国贸促会
GOV_DOMAINS = ('.gov.cn', 'cnbayarea.org.cn', 'ccopyright.com.cn', 'ccpit.org')


def is_government_url(url):
    from urllib.parse import urlparse
    host = (urlparse(url).hostname or '').lower()
    return any(host.endswith(d) for d in GOV_DOMAINS)


def strip_html(raw):
    text = raw
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = _html.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def probe(task):
    pid, url, kind, keywords = task
    is_binary = any(url.lower().endswith(ext) for ext in BINARY_EXTS)
    ctx = ssl._create_unverified_context()
    hdrs = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    status, err, content_ok, issue = None, "", True, ""
    try:
        req = urllib.request.Request(url, method="HEAD", headers=hdrs)
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as r:
            status = r.status
    except Exception:
        pass
    if not is_binary:
        last_err = None
        # 单次重试：政府站在并发下偶发 reset / 超时，重试一次显著降低假阳性
        for attempt in (1, 2):
            try:
                req = urllib.request.Request(url, headers=hdrs)
                with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as r:
                    if status is None:
                        status = r.status
                    raw = r.read(80000)
                    encoding = (r.headers.get("Content-Encoding") or "").lower()
                    if encoding in ("gzip", "deflate"):
                        try:
                            obj = zlib.decompressobj(zlib.MAX_WBITS | 32)
                            raw = obj.decompress(raw)
                        except Exception:
                            try: raw = gzip.decompress(raw)
                            except Exception: pass
                    charset = r.headers.get_content_charset() or 'utf-8'
                    try: text = raw.decode(charset, errors='replace')
                    except: text = raw.decode('utf-8', errors='replace')
                    content = strip_html(text)
                    if len(content) < 200:
                        content_ok, issue = False, f"内容过短({len(content)}字)"
                    elif keywords:
                        hit = [k for k in keywords if k in content]
                        if not hit:
                            content_ok, issue = False, f"缺全部关键词{keywords}"
                    last_err = None
                    break
            except Exception as e2:
                last_err = str(e2)[:100]
                if attempt == 1:
                    import time as _t; _t.sleep(0.6)
                    continue
        if last_err is not None:
            err = last_err
            content_ok, issue = False, "GET失败"
            if status is None:
                status = "ERR"
    http_ok = status and str(status).startswith(("2", "3"))
    return {
        "policy_id": pid,
        "url": url,
        "kind": kind,
        "status": status,
        "http_ok": bool(http_ok),
        "content_ok": content_ok if not is_binary else True,
        "is_binary": is_binary,
        "is_government": is_government_url(url),
        "is_official": is_government_url(url),
        "issue": issue,
        "error": err,
        "dead": not http_ok or (not is_binary and not content_ok),
    }


def extract_keywords(policy):
    """只用城市/区县 + 名字的前 4 个中文字，任意命中 1 个即算内容有效。
    tags 不用（tags 是我们内部分类，不是政策原文用词）。"""
    kw = []
    for fld in ("city", "district", "province"):
        v = policy.get(fld) or ""
        if len(v) >= 2:
            kw.append(v.replace("区", "").replace("市", "").replace("省", ""))
    name = policy.get("name", "")
    # 取 name 前面的中文（去掉括号和年份）
    cleaned = re.sub(r'[（(][^)）]*[)）]', '', name)
    cleaned = re.sub(r'\d+', '', cleaned)
    # 取前 6 个中文字做 bigram
    chs = re.findall(r'[\u4e00-\u9fff]+', cleaned)
    if chs:
        head = chs[0][:6]
        if len(head) >= 2:
            kw.append(head)
    return list(dict.fromkeys(kw))[:4]  # 去重保序


def collect_tasks(policies, only_filter=None):
    tasks = []
    for p in policies:
        if only_filter == "active" and p.get("status") != "active":
            continue
        pid = p.get("id")
        keywords = extract_keywords(p)
        app = p.get("application") or {}
        links = p.get("links") or {}
        # 主检：links.official
        if (links.get("official") or "").startswith("http"):
            tasks.append((pid, links["official"], "official", keywords))
        # 次检：application.url
        if (app.get("url") or "").startswith("http") and app.get("url") != links.get("official"):
            tasks.append((pid, app["url"], "application", keywords))
    return tasks


def main():
    args = sys.argv[1:]
    only = None
    fail_threshold = None
    fake_official_threshold = None
    if "--only" in args:
        only = args[args.index("--only") + 1]
    if "--fail-on-dead" in args:
        fail_threshold = int(args[args.index("--fail-on-dead") + 1])
    if "--fail-on-fake-official" in args:
        fake_official_threshold = int(args[args.index("--fail-on-fake-official") + 1])

    with open(POLICIES, encoding="utf-8") as f:
        d = json.load(f)
    policies = d["policies"]
    scoped_policies = [p for p in policies if not (only == "active" and p.get("status") != "active")]

    tasks = collect_tasks(policies, only_filter=only)
    print(f"🔍 开始检测 {len(tasks)} 条链接（来自 {len(scoped_policies)} 条政策）...")

    results = []
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for r in ex.map(probe, tasks):
            results.append(r)

    dead = [r for r in results if r["dead"]]
    non_gov = [r for r in results if not r["is_government"] and not r["dead"]]
    by_policy = {}
    for r in results:
        by_policy.setdefault(r["policy_id"], []).append(r)
    fake_official = [
        p for p in scoped_policies
        if (p.get("links") or {}).get("official") and not is_government_url((p.get("links") or {}).get("official"))
    ]
    missing_official = [
        p for p in scoped_policies
        if not is_government_url((p.get("links") or {}).get("official", ""))
    ]

    print(f"\n=== 健康度 ===")
    print(f"  检测 {len(results)} 条链接")
    print(f"  ✅ 官方域名有效: {sum(1 for r in results if r['is_government'] and not r['dead'])}")
    print(f"  ⚠️  非官方域名有效: {len(non_gov)}")
    print(f"  ❌ 失效: {len(dead)}")
    print(f"  覆盖政策 {len(by_policy)} 条")
    print(f"  ⚠️ official 字段疑似填错: {len(fake_official)}")
    print(f"  ⚠️ 缺失公开官链的政策: {len(missing_official)}")
    if non_gov:
        print(f"\n=== ⚠️ 非官方域名（建议补充官方原文） ===")
        for r in non_gov[:20]:
            from urllib.parse import urlparse
            host = urlparse(r['url']).hostname or '?'
            print(f"  [{host:25s}] {r['policy_id']:30s} ({r['kind']}) {r['url'][:60]}")
    if fake_official:
        print(f"\n=== ❌ official 字段混入非官方域名 ===")
        for p in fake_official[:20]:
            bad = (p.get("links") or {}).get("official") or ""
            print(f"  [{p.get('city','?'):4s}] {p.get('id','?'):30s} {bad[:80]}")
    if missing_official:
        print(f"\n=== ⚠️ 缺失公开官链（样例） ===")
        for p in missing_official[:20]:
            news = ((p.get("links") or {}).get("news") or [])
            fallback = news[0] if news else ""
            tail = f" -> {fallback[:50]}" if fallback else ""
            print(f"  [{p.get('city','?'):4s}] {p.get('id','?'):30s} {p.get('name','')[:36]}{tail}")

    if dead:
        print(f"\n=== ❌ 失效清单 ===")
        for r in dead[:30]:
            print(f"  [{r['status']}] {r['policy_id']:30s} ({r['kind']:11s}) {r['url'][:70]}  → {r['issue'] or r['error']}")
        if len(dead) > 30:
            print(f"  ... (还有 {len(dead) - 30} 条)")

    # 写出 link-health.json
    health = {
        "generated_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "total_links": len(results),
        "dead_count": len(dead),
        "healthy_count": len(results) - len(dead),
        "coverage_policies": len(by_policy),
        "fake_official_count": len(fake_official),
        "missing_official_count": len(missing_official),
        "fake_official_policies": sorted(p.get("id") for p in fake_official),
        "missing_official_policies": sorted(p.get("id") for p in missing_official),
        "dead_policies": sorted(set(r["policy_id"] for r in dead)),
        "results": results,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(health, f, ensure_ascii=False, indent=2)
    print(f"\n✓ 健康度报告: {OUT}")

    if fail_threshold is not None and len(dead) > fail_threshold:
        print(f"\n❌ 死链 {len(dead)} > 阈值 {fail_threshold}，部署终止")
        sys.exit(1)
    if fake_official_threshold is not None and len(fake_official) > fake_official_threshold:
        print(f"\n❌ official 字段混入非官方域名 {len(fake_official)} > 阈值 {fake_official_threshold}，部署终止")
        sys.exit(1)


if __name__ == "__main__":
    main()
