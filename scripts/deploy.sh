#!/usr/bin/env bash
#
# opcgate.com 一键部署脚本
#
# 白名单模式：只把明确列出的文件 / 目录复制进 dist/ 后上传 Cloudflare Pages。
# backend/ crawler-worker/ private/ 申报表 zip 规划文档等永远不会被部署。
#
# 使用：
#   ./scripts/deploy.sh              # 全量部署
#   ./scripts/deploy.sh --dry-run    # 只构建 dist/ 不上传，用于检查
#
set -euo pipefail

# ── 路径 ─────────────────────────────────────────────────────────────
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$REPO/dist"
PROJECT_NAME="opc-policy"

cd "$REPO"

# ── 可选：链接健康度检查（--skip-check 可跳过）─────────────────────
SKIP_CHECK=0
for arg in "$@"; do
  [[ "$arg" == "--skip-check" ]] && SKIP_CHECK=1
done
if [[ "$SKIP_CHECK" -eq 0 ]] && command -v python3 >/dev/null 2>&1; then
  echo "→ 链接健康度检查 (scripts/check_links.py --only active)"
  # 死链超过 10 条则中止部署（保护公开数据质量）
  python3 scripts/check_links.py --only active --fail-on-dead 10 --fail-on-fake-official 0 2>&1 | tail -20 || {
    echo "❌ 链接检查失败，部署终止。如确认要强制部署，加 --skip-check" >&2
    exit 1
  }
fi

# ── 可选：重新生成 changelog + rss ──────────────────────────────────
if command -v python3 >/dev/null 2>&1; then
  echo "→ 重新生成 changelog.html"
  python3 scripts/generate_changelog.py >/dev/null
  echo "→ 重新生成 rss.xml"
  python3 scripts/generate_rss.py >/dev/null
  echo "→ 重新生成 SEO 对比页"
  python3 scripts/generate_seo_pages.py >/dev/null
  echo "→ 重新生成城市 SEO 深页"
  python3 scripts/generate_city_seo.py >/dev/null
  echo "→ 注入 schema.org JSON-LD（GovernmentService / MonetaryGrant / Dataset）"
  python3 scripts/inject_jsonld.py
  echo "→ 重新生成 sitemap.xml"
  python3 scripts/generate_sitemap.py >/dev/null
fi

# ── 清空 dist ───────────────────────────────────────────────────────
echo "→ 清空 dist/"
rm -rf "$DIST"
mkdir -p "$DIST"

# ── 白名单：复制公开内容到 dist/ ────────────────────────────────────
echo "→ 复制白名单内容"

# HTML 页面
for f in index.html guangzhou.html chengdu.html suzhou.html yuexiu.html \
         tax.html tax-cases.html dashboard.html city.html \
         changelog.html chengdu-guide.html private.html admin.html compare.html; do
  if [[ -f "$f" ]]; then
    cp "$f" "$DIST/"
  fi
done

# XML / txt
for f in rss.xml sitemap.xml robots.txt; do
  if [[ -f "$f" ]]; then
    cp "$f" "$DIST/"
  fi
done

# IndexNow key 文件（必须放在根路径供搜索引擎验证）
for f in *.txt; do
  [[ "$f" == "robots.txt" ]] && continue
  if [[ -f "$f" ]]; then
    cp "$f" "$DIST/"
  fi
done

# 资源目录
if [[ -d assets ]]; then
  cp -r assets "$DIST/"
fi
if [[ -d data ]]; then
  cp -r data "$DIST/"
fi
if [[ -d cities ]]; then
  cp -r cities "$DIST/"
fi
if [[ -d seo ]]; then
  cp -r seo "$DIST/"
fi

# ── 显式黑名单校验（双重保险） ───────────────────────────────────────
echo "→ 黑名单校验"
FORBIDDEN=(backend crawler-worker private .wrangler .git .github scripts)
for item in "${FORBIDDEN[@]}"; do
  if [[ -e "$DIST/$item" ]]; then
    echo "❌ 发现禁止目录/文件：$DIST/$item" >&2
    echo "   立刻中止部署，请检查 deploy.sh 白名单逻辑" >&2
    exit 1
  fi
done

# 敏感后缀
SENSITIVE_EXT=("*.docx" "*.xlsx" "*.zip" "*.tar.gz")
FOUND=""
for ext in "${SENSITIVE_EXT[@]}"; do
  while IFS= read -r line; do
    FOUND+="$line"$'\n'
  done < <(find "$DIST" -type f -name "$ext" 2>/dev/null)
done
if [[ -n "$FOUND" ]]; then
  echo "❌ 发现敏感后缀文件：" >&2
  echo "$FOUND" >&2
  exit 1
fi

# ── 显示产物大小 ─────────────────────────────────────────────────────
echo ""
echo "→ dist/ 构建完成："
du -sh "$DIST"
find "$DIST" -type f | wc -l | xargs echo "   文件总数:"
echo ""

# ── 仅构建模式 ───────────────────────────────────────────────────────
if [[ "${1:-}" == "--dry-run" ]]; then
  echo "→ dry-run 模式，不上传 Cloudflare Pages"
  echo ""
  echo "dist/ 内容预览："
  ls -la "$DIST"
  exit 0
fi

# ── wrangler 部署 ────────────────────────────────────────────────────
echo "→ 部署到 Cloudflare Pages 项目: $PROJECT_NAME"
echo ""

if ! command -v wrangler >/dev/null 2>&1; then
  echo "❌ wrangler 未安装，请先: brew install cloudflare-wrangler2 或 npm i -g wrangler" >&2
  exit 1
fi

# commit hash 作为 deployment 标签
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "manual")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

wrangler pages deploy "$DIST" \
  --project-name="$PROJECT_NAME" \
  --branch="$BRANCH" \
  --commit-hash="$COMMIT" \
  --commit-dirty=true \
  --commit-message="deploy $COMMIT"

echo ""
echo "✓ 部署完成！"
echo "  线上: https://opcgate.com"
echo "  预览: https://$COMMIT.opc-policy.pages.dev"

# ── IndexNow 推送（告诉 Bing/Yandex 新页面已更新） ──────────────────
if command -v python3 >/dev/null 2>&1 && [[ -f scripts/push_indexnow.py ]]; then
  echo ""
  echo "→ IndexNow 推送新 sitemap"
  sleep 5  # 给 Cloudflare Pages 几秒时间让新页面上线，避免 IndexNow 抓到旧版
  python3 scripts/push_indexnow.py || echo "   (IndexNow 推送失败不中止部署)"
fi
