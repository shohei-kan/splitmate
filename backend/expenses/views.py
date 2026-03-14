import datetime
import calendar
import base64
import hashlib
import hmac
import json
import logging
from urllib import error as urllib_error
from urllib import request as urllib_request

from django.conf import settings
from django.db import OperationalError, ProgrammingError
from django.db.models import Sum, Count
from django.utils import timezone
from rest_framework import viewsets, filters, parsers, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import AppSettings, Expense, ExclusionRule, MonthlyLineNotification
from .serializers import (
    ExpenseSerializer,
    MonthlySummarySerializer,
    MonthStatusUpdateSerializer,
    MonthlyCategorySummarySerializer,
    MonthlySummaryListSerializer,
    YearlySummarySerializer,
    StoreSuggestionsResponseSerializer,
    ExclusionRuleSerializer,
    AppSettingsSerializer,
    MonthlyLineNotificationSerializer,
    MonthlyLineNotifyRequestSerializer,
    MonthlyLineNotifyResponseSerializer,
    )
from .importers import import_rakuten_csv, import_mitsui_csv

logger = logging.getLogger(__name__)


def _get_or_create_app_settings() -> AppSettings:
    settings = AppSettings.objects.order_by("id").first()
    if settings:
        return settings
    return AppSettings.objects.create()


def _resolve_year_month(params):
    month_param = params.get("month")
    if month_param:
        try:
            parsed = datetime.date.fromisoformat(f"{month_param}-01")
            return parsed.year, parsed.month
        except ValueError:
            pass

    today = datetime.date.today()
    try:
        year = int(params.get("year", today.year))
        month = int(params.get("month", today.month))
        datetime.date(year, month, 1)
        return year, month
    except ValueError:
        return today.year, today.month


def _verify_line_signature(body: bytes, signature: str) -> bool:
    if not settings.LINE_CHANNEL_SECRET:
        logger.warning("LINE webhook rejected because LINE_CHANNEL_SECRET is not configured")
        return False

    expected_signature = base64.b64encode(
        hmac.new(
            settings.LINE_CHANNEL_SECRET.encode("utf-8"),
            body,
            hashlib.sha256,
        ).digest()
    ).decode("utf-8")
    return hmac.compare_digest(expected_signature, signature)


def _build_monthly_summary(year: int, month: int, status_filter=None):
    first_day = datetime.date(year, month, 1)
    last_day = datetime.date(
        year,
        month,
        calendar.monthrange(year, month)[1],
    )

    qs = Expense.objects.filter(date__gte=first_day, date__lte=last_day)
    if status_filter:
        qs = qs.filter(status=status_filter)

    shared_total = (
        qs.filter(burden_type=Expense.BurdenType.SHARED)
        .aggregate(total=Sum("amount"))["total"]
        or 0
    )
    wife_shared = (
        qs.filter(
            burden_type=Expense.BurdenType.SHARED,
            payer=Expense.CardUser.WIFE,
        )
        .aggregate(total=Sum("amount"))["total"]
        or 0
    )
    wife_personal = (
        qs.filter(burden_type=Expense.BurdenType.WIFE_ONLY)
        .aggregate(total=Sum("amount"))["total"]
        or 0
    )
    me_only_total = (
        qs.filter(burden_type=Expense.BurdenType.ME_ONLY)
        .aggregate(total=Sum("amount"))["total"]
        or 0
    )
    half = shared_total // 2
    transfer_amount = half - wife_shared + wife_personal

    return {
        "year": year,
        "month": month,
        "shared_total": shared_total,
        "wife_shared": wife_shared,
        "wife_personal": wife_personal,
        "me_only_total": me_only_total,
        "half": half,
        "transfer_amount": transfer_amount,
    }


def _build_home_month_url(request, month_key: str):
    origin = request.headers.get("Origin")
    if origin:
        return f"{origin.rstrip('/')}/?month={month_key}"
    return request.build_absolute_uri(f"/?month={month_key}")


def _build_line_monthly_message(request, month_key: str, transfer_amount: int):
    parsed = datetime.date.fromisoformat(f"{month_key}-01")
    return "\n".join(
        [
            f"{parsed.year}年{parsed.month}月分の入力が完了しました。",
            f"振込額：¥{transfer_amount:,}",
            "内容を確認して、未入力があれば追加入力をお願いします。",
            "問題なければ、振り込みもお願いします。",
            _build_home_month_url(request, month_key),
        ]
    )


