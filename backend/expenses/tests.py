

import datetime

from django.test import TestCase
from rest_framework.test import APIClient

from .models import AppSettings, Expense


class ExpensePatchRulesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.expense = Expense.objects.create(
            date=datetime.date(2026, 3, 1),
            store="Initial Store",
            card_user=Expense.CardUser.ME,
            payer=Expense.CardUser.ME,
            burden_type=Expense.BurdenType.SHARED,
            category=Expense.Category.UNCATEGORIZED,
            amount=1000,
            memo="initial",
            source=Expense.Source.CSV_RAKUTEN,
            status=Expense.Status.DRAFT,
        )

    def test_patch_cannot_update_source_or_status(self):
        res = self.client.patch(
            f"/api/expenses/{self.expense.id}/",
            {
                "source": Expense.Source.MANUAL,
                "status": Expense.Status.FINAL,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)

        self.expense.refresh_from_db()
        self.assertEqual(self.expense.source, Expense.Source.CSV_RAKUTEN)
        self.assertEqual(self.expense.status, Expense.Status.DRAFT)

    def test_patch_rejects_amount_zero(self):
        res = self.client.patch(
            f"/api/expenses/{self.expense.id}/",
            {"amount": 0},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("amount", res.data)

    def test_patch_accepts_category_burden_and_memo(self):
        res = self.client.patch(
            f"/api/expenses/{self.expense.id}/",
            {
                "category": Expense.Category.OTHER,
                "burden_type": Expense.BurdenType.WIFE_ONLY,
                "memo": "updated memo",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)

        self.expense.refresh_from_db()
        self.assertEqual(self.expense.category, Expense.Category.OTHER)
        self.assertEqual(self.expense.burden_type, Expense.BurdenType.WIFE_ONLY)
        self.assertEqual(self.expense.memo, "updated memo")


class SettingsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = "/api/settings/"

    def test_get_settings_auto_creates_singleton(self):
        self.assertEqual(AppSettings.objects.count(), 0)

        res = self.client.get(self.url)

        self.assertEqual(res.status_code, 200)
        self.assertIn("excluded_words", res.data)
        self.assertIn("highlight_threshold", res.data)
        self.assertEqual(AppSettings.objects.count(), 1)

    def test_put_settings_persists_and_is_returned_by_get(self):
        payload = {
            "excluded_words": ["Suica", "PASMO"],
            "highlight_threshold": 12000,
        }

        put_res = self.client.put(self.url, payload, format="json")
        self.assertEqual(put_res.status_code, 200)
        self.assertEqual(put_res.data["excluded_words"], payload["excluded_words"])
        self.assertEqual(put_res.data["highlight_threshold"], payload["highlight_threshold"])

        get_res = self.client.get(self.url)
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.data["excluded_words"], payload["excluded_words"])
        self.assertEqual(get_res.data["highlight_threshold"], payload["highlight_threshold"])

    def test_put_settings_rejects_highlight_threshold_less_than_one(self):
        res = self.client.put(
            self.url,
            {
                "excluded_words": ["A"],
                "highlight_threshold": 0,
            },
            format="json",
        )

        self.assertEqual(res.status_code, 400)
        self.assertIn("highlight_threshold", res.data)

    def test_put_settings_updates_existing_singleton_without_creating_new_one(self):
        AppSettings.objects.create(excluded_words=["old"], highlight_threshold=10000)
        self.assertEqual(AppSettings.objects.count(), 1)

        res = self.client.put(
            self.url,
            {"excluded_words": ["new"], "highlight_threshold": 15000},
            format="json",
        )

        self.assertEqual(res.status_code, 200)
        self.assertEqual(AppSettings.objects.count(), 1)


class StoreSuggestionsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = "/api/stores/suggestions/"

    def test_returns_manual_stores_grouped_and_sorted_by_count(self):
        Expense.objects.create(
            date=datetime.date(2026, 3, 1),
            store="オーケー",
            amount=1000,
            source=Expense.Source.MANUAL,
        )
        Expense.objects.create(
            date=datetime.date(2026, 3, 2),
            store="オーケー",
            amount=1200,
            source=Expense.Source.MANUAL,
        )
        Expense.objects.create(
            date=datetime.date(2026, 3, 3),
            store="西友",
            amount=800,
            source=Expense.Source.MANUAL,
        )
        Expense.objects.create(
            date=datetime.date(2026, 3, 4),
            store="CSV店舗",
            amount=500,
            source=Expense.Source.CSV_RAKUTEN,
        )

        res = self.client.get(self.url)

        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            res.data,
            {
                "stores": [
                    {"name": "オーケー", "count": 2},
                    {"name": "西友", "count": 1},
                ]
            },
        )


class MonthlyCategorySummaryApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = "/api/summary/monthly-by-category/"

    def test_returns_monthly_category_breakdown(self):
        Expense.objects.create(
            date=datetime.date(2026, 3, 1),
            store="A",
            amount=3000,
            category=Expense.Category.FOOD,
        )
        Expense.objects.create(
            date=datetime.date(2026, 3, 5),
            store="B",
            amount=1000,
            category=Expense.Category.FOOD,
        )
        Expense.objects.create(
            date=datetime.date(2026, 3, 6),
            store="C",
            amount=2000,
            category=Expense.Category.DAILY,
        )
        Expense.objects.create(
            date=datetime.date(2026, 2, 10),
            store="D",
            amount=9999,
            category=Expense.Category.OUTSIDE_FOOD,
        )

        res = self.client.get(self.url, {"month": "2026-03"})

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["month"], "2026-03")
        self.assertEqual(res.data["total_amount"], 6000)
        self.assertEqual(res.data["total_count"], 3)
        self.assertEqual(
            res.data["categories"],
            [
                {
                    "category": "food",
                    "label": "食費",
                    "amount": 4000,
                    "ratio": 66.7,
                    "count": 2,
                    "top_expenses": [
                        {"date": "2026-03-01", "store": "A", "amount": 3000},
                        {"date": "2026-03-05", "store": "B", "amount": 1000},
                    ],
                },
                {
                    "category": "daily",
                    "label": "日用品",
                    "amount": 2000,
                    "ratio": 33.3,
                    "count": 1,
                    "top_expenses": [
                        {"date": "2026-03-06", "store": "C", "amount": 2000},
                    ],
                },
            ],
        )

    def test_accepts_legacy_year_month_params(self):
        Expense.objects.create(
            date=datetime.date(2026, 4, 1),
            store="A",
            amount=500,
            category=Expense.Category.OTHER,
        )

        res = self.client.get(self.url, {"year": 2026, "month": 4})

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["month"], "2026-04")
        self.assertEqual(res.data["total_amount"], 500)

    def test_returns_top_expenses_descending_by_amount(self):
        Expense.objects.create(
            date=datetime.date(2026, 5, 1),
            store="",
            amount=1500,
            category=Expense.Category.FOOD,
        )
        Expense.objects.create(
            date=datetime.date(2026, 5, 2),
            store="High",
            amount=5000,
            category=Expense.Category.FOOD,
        )
        Expense.objects.create(
            date=datetime.date(2026, 5, 3),
            store="Mid",
            amount=3000,
            category=Expense.Category.FOOD,
        )

        res = self.client.get(self.url, {"month": "2026-05"})

        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            res.data["categories"][0]["top_expenses"],
            [
                {"date": "2026-05-02", "store": "High", "amount": 5000},
                {"date": "2026-05-03", "store": "Mid", "amount": 3000},
                {"date": "2026-05-01", "store": "（店名なし）", "amount": 1500},
            ],
        )


class YearlySummaryApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = "/api/summary/yearly/"

    def test_returns_yearly_summary_with_zero_filled_months(self):
        Expense.objects.create(
            date=datetime.date(2026, 1, 10),
            store="A",
            amount=3000,
            category=Expense.Category.FOOD,
        )
        Expense.objects.create(
            date=datetime.date(2026, 1, 20),
            store="B",
            amount=2000,
            category=Expense.Category.DAILY,
        )
        Expense.objects.create(
            date=datetime.date(2026, 2, 5),
            store="C",
            amount=4000,
            category=Expense.Category.FOOD,
        )
        Expense.objects.create(
            date=datetime.date(2025, 12, 25),
            store="Old",
            amount=9999,
            category=Expense.Category.OTHER,
        )

        res = self.client.get(self.url, {"year": 2026})

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["year"], 2026)
        self.assertEqual(res.data["total_amount"], 9000)
        self.assertEqual(res.data["average_monthly_amount"], 750)
        self.assertEqual(res.data["total_count"], 3)
        self.assertEqual(len(res.data["months"]), 12)
        self.assertEqual(res.data["months"][0]["month"], "2026-01")
        self.assertEqual(res.data["months"][1]["month"], "2026-02")
        self.assertEqual(res.data["months"][2]["month"], "2026-03")
        self.assertEqual(
            res.data["months"][0],
            {
                "month": "2026-01",
                "total_amount": 5000,
                "categories": [
                    {"category": "food", "label": "食費", "amount": 3000},
                    {"category": "daily", "label": "日用品", "amount": 2000},
                ],
            },
        )
        self.assertEqual(
            res.data["months"][1],
            {
                "month": "2026-02",
                "total_amount": 4000,
                "categories": [
                    {"category": "food", "label": "食費", "amount": 4000},
                ],
            },
        )
        self.assertEqual(
            res.data["months"][2],
            {"month": "2026-03", "total_amount": 0, "categories": []},
        )
