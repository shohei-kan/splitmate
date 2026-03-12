

import datetime

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Expense


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
