// frontend/src/pages/HomePage.tsx
import { useMemo, useState, type ChangeEvent, type CompositionEvent } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { fetchMonthlySummary } from "../api/summary";
import {
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  type UpdateExpenseInput,
} from "../api/expenses";
import type {
  Expense,
  CardUser,
  Payer,
  BurdenType,
  Category,
} from "../api/types";

import { getInitialYearMonth, shiftMonth } from "../lib/month";
import { yen } from "../lib/format";
import { DEFAULT_HIGHLIGHT_THRESHOLD, useSettings } from "../hooks/useSettings";
import { qk } from "../lib/queryKeys";
import { PageShell } from "../components/layout/PageShell";
import { Card } from "../components/ui/Card";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const zenkakuKanaMap: Record<string, string> = {
  "。": "｡", "「": "｢", "」": "｣", "、": "､", "・": "･", "ー": "ｰ",
  "ヲ": "ｦ", "ァ": "ｧ", "ィ": "ｨ", "ゥ": "ｩ", "ェ": "ｪ", "ォ": "ｫ",
  "ャ": "ｬ", "ュ": "ｭ", "ョ": "ｮ", "ッ": "ｯ",
  "ア": "ｱ", "イ": "ｲ", "ウ": "ｳ", "エ": "ｴ", "オ": "ｵ",
  "カ": "ｶ", "キ": "ｷ", "ク": "ｸ", "ケ": "ｹ", "コ": "ｺ",
  "サ": "ｻ", "シ": "ｼ", "ス": "ｽ", "セ": "ｾ", "ソ": "ｿ",
  "タ": "ﾀ", "チ": "ﾁ", "ツ": "ﾂ", "テ": "ﾃ", "ト": "ﾄ",
  "ナ": "ﾅ", "ニ": "ﾆ", "ヌ": "ﾇ", "ネ": "ﾈ", "ノ": "ﾉ",
  "ハ": "ﾊ", "ヒ": "ﾋ", "フ": "ﾌ", "ヘ": "ﾍ", "ホ": "ﾎ",
  "マ": "ﾏ", "ミ": "ﾐ", "ム": "ﾑ", "メ": "ﾒ", "モ": "ﾓ",
  "ヤ": "ﾔ", "ユ": "ﾕ", "ヨ": "ﾖ",
  "ラ": "ﾗ", "リ": "ﾘ", "ル": "ﾙ", "レ": "ﾚ", "ロ": "ﾛ",
  "ワ": "ﾜ", "ン": "ﾝ",
  "ガ": "ｶﾞ", "ギ": "ｷﾞ", "グ": "ｸﾞ", "ゲ": "ｹﾞ", "ゴ": "ｺﾞ",
  "ザ": "ｻﾞ", "ジ": "ｼﾞ", "ズ": "ｽﾞ", "ゼ": "ｾﾞ", "ゾ": "ｿﾞ",
  "ダ": "ﾀﾞ", "ヂ": "ﾁﾞ", "ヅ": "ﾂﾞ", "デ": "ﾃﾞ", "ド": "ﾄﾞ",
  "バ": "ﾊﾞ", "ビ": "ﾋﾞ", "ブ": "ﾌﾞ", "ベ": "ﾍﾞ", "ボ": "ﾎﾞ",
  "パ": "ﾊﾟ", "ピ": "ﾋﾟ", "プ": "ﾌﾟ", "ペ": "ﾍﾟ", "ポ": "ﾎﾟ",
  "ヴ": "ｳﾞ",
};

function toHalfWidthKatakanaAndDigits(value: string) {
  const normalized = value.normalize("NFKC");
  return normalized.replace(/[。、「」、・ーァ-ヶヴ]/g, (s) => zenkakuKanaMap[s] ?? s);
}

function getMonthRangeISO(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // 0日 = 前月末日
  return { startISO: toISODate(start), endISO: toISODate(end) };
}

function labelCardUser(v: Expense["card_user"] | null | undefined) {
  if (!v) return "—";
  if (v === "me") return "パパ";
  if (v === "wife") return "ママ";
  return "不明";
}

function labelPayer(v: Expense["payer"] | null | undefined) {
  if (!v) return "—";
  if (v === "me") return "パパ";
  if (v === "wife") return "ママ";
  return "不明";
}

