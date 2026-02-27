// frontend/src/pages/HomePage.tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { fetchMonthlySummary } from "../api/summary";
import { fetchExpenses } from "../api/expenses";
import type { Expense } from "../api/types";
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

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const targetYM = useMemo(() => {
    const yearParam = Number(searchParams.get("year"));
    const monthParam = Number(searchParams.get("month"));
    const hasValidYear = Number.isInteger(yearParam) && yearParam > 0;
    const hasValidMonth = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12;

    if (hasValidYear && hasValidMonth) {
      return { year: yearParam, month: monthParam };
    }

    return getInitialYearMonth();
  }, [searchParams]);

  // 一覧ページ（とりあえず 1ページ目だけでOK。後で prev/next 作れる）
  const [page, setPage] = useState(1);

  const { startISO, endISO } = useMemo(
    () => getMonthRangeISO(targetYM.year, targetYM.month),
    [targetYM.year, targetYM.month]
  );

  const summaryQuery = useQuery({
    queryKey: ["summary", targetYM.year, targetYM.month],
    queryFn: () => fetchMonthlySummary(targetYM.year, targetYM.month),
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", targetYM.year, targetYM.month, page],
    queryFn: () =>
      fetchExpenses({
        dateGte: startISO,
        dateLte: endISO,
        ordering: "-date",
        page,
      }),
  });

  const data = summaryQuery.data;
  const meShared = data ? data.shared_total - data.wife_shared : null;
  const showWifePersonal = (data?.wife_personal ?? 0) > 0;

  const go = (delta: number) => {
    const nextYM = shiftMonth(targetYM.year, targetYM.month, delta);
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("year", String(nextYM.year));
    nextSearchParams.set("month", String(nextYM.month));
    setSearchParams(nextSearchParams);
    setPage(1);
  };

  const goInitial = () => {
    const nextYM = getInitialYearMonth();
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("year", String(nextYM.year));
    nextSearchParams.set("month", String(nextYM.month));
    setSearchParams(nextSearchParams);
    setPage(1);
  };

  const rows = expensesQuery.data?.results ?? [];
  const totalCount = expensesQuery.data?.count ?? 0;

  const anyError = summaryQuery.error || expensesQuery.error;

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
          <Summary title="妻の個人利用" value={data ? yen(data.wife_personal) : null} accent />
        )}

        <Summary title="折半額" value={data ? yen(data.half) : null} blue />

        <Summary
          title="振込（妻→私）"
          value={data ? yen(data.transfer_amount) : null}
          blue
        />
      </div>

      {/* Main area: (Left) form placeholder + (Right) table */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: manual form placeholder */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-[#E0E0E0] bg-white p-5">
            <div className="text-base font-semibold">支出を追加</div>
            <div className="mt-3 rounded-lg border border-dashed border-[#B0C4D8] bg-white/50 p-6 text-sm text-[#6A7C8E]">
              次：手入力フォーム（ここに配置）
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
                <div className="text-xs text-[#6A7C8E]">{totalCount ? `${totalCount}件` : ""}</div>

                <button
                  type="button"
                  className="h-9 px-3 rounded-lg bg-white border border-[#E0E0E0] hover:bg-[#F7FAFD] text-sm font-medium"
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
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">日付</th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">購入先</th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      カード利用者
                    </th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">区分</th>
                    <th className="px-4 py-3 text-right font-medium whitespace-nowrap">金額</th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">ソース</th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">メモ</th>
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
                        <td className="px-4 py-3 whitespace-nowrap">{labelCardUser(e.card_user)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{labelBurdenType(e.burden_type)}</td>
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

            {/* Pagination (optional minimal UI) */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="text-xs text-[#6A7C8E]">
                ページ: {page}
              </div>

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
  value: string | null; // null の時は skeleton 表示
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
