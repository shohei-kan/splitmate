import datetime
import calendar

from django.db.models import Sum
from rest_framework import viewsets, filters, parsers, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import AppSettings, Expense, ExclusionRule
from .serializers import (
    ExpenseSerializer,
    MonthlySummarySerializer,
    MonthStatusUpdateSerializer,
    MonthlyCategorySummarySerializer,
    MonthlySummaryListSerializer,
    ExclusionRuleSerializer,
    AppSettingsSerializer,
    )
from .importers import import_rakuten_csv, import_mitsui_csv


def _get_or_create_app_settings() -> AppSettings:
    settings = AppSettings.objects.order_by("id").first()
    if settings:
        return settings
    return AppSettings.objects.create()


class ExpenseViewSet(viewsets.ModelViewSet):
    """
    /api/expenses/ 用の基本 CRUD + フィルタ

    クエリパラメータ例:
      - year, month: 年月指定
          /api/expenses/?year=2025&month=12

      - date_from, date_to: 日付範囲
          /api/expenses/?date_from=2025-12-01&date_to=2025-12-31

      - status: draft / final
          /api/expenses/?status=draft

      - source: csv_rakuten / csv_mitsui / manual
          /api/expenses/?source=csv_rakuten

      - burden_type: shared / wife_only / me_only
          /api/expenses/?burden_type=shared

      - card_user: me / wife / unknown
          /api/expenses/?card_user=wife

      - category: food / daily / outside_food / utility / travel / other / uncategorized
          /api/expenses/?category=travel

      - search: store / memo の部分一致（DRF SearchFilter）
          /api/expenses/?search=イオン
    """

    serializer_class = ExpenseSerializer
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = ["date", "amount", "created_at"]
    ordering = ["-date", "id"]
    search_fields = ["store", "memo"]

    def get_queryset(self):
        qs = Expense.objects.all()
        params = self.request.query_params

        # --- year & month で絞り込み（UIの「対象月」で使う想定） ---
        year = params.get("year")
        month = params.get("month")

        if year and month:
            try:
                year_i = int(year)
                month_i = int(month)

                first_day = datetime.date(year_i, month_i, 1)
                # 月末日を求める
                if month_i == 12:
                    last_day = datetime.date(year_i + 1, 1, 1) - datetime.timedelta(days=1)
                else:
                    last_day = datetime.date(year_i, month_i + 1, 1) - datetime.timedelta(days=1)

                qs = qs.filter(date__gte=first_day, date__lte=last_day)
            except ValueError:
                # 変な値が来たら year/month フィルタは無視
                pass

        # --- date_from / date_to で範囲指定 ---
        date_from = params.get("date_from")
        date_to = params.get("date_to")

        if date_from:
            try:
                qs = qs.filter(date__gte=datetime.date.fromisoformat(date_from))
            except ValueError:
                pass

        if date_to:
            try:
                qs = qs.filter(date__lte=datetime.date.fromisoformat(date_to))
            except ValueError:
                pass

        # --- status フィルタ（draft / final） ---
        status_value = params.get("status")
        if status_value in dict(Expense.Status.choices):
            qs = qs.filter(status=status_value)

        # --- source フィルタ（csv_rakuten / csv_mitsui / manual） ---
        source = params.get("source")
        if source in dict(Expense.Source.choices):
            qs = qs.filter(source=source)

        # --- burden_type フィルタ（shared / wife_only / me_only） ---
        burden_type = params.get("burden_type")
        if burden_type in dict(Expense.BurdenType.choices):
            qs = qs.filter(burden_type=burden_type)

        # --- card_user フィルタ（me / wife / unknown） ---
        card_user = params.get("card_user")
        if card_user in dict(Expense.CardUser.choices):
            qs = qs.filter(card_user=card_user)

        # --- category フィルタ（food / travel など） ---
        category = params.get("category")
        if category in dict(Expense.Category.choices):
            qs = qs.filter(category=category)

        return qs

    def perform_create(self, serializer):
        """
        手入力で作成されたレコードは source を必ず 'manual' に固定。
        （CSV インポートは別経路で作成しているので影響なし）
        """
        serializer.save(source=Expense.Source.MANUAL)


