import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_market_data import (
    build_board_kind,
    aggregate_research_records,
    classify_stage,
    cumulative_return,
    deduplicate_positive_reports,
    emotion_score,
    fetch_emotion_day,
    market_cap_bucket,
    merge_market_snapshot,
    merge_keep_previous,
    normalize_rating,
    records_by_date,
    rating_window_summary,
    research_window_starts,
    write_snapshot,
)


class EmptyPoolClient:
    def __init__(self, failed_interfaces=None):
        self.failed_interfaces = set(failed_interfaces or [])

    def records(self, name, **kwargs):
        return []

    def request_failed(self, name, **kwargs):
        return name in self.failed_interfaces


class BoardClient:
    def __init__(self):
        self.warnings = []

    def records(self, name, **kwargs):
        if name == "stock_board_industry_summary_ths":
            return [{"板块": "测试行业", "板块代码": "881001", "领涨股": "测试股份", "领涨股-涨跌幅": 8.5}]
        if name == "stock_board_industry_index_ths":
            return [{"日期": f"2026-07-{day:02d}", "收盘价": close} for day, close in enumerate(range(10, 19), start=1)]
        if name == "stock_zh_a_daily":
            return [{"date": f"2026-07-{day:02d}", "close": close} for day, close in enumerate(range(20, 29), start=1)]
        return []

    def add_warning(self, warning):
        if warning not in self.warnings:
            self.warnings.append(warning)


