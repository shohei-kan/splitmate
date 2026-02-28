// frontend/src/pages/HomePage.tsx
import { useMemo, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { fetchMonthlySummary } from "../api/summary";
import { fetchExpenses, createExpense } from "../api/expenses";
import type {
  Expense,
  CardUser,
  Payer,
  BurdenType,
  Category,
} from "../api/types";

import { getInitialYearMonth, shiftMonth } from "../lib/month";
import { yen } from "../lib/format";

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

function labelBurdenType(v: Expense["burden_type"]) {
  if (v === "shared") return "共有";
  if (v === "wife_only") return "妻のみ";
  return "私のみ";
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

  // 一覧ページ（ひとまず 1ページ目から。prev/next あり）
  const [page, setPage] = useState(1);

  const { startISO, endISO } = useMemo(
    () => getMonthRangeISO(targetYM.year, targetYM.month),
    [targetYM.year, targetYM.month]
  );

  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ["summary", targetYM.year, targetYM.month],
    queryFn: () => fetchMonthlySummary(targetYM.year, targetYM.month),
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", targetYM.year, targetYM.month, page],
    queryFn: () =>
      fetchExpenses({
        dateFrom: startISO,
        dateTo: endISO,
        ordering: "-date",
        page,
      }),
  });

  const data = summaryQuery.data;
  const meShared = data ? data.shared_total - data.wife_shared : null;
  const showWifePersonal = (data?.wife_personal ?? 0) > 0;

  const go = (delta: number) => {
    const nextYM = shiftMonth(targetYM.year, targetYM.month, delta);
    const next = new URLSearchParams(searchParams);
    next.set("year", String(nextYM.year));
    next.set("month", String(nextYM.month));
    setSearchParams(next);
    setPage(1);
  };

  const goInitial = () => {
    const nextYM = getInitialYearMonth();
    const next = new URLSearchParams(searchParams);
    next.set("year", String(nextYM.year));
    next.set("month", String(nextYM.month));
    setSearchParams(next);
    setPage(1);
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
    card_user: CardUser;
    payer: Payer;
    burden_type: BurdenType;
    category: Category;
    memo: string;
  }>(() => ({
    // 初期は「今日」でもいいけど、対象月の範囲に寄せるなら startISO でもOK
    date: toISODate(new Date()),
    store: "",
    amount: "",
    card_user: "unknown",
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
        card_user: form.card_user,
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
        queryKey: ["summary", targetYM.year, targetYM.month],
      });
      queryClient.invalidateQueries({
        // page も含めてまとめて更新
        queryKey: ["expenses", targetYM.year, targetYM.month],
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
    <div className="space-y-5">
      {/* Top status (loading/error) */}
      <div className="min-h-[20px]">
        {anyError ? (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <div>
              取得に失敗しました:{" "}
              {((summaryQuery.error || expensesQuery.error) as Error).message}
            </div>
            <button
              type="button"
              className="rounded-md bg-white px-2 py-1 text-xs font-medium text-red-700 border border-red-200 hover:bg-red-50"
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

      {/* Month selector */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          className="w-10 h-10 rounded-full hover:bg-white border border-transparent hover:border-[#E0E0E0]"
          onClick={() => go(-1)}
          aria-label="prev month"
        >
          ‹
        </button>

        <div className="px-3 py-2 rounded-full bg-white border border-[#E0E0E0] text-base font-semibold">
          {targetYM.year}年{targetYM.month}月
        </div>

        <button
          type="button"
          className="w-10 h-10 rounded-full hover:bg-white border border-transparent hover:border-[#E0E0E0]"
          onClick={() => go(1)}
          aria-label="next month"
        >
          ›
        </button>

        <button
          type="button"
          className="ml-2 h-10 px-4 rounded-full bg-white border border-[#E0E0E0] hover:bg-[#F7FAFD] text-sm font-medium"
          onClick={goInitial}
          aria-label="back to current month"
          title="当月に戻る"
        >
          今月
        </button>

        {/* fetch中のさりげない表示 */}
        {(summaryQuery.isFetching || expensesQuery.isFetching) &&
          !(summaryQuery.isLoading || expensesQuery.isLoading) && (
            <div className="ml-2 text-xs text-[#6A7C8E]">更新中...</div>
          )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Summary title="総支出（共有）" value={data ? yen(data.shared_total) : null} />

        <Summary title="私の共有支出" value={meShared !== null ? yen(meShared) : null} />

        <Summary title="妻の共有支出" value={data ? yen(data.wife_shared) : null} />

        {showWifePersonal && (
          <Summary
            title="妻の個人利用"
            value={data ? yen(data.wife_personal) : null}
            accent
          />
        )}

        <Summary title="折半額" value={data ? yen(data.half) : null} blue />

        <Summary
          title="振込（妻→私）"
          value={data ? yen(data.transfer_amount) : null}
          blue
        />
      </div>

      {/* Main area: (Left) manual form + (Right) table */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: manual form */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-[#E0E0E0] bg-white p-5">
              <div className="text-base font-semibold">支出を追加</div>
              <div className="mt-1 text-xs text-[#6A7C8E]">
                登録後、サマリーと一覧を自動更新します
              </div>

              <div className="mt-4 space-y-3">
                <div className="grid gap-2">
                  <label className="text-xs text-[#6A7C8E]">日付</label>
                  <input
                    className="h-10 rounded-lg border border-[#E0E0E0] px-3 text-sm"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-[#6A7C8E]">購入先</label>
                  <input
                    className="h-10 rounded-lg border border-[#E0E0E0] px-3 text-sm"
                    value={form.store}
                    onChange={(e) => setForm((p) => ({ ...p, store: e.target.value }))}
                    placeholder="例）Amazon / 東京電力"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-[#6A7C8E]">金額</label>
                  <input
                    className="h-10 rounded-lg border border-[#E0E0E0] px-3 text-sm"
                    inputMode="numeric"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="例）12000"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-[#6A7C8E]">カード利用者</label>
                  <select
                    className="h-10 rounded-lg border border-[#E0E0E0] px-3 text-sm bg-white"
                    value={form.card_user}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, card_user: e.target.value as CardUser }))
                    }
                  >
                    <option value="unknown">不明</option>
                    <option value="me">私</option>
                    <option value="wife">妻</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-[#6A7C8E]">支払者（精算）</label>
                  <select
                    className="h-10 rounded-lg border border-[#E0E0E0] px-3 text-sm bg-white"
                    value={form.payer}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, payer: e.target.value as Payer }))
                    }
                  >
                    <option value="me">私</option>
                    <option value="wife">妻</option>
                    <option value="unknown">不明</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-[#6A7C8E]">負担区分</label>
                  <select
                    className="h-10 rounded-lg border border-[#E0E0E0] px-3 text-sm bg-white"
                    value={form.burden_type}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, burden_type: e.target.value as BurdenType }))
                    }
                  >
                    <option value="shared">共有</option>
                    <option value="wife_only">妻のみ</option>
                    <option value="me_only">私のみ</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-[#6A7C8E]">カテゴリ</label>
                  <select
                    className="h-10 rounded-lg border border-[#E0E0E0] px-3 text-sm bg-white"
                    value={form.category}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, category: e.target.value as Category }))
                    }
                  >
                    <option value="uncategorized">未分類</option>
                    <option value="food">食費</option>
                    <option value="daily">日用品</option>
                    <option value="outside_food">外食</option>
                    <option value="utility">光熱費</option>
                    <option value="travel">旅行</option>
                    <option value="other">その他</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-[#6A7C8E]">メモ</label>
                  <textarea
                    className="min-h-[84px] rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm"
                    value={form.memo}
                    onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                    placeholder="任意"
                  />
                </div>

                {createMutation.error && (
                  <div className="text-sm text-red-600">
                    登録に失敗: {(createMutation.error as Error).message}
                  </div>
                )}

                <button
                  type="button"
                  className="mt-2 h-10 w-full rounded-lg bg-black text-white text-sm font-medium disabled:opacity-50"
                  disabled={!canSubmit || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? "登録中..." : "追加する"}
                </button>

                <div className="text-[11px] text-[#6A7C8E]">
                  ※ このフォームはあとで react-hook-form + zod に置き換え可能
                </div>
              </div>
          </div>
        </div>

        {/* Right: expenses table */}
        <div className="lg:col-span-8">
          <div className="rounded-xl border border-[#E0E0E0] bg-white">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-base font-semibold">支出一覧</div>
                <div className="mt-1 text-xs text-[#6A7C8E]">
                  対象期間: {startISO} 〜 {endISO}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs text-[#6A7C8E]">
                  {totalCount ? `${totalCount}件` : ""}
                </div>

                <button
                  type="button"
                  className="h-9 px-3 rounded-lg bg-white border border-[#E0E0E0] hover:bg-[#F7FAFD] text-sm font-medium disabled:opacity-50"
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
                  <tr className="border-t border-b border-[#EEF4FA] bg-[#FAFCFF] text-[#6A7C8E]">
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      日付
                    </th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      購入先
                    </th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      カード利用者
                    </th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      区分
                    </th>
                    <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
                      金額
                    </th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      ソース
                    </th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      メモ
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {expensesQuery.isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[#6A7C8E]">
                        読み込み中...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[#6A7C8E]">
                        データがありません
                      </td>
                    </tr>
                  ) : (
                    rows.map((e) => (
                      <tr key={e.id} className="border-b border-[#EEF4FA] hover:bg-[#FAFCFF]">
                        <td className="px-4 py-3 whitespace-nowrap">{e.date}</td>
                        <td className="px-4 py-3 min-w-[180px]">{e.store}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {labelCardUser(e.card_user)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {labelBurdenType(e.burden_type)}
                        </td>
                        <td
                          className={`px-4 py-3 whitespace-nowrap text-right font-medium ${
                            isHighAmount(e.amount) ? "text-red-600" : ""
                          }`}
                        >
                          {yen(e.amount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{labelSource(e.source)}</td>
                        <td className="px-4 py-3 min-w-[200px] text-[#4B5B6A]">
                          {e.memo || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="text-xs text-[#6A7C8E]">ページ: {page}</div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 px-3 rounded-lg bg-white border border-[#E0E0E0] hover:bg-[#F7FAFD] text-sm font-medium disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!expensesQuery.data?.previous || expensesQuery.isFetching}
                >
                  前へ
                </button>

                <button
                  type="button"
                  className="h-9 px-3 rounded-lg bg-white border border-[#E0E0E0] hover:bg-[#F7FAFD] text-sm font-medium disabled:opacity-50"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!expensesQuery.data?.next || expensesQuery.isFetching}
                >
                  次へ
                </button>
              </div>
            </div>

            {/* Footer hint */}
            <div className="px-5 pb-5 text-[11px] text-[#6A7C8E]">
              金額が {yen(10000)} 以上は赤表示
            </div>
          </div>
        </div>
      </div>
    </div>
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
    <div className="bg-white border border-[#E0E0E0] rounded-xl p-5">
      <div className="text-sm text-[#6A7C8E]">{title}</div>

      {value === null ? (
        <div className="mt-3 h-7 w-32 rounded-md bg-[#EEF4FA] animate-pulse" />
      ) : (
        <div
          className={`mt-2 text-xl font-semibold ${
            accent ? "text-pink-400" : blue ? "text-[#1F8EED]" : ""
          }`}
        >
          {value}
        </div>
      )}
    </div>
  );
}
