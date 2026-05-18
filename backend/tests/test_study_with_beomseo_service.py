"""
Unit tests for Study With Beomseo leaderboard service helpers.
"""
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.study_with_beomseo import (  # noqa: E402
    CLASS_OPTIONS,
    StudyWithBeomseoValidationError,
    build_ranked_rows,
    parse_class_id,
    parse_effective_at,
    parse_total_score,
)


class StudyWithBeomseoServiceTest(unittest.TestCase):
    def test_class_options_cover_all_30_classes(self):
        self.assertEqual(len(CLASS_OPTIONS), 30)
        self.assertEqual(CLASS_OPTIONS[0]['classId'], '1-1')
        self.assertEqual(CLASS_OPTIONS[-1]['classId'], '3-10')

    def test_parse_class_id_accepts_only_school_classes(self):
        parsed = parse_class_id('2-7')
        self.assertEqual(parsed.class_id, '2-7')
        self.assertEqual(parsed.grade, 2)
        self.assertEqual(parsed.class_number, 7)

        with self.assertRaises(StudyWithBeomseoValidationError):
            parse_class_id('4-1')

    def test_parse_total_score_requires_integer_range(self):
        self.assertEqual(parse_total_score('1650'), 1650)
        self.assertEqual(parse_total_score(0), 0)

        for value in (-1, 1_000_001, 12.5, True, ''):
            with self.subTest(value=value):
                with self.assertRaises(StudyWithBeomseoValidationError):
                    parse_total_score(value)

    def test_parse_effective_at_converts_aware_time_to_kst_naive(self):
        effective_at = parse_effective_at('2026-05-19T01:30:00Z')
        self.assertEqual(effective_at, datetime(2026, 5, 19, 10, 30, 0))

        local_effective_at = parse_effective_at('2026-05-19T10:30:00')
        self.assertEqual(local_effective_at, datetime(2026, 5, 19, 10, 30, 0))

    def test_ranked_rows_include_zero_score_classes_and_shared_ranks(self):
        latest_by_class = {
            '2-7': SimpleNamespace(total_score=1650, effective_at=datetime(2026, 5, 19, 22, 0)),
            '3-1': SimpleNamespace(total_score=1650, effective_at=datetime(2026, 5, 19, 22, 0)),
            '1-9': SimpleNamespace(total_score=1350, effective_at=datetime(2026, 5, 19, 22, 0)),
        }

        rows = build_ranked_rows(latest_by_class)

        self.assertEqual(len(rows), 30)
        self.assertEqual(rows[0]['classId'], '2-7')
        self.assertEqual(rows[0]['rank'], 1)
        self.assertEqual(rows[1]['classId'], '3-1')
        self.assertEqual(rows[1]['rank'], 1)
        self.assertEqual(rows[2]['classId'], '1-9')
        self.assertEqual(rows[2]['rank'], 3)
        self.assertTrue(any(row['totalScore'] == 0 for row in rows))


if __name__ == '__main__':
    unittest.main()