class MarketDataCalculationTests(unittest.TestCase):
    def test_cumulative_return_uses_session_boundary(self):
        closes = [10, 11, 12, 15]
        self.assertEqual(cumulative_return(closes, 1), 25.0)
        self.assertEqual(cumulative_return(closes, 3), 50.0)
        self.assertIsNone(cumulative_return(closes, 4))

    def test_index_change_can_be_derived_from_adjacent_closes(self):
        records = [
            {"date": "2026-08-06", "close": 100},
            {"date": "2026-08-07", "close": 102},
        ]
        output = records_by_date(records)
        self.assertIsNone(output[0]["change"])
        self.assertEqual(output[1]["change"], 2.0)

    def test_market_cap_buckets_have_unambiguous_edges(self):
        self.assertIsNone(market_cap_bucket(49.99))
        self.assertEqual(market_cap_bucket(50), "small")
        self.assertEqual(market_cap_bucket(99.99), "small")
        self.assertEqual(market_cap_bucket(100), "medium")
        self.assertEqual(market_cap_bucket(299.99), "medium")
        self.assertEqual(market_cap_bucket(300), "large")
        self.assertEqual(market_cap_bucket(800), "large")
        self.assertIsNone(market_cap_bucket(800.01))

    def test_positive_rating_normalization(self):
        self.assertEqual(normalize_rating("强烈推荐-A"), "买入类")
        self.assertEqual(normalize_rating("增持"), "买入类")
        self.assertIsNone(normalize_rating("中性"))

    def test_report_deduplication_uses_date_institution_and_title(self):
        records = [
            {"日期": "2026-08-01", "机构": "甲机构", "报告名称": "公司更新", "东财评级": "买入"},
            {"日期": "2026-08-01", "机构": "甲机构", "报告名称": "公司更新", "东财评级": "买入"},
            {"日期": "2026-08-02", "机构": "乙机构", "报告名称": "深度报告", "东财评级": "增持"},
            {"日期": "2026-07-01", "机构": "丙机构", "报告名称": "旧报告", "东财评级": "买入"},
            {"日期": "2026-08-03", "机构": "丁机构", "报告名称": "中性报告", "东财评级": "中性"},
        ]
        output = deduplicate_positive_reports(records, "2026-07-09")
        self.assertEqual(len(output), 2)

    def test_research_windows_include_both_boundary_dates(self):
        self.assertEqual(research_window_starts("2026-08-08"), {
            "d7": "2026-08-02",
            "d30": "2026-07-10",
            "d180": "2026-02-10",
        })

    def test_research_institution_count_sums_each_disclosed_event(self):
        records = [
            {"代码": "000001", "名称": "测试股份", "接待日期": "2026-02-09", "接待机构数量": 99},
            {"代码": "000001", "名称": "测试股份", "接待日期": "2026-02-10", "接待机构数量": 10},
            {"代码": "000001", "名称": "测试股份", "接待日期": "2026-07-10", "接待机构数量": 20},
            {"代码": "000001", "名称": "测试股份", "接待日期": "2026-08-01", "接待机构数量": 5},
            {"代码": "000001", "名称": "测试股份", "接待日期": "2026-08-02", "接待机构数量": 30},
            {"代码": "000001", "名称": "测试股份", "接待日期": "2026-08-08", "接待机构数量": 40},
        ]
        stats = aggregate_research_records(records, "2026-08-08")["000001"]["windowStats"]
        self.assertEqual(stats["d7"], {"researchInstitutions": 70, "researchEvents": 2})
        self.assertEqual(stats["d30"], {"researchInstitutions": 95, "researchEvents": 4})
        self.assertEqual(stats["d180"], {"researchInstitutions": 105, "researchEvents": 5})

    def test_rating_institutions_are_deduplicated_inside_each_window(self):
        records = [
            {"日期": "2026-02-10", "机构": "甲机构", "报告名称": "半年报告", "东财评级": "买入"},
            {"日期": "2026-07-10", "机构": "乙机构", "报告名称": "公司更新", "东财评级": "增持"},
            {"日期": "2026-08-02", "机构": "乙机构", "报告名称": "深度报告", "东财评级": "推荐"},
            {"日期": "2026-08-08", "机构": "乙机构", "报告名称": "公司更新", "东财评级": "买入"},
            {"日期": "2026-08-08", "机构": "乙机构", "报告名称": "公司更新", "东财评级": "买入"},
            {"日期": "2026-08-09", "机构": "丙机构", "报告名称": "未来报告", "东财评级": "买入"},
        ]
        stats = rating_window_summary(records, "2026-08-08")
        self.assertEqual(stats["d7"], {"ratingInstitutions": 1, "positiveReports": 2})
        self.assertEqual(stats["d30"], {"ratingInstitutions": 1, "positiveReports": 3})
        self.assertEqual(stats["d180"], {"ratingInstitutions": 2, "positiveReports": 4})

    def test_emotion_score_respects_positive_and_inverse_metrics(self):
        cold = {"limitUp": 10, "limitDown": 40, "brokenRate": 60, "previousPremium": -3, "promotion12": 5, "promotion23": 2, "maxStreak": 2}
        hot = {"limitUp": 100, "limitDown": 1, "brokenRate": 10, "previousPremium": 5, "promotion12": 60, "promotion23": 50, "maxStreak": 8}
        history = [cold, hot]
        self.assertLess(emotion_score(cold, history), emotion_score(hot, history))

    def test_stage_classification_uses_score_and_direction(self):
        self.assertEqual(classify_stage(18, -4), "冰点")
        self.assertEqual(classify_stage(35, 8), "修复")
        self.assertEqual(classify_stage(50, 5), "启动")
        self.assertEqual(classify_stage(70, 6), "发酵")
        self.assertEqual(classify_stage(86, 2), "高潮")
        self.assertEqual(classify_stage(65, -8), "分歧")
        self.assertEqual(classify_stage(38, -6), "退潮")

    def test_merge_keeps_last_good_values_for_missing_sections(self):
        previous = {"overview": {"daily": [1, 2]}, "boards": {"industry": ["A"]}}
        current = {"overview": {"daily": []}, "boards": {"industry": None}}
        merged = merge_keep_previous(previous, current)
        self.assertEqual(merged["overview"]["daily"], [1, 2])
        self.assertEqual(merged["boards"]["industry"], ["A"])

    def test_snapshot_merge_accumulates_daily_values_by_date(self):
        previous = {
            "meta": {"mode": "live"},
            "overview": {"daily": [{"date": "2026-08-06", "up": 2800, "down": 2200, "turnover": 19000}]},
            "emotion": {"daily": [{"date": "2026-08-06", "limitDown": 3, "score": 60}]},
            "boards": {"industry": ["旧板块"]},
        }
        current = {
            "meta": {"mode": "live"},
            "overview": {"daily": [{"date": "2026-08-06", "up": None, "down": None, "turnover": 21000}]},
            "emotion": {"daily": [{"date": "2026-08-06", "limitDown": None, "score": 65}]},
            "boards": {"industry": []},
        }
        merged = merge_market_snapshot(previous, current)
        self.assertEqual(merged["overview"]["daily"][0], {"date": "2026-08-06", "up": 2800, "down": 2200, "turnover": 21000})
        self.assertEqual(merged["emotion"]["daily"][0]["limitDown"], 3)
        self.assertEqual(merged["emotion"]["daily"][0]["score"], 65)
        self.assertEqual(merged["boards"]["industry"], ["旧板块"])

    def test_snapshot_writer_creates_javascript_assignment(self):
        snapshot = {"meta": {"dataDate": "2026-08-07"}, "value": None}
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "market-data.js"
            write_snapshot(snapshot, output)
            text = output.read_text(encoding="utf-8")
            self.assertTrue(text.startswith("window.MARKET_REVIEW_DATA = "))
            payload = json.loads(text.removeprefix("window.MARKET_REVIEW_DATA = ").removesuffix(";\n"))
            self.assertEqual(payload["meta"]["dataDate"], "2026-08-07")

    def test_successful_empty_limit_pools_are_zero(self):
        output = fetch_emotion_day(EmptyPoolClient(), "2026-08-07")
        self.assertEqual(output["limitUp"], 0)
        self.assertEqual(output["limitDown"], 0)
        self.assertEqual(output["brokenRate"], 0)
        self.assertEqual(output["maxStreak"], 0)

    def test_failed_limit_pool_is_missing_instead_of_zero(self):
        output = fetch_emotion_day(EmptyPoolClient({"stock_zt_pool_dtgc_em"}), "2026-08-07")
        self.assertIsNone(output["limitDown"])
        self.assertEqual(output["limitUp"], 0)

    def test_board_leader_is_enriched_from_spot_and_history(self):
        boards, membership = build_board_kind(
            BoardClient(),
            "industry",
            "2026-07-01",
            "2026-07-09",
            [{"代码": "000001", "名称": "测试股份"}],
            quick=True,
        )
        leader = boards[0]["leader"]
        self.assertEqual(leader["code"], "000001")
        self.assertIsNotNone(leader["d3"])
        self.assertIsNotNone(leader["d7"])
        self.assertEqual(membership["000001"], {"测试行业"})


if __name__ == "__main__":
    unittest.main()
