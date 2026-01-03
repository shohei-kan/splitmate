from rest_framework import serializers
from .models import Expense


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
        read_only_fields = ["id", "created_at", "updated_at"]


class MonthlySummarySerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    shared_total = serializers.IntegerField()
    wife_shared = serializers.IntegerField()
    wife_personal = serializers.IntegerField()
    me_only_total = serializers.IntegerField()
    half = serializers.IntegerField()
    transfer_amount = serializers.IntegerField()