function cardUserBadgeClass(v: Expense["card_user"] | null | undefined) {
  if (v === "me") return "bg-[#E8F4FF] text-[#1D5EA8]";
  if (v === "wife") return "bg-[#FCEAF1] text-[#B94F76]";
  return "bg-[#EEF1F5] text-[#5E6E7E]";
}

function payerBadgeClass(v: Expense["payer"] | null | undefined) {
  if (v === "me") return "bg-[#E7F3FF] text-[#155FAD]";
  if (v === "wife") return "bg-[#FFF0E6] text-[#BA6A25]";
  return "bg-[#EEF1F5] text-[#5E6E7E]";
}

function categoryBadgeClass(v: Expense["category"]) {
  if (v === "food") return "bg-[#E7F6EC] text-[#24734B]";
  if (v === "daily") return "bg-[#F1F6FF] text-[#2B5E9E]";
  if (v === "outside_food") return "bg-[#FFF4E7] text-[#A8641F]";
  if (v === "utility") return "bg-[#F3EDFF] text-[#6741A6]";
  if (v === "travel") return "bg-[#E8FBFF] text-[#1B6C80]";
  if (v === "other") return "bg-[#F7F0E8] text-[#7A5C36]";
  return "bg-[#EEF1F5] text-[#5E6E7E]";
}

function burdenBadgeClass(v: Expense["burden_type"]) {
  if (v === "shared") return "bg-[#2B8CE6] text-white";
  if (v === "wife_only") return "bg-[#FADDE7] text-[#E36D94]";
  return "bg-[#ECEEF1] text-[#5D6C7B]";
}

const CATEGORY_OPTIONS: Array<{ value: Category; label: string }> = [
  { value: "uncategorized", label: "未分類" },
  { value: "food", label: "食費" },
  { value: "daily", label: "日用品" },
  { value: "outside_food", label: "外食" },
  { value: "utility", label: "光熱費" },
  { value: "travel", label: "旅行" },
  { value: "other", label: "その他" },
];

const BURDEN_TYPE_OPTIONS: Array<{ value: BurdenType; label: string }> = [
  { value: "shared", label: "共有支出" },
  { value: "wife_only", label: "ママ個人" },
  { value: "me_only", label: "パパ個人" },
];

function categoryLabel(value: Category) {
  return CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? "未分類";
}

function burdenTypeLabel(value: BurdenType) {
  return BURDEN_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "共有支出";
}

function labelSource(v: Expense["source"]) {
  if (v === "csv_rakuten") return "楽天CSV";
  if (v === "csv_mitsui") return "三井CSV";
  return "手入力";
}

function isHighAmount(amount: number, threshold = 10000) {
  return amount >= threshold;
}

function clampYearMonth(year: number, month: number) {
  const y = Number.isInteger(year) && year > 0 ? year : 0;
  const m = Number.isInteger(month) && month >= 1 && month <= 12 ? month : 0;
  return { y, m, ok: y > 0 && m > 0 };
}

