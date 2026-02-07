import csv
import datetime
from typing import IO, Dict, List, Tuple

from .models import Expense


# 共通ヘルパー ---------------------------------------------------------


def _parse_date(date_str: str) -> datetime.date:
    """
    '2025/12/31' or '2025-12-31' 形式の文字列を date に変換する。
    """
    date_str = (date_str or "").strip()
    if not date_str:
        raise ValueError("empty date")

    # 両方対応しておく
    if "/" in date_str:
        fmt = "%Y/%m/%d"
    else:
        fmt = "%Y-%m-%d"

    return datetime.datetime.strptime(date_str, fmt).date()


def _parse_amount(amount_str: str) -> int:
    """
    金額文字列から整数（円）を取り出す。
    '3,000' や '-1,234' などを想定。
    """
    if not amount_str:
        return 0

    s = str(amount_str).replace(",", "").strip()
    if not s:
        return 0

    try:
        return int(s)
    except ValueError:
        return 0


def _get_first(row: Dict[str, str], keys: List[str]) -> str:
    """
    DictReader の 1 行から、候補キーのうち最初に見つかった列の値を返す。
    まず完全一致を探し、なければ「部分一致」でも拾う。
    """
    # 完全一致
    for key in keys:
        if key in row:
            return row[key]

    # 部分一致（例: "利用店名" で "利用店名・商品名" を拾う）
    for field_name in row.keys():
        for key in keys:
            if key in field_name:
                return row[field_name]

    return ""


# 楽天カードインポート -------------------------------------------------


def import_rakuten_csv(
    file_obj: IO[bytes],
    default_card_user: str = Expense.CardUser.UNKNOWN,
) -> Tuple[int, int]:
    """
    楽天カード CSV をインポートして Expense を bulk_create する。

    仕様:
      - エンコーディング: UTF-8 (BOM 付き想定)
      - DictReader でヘッダー行あり
      - 使うカラム:
          利用日              -> date
          利用店名・商品名    -> store
          利用金額            -> amount
          利用者              -> card_user (本人/家族)

    前提:
      - 請求はすべて自分のカードに来るため、payer は一律 me。
      - card_user は「誰が利用したか」（UI のカード利用者）として保存する。
    """

    # UTF-8 BOM を想定
    text_stream = (line.decode("utf-8-sig") for line in file_obj)
    reader = csv.DictReader(text_stream)

    expenses_to_create: List[Expense] = []
    skipped = 0

    for row in reader:
        # 楽天のカラム名に合わせる
        date_str = _get_first(row, ["利用日"])
        store = _get_first(row, ["利用店名・商品名", "利用店名"])
        amount_str = _get_first(row, ["利用金額"])
        user_label = _get_first(row, ["利用者"])

        amount = _parse_amount(amount_str)

        # 必須3項目が揃っていない行はスキップ
        if not date_str or not store or amount <= 0:
            skipped += 1
            continue

        # 利用者 → UI表示用の card_user にマッピング
        user_label = (user_label or "").strip()
        if "家族" in user_label:
            card_user = Expense.CardUser.WIFE
        elif "本人" in user_label:
            card_user = Expense.CardUser.ME
        else:
            card_user = default_card_user

        try:
            date = _parse_date(date_str)
        except ValueError:
            skipped += 1
            continue

        expense = Expense(
            date=date,
            store=store[:255],
            card_user=card_user,                # 誰が使ったか
            payer=Expense.CardUser.ME,          # 誰が支払ったか（現状は自分一択）
            burden_type=Expense.BurdenType.SHARED,
            amount=amount,
            memo="",
            source=Expense.Source.CSV_RAKUTEN,
            status=Expense.Status.DRAFT,
        )
        expenses_to_create.append(expense)

    created = 0
    if expenses_to_create:
        Expense.objects.bulk_create(expenses_to_create)
        created = len(expenses_to_create)

    return created, skipped


# 三井住友カードインポート ----------------------------------------------


def import_mitsui_csv(
    file_obj: IO[bytes],
    card_user: str = Expense.CardUser.ME,
) -> Tuple[int, int]:
    """
    三井住友カード CSV をインポートして Expense を bulk_create する。

    仕様:
      - ヘッダー行なし
      - エンコーディング: Shift-JIS (cp932)
      - 列構成:
          A列: 日付 (YYYY/MM/DD)
          B列: 利用店名
          C列: 利用金額
          G列: 店舗詳細(任意)
      - 利用者カラムはないので card_user は引数の値をそのまま使う。
      - 三井の請求も自分の口座前提なので payer=me 固定。
    """

    text_stream = (line.decode("cp932", errors="ignore") for line in file_obj)
    reader = csv.reader(text_stream)

    expenses_to_create: List[Expense] = []
    skipped = 0

    for row in reader:
        if not row:
            continue

        # A列（日付）
        date_str = row[0].strip()

        # 日付でない行（名義人行など）はスキップ
        # フォーマット: YYYY/MM/DD を期待
        if len(date_str) != 10 or date_str[4] != "/" or date_str[7] != "/":
            skipped += 1
            continue

        # B列: 利用店名（必須）
        store_main = row[1].strip() if len(row) > 1 else ""

        # G列: 店舗詳細（あれば付け足す）
        store_extra = row[6].strip() if len(row) > 6 else ""
        if store_extra:
            store = f"{store_main} {store_extra}"
        else:
            store = store_main

        # C列: 利用金額
        amount_str = row[2].strip() if len(row) > 2 else ""
        amount = _parse_amount(amount_str)

        if not store or amount <= 0:
            skipped += 1
            continue

        try:
            date = _parse_date(date_str)
        except ValueError:
            skipped += 1
            continue

        expense = Expense(
            date=date,
            store=store[:255],
            card_user=card_user,               # UI の「カード利用者」欄に出す値
            payer=Expense.CardUser.ME,         # 実際の支払者
            burden_type=Expense.BurdenType.SHARED,
            amount=amount,
            memo="",
            source=Expense.Source.CSV_MITSUI,
            status=Expense.Status.DRAFT,
        )
        expenses_to_create.append(expense)

    created = 0
    if expenses_to_create:
        Expense.objects.bulk_create(expenses_to_create)
        created = len(expenses_to_create)

    return created, skipped
