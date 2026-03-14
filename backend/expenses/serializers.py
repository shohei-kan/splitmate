from rest_framework import serializers
from .models import AppSettings, Expense, ExclusionRule, MonthlyLineNotification
import datetime  

class ExpenseSerializer(serializers.ModelSerializer):
    amount = serializers.IntegerField(min_value=1)

    class Meta:
        model = Expense
        fields = [
            "id",
            "date",
            "store",
            "card_user",
            "payer",
            "burden_type",
            "category",
            "amount",
            "memo",
            "source",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "source",
            "status",
            "created_at",
            "updated_at"
        ]

    def validate_store(self, value: str) -> str:
        store = value.strip()
        if not store:
            raise serializers.ValidationError("store は空にできません。")
        return store

#月別サマリー
class MonthlySummarySerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    shared_total = serializers.IntegerField()
    wife_shared = serializers.IntegerField()
    wife_personal = serializers.IntegerField()
    me_only_total = serializers.IntegerField()
    half = serializers.IntegerField()
    transfer_amount = serializers.IntegerField()


class MonthlySummaryListItemSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    shared_total = serializers.IntegerField()
    wife_shared = serializers.IntegerField()
    wife_personal = serializers.IntegerField()
    me_only_total = serializers.IntegerField()
    half = serializers.IntegerField()
    transfer_amount = serializers.IntegerField()

#年別サマリー（１２ヶ月分のリスト）
class MonthlySummaryListSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    status = serializers.CharField(allow_null=True)
    items = MonthlySummaryListItemSerializer(many=True)


class StoreSuggestionSerializer(serializers.Serializer):
    name = serializers.CharField()
    count = serializers.IntegerField()


class StoreSuggestionsResponseSerializer(serializers.Serializer):
    stores = StoreSuggestionSerializer(many=True)


class MonthlyCategoryTopExpenseSerializer(serializers.Serializer):
    date = serializers.DateField()
    store = serializers.CharField()
    amount = serializers.IntegerField()


class MonthlyCategoryBreakdownItemSerializer(serializers.Serializer):
    category = serializers.CharField()
    label = serializers.CharField()
    amount = serializers.IntegerField()
    ratio = serializers.FloatField()
    count = serializers.IntegerField()
    top_expenses = MonthlyCategoryTopExpenseSerializer(many=True)


class MonthlyCategorySummarySerializer(serializers.Serializer):
    month = serializers.CharField()
    total_amount = serializers.IntegerField()
    total_count = serializers.IntegerField()
    categories = MonthlyCategoryBreakdownItemSerializer(many=True)


class YearlySummaryCategorySerializer(serializers.Serializer):
    category = serializers.CharField()
    label = serializers.CharField()
    amount = serializers.IntegerField()


class YearlySummaryMonthSerializer(serializers.Serializer):
    month = serializers.CharField()
    total_amount = serializers.IntegerField()
    categories = YearlySummaryCategorySerializer(many=True)


class YearlySummarySerializer(serializers.Serializer):
    year = serializers.IntegerField()
    total_amount = serializers.IntegerField()
    average_monthly_amount = serializers.IntegerField()
    total_count = serializers.IntegerField()
    months = YearlySummaryMonthSerializer(many=True)


class MonthStatusUpdateSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    status = serializers.ChoiceField(choices=Expense.Status.choices)

    def validate(self, attrs):
        year = attrs["year"]
        month = attrs["month"]

        # year / month が変な値じゃないかチェック
        try:
            datetime.date(year, month, 1)
        except ValueError:
            raise serializers.ValidationError("year / month が不正です。")

        return attrs
    
    
class ExclusionRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExclusionRule
        fields = [
            "id",
            "keyword",
            "target_source",
            "is_active",
            "memo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]    


class AppSettingsSerializer(serializers.ModelSerializer):
    excluded_words = serializers.ListField(
        child=serializers.CharField(allow_blank=False),
        required=False,
    )
    highlight_threshold = serializers.IntegerField(min_value=1, required=False)

    class Meta:
        model = AppSettings
        fields = [
            "excluded_words",
            "highlight_threshold",
        ]


class MonthlyLineNotificationSerializer(serializers.ModelSerializer):
    is_sent = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyLineNotification
        fields = [
            "month",
            "is_sent",
            "last_sent_at",
            "send_count",
        ]

    def get_is_sent(self, obj):
        return obj.last_sent_at is not None


class MonthlyLineNotifyRequestSerializer(serializers.Serializer):
    month = serializers.RegexField(r"^\d{4}-\d{2}$")


class MonthlyLineNotifyResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    month = serializers.CharField()
    sent = serializers.BooleanField()
    last_sent_at = serializers.DateTimeField(allow_null=True)
    send_count = serializers.IntegerField()