function parsePage(value: string | null) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL の year/month を唯一のソースにする（状態ズレの温床を消す）
  const targetYM = useMemo(() => {
    const yearParam = Number(searchParams.get("year"));
    const monthParam = Number(searchParams.get("month"));
    const { ok } = clampYearMonth(yearParam, monthParam);

    if (ok) return { year: yearParam, month: monthParam };
    return getInitialYearMonth(); // ここは「当月」を返す前提
  }, [searchParams]);

  // 一覧ページ（URLクエリをソースにして戻った時の状態を一貫させる）
  const page = useMemo(() => parsePage(searchParams.get("page")), [searchParams]);
  const settingsQ = useSettings();
  const highlightThreshold =
    settingsQ.data?.highlight_threshold ?? DEFAULT_HIGHLIGHT_THRESHOLD;

  const { startISO, endISO } = useMemo(
    () => getMonthRangeISO(targetYM.year, targetYM.month),
    [targetYM.year, targetYM.month]
  );

  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: qk.summaryMonth(targetYM.year, targetYM.month),
    queryFn: () => fetchMonthlySummary(targetYM.year, targetYM.month),
    refetchOnMount: "always",
  });

  const expensesQuery = useQuery({
    queryKey: qk.expensesMonthPage(targetYM.year, targetYM.month, page),
    queryFn: () =>
      fetchExpenses({
        dateFrom: startISO,
        dateTo: endISO,
        ordering: "-date",
        page,
      }),
    refetchOnMount: "always",
  });

  const data = summaryQuery.data;
  const meShared = data ? data.shared_total - data.wife_shared : null;
  const showWifePersonal = (data?.wife_personal ?? 0) > 0;

  const go = (delta: number) => {
    const nextYM = shiftMonth(targetYM.year, targetYM.month, delta);
    const next = new URLSearchParams(searchParams);
    next.set("year", String(nextYM.year));
    next.set("month", String(nextYM.month));
    next.set("page", "1");
    setSearchParams(next);
  };

  const goInitial = () => {
    const nextYM = getInitialYearMonth();
    const next = new URLSearchParams(searchParams);
    next.set("year", String(nextYM.year));
    next.set("month", String(nextYM.month));
    next.set("page", "1");
    setSearchParams(next);
  };

  const rows = expensesQuery.data?.results ?? [];
  const totalCount = expensesQuery.data?.count ?? 0;

  const anyError = summaryQuery.error || expensesQuery.error;

  // -----------------------------
  // 手入力フォーム
  // -----------------------------
  const [form, setForm] = useState<{
    date: string;
    store: string;
    amount: string;
    payer: Payer;
    category: Category;
    memo: string;
  }>(() => ({
    // 初期は「今日」でもいいけど、対象月の範囲に寄せるなら startISO でもOK
    date: toISODate(new Date()),
    store: "",
    amount: "",
    payer: "me",
    category: "uncategorized",
    memo: "",
  }));
  const [isComposing, setIsComposing] = useState(false);

  const setFormTextField = (field: "store" | "amount" | "memo", value: string) => {
    setForm((prev) => {
      if (field === "store") return { ...prev, store: value };
      if (field === "amount") return { ...prev, amount: value };
      return { ...prev, memo: value };
    });
  };

  const handleFormTextChange =
    (field: "store" | "amount" | "memo") => (e: ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setFormTextField(field, isComposing ? next : toHalfWidthKatakanaAndDigits(next));
    };

  const handleFormCompositionStart = () => {
    setIsComposing(true);
  };

  const handleFormCompositionEnd =
    (field: "store" | "amount" | "memo") =>
    (e: CompositionEvent<HTMLInputElement>) => {
      setIsComposing(false);
      setFormTextField(field, toHalfWidthKatakanaAndDigits(e.currentTarget.value));
    };

  // targetYM が変わったとき、日付が対象月外になりがちなので、
  // ここは「そのまま維持」にしてる（勝手に書き換えない）。
  // もし「月切替したら日付も月初に寄せたい」なら後で仕様決めよう。

  const createMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount);
      if (!form.store.trim()) throw new Error("購入先を入力してください");
      if (!form.date) throw new Error("日付を入力してください");
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("金額は 1 以上の数値で入力してください");
      }

      return createExpense({
        date: form.date,
        store: form.store.trim(),
        amount,
        payer: form.payer,
        burden_type: "shared",
        category: form.category,
        memo: form.memo,
      });
    },
    onSuccess: () => {
      // 入力は軽くクリア（date は残す運用が楽）
      setForm((p) => ({ ...p, store: "", amount: "", memo: "" }));

      // summary / expenses を更新
    queryClient.invalidateQueries({
      queryKey: qk.summaryMonth(targetYM.year, targetYM.month),
    });
    queryClient.invalidateQueries({
      queryKey: qk.expensesMonth(targetYM.year, targetYM.month),
    });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateExpenseInput }) =>
      updateExpense(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.summaryMonth(targetYM.year, targetYM.month),
      });
      queryClient.invalidateQueries({
        queryKey: qk.expensesMonth(targetYM.year, targetYM.month),
      });
    },
  });
  const inlineUpdateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateExpenseInput }) =>
      updateExpense(id, input),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.summaryMonth(targetYM.year, targetYM.month),
      });
      queryClient.invalidateQueries({
        queryKey: qk.expensesMonth(targetYM.year, targetYM.month),
      });
    },
  });

  const canSubmit =
    !!form.store.trim() &&
    !!form.date &&
    !!form.amount &&
    Number.isFinite(Number(form.amount)) &&
    Number(form.amount) > 0;

  const [editForm, setEditForm] = useState<{
    id: number;
    date: string;
    store: string;
    amount: string;
    card_user: CardUser;
    payer: Payer;
    burden_type: BurdenType;
    category: Category;
    memo: string;
    source: Expense["source"];
  } | null>(null);

  const canSaveEdit =
    !!editForm &&
    !!editForm.store.trim() &&
    !!editForm.date &&
    !!editForm.amount &&
    Number.isFinite(Number(editForm.amount)) &&
    Number(editForm.amount) > 0;
  const [savingRowIds, setSavingRowIds] = useState<number[]>([]);
  const [inlineErrors, setInlineErrors] = useState<Record<number, string>>({});
  const [inlineDrafts, setInlineDrafts] = useState<
    Record<number, { category?: Category; burden_type?: BurdenType }>
  >({});
  const [editingCell, setEditingCell] = useState<
    { id: number; field: "category" | "burden_type" } | null
  >(null);

  const setRowSaving = (id: number, isSaving: boolean) => {
    setSavingRowIds((prev) => {
      if (isSaving) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((rowId) => rowId !== id);
    });
  };

  const setInlineDraftField = (
    id: number,
    field: "category" | "burden_type",
    value?: Category | BurdenType
  ) => {
    setInlineDrafts((prev) => {
      const current = prev[id] ?? {};
      const next = { ...current };
      if (value === undefined) {
        delete next[field];
      } else if (field === "category") {
        next.category = value as Category;
      } else {
        next.burden_type = value as BurdenType;
      }

      if (!next.category && !next.burden_type) {
        const rest = { ...prev };
        delete rest[id];
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const saveInlineField = (
    id: number,
    field: "category" | "burden_type",
    value: Category | BurdenType
  ) => {
    const input: UpdateExpenseInput =
      field === "category"
        ? { category: value as Category }
        : { burden_type: value as BurdenType };

    setInlineErrors((prev) => {
      const rest = { ...prev };
      delete rest[id];
      return rest;
    });
    setInlineDraftField(id, field, value);
    setRowSaving(id, true);

    inlineUpdateMutation.mutate(
      { id, input },
      {
        onSuccess: () => {
          setRowSaving(id, false);
          setInlineDraftField(id, field, undefined);
          setEditingCell((prev) =>
            prev && prev.id === id && prev.field === field ? null : prev
          );
          queryClient.invalidateQueries({
            queryKey: qk.summaryMonth(targetYM.year, targetYM.month),
          });
          queryClient.invalidateQueries({
            queryKey: qk.expensesMonth(targetYM.year, targetYM.month),
          });
        },
        onError: (error) => {
          setRowSaving(id, false);
          setInlineDraftField(id, field, undefined);
          setEditingCell((prev) =>
            prev && prev.id === id && prev.field === field ? null : prev
          );
          setInlineErrors((prev) => ({
            ...prev,
            [id]: (error as Error).message,
          }));
        },
      }
    );
  };

  return (
    <PageShell>
      <div className="space-y-7">
        <div className="min-h-5">
          {anyError ? (
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <div>
                取得に失敗しました:{" "}
                {((summaryQuery.error || expensesQuery.error) as Error).message}
              </div>
              <button
                type="button"
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                onClick={() => {
                  summaryQuery.refetch();
                  expensesQuery.refetch();
                }}
              >
                再試行
              </button>
            </div>
          ) : summaryQuery.isLoading ? (
            <div className="text-sm text-[#6A7C8E]">読み込み中...</div>
          ) : null}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="h-10 w-10 rounded-full border border-transparent text-2xl text-[#60758B] hover:border-[#D5E2EF] hover:bg-white"
            onClick={() => go(-1)}
            aria-label="prev month"
          >
            ‹
          </button>

          <div className="min-w-40 text-center text-2xl font-bold text-[#19385A]">
            {targetYM.year}年{targetYM.month}月
          </div>

          <button
            type="button"
            className="h-10 w-10 rounded-full border border-transparent text-2xl text-[#60758B] hover:border-[#D5E2EF] hover:bg-white"
            onClick={() => go(1)}
            aria-label="next month"
          >
            ›
          </button>

          <button
            type="button"
            className="ml-2 h-10 rounded-full border border-[#D1DCE8] bg-white px-4 text-sm font-medium hover:bg-[#F7FAFD]"
            onClick={goInitial}
            aria-label="back to current month"
            title="当月に戻る"
          >
            今月
          </button>

          {(summaryQuery.isFetching || expensesQuery.isFetching) &&
            !(summaryQuery.isLoading || expensesQuery.isLoading) && (
              <div className="ml-2 text-xs text-[#6A7C8E]">更新中...</div>
            )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Summary title="総支出" value={data ? yen(data.shared_total) : null} />
          <Summary title="パパの共有支出" value={meShared !== null ? yen(meShared) : null} />
          <Summary title="ママの共有支出" value={data ? yen(data.wife_shared) : null} />
          {showWifePersonal && (
            <Summary title="ママの個人利用" value={data ? yen(data.wife_personal) : null} accent />
          )}
          <Summary title="折半額" value={data ? yen(data.half) : null} blue />
          <Summary title="振込（ママ→パパ）" value={data ? yen(data.transfer_amount) : null} blue />
        </div>

        <Card className="p-5 sm:p-6">
          <div className="text-2xl font-bold text-[#143A61]">支出を追加</div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              className="h-11 rounded-xl border border-[#D1DCE8] bg-white px-4 text-base text-[#153B61]"
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
            <input
              className="h-11 rounded-xl border border-[#D1DCE8] bg-white px-4 text-base placeholder:text-[#91A2B4]"
              value={form.store}
              onCompositionStart={handleFormCompositionStart}
              onCompositionEnd={handleFormCompositionEnd("store")}
              onChange={handleFormTextChange("store")}
              placeholder="購入先"
            />
            <input
              className="h-11 rounded-xl border border-[#D1DCE8] bg-white px-4 text-base placeholder:text-[#91A2B4]"
              inputMode="numeric"
              value={form.amount}
              onCompositionStart={handleFormCompositionStart}
              onCompositionEnd={handleFormCompositionEnd("amount")}
              onChange={handleFormTextChange("amount")}
              placeholder="金額"
            />
            <select
              className="h-11 rounded-xl border border-[#D1DCE8] bg-white px-4 text-base text-[#153B61]"
              value={form.payer}
              onChange={(e) => setForm((p) => ({ ...p, payer: e.target.value as Payer }))}
            >
              <option value="me">支払い者: パパ</option>
              <option value="wife">支払い者: ママ</option>
            </select>
            <select
              className="h-11 rounded-xl border border-[#D1DCE8] bg-white px-4 text-base text-[#153B61]"
              value={form.category}
              onChange={(e) =>
                setForm((p) => ({ ...p, category: e.target.value as Category }))
              }
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  カテゴリ: {option.label}
                </option>
              ))}
            </select>
            <input
              className="h-11 rounded-xl border border-[#D1DCE8] bg-white px-4 text-base placeholder:text-[#91A2B4]"
              value={form.memo}
              onCompositionStart={handleFormCompositionStart}
              onCompositionEnd={handleFormCompositionEnd("memo")}
              onChange={handleFormTextChange("memo")}
              placeholder="メモ"
            />
            <div className="flex items-center justify-end md:col-span-3">
              <button
                type="button"
                className="h-11 min-w-28 rounded-xl bg-[#2B8CE6] px-5 text-base font-bold text-white disabled:opacity-50"
                disabled={!canSubmit || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "登録中..." : "＋ 追加"}
              </button>
            </div>
          </div>
          {createMutation.error && (
            <div className="mt-3 text-sm text-red-600">
              登録に失敗: {(createMutation.error as Error).message}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E1E8F0] px-6 py-4">
            <div className="text-sm text-[#6A7C8E]">
              対象期間: {startISO} 〜 {endISO}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-[#6A7C8E]">{totalCount ? `${totalCount}件` : ""}</div>
              <button
                type="button"
                className="h-9 rounded-lg border border-[#D1DCE8] bg-white px-3 text-sm font-medium hover:bg-[#F7FAFD] disabled:opacity-50"
                onClick={() => expensesQuery.refetch()}
                disabled={expensesQuery.isFetching}
              >
                更新
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#E1E8F0] bg-[#F7FAFE] text-[#667D93]">
                  <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">日付</th>
                  <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">購入先</th>
                  <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">カード利用者</th>
                  <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">支払い者</th>
                  <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">カテゴリ</th>
                  <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">負担区分</th>
                  <th className="whitespace-nowrap px-6 py-3 text-right font-semibold">金額</th>
                  <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">メモ</th>
                  <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {expensesQuery.isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-[#6A7C8E]">
                      読み込み中...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-[#6A7C8E]">
                      データがありません
                    </td>
                  </tr>
                ) : (
                  rows.map((e) => {
                    const rowSaving = savingRowIds.includes(e.id);
                    const currentCategory = inlineDrafts[e.id]?.category ?? e.category;
                    const currentBurdenType = inlineDrafts[e.id]?.burden_type ?? e.burden_type;
                    const isEditingCategory =
                      editingCell?.id === e.id && editingCell.field === "category";
                    const isEditingBurdenType =
                      editingCell?.id === e.id && editingCell.field === "burden_type";

                    return (
                    <tr key={e.id} className="border-b border-[#EEF3F8] last:border-b-0 hover:bg-[#FAFCFF]">
                      <td className="whitespace-nowrap px-6 py-4 text-base text-[#4D6278]">{e.date}</td>
                      <td className="min-w-55 px-6 py-4 text-base text-[#1A395B]">{e.store}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-base text-[#1A395B]">
                        <span
                          className={`inline-flex items-center rounded-xl px-3 py-1 text-sm font-semibold ${cardUserBadgeClass(
                            e.card_user
                          )}`}
                        >
                          {labelCardUser(e.card_user)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-base text-[#1A395B]">
                        <span
                          className={`inline-flex items-center rounded-xl px-3 py-1 text-sm font-semibold ${payerBadgeClass(
                            e.payer
                          )}`}
                        >
                          {labelPayer(e.payer)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-base text-[#596F85]">
                        {isEditingCategory ? (
                          <select
                            autoFocus
                            className={`h-9 min-w-22 rounded-xl border border-transparent px-3 py-1 text-sm font-semibold ${categoryBadgeClass(
                              currentCategory
                            )}`}
                            value={currentCategory}
                            disabled={rowSaving}
                            onBlur={() =>
                              setEditingCell((prev) =>
                                prev && prev.id === e.id && prev.field === "category"
                                  ? null
                                  : prev
                              )
                            }
                            onKeyDown={(ev) => {
                              if (ev.key === "Escape") {
                                ev.preventDefault();
                                setEditingCell(null);
                              }
                            }}
                            onChange={(ev) => {
                              const nextCategory = ev.target.value as Category;
                              if (nextCategory === e.category) return;
                              saveInlineField(e.id, "category", nextCategory);
                            }}
                          >
                            {CATEGORY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            className={`inline-flex h-9 min-w-22 items-center rounded-xl px-3 py-1 text-sm font-semibold ${categoryBadgeClass(
                              currentCategory
                            )} ${rowSaving ? "cursor-not-allowed opacity-60" : ""}`}
                            aria-label="カテゴリを編集"
                            aria-haspopup="listbox"
                            aria-expanded={isEditingCategory}
                            title="カテゴリを編集"
                            disabled={rowSaving}
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              if (rowSaving) return;
                              setEditingCell({ id: e.id, field: "category" });
                            }}
                            onClick={() => {}}
                            onKeyDown={(ev) => {
                              if ((ev.key === "Enter" || ev.key === " ") && !rowSaving) {
                                ev.preventDefault();
                                setEditingCell({ id: e.id, field: "category" });
                              }
                            }}
                          >
                            {categoryLabel(currentCategory)}
                            <span className="ml-1">▾</span>
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {isEditingBurdenType ? (
                          <select
                            autoFocus
                            className={`h-9 min-w-24 rounded-xl border border-transparent px-3 py-1 text-sm font-semibold ${burdenBadgeClass(
                              currentBurdenType
                            )}`}
                            value={currentBurdenType}
                            disabled={rowSaving}
                            onBlur={() =>
                              setEditingCell((prev) =>
                                prev && prev.id === e.id && prev.field === "burden_type"
                                  ? null
                                  : prev
                              )
                            }
                            onKeyDown={(ev) => {
                              if (ev.key === "Escape") {
                                ev.preventDefault();
                                setEditingCell(null);
                              }
                            }}
                            onChange={(ev) => {
                              const nextBurdenType = ev.target.value as BurdenType;
                              if (nextBurdenType === e.burden_type) return;
                              saveInlineField(e.id, "burden_type", nextBurdenType);
                            }}
                          >
                            {BURDEN_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            className={`inline-flex h-9 min-w-24 items-center rounded-xl px-3 py-1 text-sm font-semibold ${burdenBadgeClass(
                              currentBurdenType
                            )} ${rowSaving ? "cursor-not-allowed opacity-60" : ""}`}
                            aria-label="負担区分を編集"
                            aria-haspopup="listbox"
                            aria-expanded={isEditingBurdenType}
                            title="負担区分を編集"
                            disabled={rowSaving}
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              if (rowSaving) return;
                              setEditingCell({ id: e.id, field: "burden_type" });
                            }}
                            onClick={() => {}}
                            onKeyDown={(ev) => {
                              if ((ev.key === "Enter" || ev.key === " ") && !rowSaving) {
                                ev.preventDefault();
                                setEditingCell({ id: e.id, field: "burden_type" });
                              }
                            }}
                          >
                            {burdenTypeLabel(currentBurdenType)}
                            <span className="ml-1">▾</span>
                          </button>
                        )}
                      </td>
                      <td
                        className={`whitespace-nowrap px-6 py-4 text-right text-base font-semibold ${
                          isHighAmount(e.amount, highlightThreshold)
                            ? "text-red-600"
                            : "text-[#1A395B]"
                        }`}
                        title={labelSource(e.source)}
                      >
                        {yen(e.amount)}
                      </td>
                      <td className="min-w-45 px-6 py-4 text-base text-[#596F85]">{e.memo || "-"}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="rounded-md px-2 py-1 text-sm font-semibold text-[#60758B] hover:bg-[#EEF4FB] hover:text-[#2B8CE6] disabled:cursor-not-allowed disabled:opacity-45"
                            title="登録内容を編集"
                            onClick={() => {
                              setEditForm({
                                id: e.id,
                                date: e.date,
                                store: e.store,
                                amount: String(e.amount),
                                card_user: e.card_user ?? "unknown",
                                payer: e.payer,
                                burden_type: e.burden_type,
                                category: e.category,
                                memo: e.memo ?? "",
                                source: e.source,
                              });
                            }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="text-[#E05A66] hover:text-[#CC2F3C]"
                            title="削除"
                            onClick={() => {
                              const ok = window.confirm("この支出を削除しますか？");
                              if (!ok) return;
                              deleteMutation.mutate(e.id);
                            }}
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        </div>
                        {rowSaving && (
                          <div className="mt-1 text-xs text-[#6A7C8E]">保存中...</div>
                        )}
                        {inlineErrors[e.id] && (
                          <div className="mt-1 text-xs text-red-600">{inlineErrors[e.id]}</div>
                        )}
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#E1E8F0] px-6 py-4">
            <div className="text-xs text-[#6A7C8E]">ページ: {page}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-9 rounded-lg border border-[#D1DCE8] bg-white px-3 text-sm font-medium hover:bg-[#F7FAFD] disabled:opacity-50"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set("page", String(Math.max(1, page - 1)));
                  setSearchParams(next);
                }}
                disabled={!expensesQuery.data?.previous || expensesQuery.isFetching}
              >
                前へ
              </button>
              <button
                type="button"
                className="h-9 rounded-lg border border-[#D1DCE8] bg-white px-3 text-sm font-medium hover:bg-[#F7FAFD] disabled:opacity-50"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set("page", String(page + 1));
                  setSearchParams(next);
                }}
                disabled={!expensesQuery.data?.next || expensesQuery.isFetching}
              >
                次へ
              </button>
            </div>
          </div>
          <div className="px-6 pb-5 text-xs text-[#6A7C8E]">金額が {yen(highlightThreshold)} 以上は赤表示</div>
        </Card>

        {editForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-[#D1DCE8] bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-[#E7EDF4] px-6 py-4">
                <h2 className="text-lg font-bold text-[#143A61]">登録内容を編集</h2>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-sm text-[#60758B] hover:bg-[#EEF4FB]"
                  onClick={() => setEditForm(null)}
                >
                  閉じる
                </button>
              </div>

              <div className="grid gap-3 px-6 py-5 md:grid-cols-2">
                <label className="grid gap-1 text-sm text-[#60758B]">
                  日付
                  <input
                    type="date"
                    className="h-10 rounded-lg border border-[#D1DCE8] px-3 text-sm text-[#153B61]"
                    value={editForm.date}
                    onChange={(e) => setEditForm((p) => (p ? { ...p, date: e.target.value } : p))}
                  />
                </label>

                <label className="grid gap-1 text-sm text-[#60758B]">
                  購入先
                  <input
                    className="h-10 rounded-lg border border-[#D1DCE8] px-3 text-sm text-[#153B61]"
                    value={editForm.store}
                    onChange={(e) =>
                      setEditForm((p) =>
                        p ? { ...p, store: toHalfWidthKatakanaAndDigits(e.target.value) } : p
                      )
                    }
                  />
                </label>

                <label className="grid gap-1 text-sm text-[#60758B]">
                  金額
                  <input
                    inputMode="numeric"
                    className="h-10 rounded-lg border border-[#D1DCE8] px-3 text-sm text-[#153B61]"
                    value={editForm.amount}
                    onChange={(e) =>
                      setEditForm((p) =>
                        p ? { ...p, amount: toHalfWidthKatakanaAndDigits(e.target.value) } : p
                      )
                    }
                  />
                </label>

                <label className="grid gap-1 text-sm text-[#60758B]">
                  カード利用者
                  <select
                    className="h-10 rounded-lg border border-[#D1DCE8] px-3 text-sm text-[#153B61]"
                    value={editForm.card_user}
                    onChange={(e) =>
                      setEditForm((p) => (p ? { ...p, card_user: e.target.value as CardUser } : p))
                    }
                  >
                    <option value="me">パパ</option>
                    <option value="wife">ママ</option>
                    <option value="unknown">不明</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm text-[#60758B]">
                  支払い者
                  <select
                    className="h-10 rounded-lg border border-[#D1DCE8] px-3 text-sm text-[#153B61]"
                    value={editForm.payer}
                    onChange={(e) => setEditForm((p) => (p ? { ...p, payer: e.target.value as Payer } : p))}
                  >
                    <option value="me">パパ</option>
                    <option value="wife">ママ</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm text-[#60758B]">
                  負担区分
                  <select
                    className="h-10 rounded-lg border border-[#D1DCE8] px-3 text-sm text-[#153B61]"
                    value={editForm.burden_type}
                    onChange={(e) =>
                      setEditForm((p) => (p ? { ...p, burden_type: e.target.value as BurdenType } : p))
                    }
                  >
                    {BURDEN_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm text-[#60758B]">
                  カテゴリ
                  <select
                    className="h-10 rounded-lg border border-[#D1DCE8] px-3 text-sm text-[#153B61]"
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm((p) => (p ? { ...p, category: e.target.value as Category } : p))
                    }
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm text-[#60758B] md:col-span-2">
                  メモ
                  <textarea
                    className="min-h-21 rounded-lg border border-[#D1DCE8] px-3 py-2 text-sm text-[#153B61]"
                    value={editForm.memo}
                    onChange={(e) =>
                      setEditForm((p) =>
                        p ? { ...p, memo: toHalfWidthKatakanaAndDigits(e.target.value) } : p
                      )
                    }
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#E7EDF4] px-6 py-4">
                <button
                  type="button"
                  className="h-10 rounded-lg border border-[#D1DCE8] bg-white px-4 text-sm font-semibold text-[#60758B]"
                  onClick={() => setEditForm(null)}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  className="h-10 rounded-lg bg-[#2B8CE6] px-4 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={!canSaveEdit || updateMutation.isPending}
                  onClick={() => {
                    if (!editForm) return;
                    const nextAmount = Number(editForm.amount);
                    updateMutation.mutate(
                      {
                        id: editForm.id,
                        input: {
                          date: editForm.date,
                          store: editForm.store.trim(),
                          amount: nextAmount,
                          card_user: editForm.card_user,
                          payer: editForm.payer,
                          burden_type: editForm.burden_type,
                          category: editForm.category,
                          memo: editForm.memo,
                        },
                      },
                      {
                        onSuccess: () => setEditForm(null),
                      }
                    );
                  }}
                >
                  {updateMutation.isPending ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Summary({
  title,
  value,
  accent,
  blue,
}: {
  title: string;
  value: string | null;
  accent?: boolean;
  blue?: boolean;
}) {
  return (
    <Card className="px-6 py-5">
      <div className="text-base font-semibold text-[#6A7C8E]">{title}</div>

      {value === null ? (
        <div className="mt-3 h-8 w-32 animate-pulse rounded-md bg-[#EEF4FA]" />
      ) : (
        <div
          className={`mt-2 text-3xl font-bold ${
            accent ? "text-[#F595B1]" : blue ? "text-[#2B8CE6]" : "text-[#163A5E]"
          }`}
        >
          {value}
        </div>
      )}
    </Card>
  );
}
