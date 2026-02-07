import datetime
import calendar

from django.db.models import Sum
from rest_framework import viewsets, filters, parsers, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Expense
from .serializers import (ExpenseSerializer, MonthlySummarySerializer, MonthStatusUpdateSerializer,)
from .importers import import_rakuten_csv, import_mitsui_csv


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
    
    #手入力
    def perform_create(self, serializer):
        """
        手入力で作成されたレコードは source を必ず 'manual' に固定。
        （CSV インポートは別経路で作成しているので影響なし）
        """
        serializer.save(source=Expense.Source.MANUAL)


class MonthlySummaryView(APIView):
    """
    GET /api/summary/monthly/?year=YYYY&month=MM[&status=draft|final]

    月単位の精算サマリを返す。

    - shared_total : 共有支出の合計
    - wife_shared  : 妻が支払った共有支出（payer=wife）の合計
    - wife_personal: 妻の個人利用 (burden_type=wife_only)
    - me_only_total: 自分の個人利用 (burden_type=me_only)
    - half         : shared_total の折半額（floor）
    - transfer_amount: 妻→私 への振込額
                       = half - wife_shared + wife_personal
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

        # draft / final で絞り込みたいとき用 (オプション)
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        # ① 共有支出合計（誰が払ったかは関係なく shared だけ全部）
        shared_total = (
            qs.filter(burden_type=Expense.BurdenType.SHARED)
            .aggregate(total=Sum("amount"))["total"]
            or 0
        )

        # ② 妻が払った共有分（手入力＋card_user=wife）
        #    → 妻の現金/妻名義カードで払った共有支出だけをここに積むイメージ
        wife_shared = (
            qs.filter(
                burden_type=Expense.BurdenType.SHARED,
                source=Expense.Source.MANUAL,
                card_user=Expense.CardUser.WIFE,
            )
            .aggregate(total=Sum("amount"))["total"]
            or 0
        )

        # ③ 妻の個人利用
        #    burden_type=wife_only は、CSV でも手入力でも全部カウント
        wife_personal = (
            qs.filter(burden_type=Expense.BurdenType.WIFE_ONLY)
            .aggregate(total=Sum("amount"))["total"]
            or 0
        )

        # ④ 私個人の支出（参考用）
        me_only_total = (
            qs.filter(burden_type=Expense.BurdenType.ME_ONLY)
            .aggregate(total=Sum("amount"))["total"]
            or 0
        )

        # ⑤ 折半額＆振込額
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
    
    
class RakutenCSVImportView(APIView):
    """
    POST /api/import/rakuten/?card_user=me|wife|unknown

    楽天カードのCSVファイルをアップロードして Expense に取り込む。

    - burden_type はすべて shared
    - payer は「請求はすべて自分持ち」前提で backend 側で me 固定
    - CSV の「利用者」は UI のカード利用者 (card_user=me|wife) として保存
    - クエリの card_user は「CSV側で利用者が空欄だったケースのデフォルト値」
    """

    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request, *args, **kwargs):
        file = request.FILES.get("file")
        if not file:
            return Response(
                {"detail": "file を multipart/form-data で送ってください"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 利用者列が空欄のときのデフォルト card_user
        default_card_user = request.query_params.get(
            "card_user", Expense.CardUser.UNKNOWN
        )

        if default_card_user not in (
            Expense.CardUser.ME,
            Expense.CardUser.WIFE,
            Expense.CardUser.UNKNOWN,
        ):
            return Response(
                {"detail": "card_user は me / wife / unknown のいずれかにしてください"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created, skipped = import_rakuten_csv(
            file,
            default_card_user=default_card_user,
        )

        return Response(
            {
                "created": created,
                "skipped": skipped,
                "default_card_user": default_card_user,
                "source": Expense.Source.CSV_RAKUTEN,
            },
            status=status.HTTP_201_CREATED,
        )


class MitsuiCSVImportView(APIView):
    """
    POST /api/import/mitsui/?card_user=me|wife|unknown

    三井住友カードのCSVファイルをアップロードして Expense に取り込む。

    - A列: 日付
    - B列+G列: 利用店名
    - C列: 利用金額
    - 利用者カラムは無いので、card_user はクエリの値
      (デフォルトは me)
    - payer も「三井の請求は自分のカード」前提で backend 側で me 固定
    """

    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request, *args, **kwargs):
        file = request.FILES.get("file")
        if not file:
            return Response(
                {"detail": "file を multipart/form-data で送ってください"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        card_user = request.query_params.get(
            "card_user",
            Expense.CardUser.ME,
        )

        if card_user not in (
            Expense.CardUser.ME,
            Expense.CardUser.WIFE,
            Expense.CardUser.UNKNOWN,
        ):
            return Response(
                {"detail": "card_user は me / wife / unknown のいずれかにしてください"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created, skipped = import_mitsui_csv(
            file,
            card_user=card_user,
        )

        return Response(
            {
                "created": created,
                "skipped": skipped,
                "card_user": card_user,
                "source": Expense.Source.CSV_MITSUI,
            },
            status=status.HTTP_201_CREATED,
        )

class MonthStatusUpdateView(APIView):
    """
    POST /api/month/status/

    指定した year/month に含まれる Expense の status を
    draft / final にまとめて更新する。
    """

    def post(self, request, *args, **kwargs):
        serializer = MonthStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        year = serializer.validated_data["year"]
        month = serializer.validated_data["month"]
        status_value = serializer.validated_data["status"]

        first_day = datetime.date(year, month, 1)
        last_day = datetime.date(
            year,
            month,
            calendar.monthrange(year, month)[1],
        )

        qs = Expense.objects.filter(date__gte=first_day, date__lte=last_day)
        updated = qs.update(status=status_value)

        return Response(
            {
                "year": year,
                "month": month,
                "status": status_value,
                "updated": updated,
            },
            status=status.HTTP_200_OK,
        )