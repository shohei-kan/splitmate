

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