def _send_line_push_message(group_id: str, text: str):
    payload = json.dumps(
        {
            "to": group_id,
            "messages": [{"type": "text", "text": text}],
        }
    ).encode("utf-8")
    req = urllib_request.Request(
        "https://api.line.me/v2/bot/message/push",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.LINE_CHANNEL_ACCESS_TOKEN}",
        },
        method="POST",
    )
    with urllib_request.urlopen(req, timeout=10) as response:
        response.read()


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


class StoreSuggestionsView(APIView):
    """
    GET /api/stores/suggestions/

    手入力で作成された expense から店名候補を返す。
    """

    def get(self, request, *args, **kwargs):
        rows = (
            Expense.objects.filter(source=Expense.Source.MANUAL)
            .exclude(store="")
            .values("store")
            .annotate(count=Count("id"))
            .order_by("-count", "store")[:20]
        )

        data = {
            "stores": [
                {"name": row["store"], "count": row["count"]}
                for row in rows
                if row["store"].strip()
            ]
        }
        serializer = StoreSuggestionsResponseSerializer(data)
        return Response(serializer.data)


class LineWebhookView(APIView):
    """
    POST /api/integrations/line/webhook/

    LINE webhook を最小限で受け、署名検証後に groupId をログへ出す。
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request, *args, **kwargs):
        signature = request.headers.get("X-Line-Signature", "")
        if not signature:
            return Response({"detail": "Missing X-Line-Signature header"}, status=status.HTTP_400_BAD_REQUEST)

        body = request.body
        if not _verify_line_signature(body, signature):
            return Response({"detail": "Invalid LINE signature"}, status=status.HTTP_403_FORBIDDEN)

        try:
            payload = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return Response({"detail": "Invalid JSON body"}, status=status.HTTP_400_BAD_REQUEST)

        for event in payload.get("events", []):
            source = event.get("source") or {}
            group_id = source.get("groupId")
            if group_id:
                logger.info(
                    "LINE webhook groupId detected: %s (event_type=%s)",
                    group_id,
                    event.get("type", "unknown"),
                )

        return Response({"ok": True}, status=status.HTTP_200_OK)


class MonthlyLineNotifyView(APIView):
    """
    POST /api/integrations/line/notify-monthly/
    """

    def post(self, request, *args, **kwargs):
        serializer = MonthlyLineNotifyRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        month_key = serializer.validated_data["month"]
        parsed = datetime.date.fromisoformat(f"{month_key}-01")

        if not settings.LINE_GROUP_ID:
            return Response({"detail": "LINE_GROUP_ID is not configured"}, status=status.HTTP_400_BAD_REQUEST)
        if not settings.LINE_CHANNEL_ACCESS_TOKEN:
            return Response(
                {"detail": "LINE_CHANNEL_ACCESS_TOKEN is not configured"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        summary = _build_monthly_summary(parsed.year, parsed.month)
        message = _build_line_monthly_message(request, month_key, summary["transfer_amount"])

        try:
            _send_line_push_message(settings.LINE_GROUP_ID, message)
        except urllib_error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            return Response(
                {"detail": f"LINE push failed: {detail or exc.reason}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except urllib_error.URLError as exc:
            return Response(
                {"detail": f"LINE push failed: {exc.reason}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            notification, _created = MonthlyLineNotification.objects.get_or_create(month=month_key)
            notification.last_sent_at = timezone.now()
            notification.send_count += 1
            notification.save(update_fields=["last_sent_at", "send_count", "updated_at"])
        except (ProgrammingError, OperationalError):
            return Response(
                {"detail": "LINE notification table is not ready. Run migrations first."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        response_serializer = MonthlyLineNotifyResponseSerializer(
            {
                "ok": True,
                "month": notification.month,
                "sent": True,
                "last_sent_at": notification.last_sent_at,
                "send_count": notification.send_count,
            }
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class MonthlyLineNotifyStatusView(APIView):
    """
    GET /api/integrations/line/notify-monthly-status/?month=YYYY-MM
    """

    def get(self, request, *args, **kwargs):
        serializer = MonthlyLineNotifyRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        month_key = serializer.validated_data["month"]

        try:
            notification = MonthlyLineNotification.objects.filter(month=month_key).first()
        except (ProgrammingError, OperationalError):
            logger.warning("MonthlyLineNotification table is not ready; returning unsent status")
            return Response(
                {
                    "month": month_key,
                    "is_sent": False,
                    "last_sent_at": None,
                    "send_count": 0,
                },
                status=status.HTTP_200_OK,
            )
        if not notification:
            return Response(
                {
                    "month": month_key,
                    "is_sent": False,
                    "last_sent_at": None,
                    "send_count": 0,
                },
                status=status.HTTP_200_OK,
            )

        return Response(MonthlyLineNotificationSerializer(notification).data, status=status.HTTP_200_OK)


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

        # draft / final で絞り込みたいとき用 (オプション)
        status_filter = request.query_params.get("status")
        summary_data = _build_monthly_summary(year, month, status_filter=status_filter)

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
    GET /api/summary/monthly-by-category/?month=YYYY-MM
    GET /api/summary/monthly-by-category/?year=YYYY&month=MM

    指定した年月の支出をカテゴリ別に集計して返す。
    """

    def get(self, request, *args, **kwargs):
        params = request.query_params
        year, month = _resolve_year_month(params)

        # 対象月の1日〜末日
        first_day = datetime.date(year, month, 1)
        if month == 12:
            last_day = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
        else:
            last_day = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)

        qs = Expense.objects.filter(date__gte=first_day, date__lte=last_day)
        total_amount = qs.aggregate(total=Sum("amount"))["total"] or 0
        total_count = qs.count()

        rows = (
            qs.values("category")
            .annotate(amount=Sum("amount"), count=Count("id"))
            .order_by("-amount", "category")
        )

        category_label_map = {c.value: c.label for c in Expense.Category}
        categories = []
        for row in rows:
            amount = row["amount"] or 0
            if amount <= 0:
                continue
            category = row["category"] or Expense.Category.UNCATEGORIZED
            ratio = round((amount / total_amount) * 100, 1) if total_amount > 0 else 0.0
            top_expenses = list(
                qs.filter(category=category)
                .order_by("-amount", "-date", "id")[:5]
                .values("date", "store", "amount")
            )
            categories.append(
                {
                    "category": category,
                    "label": category_label_map.get(category, category),
                    "amount": amount,
                    "ratio": ratio,
                    "count": row["count"],
                    "top_expenses": [
                        {
                            "date": expense["date"],
                            "store": expense["store"].strip() if expense["store"].strip() else "（店名なし）",
                            "amount": expense["amount"],
                        }
                        for expense in top_expenses
                    ],
                }
            )

        summary = {
            "month": f"{year:04d}-{month:02d}",
            "total_amount": total_amount,
            "total_count": total_count,
            "categories": categories,
        }

        serializer = MonthlyCategorySummarySerializer(summary)
        return Response(serializer.data)


