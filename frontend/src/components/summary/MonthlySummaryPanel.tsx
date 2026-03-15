import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchMonthlyCategorySummary } from "../../api/summary";
import { fetchExpenses } from "../../api/expenses";
import { MonthlyCategoryBarChart } from "../home/MonthlyCategoryBarChart";
import { Card } from "../ui/Card";
import { qk } from "../../lib/queryKeys";
import { getInitialYearMonth, shiftMonth } from "../../lib/month";
import { getMonthRange } from "../../lib/monthRange";
import { yen } from "../../lib/format";
import type { Category, Expense } from "../../api/types";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseMonthParam(month?: string) {
  if (!month) return null;
  const matched = month.match(/^(\d{4})-(\d{2})$/);
  if (!matched) return null;
  const year = Number(matched[1]);
  const monthNumber = Number(matched[2]);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return null;
  }
  return { year, month: monthNumber };
}

function formatCompactDate(date: string) {
  const matched = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return date;
  return `${Number(matched[2])}/${Number(matched[3])}`;
}

function labelPayer(v: Expense["payer"] | null | undefined) {
  if (!v) return "—";
  if (v === "me") return "パパ";
  if (v === "wife") return "ママ";
  return "不明";
}

async function fetchAllMonthlyCategoryExpenses(params: {
  year: number;
  month: number;
  category: Category;
}) {
  const { startISO, endISO } = getMonthRange(params.year, params.month);
  let page = 1;
  const results: Expense[] = [];

  while (true) {
    const res = await fetchExpenses({
      dateFrom: startISO,
      dateTo: endISO,
      category: params.category,
      ordering: "-amount",
      page,
    });
    results.push(...res.results);
    if (!res.next) break;
    page += 1;
  }

  return results;
}

