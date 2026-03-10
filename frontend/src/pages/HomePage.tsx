// frontend/src/pages/HomePage.tsx
import { useMemo, useState } from "react";
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

function getMonthRangeISO(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // 0日 = 前月末日
  return { startISO: toISODate(start), endISO: toISODate(end) };
}

function labelCardUser(v: Expense["card_user"] | null | undefined) {
  if (!v) return "—";
  if (v === "me") return "私";
  if (v === "wife") return "妻";
  return "不明";
}

function labelPayer(v: Expense["payer"] | null | undefined) {
  if (!v) return "—";
  if (v === "me") return "私";
  if (v === "wife") return "妻";
  return "不明";
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
    burden_type: BurdenType;
    category: Category;
    memo: string;
  }>(() => ({
    // 初期は「今日」でもいいけど、対象月の範囲に寄せるなら startISO でもOK
    date: toISODate(new Date()),
    store: "",
    amount: "",
    payer: "me",
    burden_type: "shared",
    category: "uncategorized",
    memo: "",
  }));

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
        burden_type: form.burden_type,
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
          <Summary title="私の共有支出" value={meShared !== null ? yen(meShared) : null} />
          <Summary title="妻の共有支出" value={data ? yen(data.wife_shared) : null} />
          {showWifePersonal && (
            <Summary title="妻の個人利用" value={data ? yen(data.wife_personal) : null} accent />
          )}
          <Summary title="折半額" value={data ? yen(data.half) : null} blue />
          <Summary title="振込（妻→私）" value={data ? yen(data.transfer_amount) : null} blue />
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
              onChange={(e) => setForm((p) => ({ ...p, store: e.target.value }))}
              placeholder="購入先"
            />
            <input
              className="h-11 rounded-xl border border-[#D1DCE8] bg-white px-4 text-base placeholder:text-[#91A2B4]"
              inputMode="numeric"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="金額"
            />
            <select
              className="h-11 rounded-xl border border-[#D1DCE8] bg-white px-4 text-base text-[#153B61]"
              value={form.burden_type}
              onChange={(e) =>
                setForm((p) => ({ ...p, burden_type: e.target.value as BurdenType }))
              }
            >
              <option value="shared">共有支出</option>
              <option value="wife_only">妻個人</option>
              <option value="me_only">私個人</option>
            </select>
            <select
              className="h-11 rounded-xl border border-[#D1DCE8] bg-white px-4 text-base text-[#153B61]"
              value={form.payer}
              onChange={(e) => setForm((p) => ({ ...p, payer: e.target.value as Payer }))}
            >
              <option value="me">私</option>
              <option value="wife">妻</option>
            </select>
            <input
              className="h-11 rounded-xl border border-[#D1DCE8] bg-white px-4 text-base placeholder:text-[#91A2B4]"
              value={form.memo}
              onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
              placeholder="メモ"
            />
            <select
              className="h-11 rounded-xl border border-[#D1DCE8] bg-white px-4 text-base text-[#153B61]"
              value={form.category}
              onChange={(e) =>
                setForm((p) => ({ ...p, category: e.target.value as Category }))
              }
            >
              <option value="uncategorized">カテゴリ: 未分類</option>
              <option value="food">カテゴリ: 食費</option>
              <option value="daily">カテゴリ: 日用品</option>
              <option value="outside_food">カテゴリ: 外食</option>
              <option value="utility">カテゴリ: 光熱費</option>
              <option value="travel">カテゴリ: 旅行</option>
              <option value="other">カテゴリ: その他</option>
            </select>
            <div className="flex items-center justify-end">
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
                  <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">負担区分</th>
                  <th className="whitespace-nowrap px-6 py-3 text-right font-semibold">金額</th>
                  <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">メモ</th>
                  <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {expensesQuery.isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-[#6A7C8E]">
                      読み込み中...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-[#6A7C8E]">
                      データがありません
                    </td>
                  </tr>
                ) : (
                  rows.map((e) => (
                    <tr key={e.id} className="border-b border-[#EEF3F8] last:border-b-0 hover:bg-[#FAFCFF]">
                      <td className="whitespace-nowrap px-6 py-4 text-base text-[#4D6278]">{e.date}</td>
                      <td className="min-w-55 px-6 py-4 text-base text-[#1A395B]">{e.store}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-base text-[#1A395B]">
                        {labelCardUser(e.card_user)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-base text-[#1A395B]">
                        {labelPayer(e.payer)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <select
                          className={`h-8 rounded-xl border px-2 text-sm font-semibold ${
                            e.burden_type === "shared"
                              ? "border-[#2B8CE6] bg-[#2B8CE6] text-white"
                              : e.burden_type === "wife_only"
                                ? "border-[#F3C7D7] bg-[#FADDE7] text-[#E36D94]"
                                : "border-[#DDE2E8] bg-[#ECEEF1] text-[#5D6C7B]"
                          }`}
                          value={e.burden_type}
                          disabled={updateMutation.isPending}
                          onChange={(ev) => {
                            updateMutation.mutate({
                              id: e.id,
                              input: { burden_type: ev.target.value as BurdenType },
                            });
                          }}
                        >
                          <option value="shared">共有支出</option>
                          <option value="wife_only">妻個人</option>
                          <option value="me_only">私個人</option>
                        </select>
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
                            className="text-xl text-[#60758B] hover:text-[#2B8CE6]"
                            title="メモを編集"
                            onClick={() => {
                              const nextMemo = window.prompt("メモを編集", e.memo ?? "");
                              if (nextMemo === null) return;
                              if (nextMemo === e.memo) return;
                              updateMutation.mutate({
                                id: e.id,
                                input: { memo: nextMemo },
                              });
                            }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="text-xl text-[#E05A66] hover:text-[#CC2F3C]"
                            title="削除"
                            onClick={() => {
                              const ok = window.confirm("この支出を削除しますか？");
                              if (!ok) return;
                              deleteMutation.mutate(e.id);
                            }}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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
