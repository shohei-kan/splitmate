import csv
import datetime
import io
import unicodedata
from typing import IO, Dict, List, Tuple

from django.db import transaction
from django.db.models import Q

from .models import Expense, ExclusionRule


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


def _parse_amount_for_sample(value: object) -> int | None:
    """
    samples レスポンス用の金額正規化。
    返却値は必ず int か None。
    """
    if isinstance(value, bool):
        return None

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return int(value) if value == value and value not in (float("inf"), float("-inf")) else None

    if isinstance(value, str):
        normalized = value.replace("¥", "").replace(",", "").replace(" ", "").strip()
        if not normalized:
            return None
        try:
            return int(normalized)
        except ValueError:
            try:
                return int(float(normalized))
            except ValueError:
                return None

    return None


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

def _normalize_text(value: str) -> str:
    """
    除外ワード判定用の正規化:
      - NFKC で全角/半角や互換文字を揃える
      - casefold() で大文字小文字を無視
    必要ならここでスペース除去なども追加できる。
    """
    if not value:
        return ""
    # 全角英数・記号などを半角に寄せる & 互換文字を統一
    normalized = unicodedata.normalize("NFKC", value)
    # 大文字/小文字を吸収
    normalized = normalized.casefold()
    return normalized


def _decode_text_with_fallback(file_obj: IO[bytes], encodings: List[str]) -> str:
    """
    バイト列を複数エンコーディングで順にデコードする。
    全て失敗したら ValueError を投げる。
    """
    raw = file_obj.read()
    if raw is None:
        raise ValueError("CSVファイルの読み込みに失敗しました。")

    for encoding in encodings:
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue

    raise ValueError(
        "CSVの文字コードを判別できませんでした。"
        "楽天は UTF-8 / Shift-JIS(cp932) を試してください。"
    )



# 除外ルール関連 -------------------------------------------------------


def _load_exclusion_rules(source: str) -> List[ExclusionRule]:
    # source 固有ルール + all ルールを対象にする
    return list(
        ExclusionRule.objects.filter(
            Q(target_source=source) | Q(target_source=ExclusionRule.TargetSource.ALL),
            is_active=True,
        )
    )


def _match_exclusion_rule(
    store: str,
    rules: List[ExclusionRule],
) -> ExclusionRule | None:
    """
    store と除外ルールの keyword を正規化して部分一致判定する。
    全角/半角・大文字小文字・スペース違いを吸収。
    """
    norm_store = _normalize_text(store)

    for rule in rules:
        kw = (rule.keyword or "").strip()
        if not kw:
            continue

        norm_kw = _normalize_text(kw)
        if not norm_kw:
            continue

        if norm_kw in norm_store:
            return rule

    return None


# 楽天カードインポート -------------------------------------------------


