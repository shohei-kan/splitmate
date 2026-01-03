from django.db import models


class Expense(models.Model):
    class CardUser(models.TextChoices):
        ME = "me", "Me"
        WIFE = "wife", "Wife"
        UNKNOWN = "unknown", "Unknown"

    class BurdenType(models.TextChoices):
        SHARED = "shared", "Shared"
        WIFE_ONLY = "wife_only", "Wife only"
        ME_ONLY = "me_only", "Me only"

    class Source(models.TextChoices):
        CSV_RAKUTEN = "csv_rakuten", "CSV (Rakuten)"
        CSV_MITSUI = "csv_mitsui", "CSV (Mitsui)"
        MANUAL = "manual", "Manual"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        FINAL = "final", "Final"

    date = models.DateField()
    store = models.CharField(max_length=255)

    card_user = models.CharField(
        max_length=10,
        choices=CardUser.choices,
        default=CardUser.UNKNOWN,
    )

    burden_type = models.CharField(
        max_length=20,
        choices=BurdenType.choices,
        default=BurdenType.SHARED,
    )

    amount = models.PositiveIntegerField()

    memo = models.TextField(blank=True)

    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
    )

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "id"]

    def __str__(self) -> str:
        return f"{self.date} {self.store} {self.amount}"