class YearlySummaryView(APIView):
    """
    GET /api/summary/yearly/?year=YYYY

    指定年の月別総支出とカテゴリ別内訳を返す。
    """

    def get(self, request, *args, **kwargs):
        today = datetime.date.today()
        try:
            year = int(request.query_params.get("year", today.year))
        except ValueError:
            year = today.year

        first_day = datetime.date(year, 1, 1)
        last_day = datetime.date(year, 12, 31)
        qs = Expense.objects.filter(date__gte=first_day, date__lte=last_day)

        rows = (
            qs.values("date__month", "category")
            .annotate(amount=Sum("amount"))
            .order_by("date__month", "category")
        )

        category_label_map = {c.value: c.label for c in Expense.Category}
        months_map = {
            month: {
                "month": f"{year:04d}-{month:02d}",
                "total_amount": 0,
                "categories": [],
            }
            for month in range(1, 13)
        }

        category_buckets = {month: {} for month in range(1, 13)}
        for row in rows:
            month = row["date__month"]
            category = row["category"] or Expense.Category.UNCATEGORIZED
            amount = row["amount"] or 0
            category_buckets[month][category] = amount

        for month in range(1, 13):
            month_categories = []
            total_amount = 0
            for category, amount in sorted(
                category_buckets[month].items(),
                key=lambda item: (-item[1], item[0]),
            ):
                month_categories.append(
                    {
                        "category": category,
                        "label": category_label_map.get(category, category),
                        "amount": amount,
                    }
                )
                total_amount += amount

            months_map[month]["categories"] = month_categories
            months_map[month]["total_amount"] = total_amount

        total_amount = qs.aggregate(total=Sum("amount"))["total"] or 0
        total_count = qs.count()
        summary = {
            "year": year,
            "total_amount": total_amount,
            "average_monthly_amount": total_amount // 12,
            "total_count": total_count,
            "months": [months_map[month] for month in range(1, 13)],
        }

        serializer = YearlySummarySerializer(summary)
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