@transaction.atomic
def import_rakuten_csv(
    file_obj: IO[bytes],
    default_card_user: str = Expense.CardUser.UNKNOWN,
) -> Tuple[int, int, List[Dict[str, object]], int, int, List[Dict[str, object]], List[Dict[str, object]], List[Dict[str, object]]]:
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
      - 除外ルール(ExclusionRule) にマッチした行は作成せず excluded_samples に記録。
      - 既に同じ支出が DB にある場合は重複としてスキップする。
        重複判定キー: (date, store, amount, source, card_user)
    """

    # 有効な除外ルールを読み込む（楽天用）
    exclusion_rules = _load_exclusion_rules(Expense.Source.CSV_RAKUTEN)

    # すでに登録済みのキーを全部取得（個人利用規模ならこれで十分）
    existing_keys = set(
        Expense.objects.filter(source=Expense.Source.CSV_RAKUTEN).values_list(
            "date", "store", "amount", "source", "card_user"
        )
    )

    # 同一CSV内での重複も防ぐために、今回のインポート中に見つけたキーも管理
    seen_keys = set()

    expenses_to_create: List[Expense] = []
    skipped = 0
    duplicate_count = 0
    excluded_samples: List[Dict[str, object]] = []
    excluded_count = 0
    created_samples: List[Dict[str, object]] = []
    skipped_samples: List[Dict[str, object]] = []
    duplicate_samples: List[Dict[str, object]] = []

    text = _decode_text_with_fallback(file_obj, ["utf-8-sig", "cp932"])
    reader = csv.DictReader(io.StringIO(text))

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
            skipped_samples.append(
                {
                    "date": date_str or "",
                    "store": store or "",
                    "amount": _parse_amount_for_sample(amount_str),
                    "raw_amount": amount_str or "",
                    "reason": "invalid_row",
                }
            )
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
            skipped_samples.append(
                {
                    "date": date_str,
                    "store": store,
                    "amount": _parse_amount_for_sample(amount_str),
                    "raw_amount": amount_str,
                    "reason": "invalid_date",
                }
            )
            continue

        # 1) 除外ルール判定
        rule = _match_exclusion_rule(store, exclusion_rules)
        if rule:
            excluded_samples.append(
                {
                    "date": date_str,
                    "store": store,
                    "amount": _parse_amount_for_sample(amount_str),
                    "raw_amount": amount_str,
                    "reason": "excluded_by_rule",
                }
            )
            excluded_count += 1
            skipped += 1
            skipped_samples.append(
                {
                    "date": date_str,
                    "store": store,
                    "amount": _parse_amount_for_sample(amount_str),
                    "raw_amount": amount_str,
                    "reason": "excluded_by_rule",
                }
            )
            continue

        # 2) 重複判定 (DB 既存 + 今回 CSV 内)
        key = (date, store[:255], amount, Expense.Source.CSV_RAKUTEN, card_user)
        if key in existing_keys or key in seen_keys:
            duplicate_count += 1
            skipped += 1
            duplicate_samples.append(
                {
                    "date": date_str,
                    "store": store,
                    "amount": amount,
                    "raw_amount": amount_str,
                    "reason": "duplicate",
                }
            )
            skipped_samples.append(
                {
                    "date": date_str,
                    "store": store,
                    "amount": amount,
                    "raw_amount": amount_str,
                    "reason": "duplicate",
                }
            )
            continue

        seen_keys.add(key)

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
        created_samples.append(
            {
                "date": date_str,
                "store": store,
                "amount": amount,
                "raw_amount": amount_str,
            }
        )

    created = 0
    if expenses_to_create:
        Expense.objects.bulk_create(expenses_to_create)
        created = len(expenses_to_create)

    return (
        created,
        skipped,
        excluded_samples,
        excluded_count,
        duplicate_count,
        created_samples,
        skipped_samples,
        duplicate_samples,
    )


# 三井住友カードインポート ----------------------------------------------


@transaction.atomic
def import_mitsui_csv(
    file_obj: IO[bytes],
    card_user: str = Expense.CardUser.ME,
) -> Tuple[int, int, List[Dict[str, object]], int, int, List[Dict[str, object]], List[Dict[str, object]], List[Dict[str, object]]]:
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
      - 除外ルール(ExclusionRule) にマッチした行は作成せず excluded_samples に記録。
      - 既に同じ支出が DB にある場合は重複としてスキップする。
        重複判定キー: (date, store, amount, source, card_user)
    """

    # 三井用の除外ルール
    exclusion_rules = _load_exclusion_rules(Expense.Source.CSV_MITSUI)

    existing_keys = set(
        Expense.objects.filter(source=Expense.Source.CSV_MITSUI).values_list(
            "date", "store", "amount", "source", "card_user"
        )
    )
    seen_keys = set()

    expenses_to_create: List[Expense] = []
    skipped = 0
    duplicate_count = 0
    excluded_samples: List[Dict[str, object]] = []
    excluded_count = 0
    created_samples: List[Dict[str, object]] = []
    skipped_samples: List[Dict[str, object]] = []
    duplicate_samples: List[Dict[str, object]] = []

    text_stream = (line.decode("cp932", errors="ignore") for line in file_obj)
    reader = csv.reader(text_stream)

    for row in reader:
        if not row:
            continue

        # A列（日付）
        date_str = row[0].strip()

        # 日付でない行（名義人行など）はスキップ
        # フォーマット: YYYY/MM/DD を期待
        if len(date_str) != 10 or date_str[4] != "/" or date_str[7] != "/":
            skipped += 1
            skipped_samples.append(
                {
                    "date": date_str,
                    "store": row[1].strip() if len(row) > 1 else "",
                    "amount": _parse_amount_for_sample(row[2].strip() if len(row) > 2 else ""),
                    "raw_amount": row[2].strip() if len(row) > 2 else "",
                    "reason": "non_data_row",
                }
            )
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
            skipped_samples.append(
                {
                    "date": date_str,
                    "store": store,
                    "amount": _parse_amount_for_sample(amount_str),
                    "raw_amount": amount_str,
                    "reason": "invalid_row",
                }
            )
            continue

        try:
            date = _parse_date(date_str)
        except ValueError:
            skipped += 1
            skipped_samples.append(
                {
                    "date": date_str,
                    "store": store,
                    "amount": _parse_amount_for_sample(amount_str),
                    "raw_amount": amount_str,
                    "reason": "invalid_date",
                }
            )
            continue

        # 1) 除外ルール判定
        rule = _match_exclusion_rule(store, exclusion_rules)
        if rule:
            excluded_samples.append(
                {
                    "date": date_str,
                    "store": store,
                    "amount": _parse_amount_for_sample(amount_str),
                    "raw_amount": amount_str,
                    "reason": "excluded_by_rule",
                }
            )
            excluded_count += 1
            skipped += 1
            skipped_samples.append(
                {
                    "date": date_str,
                    "store": store,
                    "amount": _parse_amount_for_sample(amount_str),
                    "raw_amount": amount_str,
                    "reason": "excluded_by_rule",
                }
            )
            continue

        # 2) 重複判定
        key = (date, store[:255], amount, Expense.Source.CSV_MITSUI, card_user)
        if key in existing_keys or key in seen_keys:
            duplicate_count += 1
            skipped += 1
            duplicate_samples.append(
                {
                    "date": date_str,
                    "store": store,
                    "amount": amount,
                    "raw_amount": amount_str,
                    "reason": "duplicate",
                }
            )
            skipped_samples.append(
                {
                    "date": date_str,
                    "store": store,
                    "amount": amount,
                    "raw_amount": amount_str,
                    "reason": "duplicate",
                }
            )
            continue

        seen_keys.add(key)

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
        created_samples.append(
            {
                "date": date_str,
                "store": store,
                "amount": amount,
                "raw_amount": amount_str,
            }
        )

    created = 0
    if expenses_to_create:
        Expense.objects.bulk_create(expenses_to_create)
        created = len(expenses_to_create)

    return (
        created,
        skipped,
        excluded_samples,
        excluded_count,
        duplicate_count,
        created_samples,
        skipped_samples,
        duplicate_samples,
    )
