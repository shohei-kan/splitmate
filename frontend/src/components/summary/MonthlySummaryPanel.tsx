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

  const monthKey = `${targetYM.year}-${pad2(targetYM.month)}`;

  useEffect(() => {
    const parsed = parseMonthParam(initialMonth);
    if (parsed) {
      setTargetYM(parsed);
    }
  }, [initialMonth]);

  useEffect(() => {
    if (!selectedCategory) return;
    detailSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [selectedCategory]);

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

  const selectCategory = (category: Category) => {
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
              onClick={() =>
                detailSectionRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
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
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E1E8F0] bg-[#F7FAFE] text-[#667D93]">
                    <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">日付</th>
                    <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">店名</th>
                    <th className="whitespace-nowrap px-6 py-3 text-right font-semibold">金額</th>
                    <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">支払い者</th>
                    <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">メモ</th>
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
                        <td className="whitespace-nowrap px-6 py-4 text-base text-[#4D6278]">
                          {expense.date}
                        </td>
                        <td className="px-6 py-4 text-base text-[#1A395B]">
                          {expense.store.trim() || "（店名なし）"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-base font-semibold text-[#163A5E]">
                          {yen(expense.amount)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-base text-[#596F85]">
                          {labelPayer(expense.payer)}
                        </td>
                        <td className="px-6 py-4 text-base text-[#596F85]">
                          {expense.memo || "—"}
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
