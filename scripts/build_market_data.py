#!/usr/bin/env python3
"""生成可被静态页面直接加载的 A 股复盘快照。"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import statistics
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "market-data.js"
DEFAULT_CACHE = ROOT / ".cache" / "akshare"
POSITIVE_RATING_WORDS = ("买入", "增持", "推荐", "强烈推荐", "强推", "优于大市")
INDEX_SPECS = (
    ("000001", "sh000001", "上证指数"),
    ("399001", "sz399001", "深证成指"),
    ("399006", "sz399006", "创业板指"),
    ("000688", "sh000688", "科创50"),
    ("000300", "sh000300", "沪深300"),
    ("000852", "sh000852", "中证1000"),
)
BUCKETS = (
    ("small", "50–100亿", 50.0, 100.0),
    ("medium", "100–300亿", 100.0, 300.0),
    ("large", "300–800亿", 300.0, 800.0),
)
RESEARCH_WINDOWS = (
    ("d7", "过去7天", 7),
    ("d30", "过去30天", 30),
    ("d180", "过去半年", 180),
)


def safe_float(value: Any) -> float | None:
    if value is None or value == "" or str(value).lower() in {"nan", "none", "null", "--"}:
        return None
    try:
        number = float(str(value).replace(",", "").replace("%", ""))
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def safe_int(value: Any) -> int | None:
    number = safe_float(value)
    return int(number) if number is not None else None


def pick(record: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in record and record[key] is not None:
            return record[key]
    return default


def normalize_date(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    text = str(value).strip().replace("/", "-")
    if re.fullmatch(r"\d{8}", text):
        return f"{text[:4]}-{text[4:6]}-{text[6:]}"
    match = re.search(r"\d{4}-\d{2}-\d{2}", text)
    return match.group(0) if match else None


def normalize_code(value: Any) -> str:
    text = str(value or "").upper()
    match = re.search(r"(\d{6})", text)
    return match.group(1) if match else text


def sina_stock_symbol(code: str) -> str:
    code = normalize_code(code)
    if code.startswith(("5", "6", "9")):
        return f"sh{code}"
    if code.startswith(("4", "8")):
        return f"bj{code}"
    return f"sz{code}"


def cumulative_return(closes: Iterable[Any], sessions: int) -> float | None:
    values = [safe_float(value) for value in closes]
    values = [value for value in values if value is not None]
    if sessions < 1 or len(values) <= sessions:
        return None
    start = values[-sessions - 1]
    end = values[-1]
    if start == 0:
        return None
    return round((end / start - 1) * 100, 2)


def market_cap_bucket(market_cap_yi: Any) -> str | None:
    value = safe_float(market_cap_yi)
    if value is None:
        return None
    if 50 <= value < 100:
        return "small"
    if 100 <= value < 300:
        return "medium"
    if 300 <= value <= 800:
        return "large"
    return None


def normalize_rating(value: Any) -> str | None:
    text = str(value or "").strip()
    return "买入类" if any(word in text for word in POSITIVE_RATING_WORDS) else None


def deduplicate_positive_reports(
    records: Iterable[dict[str, Any]],
    start_date: str,
    end_date: str | None = None,
) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for record in records:
        report_date = normalize_date(pick(record, "日期", "date"))
        if not report_date or report_date < start_date or (end_date and report_date > end_date):
            continue
        if not normalize_rating(pick(record, "东财评级", "评级", "rating")):
            continue
        institution = str(pick(record, "机构", "institution", default="未知机构"))
        title = str(pick(record, "报告名称", "title", default=""))
        key = (report_date, institution, title)
        if key in seen:
            continue
        seen.add(key)
        output.append({"date": report_date, "institution": institution, "title": title})
    return output


def research_window_starts(data_date: str) -> dict[str, str]:
    """返回包含结束日在内的自然日窗口起点。"""
    end_date = datetime.fromisoformat(data_date).date()
    return {
        key: (end_date - timedelta(days=days - 1)).isoformat()
        for key, _, days in RESEARCH_WINDOWS
    }


def aggregate_research_records(
    records: Iterable[dict[str, Any]],
    data_date: str,
    valid_codes: set[str] | None = None,
) -> dict[str, dict[str, Any]]:
    """按股票和自然日窗口累计公告披露的接待机构数量。"""
    starts = research_window_starts(data_date)
    aggregate: dict[str, dict[str, Any]] = {}
    for record in records:
        event_date = normalize_date(pick(record, "接待日期", "调研日期", "公告日期"))
        if not event_date or event_date < starts["d180"] or event_date > data_date:
            continue
        code = normalize_code(pick(record, "代码"))
        if valid_codes is not None and code not in valid_codes:
            continue
        item = aggregate.setdefault(code, {
            "code": code,
            "name": str(pick(record, "名称", default=code)),
            "windowStats": {
                key: {"researchInstitutions": 0, "researchEvents": 0}
                for key, _, _ in RESEARCH_WINDOWS
            },
        })
        institution_count = safe_int(pick(record, "接待机构数量")) or 0
        for key, _, _ in RESEARCH_WINDOWS:
            if event_date >= starts[key]:
                item["windowStats"][key]["researchInstitutions"] += institution_count
                item["windowStats"][key]["researchEvents"] += 1
    for item in aggregate.values():
        thirty_day = item["windowStats"]["d30"]
        item["researchCount"] = thirty_day["researchInstitutions"]
        item["eventCount"] = thirty_day["researchEvents"]
    return aggregate


def rating_window_summary(records: Iterable[dict[str, Any]], data_date: str) -> dict[str, dict[str, int]]:
    """按窗口统计去重后的积极评级报告和评级机构。"""
    record_list = list(records)
    starts = research_window_starts(data_date)
    output: dict[str, dict[str, int]] = {}
    for key, _, _ in RESEARCH_WINDOWS:
        positive = deduplicate_positive_reports(record_list, starts[key], data_date)
        institutions = {item["institution"] for item in positive}
        output[key] = {
            "ratingInstitutions": len(institutions),
            "positiveReports": len(positive),
        }
    return output


def percentile_rank(value: Any, values: Iterable[Any]) -> float | None:
    target = safe_float(value)
    clean = sorted(number for number in (safe_float(item) for item in values) if number is not None)
    if target is None or not clean:
        return None
    if len(set(clean)) == 1:
        return 0.5
    below = sum(item < target for item in clean)
    equal = sum(item == target for item in clean)
    return (below + (equal - 1) / 2) / (len(clean) - 1)


def emotion_score(day: dict[str, Any], history: list[dict[str, Any]]) -> int | None:
    definitions = (
        ("limitUp", 20, False),
        ("limitDown", 15, True),
        ("brokenRate", 15, True),
        ("previousPremium", 20, False),
        ("promotion12", 10, False),
        ("promotion23", 10, False),
        ("maxStreak", 10, False),
    )
    weighted = 0.0
    weight_sum = 0.0
    for key, weight, inverse in definitions:
        rank = percentile_rank(day.get(key), [item.get(key) for item in history])
        if rank is None:
            continue
        weighted += (1 - rank if inverse else rank) * weight
        weight_sum += weight
    return round(weighted / weight_sum * 100) if weight_sum else None


def classify_stage(score: Any, delta: Any) -> str:
    current = safe_float(score)
    movement = safe_float(delta) or 0
    if current is None:
        return "未知"
    if current < 25 and movement <= 0:
        return "冰点"
    if current < 42 and movement > 0:
        return "修复"
    if current < 58 and movement > 0:
        return "启动"
    if current >= 82 and movement >= 0:
        return "高潮"
    if current >= 58 and movement > 0:
        return "发酵"
    if current >= 50 and movement <= 0:
        return "分歧"
    return "退潮"


def json_safe(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [json_safe(item) for item in value]
    if hasattr(value, "item"):
        try:
            return json_safe(value.item())
        except (TypeError, ValueError):
            return str(value)
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except (TypeError, ValueError):
            return str(value)
    return str(value)


def merge_keep_previous(previous: Any, current: Any) -> Any:
    if current is None:
        return previous
    if isinstance(previous, dict) and isinstance(current, dict):
        return {key: merge_keep_previous(previous.get(key), value) for key, value in current.items()} | {
            key: value for key, value in previous.items() if key not in current
        }
    if isinstance(current, list) and not current and isinstance(previous, list) and previous:
        return previous
    return current


def read_snapshot(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        content = path.read_text(encoding="utf-8").strip()
        prefix = "window.MARKET_REVIEW_DATA = "
        if not content.startswith(prefix) or not content.endswith(";"):
            return None
        payload = json.loads(content[len(prefix):-1])
        return payload if isinstance(payload, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def merge_daily_records(previous: Any, current: Any) -> Any:
    if not isinstance(previous, list) or not isinstance(current, list):
        return current
    previous_by_date = {
        item.get("date"): item
        for item in previous
        if isinstance(item, dict) and item.get("date")
    }
    output = []
    for item in current:
        if not isinstance(item, dict):
            output.append(item)
            continue
        prior = previous_by_date.get(item.get("date"), {})
        output.append({
            key: prior.get(key) if value is None and prior.get(key) is not None else value
            for key, value in item.items()
        })
    return output


def merge_market_snapshot(previous: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    if previous.get("meta", {}).get("mode") != "live":
        return current
    merged = merge_keep_previous(previous, current)
    for section in ("overview", "emotion"):
        previous_daily = previous.get(section, {}).get("daily")
        current_daily = current.get(section, {}).get("daily")
        if isinstance(merged.get(section), dict):
            merged[section]["daily"] = merge_daily_records(previous_daily, current_daily)
    return merged


class AkshareClient:
    def __init__(self, ak_module: Any, cache_dir: Path, max_age_hours: float = 12):
        self.ak = ak_module
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_age = timedelta(hours=max_age_hours)
        self.warnings: list[str] = []
        self.failed_interfaces: set[str] = set()
        self._failed_requests: set[str] = set()
        self._lock = threading.Lock()

    @staticmethod
    def _request_key(name: str, kwargs: dict[str, Any]) -> str:
        return json.dumps([name, kwargs], ensure_ascii=False, sort_keys=True, default=str)

    def add_warning(self, warning: str) -> None:
        with self._lock:
            if warning not in self.warnings:
                self.warnings.append(warning)

    def request_failed(self, name: str, **kwargs: Any) -> bool:
        request_key = self._request_key(name, kwargs)
        with self._lock:
            return request_key in self._failed_requests

    def _cache_path(self, name: str, kwargs: dict[str, Any]) -> Path:
        payload = json.dumps([name, kwargs], ensure_ascii=False, sort_keys=True, default=str)
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]
        return self.cache_dir / f"{name}-{digest}.json"

    def _read_cache(self, path: Path, allow_stale: bool = False) -> list[dict[str, Any]] | None:
        if not path.exists():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            fetched_at = datetime.fromisoformat(payload["fetchedAt"])
            if not allow_stale and datetime.now(timezone.utc) - fetched_at > self.max_age:
                return None
            return payload["records"]
        except (KeyError, ValueError, OSError, json.JSONDecodeError):
            return None

    def records(self, name: str, **kwargs: Any) -> list[dict[str, Any]]:
        cache_path = self._cache_path(name, kwargs)
        request_key = self._request_key(name, kwargs)
        cached = self._read_cache(cache_path)
        if cached is not None:
            return cached
        error: Exception | None = None
        for attempt in range(3):
            try:
                frame = getattr(self.ak, name)(**kwargs)
                records = [json_safe(record) for record in frame.to_dict(orient="records")]
                payload = {"fetchedAt": datetime.now(timezone.utc).isoformat(), "records": records}
                temporary = cache_path.with_suffix(".tmp")
                temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
                os.replace(temporary, cache_path)
                with self._lock:
                    self._failed_requests.discard(request_key)
                return records
            except Exception as exc:
                error = exc
                if attempt < 2:
                    time.sleep(1.2 * (2**attempt))
        stale = self._read_cache(cache_path, allow_stale=True)
        warning = f"{name} 获取失败"
        if stale is not None:
            warning += "，已使用过期缓存"
        elif error:
            warning += f"：{type(error).__name__}"
        if stale is None:
            with self._lock:
                self.failed_interfaces.add(name)
                self._failed_requests.add(request_key)
        self.add_warning(warning)
        return stale or []


def parse_trade_dates(records: list[dict[str, Any]]) -> list[str]:
    today = date.today().isoformat()
    dates = sorted({normalized for record in records if (normalized := normalize_date(pick(record, "trade_date", "日期", "date"))) and normalized <= today})
    return dates


def records_by_date(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output = []
    for record in records:
        normalized = normalize_date(pick(record, "date", "日期"))
        close = safe_float(pick(record, "close", "收盘", "收盘价"))
        if normalized and close is not None:
            output.append({
                "date": normalized,
                "close": close,
                "amount": safe_float(pick(record, "amount", "成交额")),
                "change": safe_float(pick(record, "pct_chg", "涨跌幅")),
            })
    output.sort(key=lambda item: item["date"])
    for index, item in enumerate(output):
        if item["change"] is None and index > 0:
            previous_close = output[index - 1]["close"]
            item["change"] = round((item["close"] / previous_close - 1) * 100, 4) if previous_close else None
    return output


def fetch_index_series(client: AkshareClient, symbol: str) -> list[dict[str, Any]]:
    return records_by_date(client.records("stock_zh_index_daily", symbol=symbol))


def build_overview(client: AkshareClient, trading_days: list[str], spot_records: list[dict[str, Any]]) -> dict[str, Any]:
    series: dict[str, list[dict[str, Any]]] = {}
    indices = []
    for code, symbol, name in INDEX_SPECS:
        history = fetch_index_series(client, symbol)
        series[symbol] = history
        last = history[-1] if history else {}
        closes = [item["close"] for item in history[-7:]]
        change = last.get("change")
        if change is None and len(closes) > 1:
            change = cumulative_return(closes, 1)
        indices.append({
            "code": code,
            "name": name,
            "value": last.get("close"),
            "change": change,
            "history": closes,
        })
    sh_composite = series.get("sh000001", [])
    sz_composite = fetch_index_series(client, "sz399106")
    hs300 = {item["date"]: item for item in series.get("sh000300", [])}
    csi1000 = {item["date"]: item for item in series.get("sh000852", [])}
    sh_map = {item["date"]: item for item in sh_composite}
    sz_map = {item["date"]: item for item in sz_composite}
    daily = []
    for current_date in trading_days[-7:]:
        sh_amount = safe_float(sh_map.get(current_date, {}).get("amount"))
        sz_amount = safe_float(sz_map.get(current_date, {}).get("amount"))
        turnover = (sh_amount + sz_amount) / 100_000_000 if sh_amount is not None and sz_amount is not None else None
        large_change = safe_float(hs300.get(current_date, {}).get("change"))
        small_change = safe_float(csi1000.get(current_date, {}).get("change"))
        daily.append({
            "date": current_date,
            "turnover": round(turnover, 1) if turnover is not None else None,
            "up": None,
            "down": None,
            "flat": None,
            "median": None,
            "largeSmallSpread": round(large_change - small_change, 2) if large_change is not None and small_change is not None else None,
        })
    if daily and spot_records:
        changes = [safe_float(pick(row, "涨跌幅")) for row in spot_records]
        changes = [value for value in changes if value is not None]
        amounts = [safe_float(pick(row, "成交额")) for row in spot_records]
        amounts = [value for value in amounts if value is not None]
        daily[-1].update({
            "turnover": round(sum(amounts) / 100_000_000, 1) if amounts else daily[-1]["turnover"],
            "up": sum(value > 0 for value in changes),
            "down": sum(value < 0 for value in changes),
            "flat": sum(value == 0 for value in changes),
            "median": round(statistics.median(changes), 2) if changes else None,
        })
    return {"indices": indices, "daily": daily}


def pool_metric(records: list[dict[str, Any]], column: str, aggregate: str = "mean") -> float | None:
    values = [safe_float(pick(record, column)) for record in records]
    clean = [value for value in values if value is not None]
    if not clean:
        return None
    if aggregate == "max":
        return max(clean)
    if aggregate == "median":
        return statistics.median(clean)
    return statistics.mean(clean)


def fetch_emotion_day(client: AkshareClient, current_date: str) -> dict[str, Any]:
    date_arg = current_date.replace("-", "")
    pool_interfaces = {
        "up": "stock_zt_pool_em",
        "down": "stock_zt_pool_dtgc_em",
        "broken": "stock_zt_pool_zbgc_em",
        "previous": "stock_zt_pool_previous_em",
    }
    pools = {key: client.records(interface, date=date_arg) for key, interface in pool_interfaces.items()}
    failed = {
        key: client.request_failed(interface, date=date_arg)
        for key, interface in pool_interfaces.items()
    }
    streak_counts: dict[int, int] = {}
    for record in pools["up"]:
        streak = safe_int(pick(record, "连板数"))
        if streak is not None:
            streak_counts[streak] = streak_counts.get(streak, 0) + 1
    touched = len(pools["up"]) + len(pools["broken"])
    return {
        "date": current_date,
        "limitUp": None if failed["up"] else len(pools["up"]),
        "limitDown": None if failed["down"] else len(pools["down"]),
        "brokenRate": None if failed["up"] or failed["broken"] else round(len(pools["broken"]) / touched * 100, 1) if touched else 0,
        "maxStreak": None if failed["up"] else safe_int(pool_metric(pools["up"], "连板数", "max")) or 0,
        "previousPremium": round(pool_metric(pools["previous"], "涨跌幅", "mean"), 2) if pools["previous"] else None,
        "promotion12": None,
        "promotion23": None,
        "promotionAll": None,
        "streakCounts": streak_counts,
        "upCodes": [normalize_code(pick(record, "代码")) for record in pools["up"]],
        "brokenCodes": [normalize_code(pick(record, "代码")) for record in pools["broken"]],
        "industryByCode": {
            normalize_code(pick(record, "代码")): str(pick(record, "所属行业", default="待补充"))
            for record in pools["up"] + pools["broken"]
        },
    }


def build_emotion(client: AkshareClient, score_dates: list[str]) -> tuple[dict[str, Any], dict[str, Any]]:
    raw_days: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(fetch_emotion_day, client, current_date): current_date for current_date in score_dates}
        for future in as_completed(futures):
            raw_days.append(future.result())
    raw_days.sort(key=lambda item: item["date"])
    for index, item in enumerate(raw_days):
        if index > 0:
            previous = raw_days[index - 1]
            previous_streaks = previous["streakCounts"]
            item["promotion12"] = round(item["streakCounts"].get(2, 0) / previous_streaks.get(1, 0) * 100, 1) if previous_streaks.get(1) else None
            item["promotion23"] = round(item["streakCounts"].get(3, 0) / previous_streaks.get(2, 0) * 100, 1) if previous_streaks.get(2) else None
            previous_codes = set(previous["upCodes"])
            item["promotionAll"] = round(len(previous_codes & set(item["upCodes"])) / len(previous_codes) * 100, 1) if previous_codes else None
        item["score"] = emotion_score(item, raw_days[max(0, index - 19): index + 1])
        previous_score = raw_days[index - 1].get("score") if index > 0 else item["score"]
        delta = (item["score"] - previous_score) if item["score"] is not None and previous_score is not None else 0
        item["stage"] = classify_stage(item["score"], delta)
        item["confidence"] = "20日分位" if index >= 19 else "7日样本"
    public_days = []
    for item in raw_days[-7:]:
        public_days.append({key: value for key, value in item.items() if key not in {"streakCounts", "upCodes", "brokenCodes", "industryByCode"}})
    context = raw_days[-1] if raw_days else {"upCodes": [], "brokenCodes": [], "industryByCode": {}}
    return {"daily": public_days}, context


def stock_history(client: AkshareClient, code: str, start_date: str, end_date: str) -> list[dict[str, Any]]:
    records = client.records(
        "stock_zh_a_daily",
        symbol=sina_stock_symbol(code),
        start_date=start_date.replace("-", ""),
        end_date=end_date.replace("-", ""),
        adjust="qfq",
    )
    return records_by_date(records)


def stock_returns(history: list[dict[str, Any]]) -> dict[str, float | None]:
    closes = [item["close"] for item in history]
    return {
        "d1": cumulative_return(closes, 1),
        "d3": cumulative_return(closes, 3),
        "d5": cumulative_return(closes, 5),
        "d7": cumulative_return(closes, 7),
        "d10": cumulative_return(closes, 10),
        "d30": cumulative_return(closes, 30),
        "d120": cumulative_return(closes, 120),
    }


def board_history(client: AkshareClient, kind: str, name: str, start_date: str, end_date: str) -> list[dict[str, Any]]:
    if kind == "industry":
        records = client.records(
            "stock_board_industry_index_ths",
            symbol=name,
            start_date=start_date.replace("-", ""),
            end_date=end_date.replace("-", ""),
        )
    else:
        records = client.records(
            "stock_board_concept_index_ths",
            symbol=name,
            start_date=start_date.replace("-", ""),
            end_date=end_date.replace("-", ""),
        )
    return records_by_date(records)


def build_board_kind(
    client: AkshareClient,
    kind: str,
    start_date: str,
    end_date: str,
    spot_records: list[dict[str, Any]],
    quick: bool,
) -> tuple[list[dict[str, Any]], dict[str, set[str]]]:
    name_interface = "stock_board_industry_summary_ths" if kind == "industry" else "stock_board_concept_name_ths"
    records = client.records(name_interface)
    concept_leaders = {}
    if kind == "concept":
        concept_leaders = {
            str(pick(item, "概念名称", default="")): str(pick(item, "龙头股", default="--"))
            for item in client.records("stock_board_concept_summary_ths")
        }
    boards = []
    for record in records:
        name = str(pick(record, "板块", "板块名称", "名称", "name", default="")).strip()
        if not name:
            continue
        leader_name = str(pick(record, "领涨股", default=concept_leaders.get(name, "--")))
        boards.append({
            "code": str(pick(record, "板块代码", "代码", "code", default=name)),
            "name": name,
            "sourceLeader": leader_name if leader_name and leader_name != "--" else None,
            "sourceLeaderChange": safe_float(pick(record, "领涨股-涨跌幅")),
        })
    if quick:
        boards = boards[:30 if kind == "industry" else 50]
    histories: dict[str, list[dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(board_history, client, kind, item["name"], start_date, end_date): item["name"] for item in boards}
        for future in as_completed(futures):
            histories[futures[future]] = future.result()
    spot_by_name = {str(pick(item, "名称", default="")).strip(): item for item in spot_records}
    leader_codes = {
        normalize_code(pick(spot_by_name[board["sourceLeader"]], "代码"))
        for board in boards
        if board["sourceLeader"] in spot_by_name
    }
    leader_histories: dict[str, list[dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(stock_history, client, code, start_date, end_date): code for code in leader_codes}
        for future in as_completed(futures):
            leader_histories[futures[future]] = future.result()
    output = []
    membership: dict[str, set[str]] = {}
    for board in boards:
        closes = [item["close"] for item in histories.get(board["name"], [])]
        leader_spot = spot_by_name.get(board["sourceLeader"])
        leader = None
        if leader_spot:
            leader_code = normalize_code(pick(leader_spot, "代码"))
            returns = stock_returns(leader_histories.get(leader_code, []))
            leader = {
                "code": leader_code,
                "name": board["sourceLeader"],
                "d1": returns["d1"] if returns["d1"] is not None else board["sourceLeaderChange"],
                "d3": returns["d3"],
                "d7": returns["d7"],
            }
            membership.setdefault(leader_code, set()).add(board["name"])
        output.append({
            "code": board["code"],
            "name": board["name"],
            "d1": cumulative_return(closes, 1),
            "d3": cumulative_return(closes, 3),
            "d7": cumulative_return(closes, 7),
            "leader": leader,
        })
    if output and not any(item["leader"] for item in output):
        label = "概念" if kind == "concept" else "行业"
        client.add_warning(f"{label}板块来源未提供可识别的领涨股，相关字段显示缺失")
    return output, membership


def build_boards(
    client: AkshareClient,
    data_date: str,
    spot_records: list[dict[str, Any]],
    quick: bool,
) -> tuple[dict[str, Any], dict[str, set[str]]]:
    start_date = (datetime.fromisoformat(data_date).date() - timedelta(days=24)).isoformat()
    industry, industry_membership = build_board_kind(client, "industry", start_date, data_date, spot_records, quick)
    concept, concept_membership = build_board_kind(client, "concept", start_date, data_date, spot_records, quick)
    combined = {code: names | concept_membership.get(code, set()) for code, names in industry_membership.items()}
    for code, names in concept_membership.items():
        combined.setdefault(code, set()).update(names)
    return {"industry": industry, "concept": concept}, combined


def filtered_spot(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output = []
    for record in records:
        name = str(pick(record, "名称", default=""))
        if not name or "ST" in name.upper() or "退" in name or name.startswith(("N", "C")):
            continue
        output.append(record)
    return output


def build_identity(
    client: AkshareClient,
    spot_records: list[dict[str, Any]],
    hot_records: list[dict[str, Any]],
    boards: dict[str, Any],
    board_membership: dict[str, set[str]],
    emotion_context: dict[str, Any],
    data_date: str,
    quick: bool,
) -> dict[str, Any]:
    spot_map = {normalize_code(pick(item, "代码")): item for item in spot_records}
    hot_map = {normalize_code(pick(item, "代码")): safe_int(pick(item, "当前排名")) for item in hot_records}
    turnover_sorted = sorted(spot_records, key=lambda item: safe_float(pick(item, "成交额")) or 0, reverse=True)[:100]
    board_leaders = {}
    for kind in ("industry", "concept"):
        for board in boards.get(kind, []):
            leader = board.get("leader")
            if leader:
                board_leaders.setdefault(leader["code"], []).append(board["name"])
    candidate_codes = set(list(hot_map)[:100])
    candidate_codes.update(normalize_code(pick(item, "代码")) for item in turnover_sorted)
    candidate_codes.update(emotion_context.get("upCodes", []))
    candidate_codes.update(emotion_context.get("brokenCodes", []))
    candidate_codes.update(board_leaders)
    candidate_codes = {code for code in candidate_codes if code in spot_map}
    if quick:
        candidate_codes = set(list(candidate_codes)[:60])
    start_date = (datetime.fromisoformat(data_date).date() - timedelta(days=210)).isoformat()
    histories: dict[str, list[dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(stock_history, client, code, start_date, data_date): code for code in candidate_codes}
        for future in as_completed(futures):
            histories[futures[future]] = future.result()
    lhb_records = client.records(
        "stock_lhb_detail_em",
        start_date=(datetime.fromisoformat(data_date).date() - timedelta(days=30)).strftime("%Y%m%d"),
        end_date=data_date.replace("-", ""),
    )
    lhb_counts: dict[str, int] = {}
    for record in lhb_records:
        code = normalize_code(pick(record, "代码"))
        lhb_counts[code] = lhb_counts.get(code, 0) + 1
    features = []
    for code in candidate_codes:
        spot = spot_map[code]
        returns = stock_returns(histories.get(code, []))
        features.append({
            "code": code,
            "name": str(pick(spot, "名称", default=code)),
            "turnover": safe_float(pick(spot, "成交额")),
            "turnoverRate": safe_float(pick(spot, "换手率")),
            "pe": safe_float(pick(spot, "市盈率-动态")),
            "hotRank": hot_map.get(code),
            "returns": returns,
            "boards": board_leaders.get(code, []),
            "concepts": sorted(board_membership.get(code, set()))[:5],
            "limitUp": code in set(emotion_context.get("upCodes", [])),
            "broken": code in set(emotion_context.get("brokenCodes", [])),
            "lhbCount": lhb_counts.get(code, 0),
            "industry": emotion_context.get("industryByCode", {}).get(code, "待补充"),
            "change": safe_float(pick(spot, "涨跌幅")),
        })
    turnover_values = [item["turnover"] for item in features]
    d5_values = [item["returns"]["d5"] for item in features]
    d10_values = [item["returns"]["d10"] for item in features]
    d30_values = [item["returns"]["d30"] for item in features]
    lhb_values = [item["lhbCount"] for item in features]
    ranked = []
    for item in features:
        hot_component = max(0, 18 * (1 - ((item["hotRank"] or 101) - 1) / 99)) if item["hotRank"] else 0
        amount_component = 12 * (percentile_rank(item["turnover"], turnover_values) or 0)
        attention = round(hot_component + amount_component)
        strength = round(
            12 * (percentile_rank(item["returns"]["d5"], d5_values) or 0)
            + 10 * (percentile_rank(item["returns"]["d10"], d10_values) or 0)
            + 8 * (percentile_rank(item["returns"]["d30"], d30_values) or 0)
        )
        leadership = 25 if item["boards"] else (10 if item["concepts"] else 0)
        confirmation = (8 if item["limitUp"] else 4 if item["broken"] else 0) + round(7 * (percentile_rank(item["lhbCount"], lhb_values) or 0))
        score = min(100, attention + strength + leadership + confirmation)
        if item["limitUp"] and score >= 78:
            role = "情绪核心"
        elif (item["returns"]["d30"] or 0) > 10 and attention >= 18:
            role = "趋势核心"
        elif item["boards"]:
            role = "题材中军"
        else:
            role = "人气博弈"
        reasons = []
        if item["hotRank"]:
            reasons.append(f"人气排名第{item['hotRank']}")
        if item["boards"]:
            reasons.append(f"{item['boards'][0]}领涨股")
        if item["returns"]["d5"] is not None:
            reasons.append(f"5日涨幅{item['returns']['d5']:+.2f}%")
        if item["lhbCount"]:
            reasons.append(f"近月龙虎榜{item['lhbCount']}次")
        risks = []
        if (item["returns"]["d30"] or 0) > 35:
            risks.append("30日涨幅偏高")
        if (item["turnoverRate"] or 0) > 25:
            risks.append("换手率偏高")
        if item["broken"]:
            risks.append("当日炸板")
        if (item["pe"] or 0) < 0:
            risks.append("当前利润为负")
        ranked.append({
            "code": item["code"],
            "name": item["name"],
            "score": score,
            "role": role,
            "industry": item["industry"],
            "concepts": item["concepts"] or item["boards"],
            "components": {"attention": attention, "strength": strength, "leadership": leadership, "confirmation": confirmation},
            "reasons": reasons[:3],
            "risks": risks[:2],
        })
    ranked.sort(key=lambda item: item["score"], reverse=True)
    for index, item in enumerate(ranked[:20], start=1):
        item["rank"] = index
    popular = []
    for record in hot_records[:20]:
        popular.append({
            "rank": safe_int(pick(record, "当前排名")),
            "code": normalize_code(pick(record, "代码")),
            "name": str(pick(record, "股票名称", "名称", default="--")),
            "change": safe_float(pick(record, "涨跌幅")),
        })
    return {"popular": popular, "ranked": ranked[:20]}


def report_summary(client: AkshareClient, code: str, data_date: str) -> dict[str, Any]:
    records = client.records("stock_research_report_em", symbol=code)
    industry = next((str(pick(record, "行业")) for record in records if pick(record, "行业")), None)
    window_stats = rating_window_summary(records, data_date)
    thirty_day = window_stats["d30"]
    return {
        "ratingCount": thirty_day["positiveReports"],
        "ratingInstitutions": thirty_day["ratingInstitutions"],
        "windowStats": window_stats,
        "industry": industry,
    }


def sina_financial_summary(
    abstract_records: list[dict[str, Any]],
    indicator_records: list[dict[str, Any]],
) -> dict[str, Any]:
    latest_indicator = sorted(
        indicator_records,
        key=lambda item: normalize_date(pick(item, "日期")) or "",
        reverse=True,
    )[0] if indicator_records else {}
    period_columns = []
    for record in abstract_records:
        for key in record:
            if re.fullmatch(r"\d{8}", str(key)):
                period_columns.append(str(key))
    latest_period = max(period_columns, default="")

    def abstract_value(metric_name: str) -> float | None:
        for record in abstract_records:
            if str(pick(record, "指标", default="")) == metric_name:
                return safe_float(record.get(latest_period))
        return None

    revenue = abstract_value("营业总收入")
    net_profit = abstract_value("归母净利润")
    return {
        "revenue": revenue / 100_000_000 if revenue is not None else None,
        "netProfit": net_profit / 100_000_000 if net_profit is not None else None,
        "revenueGrowth": safe_float(pick(latest_indicator, "主营业务收入增长率(%)")),
        "profitGrowth": safe_float(pick(latest_indicator, "净利润增长率(%)")),
        "reportPeriod": normalize_date(latest_period) or normalize_date(pick(latest_indicator, "日期")) or "--",
    }


def latest_valuation(client: AkshareClient, code: str, indicator: str) -> float | None:
    records = client.records("stock_zh_valuation_baidu", symbol=code, indicator=indicator, period="近一年")
    if not records:
        return None
    latest = sorted(records, key=lambda item: normalize_date(pick(item, "date", "日期")) or "", reverse=True)[0]
    return safe_float(pick(latest, "value", "值"))


def enrich_research_stock(
    client: AkshareClient,
    base: dict[str, Any],
    data_date: str,
    board_membership: dict[str, set[str]],
    rating: dict[str, Any],
) -> dict[str, Any]:
    code = base["code"]
    start_history = (datetime.fromisoformat(data_date).date() - timedelta(days=230)).isoformat()
    returns = stock_returns(stock_history(client, code, start_history, data_date))
    business_records = client.records("stock_zyjs_ths", symbol=code)
    abstract_records = client.records("stock_financial_abstract", symbol=code)
    indicator_records = client.records("stock_financial_analysis_indicator", symbol=code, start_year=str(datetime.fromisoformat(data_date).year - 1))
    financial = sina_financial_summary(abstract_records, indicator_records)
    business = str(pick(business_records[0], "主营业务", default="")) if business_records else ""
    pe = base.get("pe")
    if pe is None:
        pe = latest_valuation(client, code, "市盈率(TTM)")
    rating_windows = rating.get("windowStats", {})
    window_stats = {}
    for key, _, _ in RESEARCH_WINDOWS:
        research_metrics = base.get("windowStats", {}).get(key, {})
        rating_metrics = rating_windows.get(key, {})
        window_stats[key] = {
            "researchInstitutions": research_metrics.get("researchInstitutions"),
            "researchEvents": research_metrics.get("researchEvents"),
            "ratingInstitutions": rating_metrics.get("ratingInstitutions"),
            "positiveReports": rating_metrics.get("positiveReports"),
        }
    return {
        **base,
        "industry": rating.get("industry") or "待补充",
        "concepts": sorted(board_membership.get(code, set()))[:5],
        "business": business,
        "pe": pe,
        "returns": {key: returns[key] for key in ("d5", "d10", "d30", "d120")},
        "ratingCount": rating.get("ratingCount", 0),
        "ratingInstitutions": rating.get("ratingInstitutions", 0),
        "windowStats": window_stats,
        **financial,
    }


def build_research(
    client: AkshareClient,
    spot_records: list[dict[str, Any]],
    board_membership: dict[str, set[str]],
    data_date: str,
    quick: bool,
) -> dict[str, Any]:
    starts = research_window_starts(data_date)
    records = client.records("stock_jgdy_tj_em", date=starts["d180"].replace("-", ""))
    spot_map = {normalize_code(pick(item, "代码")): item for item in spot_records}
    aggregate = aggregate_research_records(records, data_date, set(spot_map))
    bucket_candidates: dict[str, list[dict[str, Any]]] = {bucket_id: [] for bucket_id, _, _, _ in BUCKETS}
    candidate_limit = 30 if quick else 150
    preselected_by_code: dict[str, dict[str, Any]] = {}
    for window_key, _, _ in RESEARCH_WINDOWS:
        ranked = sorted(
            aggregate.values(),
            key=lambda item: (
                item["windowStats"][window_key]["researchInstitutions"],
                item["windowStats"][window_key]["researchEvents"],
            ),
            reverse=True,
        )[:candidate_limit]
        preselected_by_code.update({item["code"]: item for item in ranked})
    preselected = list(preselected_by_code.values())
    market_caps: dict[str, float | None] = {}
    missing_market_caps = [
        item for item in preselected
        if safe_float(pick(spot_map[item["code"]], "总市值")) is None
    ]
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(latest_valuation, client, item["code"], "总市值"): item["code"] for item in missing_market_caps}
        for future in as_completed(futures):
            market_caps[futures[future]] = future.result()
    for item in preselected:
        code = item["code"]
        spot = spot_map[code]
        market_cap = safe_float(pick(spot, "总市值"))
        market_cap_yi = market_cap / 100_000_000 if market_cap is not None else market_caps.get(code)
        bucket_id = market_cap_bucket(market_cap_yi)
        if not bucket_id:
            continue
        bucket_candidates[bucket_id].append({
            **item,
            "marketCap": round(market_cap_yi, 2),
            "price": safe_float(pick(spot, "最新价", "最新", "trade")),
            "pe": safe_float(pick(spot, "市盈率-动态")),
        })
    scan_limit = 10 if quick else 40
    rating_summaries: dict[str, dict[str, Any]] = {}
    scan_by_code: dict[str, dict[str, Any]] = {}
    for bucket_id in bucket_candidates:
        for window_key, _, _ in RESEARCH_WINDOWS:
            ranked = sorted(
                bucket_candidates[bucket_id],
                key=lambda item: (
                    item["windowStats"][window_key]["researchInstitutions"],
                    item["windowStats"][window_key]["researchEvents"],
                ),
                reverse=True,
            )[:scan_limit]
            scan_by_code.update({item["code"]: item for item in ranked})
    scan_stocks = list(scan_by_code.values())
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(report_summary, client, item["code"], data_date): item["code"] for item in scan_stocks}
        for future in as_completed(futures):
            rating_summaries[futures[future]] = future.result()
    selected: dict[str, list[dict[str, Any]]] = {}
    for bucket_id, items in bucket_candidates.items():
        scanned = [item for item in items if item["code"] in rating_summaries]
        unique: dict[str, dict[str, Any]] = {}
        for window_key, _, _ in RESEARCH_WINDOWS:
            eligible = [
                item for item in scanned
                if item["windowStats"][window_key]["researchInstitutions"] > 0
            ]
            top_research = sorted(
                eligible,
                key=lambda item: (
                    item["windowStats"][window_key]["researchInstitutions"],
                    item["windowStats"][window_key]["researchEvents"],
                ),
                reverse=True,
            )[:10]
            top_rating = sorted(
                eligible,
                key=lambda item: (
                    rating_summaries[item["code"]]["windowStats"][window_key]["ratingInstitutions"],
                    rating_summaries[item["code"]]["windowStats"][window_key]["positiveReports"],
                ),
                reverse=True,
            )[:10]
            unique.update({item["code"]: item for item in top_research + top_rating})
        selected[bucket_id] = list(unique.values())
    enriched: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(enrich_research_stock, client, item, data_date, board_membership, rating_summaries.get(item["code"], {})): item["code"]
            for items in selected.values() for item in items
        }
        for future in as_completed(futures):
            enriched[futures[future]] = future.result()
    buckets = []
    for bucket_id, label, minimum, maximum in BUCKETS:
        stocks = [enriched[item["code"]] for item in selected[bucket_id] if item["code"] in enriched]
        stocks.sort(key=lambda item: item["windowStats"]["d30"]["researchInstitutions"], reverse=True)
        buckets.append({"id": bucket_id, "label": label, "min": minimum, "max": maximum, "stocks": stocks})
    windows = {
        key: {"label": label, "start": starts[key], "end": data_date, "days": days}
        for key, label, days in RESEARCH_WINDOWS
    }
    return {
        "windowStart": starts["d30"],
        "windowEnd": data_date,
        "windows": windows,
        "buckets": buckets,
    }


def build_snapshot(ak_module: Any, cache_dir: Path, quick: bool = False) -> dict[str, Any]:
    client = AkshareClient(ak_module, cache_dir)
    trade_records = client.records("tool_trade_date_hist_sina")
    all_trade_dates = parse_trade_dates(trade_records)
    if len(all_trade_dates) < 7:
        raise RuntimeError("无法取得足够的交易日数据，已保留原快照")
    data_date = all_trade_dates[-1]
    score_dates = all_trade_dates[-(7 if quick else 20):]
    spot_records = filtered_spot(client.records("stock_zh_a_spot_em"))
    if not spot_records:
        spot_records = filtered_spot(client.records("stock_zh_a_spot"))
        client.warnings.append("东方财富全市场行情不可用，已切换新浪行情")
    if not spot_records:
        raise RuntimeError("全市场行情接口不可用，已保留原快照")
    hot_records = client.records("stock_hot_rank_em")
    overview = build_overview(client, all_trade_dates[-7:], spot_records)
    emotion, emotion_context = build_emotion(client, score_dates)
    boards, board_membership = build_boards(client, data_date, spot_records, quick)
    identity = build_identity(client, spot_records, hot_records, boards, board_membership, emotion_context, data_date, quick)
    research = build_research(client, spot_records, board_membership, data_date, quick)
    warnings = client.warnings
    return {
        "meta": {
            "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
            "dataDate": data_date,
            "mode": "live",
            "status": "degraded" if warnings else "ok",
            "confidence": "真实收盘快照",
            "warnings": warnings,
            "sources": ["AKShare", "交易所", "东方财富", "同花顺"],
        },
        "tradingDays": all_trade_dates[-7:],
        "overview": overview,
        "emotion": emotion,
        "boards": boards,
        "identity": identity,
        "research": research,
    }


def write_snapshot(snapshot: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    content = "window.MARKET_REVIEW_DATA = " + json.dumps(json_safe(snapshot), ensure_ascii=False, separators=(",", ":")) + ";\n"
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(content, encoding="utf-8")
    os.replace(temporary, output)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="生成 A 股系统复盘静态数据")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="输出 market-data.js 的路径")
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE, help="AKShare 缓存目录")
    parser.add_argument("--quick", action="store_true", help="只扫描较小候选集，用于首次连通性验证")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        import akshare as ak
    except ModuleNotFoundError:
        print("缺少 akshare。请先运行：python3 -m pip install -r requirements.txt", file=sys.stderr)
        return 2
    try:
        snapshot = build_snapshot(ak, args.cache_dir, quick=args.quick)
        previous = read_snapshot(args.output)
        if previous:
            snapshot = merge_market_snapshot(previous, snapshot)
        write_snapshot(snapshot, args.output)
    except Exception as exc:
        print(f"数据生成失败：{exc}", file=sys.stderr)
        return 1
    print(f"已生成 {args.output}，数据交易日 {snapshot['meta']['dataDate']}，告警 {len(snapshot['meta']['warnings'])} 条")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
