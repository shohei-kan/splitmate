from rest_framework import serializers
from .models import Expense, ExclusionRule
import datetime  

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = [
            "id",
            "date",
            "store",
            "card_user",
            "burden_type",
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


class MonthlySummarySerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    shared_total = serializers.IntegerField()
    wife_shared = serializers.IntegerField()
    wife_personal = serializers.IntegerField()
    me_only_total = serializers.IntegerField()
    half = serializers.IntegerField()
    transfer_amount = serializers.IntegerField()

import datetime  # もしまだ上に無ければ追加

from rest_framework import serializers

from .models import Expense


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
    
