#!/usr/bin/env python3
"""
Validate core OPC data files.

This script is intentionally read-only and uses only the Python standard
library so it can run in local development and deployment checks.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

POLICIES_PATH = DATA_DIR / "policies.json"
COMMUNITIES_PATH = DATA_DIR / "communities.json"
CITIES_PATH = DATA_DIR / "cities.json"

REQUIRED_POLICY_FIELDS = (
    "id",
    "name",
    "city",
    "province",
    "level",
    "status",
    "category",
    "summary",
    "updated_at",
)

REQUIRED_POLICY_IDS = (
    "hangzhou-city-002",
    "guangzhou-city-007",
    "wuxi-xidong-001",
    "shenzhen-longgang-002",
    "qingdao-chengyang-001",
)

# Heuristic only: these domains are commonly used as reporting or media sources,
# so an URL under links.official should usually move to links.news instead.
MEDIA_DOMAINS = (
    "163.com",
    "21jingji.com",
    "36kr.com",
    "baijiahao.baidu.com",
    "caixin.com",
    "ce.cn",
    "chinanews.com",
    "cctv.com",
    "cnr.cn",
    "eastmoney.com",
    "finance.sina.com.cn",
    "gmw.cn",
    "huxiu.com",
    "ifeng.com",
    "ithome.com",
    "jiemian.com",
    "mrjjxw.com",
    "news.cn",
    "people.com.cn",
    "qq.com",
    "sina.com.cn",
    "sohu.com",
    "stcn.com",
    "stdaily.com",
    "thepaper.cn",
    "toutiao.com",
    "xinhuanet.com",
    "yicai.com",
    "zhihu.com",
)


def is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, (list, dict, tuple, set)):
        return len(value) == 0
    return False


def load_json(path: Path, errors: list[str]) -> Any | None:
    try:
        with path.open(encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        errors.append(f"{path.relative_to(ROOT)} does not exist")
    except json.JSONDecodeError as exc:
        errors.append(
            f"{path.relative_to(ROOT)} is not valid JSON: line {exc.lineno}, column {exc.colno}: {exc.msg}"
        )
    except UnicodeError as exc:
        errors.append(f"{path.relative_to(ROOT)} cannot be read as UTF-8: {exc}")
    except OSError as exc:
        errors.append(f"{path.relative_to(ROOT)} cannot be read: {exc}")
    return None


def get_records(data: Any, key: str, label: str, errors: list[str]) -> list[dict[str, Any]]:
    if not isinstance(data, dict):
        errors.append(f"{label} must be a JSON object with a '{key}' array")
        return []

    records = data.get(key)
    if not isinstance(records, list):
        errors.append(f"{label}.{key} must be an array")
        return []

    invalid = [idx for idx, item in enumerate(records) if not isinstance(item, dict)]
    if invalid:
        sample = ", ".join(str(i) for i in invalid[:10])
        errors.append(f"{label}.{key} contains non-object records at indexes: {sample}")
        return []

    return records


def find_duplicate_ids(records: list[dict[str, Any]], label: str, errors: list[str]) -> None:
    ids = [record.get("id") for record in records]
    missing_indexes = [idx for idx, value in enumerate(ids) if is_missing(value)]
    if missing_indexes:
        sample = ", ".join(str(i) for i in missing_indexes[:10])
        errors.append(f"{label} has missing id at indexes: {sample}")

    counts = Counter(value for value in ids if not is_missing(value))
    duplicates = sorted(value for value, count in counts.items() if count > 1)
    if duplicates:
        errors.append(f"{label} has duplicate ids: {', '.join(str(i) for i in duplicates)}")


def validate_required_policy_fields(
    policies: list[dict[str, Any]], errors: list[str]
) -> None:
    for idx, policy in enumerate(policies):
        missing = [field for field in REQUIRED_POLICY_FIELDS if is_missing(policy.get(field))]
        if missing:
            policy_id = policy.get("id") or f"index {idx}"
            errors.append(f"policy {policy_id} missing required fields: {', '.join(missing)}")


def validate_city_policy_counts(
    policies: list[dict[str, Any]], cities: list[dict[str, Any]], errors: list[str]
) -> None:
    policy_counts = Counter(policy.get("city") for policy in policies if not is_missing(policy.get("city")))
    city_names = set()

    for idx, city in enumerate(cities):
        name = city.get("name")
        if is_missing(name):
            errors.append(f"city at index {idx} missing name")
            continue

        city_names.add(name)
        expected = policy_counts.get(name, 0)
        actual = city.get("policy_count")
        if actual != expected:
            errors.append(
                f"city {name} policy_count is {actual}, expected {expected} from policies.json"
            )

    missing_city_rows = sorted(city for city in policy_counts if city not in city_names)
    if missing_city_rows:
        errors.append(
            "policies reference cities missing from data/cities.json: "
            + ", ".join(str(city) for city in missing_city_rows)
        )


def validate_communities_total(
    communities_data: Any, communities: list[dict[str, Any]], errors: list[str]
) -> None:
    if not isinstance(communities_data, dict):
        return

    total = communities_data.get("total")
    expected = len(communities)
    if total != expected:
        errors.append(f"communities.total is {total}, expected {expected}")


def host_matches(host: str, domain: str) -> bool:
    return host == domain or host.endswith(f".{domain}")


def is_media_domain(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return any(host_matches(host, domain) for domain in MEDIA_DOMAINS)


def validate_official_links(
    policies: list[dict[str, Any]], warnings: list[str]
) -> None:
    for policy in policies:
        links = policy.get("links") or {}
        if not isinstance(links, dict):
            warnings.append(f"policy {policy.get('id')} has non-object links")
            continue

        official = links.get("official")
        if is_missing(official):
            continue
        if not isinstance(official, str):
            warnings.append(f"policy {policy.get('id')} has non-string links.official")
            continue

        parsed = urlparse(official)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            warnings.append(f"policy {policy.get('id')} has invalid links.official: {official}")
            continue

        if is_media_domain(official):
            warnings.append(
                f"policy {policy.get('id')} links.official appears to be media/news: {parsed.netloc}"
            )


def validate_required_policy_ids(
    policies: list[dict[str, Any]], errors: list[str]
) -> None:
    present = {policy.get("id") for policy in policies}
    missing = [policy_id for policy_id in REQUIRED_POLICY_IDS if policy_id not in present]
    if missing:
        errors.append("missing required new policy ids: " + ", ".join(missing))


def print_messages(title: str, messages: list[str], max_items: int = 20) -> None:
    if not messages:
        return

    print(title)
    for message in messages[:max_items]:
        print(f"  - {message}")
    remaining = len(messages) - max_items
    if remaining > 0:
        print(f"  - ... {remaining} more")


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    policies_data = load_json(POLICIES_PATH, errors)
    communities_data = load_json(COMMUNITIES_PATH, errors)
    cities_data = load_json(CITIES_PATH, errors)

    if errors:
        print("Data validation failed before structural checks.")
        print_messages("ERRORS:", errors)
        return 1

    policies = get_records(policies_data, "policies", "policies.json", errors)
    communities = get_records(communities_data, "communities", "communities.json", errors)
    cities = get_records(cities_data, "cities", "cities.json", errors)

    find_duplicate_ids(policies, "policies", errors)
    find_duplicate_ids(communities, "communities", errors)
    validate_required_policy_fields(policies, errors)
    validate_city_policy_counts(policies, cities, errors)
    validate_communities_total(communities_data, communities, errors)
    validate_official_links(policies, warnings)
    validate_required_policy_ids(policies, errors)

    policy_version = (
        policies_data.get("version", "unknown")
        if isinstance(policies_data, dict)
        else "unknown"
    )
    print(
        "Data validation summary: "
        f"policies={len(policies)} (version {policy_version}), "
        f"communities={len(communities)}, cities={len(cities)}, "
        f"errors={len(errors)}, warnings={len(warnings)}"
    )

    print_messages("WARNINGS:", warnings)
    if errors:
        print_messages("ERRORS:", errors)
        return 1

    print("Data validation OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