#月別サマリー
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

        # ② 妻が払った共有分（payer=wife）
        #    → 実際にお金を払った人ベースで集計する
        wife_shared = (
            qs.filter(
                burden_type=Expense.BurdenType.SHARED,
                payer=Expense.CardUser.WIFE,
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
    
#年別サマリー
class MonthlySummaryListView(APIView):
    """
    GET /api/summary/monthly-list/?year=YYYY&status=draft|final

    指定した年の「1〜12月」の月次サマリを配列で返す。
    status を指定すると draft/final でフィルタできる。
    データがない月も 0 で返す。
    """

    def get(self, request, *args, **kwargs):
        today = datetime.date.today()
        params = request.query_params

        try:
            year = int(params.get("year", today.year))
        except ValueError:
            year = today.year

        status_value = params.get("status")
        if status_value not in dict(Expense.Status.choices):
            status_value = None  # 不正な値は無視

        items = []

        for month in range(1, 13):
            first_day = datetime.date(year, month, 1)
            if month == 12:
                last_day = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
            else:
                last_day = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)

            qs = Expense.objects.filter(date__gte=first_day, date__lte=last_day)

            if status_value:
                qs = qs.filter(status=status_value)

            shared_total = qs.filter(
                burden_type=Expense.BurdenType.SHARED
            ).aggregate(total=Sum("amount"))["total"] or 0

            wife_shared = qs.filter(
                burden_type=Expense.BurdenType.SHARED,
                payer=Expense.CardUser.WIFE,
            ).aggregate(total=Sum("amount"))["total"] or 0

            wife_personal = qs.filter(
                burden_type=Expense.BurdenType.WIFE_ONLY
            ).aggregate(total=Sum("amount"))["total"] or 0

            me_only_total = qs.filter(
                burden_type=Expense.BurdenType.ME_ONLY
            ).aggregate(total=Sum("amount"))["total"] or 0

            half = shared_total // 2
            transfer_amount = half - wife_shared + wife_personal

            items.append(
                {
                    "year": year,
                    "month": month,
                    "shared_total": shared_total,
                    "wife_shared": wife_shared,
                    "wife_personal": wife_personal,
                    "me_only_total": me_only_total,
                    "half": half,
                    "transfer_amount": transfer_amount,
                }
            )

        summary = {
            "year": year,
            "status": status_value,
            "items": items,
        }

        serializer = MonthlySummaryListSerializer(summary)
        return Response(serializer.data)


class RakutenCSVImportView(APIView):
    """
    POST /api/import/rakuten/?card_user=me|wife

    楽天カードのCSVファイルをアップロードして Expense に取り込む。
    利用者列から本⼈/家族を判定して card_user を設定する。
    """

    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request, *args, **kwargs):
        file = request.FILES.get("file")
        if not file:
            return Response(
                {"detail": "file を multipart/form-data で送ってください"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # クエリで渡された card_user は「利用者が空欄だったときのデフォルト」として使う
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

        try:
            (
                created,
                skipped,
                excluded_samples,
                excluded_count,
                duplicate_count,
                created_samples,
                skipped_samples,
                duplicate_samples,
            ) = import_rakuten_csv(
                file, default_card_user=default_card_user
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "created": created,
                "skipped": skipped,
                "default_card_user": default_card_user,
                "source": Expense.Source.CSV_RAKUTEN,
                "excluded_samples": excluded_samples,
                "excluded_count": excluded_count,
                "duplicate_count": duplicate_count,
                "created_samples": created_samples,
                "skipped_samples": skipped_samples,
                "duplicate_samples": duplicate_samples,
            },
            status=status.HTTP_201_CREATED,
        )
        
class MitsuiCSVImportView(APIView):
    """
    POST /api/import/mitsui/?card_user=me|wife

    三井住友カードのCSVファイルをアップロードして Expense に取り込む。
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
            "card_user", Expense.CardUser.ME
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

        try:
            (
                created,
                skipped,
                excluded_samples,
                excluded_count,
                duplicate_count,
                created_samples,
                skipped_samples,
                duplicate_samples,
            ) = import_mitsui_csv(file, card_user=card_user)
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "created": created,
                "skipped": skipped,
                "card_user": card_user,
                "source": Expense.Source.CSV_MITSUI,
                "excluded_samples": excluded_samples,
                "excluded_count": excluded_count,
                "duplicate_count": duplicate_count,
                "created_samples": created_samples,
                "skipped_samples": skipped_samples,
                "duplicate_samples": duplicate_samples,
            },
            status=status.HTTP_201_CREATED,
        )

#CSVの除外ワード用
class ExclusionRuleViewSet(viewsets.ModelViewSet):
    """
    /api/exclusion-rules/ 用の CRUD.
    """

    queryset = ExclusionRule.objects.all()
    serializer_class = ExclusionRuleSerializer

    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = ["keyword", "created_at"]
    ordering = ["keyword", "id"]
    search_fields = ["keyword", "memo"]


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


class MonthlyCategorySummaryView(APIView):
    """
    GET /api/summary/monthly-by-category/?year=YYYY&month=MM&status=draft|final

    指定した年月の支出をカテゴリ別に集計して返す。
    status を指定すると draft/final でフィルタできる。
    """

    def get(self, request, *args, **kwargs):
        today = datetime.date.today()
        params = request.query_params

        try:
            year = int(params.get("year", today.year))
            month = int(params.get("month", today.month))
        except ValueError:
            year = today.year
            month = today.month

        # 対象月の1日〜末日
        first_day = datetime.date(year, month, 1)
        if month == 12:
            last_day = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
        else:
            last_day = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)

        qs = Expense.objects.filter(date__gte=first_day, date__lte=last_day)

        # draft/final で絞る（指定なしなら両方）
        status_value = params.get("status")
        if status_value in dict(Expense.Status.choices):
            qs = qs.filter(status=status_value)
        else:
            status_value = None  # 応答用

        # category × burden_type ごとの合計をまとめて1クエリで取得
        rows = (
            qs.values("category", "burden_type")
            .annotate(total=Sum("amount"))
            .order_by("category", "burden_type")
        )

        # カテゴリごとに合算
        category_map = {}
        for row in rows:
            category = row["category"] or Expense.Category.UNCATEGORIZED
            burden_type = row["burden_type"]
            total = row["total"] or 0

            if category not in category_map:
                category_map[category] = {
                    "shared_total": 0,
                    "wife_only_total": 0,
                    "me_only_total": 0,
                }

            if burden_type == Expense.BurdenType.SHARED:
                category_map[category]["shared_total"] += total
            elif burden_type == Expense.BurdenType.WIFE_ONLY:
                category_map[category]["wife_only_total"] += total
            elif burden_type == Expense.BurdenType.ME_ONLY:
                category_map[category]["me_only_total"] += total

        # Category TextChoices からラベル解決
        category_label_map = {c.value: c.label for c in Expense.Category}

        items = []
        for category, data in category_map.items():
            shared_total = data["shared_total"]
            wife_only_total = data["wife_only_total"]
            me_only_total = data["me_only_total"]
            total = shared_total + wife_only_total + me_only_total

            items.append(
                {
                    "category": category,
                    "category_label": category_label_map.get(
                        category, category
                    ),
                    "shared_total": shared_total,
                    "wife_only_total": wife_only_total,
                    "me_only_total": me_only_total,
                    "total": total,
                }
            )

        # カテゴリコード順でソートしておく（UI側で並べ替えてもOK）
        items.sort(key=lambda x: x["category"])

        summary = {
            "year": year,
            "month": month,
            "status": status_value,
            "items": items,
        }

        serializer = MonthlyCategorySummarySerializer(summary)
        return Response(serializer.data)


class AppSettingsView(APIView):
    """
    GET /api/settings/
    PUT /api/settings/
    """

    def get(self, request, *args, **kwargs):
        settings = _get_or_create_app_settings()
        serializer = AppSettingsSerializer(settings)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, *args, **kwargs):
        settings = _get_or_create_app_settings()
        serializer = AppSettingsSerializer(settings, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
