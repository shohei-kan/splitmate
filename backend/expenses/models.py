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
    
    class Category(models.TextChoices):
        UNCATEGORIZED = "uncategorized", "未分類"
        FOOD = "food", "食費"
        DAILY = "daily", "日用品"
        OUTSIDE_FOOD = "outside_food", "外食"
        UTILITY = "utility", "光熱費"
        HOBBY = "travel", "旅行"
        OTHER = "other", "その他"

    class Source(models.TextChoices):
        CSV_RAKUTEN = "csv_rakuten", "CSV (Rakuten)"
        CSV_MITSUI = "csv_mitsui", "CSV (Mitsui)"
        MANUAL = "manual", "Manual"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        FINAL = "final", "Final"

    date = models.DateField()
    store = models.CharField(max_length=255)

    # 👇 UIの「カード利用者」＝誰が使ったか（買い物した人）
    card_user = models.CharField(
        max_length=10,
        choices=CardUser.choices,
        blank=True,
        null=True,
        default=CardUser.UNKNOWN,
        help_text="誰がこの支出を使ったか（UI表示用）",
    )

    # 👇 実際に支払った人（カード or 現金）。精算ロジックは基本こちらを見る
    payer = models.CharField(
        max_length=10,
        choices=CardUser.choices,
        default=CardUser.ME,
        help_text="実際に支払った人（精算ロジック用）",
    )

    burden_type = models.CharField(
        max_length=20,
        choices=BurdenType.choices,
        default=BurdenType.SHARED,
    )

    category = models.CharField(
        max_length=32,
        choices=Category.choices,
        default=Category.UNCATEGORIZED,
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


class ExclusionRule(models.Model):
    """
    店名に含まれるキーワードで、CSV インポート時の行を除外するためのルール。
    """

    class TargetSource(models.TextChoices):
        ALL = "all", "All sources"
        CSV_RAKUTEN = Expense.Source.CSV_RAKUTEN
        CSV_MITSUI = Expense.Source.CSV_MITSUI

    keyword = models.CharField(
        max_length=255,
        help_text="店名にこの文字列が含まれていたら除外します",
    )
    target_source = models.CharField(
        max_length=20,
        choices=TargetSource.choices,
        default=TargetSource.ALL,
        help_text="どのソースに適用するか。all なら全 CSV に適用。",
    )
    is_active = models.BooleanField(default=True)
    memo = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["keyword", "id"]

    def __str__(self) -> str:
        return f"[{self.target_source}] {self.keyword}"