export function MonthlySummaryPanel({ initialMonth }: { initialMonth?: string }) {
  const initial = useMemo(
    () => parseMonthParam(initialMonth) ?? getInitialYearMonth(),
    [initialMonth]
  );
  const [targetYM, setTargetYM] = useState(initial);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRef = useRef(false);

  const monthKey = `${targetYM.year}-${pad2(targetYM.month)}`;

  useEffect(() => {
    const parsed = parseMonthParam(initialMonth);
    if (parsed) {
      setTargetYM(parsed);
    }
  }, [initialMonth]);

  const summaryQuery = useQuery({
    queryKey: qk.summaryMonthlyCategory(monthKey),
    queryFn: () => fetchMonthlyCategorySummary(monthKey),
  });

  const selectedCategoryQuery = useQuery({
    queryKey:
      selectedCategory
        ? [...qk.expensesMonth(targetYM.year, targetYM.month), "category-detail", selectedCategory]
        : [...qk.expensesMonth(targetYM.year, targetYM.month), "category-detail", "none"],
    queryFn: () =>
      fetchAllMonthlyCategoryExpenses({
        year: targetYM.year,
        month: targetYM.month,
        category: selectedCategory as Category,
      }),
    enabled: !!selectedCategory,
  });

  const scrollToDetailSection = () => {
    const element = detailSectionRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const margin = 24;
    const fitsViewport = rect.height <= viewportHeight - margin * 2;
    const top = fitsViewport
      ? window.scrollY + rect.bottom - viewportHeight + margin
      : window.scrollY + rect.top - margin;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (!selectedCategory || selectedCategoryQuery.isLoading || !pendingScrollRef.current) {
      return;
    }

    pendingScrollRef.current = false;
    const frameId = window.requestAnimationFrame(() => {
      scrollToDetailSection();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [selectedCategory, selectedCategoryQuery.isLoading, selectedCategoryQuery.data]);

  const selectCategory = (category: Category) => {
    pendingScrollRef.current = true;
    setSelectedCategory(category);
  };

  const goMonth = (delta: number) => {
    setTargetYM((prev) => shiftMonth(prev.year, prev.month, delta));
    setSelectedCategory(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          className="h-10 w-10 rounded-full border border-transparent text-2xl text-[#60758B] hover:border-[#D5E2EF] hover:bg-white"
          onClick={() => goMonth(-1)}
          aria-label="前月"
        >
          ‹
        </button>

        <div className="min-w-40 text-center text-2xl font-bold text-[#19385A]">
          {targetYM.year}年{targetYM.month}月
        </div>

        <button
          type="button"
          className="h-10 w-10 rounded-full border border-transparent text-2xl text-[#60758B] hover:border-[#D5E2EF] hover:bg-white"
          onClick={() => goMonth(1)}
          aria-label="次月"
        >
          ›
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="px-6 py-5">
          <div className="text-base font-semibold text-[#6A7C8E]">総支出</div>
          {summaryQuery.data ? (
            <div className="mt-2 text-3xl font-bold text-[#163A5E]">
              {yen(summaryQuery.data.total_amount)}
            </div>
          ) : (
            <div className="mt-3 h-8 w-32 animate-pulse rounded-md bg-[#EEF4FA]" />
          )}
        </Card>

        <Card className="px-6 py-5">
          <div className="text-base font-semibold text-[#6A7C8E]">件数</div>
          {summaryQuery.data ? (
            <div className="mt-2 text-3xl font-bold text-[#163A5E]">
              {summaryQuery.data.total_count}件
            </div>
          ) : (
            <div className="mt-3 h-8 w-24 animate-pulse rounded-md bg-[#EEF4FA]" />
          )}
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-[#143A61]">カテゴリ別横棒グラフ</div>
            <div className="mt-1 text-sm text-[#6A7C8E]">対象月: {monthKey}</div>
          </div>
          {selectedCategory && (
            <button
              type="button"
              className="rounded-full border border-[#D1DCE8] bg-white px-4 py-2 text-sm font-semibold text-[#143A61] hover:bg-[#F7FAFD]"
              onClick={scrollToDetailSection}
            >
              カテゴリ別詳細へ
            </button>
          )}
        </div>
        <div className="mt-5">
          {summaryQuery.isLoading ? (
            <div className="text-sm text-[#6A7C8E]">集計を読み込み中...</div>
          ) : summaryQuery.error ? (
            <div className="text-sm text-red-600">
              集計の取得に失敗しました: {(summaryQuery.error as Error).message}
            </div>
          ) : (
            <MonthlyCategoryBarChart
              items={summaryQuery.data?.categories ?? []}
              onSelectCategory={selectCategory}
            />
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[#E1E8F0] px-6 py-4">
          <div className="text-lg font-bold text-[#143A61]">カテゴリ別一覧</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#E1E8F0] bg-[#F7FAFE] text-[#667D93]">
                <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">カテゴリ</th>
                <th className="whitespace-nowrap px-6 py-3 text-right font-semibold">金額</th>
                <th className="whitespace-nowrap px-6 py-3 text-right font-semibold">割合</th>
                <th className="whitespace-nowrap px-6 py-3 text-right font-semibold">件数</th>
              </tr>
            </thead>
            <tbody>
              {summaryQuery.isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[#6A7C8E]">
                    読み込み中...
                  </td>
                </tr>
              ) : (summaryQuery.data?.categories ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[#6A7C8E]">
                    この月の集計データはありません
                  </td>
                </tr>
              ) : (
                summaryQuery.data?.categories.map((item) => (
                  <tr
                    key={item.category}
                    className={`border-b border-[#EEF3F8] last:border-b-0 ${
                      selectedCategory === item.category ? "bg-[#F7FAFD]" : ""
                    }`}
                  >
                    <td colSpan={4} className="p-0">
                      <button
                        type="button"
                        className="grid w-full grid-cols-[minmax(0,1fr)_120px_90px_90px] items-center px-6 py-4 text-left"
                        onClick={() => selectCategory(item.category)}
                      >
                        <span className="whitespace-nowrap text-base text-[#1A395B]">{item.label}</span>
                        <span className="whitespace-nowrap text-right text-base text-[#1A395B]">
                          {yen(item.amount)}
                        </span>
                        <span className="whitespace-nowrap text-right text-base text-[#596F85]">
                          {item.ratio.toFixed(1)}%
                        </span>
                        <span className="whitespace-nowrap text-right text-base text-[#596F85]">
                          {item.count}件
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div ref={detailSectionRef} className="scroll-mt-24">
      <Card className="overflow-hidden">
        <div className="border-b border-[#E1E8F0] px-6 py-4">
          <div className="text-lg font-bold text-[#143A61]">カテゴリ別明細</div>
        </div>
        {!selectedCategory ? (
          <div className="px-6 py-8 text-sm text-[#6A7C8E]">
            カテゴリを選ぶと明細を表示します。
          </div>
        ) : selectedCategoryQuery.isLoading ? (
          <div className="px-6 py-8 text-sm text-[#6A7C8E]">明細を読み込み中...</div>
        ) : selectedCategoryQuery.error ? (
          <div className="px-6 py-8 text-sm text-red-600">
            明細の取得に失敗しました: {(selectedCategoryQuery.error as Error).message}
          </div>
        ) : (
          <>
            <div className="px-6 py-4 text-sm text-[#5F7388]">
              {(summaryQuery.data?.categories.find((item) => item.category === selectedCategory)?.label ?? "カテゴリ")}
              の明細（{selectedCategoryQuery.data?.length ?? 0}件）
            </div>
            <div className="sm:hidden">
              {(selectedCategoryQuery.data ?? []).length === 0 ? (
                <div className="px-6 py-8 text-center text-[#6A7C8E]">明細がありません</div>
              ) : (
                <div className="space-y-3 p-4">
                  {(selectedCategoryQuery.data ?? []).map((expense) => (
                    <details
                      key={expense.id}
                      className="rounded-2xl border border-[#E1E8F0] bg-white/95 p-4"
                    >
                      <summary className="list-none cursor-pointer">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-[#6A7C8E]">{expense.date}</div>
                            <div className="mt-2 truncate text-base font-semibold text-[#1A395B]">
                              {expense.store.trim() || "（店名なし）"}
                            </div>
                          </div>
                          <div className="shrink-0 text-right text-base font-semibold text-[#163A5E]">
                            {yen(expense.amount)}
                          </div>
                        </div>
                      </summary>

                      <div className="mt-4 space-y-3 border-t border-[#EEF3F8] pt-4 text-sm text-[#596F85]">
                        <div>
                          <div className="text-xs text-[#7A8C9E]">支払い者</div>
                          <div className="mt-1">{labelPayer(expense.payer)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-[#7A8C9E]">メモ</div>
                          <div className="mt-1">{expense.memo || "—"}</div>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-[#E1E8F0] bg-[#F7FAFE] text-[#667D93]">
                    <th className="w-16 whitespace-nowrap px-2 py-3 text-left font-semibold lg:w-[14%] lg:px-5">日付</th>
                    <th className="w-[42%] px-2 py-3 text-left font-semibold lg:w-[44%] lg:px-5">購入先</th>
                    <th className="w-24 whitespace-nowrap px-2 py-3 text-right font-semibold lg:w-[14%] lg:px-5">金額</th>
                    <th className="w-20 whitespace-nowrap px-2 py-3 text-left font-semibold text-xs lg:w-[14%] lg:px-5 lg:text-sm">
                      <span className="lg:hidden">支払</span>
                      <span className="hidden lg:inline">支払い者</span>
                    </th>
                    <th className="w-[22%] px-2 py-3 text-left font-semibold lg:w-[14%] lg:px-5">メモ</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedCategoryQuery.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-[#6A7C8E]">
                        明細がありません
                      </td>
                    </tr>
                  ) : (
                    (selectedCategoryQuery.data ?? []).map((expense) => (
                      <tr key={expense.id} className="border-b border-[#EEF3F8] last:border-b-0">
                        <td className="whitespace-nowrap px-2 py-4 text-sm text-[#4D6278] lg:px-5 lg:text-base">
                          <span className="lg:hidden">{formatCompactDate(expense.date)}</span>
                          <span className="hidden lg:inline">{expense.date}</span>
                        </td>
                        <td className="px-2 py-4 text-sm text-[#1A395B] align-middle lg:px-5 lg:text-base">
                          <span className="block truncate lg:hidden">
                            {expense.store.trim() || "（店名なし）"}
                          </span>
                          <span
                            className="hidden break-words leading-5 lg:[display:-webkit-box] lg:overflow-hidden lg:[-webkit-line-clamp:2] lg:[-webkit-box-orient:vertical]"
                          >
                            {expense.store.trim() || "（店名なし）"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-4 text-right text-sm font-semibold text-[#163A5E] lg:px-5 lg:text-base">
                          {yen(expense.amount)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-4 text-sm text-[#596F85] lg:px-5">
                          {labelPayer(expense.payer)}
                        </td>
                        <td className="px-2 py-4 text-sm text-[#596F85] lg:px-5">
                          <span className="block truncate">
                            {expense.memo || "—"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
      </div>
    </div>
  );
}
