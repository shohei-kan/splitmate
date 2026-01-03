from django.db.models import Sum
from rest_framework import viewsets, filters
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Expense
from .serializers import ExpenseSerializer, MonthlySummarySerializer

import datetime
import calendar

class ExpenseViewSet(viewsets.ModelViewSet):
    """
    /api/expenses/ 用の基本 CRUD
    """

    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer

    # ひとまず簡単なソート・検索だけ
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = ["date", "amount", "created_at"]
    ordering = ["-date", "id"]
    search_fields = ["store", "memo"]


class MonthlySummaryView(APIView):
    """
    /api/summary/monthly/?year=YYYY&month=MM
    """

    def get(self, request, *args, **kwargs):
        today = datetime.date.today()
        try:
            year = int(request.query_params.get("year", today.year))
            month = int(request.query_params.get("month", today.month))
        except ValueError:
            year = today.year
            month = today.month

        first_day = datetime.date(year, month, 1)
        last_day = datetime.date(
            year,
            month,
            calendar.monthrange(year, month)[1],
        )

        qs = Expense.objects.filter(date__gte=first_day, date__lte=last_day)

        status = request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)

        shared_total = qs.filter(
            burden_type=Expense.BurdenType.SHARED
        ).aggregate(total=Sum("amount"))["total"] or 0

        wife_shared = qs.filter(
            burden_type=Expense.BurdenType.SHARED,
            card_user=Expense.CardUser.WIFE,
        ).aggregate(total=Sum("amount"))["total"] or 0

        wife_personal = qs.filter(
            burden_type=Expense.BurdenType.WIFE_ONLY
        ).aggregate(total=Sum("amount"))["total"] or 0

        me_only_total = qs.filter(
            burden_type=Expense.BurdenType.ME_ONLY
        ).aggregate(total=Sum("amount"))["total"] or 0

        half = shared_total // 2
        transfer_amount = half - wife_shared + wife_personal

        summary_data = {
            "year": year,
            "month": month,
            "shared_total": shared_total,
            "wife_shared": wife_shared,
            "wife_personal": wife_personal,
            "me_only_total": me_only_total,
            "half": half,
            "transfer_amount": transfer_amount,
        }

        serializer = MonthlySummarySerializer(summary_data)
        return Response(serializer.data)
