from rest_framework import viewsets
from rest_framework import filters

from .models import Expense
from .serializers import ExpenseSerializer


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
