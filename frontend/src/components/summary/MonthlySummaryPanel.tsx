import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchMonthlyCategorySummary } from "../../api/summary";
import { MonthlyCategoryBarChart } from "../home/MonthlyCategoryBarChart";
import { Card } from "../ui/Card";
import { qk } from "../../lib/queryKeys";
import { getInitialYearMonth, shiftMonth } from "../../lib/month";
import { yen } from "../../lib/format";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function MonthlySummaryPanel() {
  const initial = useMemo(() => getInitialYearMonth(), []);
  const [targetYM, setTargetYM] = useState(initial);

  const monthKey = `${targetYM.year}-${pad2(targetYM.month)}`;

  const summaryQuery = useQuery({
    queryKey: qk.summaryMonthlyCategory(monthKey),
    queryFn: () => fetchMonthlyCategorySummary(monthKey),
  });

  const goMonth = (delta: number) => {
    setTargetYM((prev) => shiftMonth(prev.year, prev.month, delta));
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
        <div className="text-lg font-bold text-[#143A61]">カテゴリ別横棒グラフ</div>
        <div className="mt-1 text-sm text-[#6A7C8E]">対象月: {monthKey}</div>
        <div className="mt-5">
          {summaryQuery.isLoading ? (
            <div className="text-sm text-[#6A7C8E]">集計を読み込み中...</div>
          ) : summaryQuery.error ? (
            <div className="text-sm text-red-600">
              集計の取得に失敗しました: {(summaryQuery.error as Error).message}
            </div>
          ) : (
            <MonthlyCategoryBarChart items={summaryQuery.data?.categories ?? []} />
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
                    className="border-b border-[#EEF3F8] last:border-b-0"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-base text-[#1A395B]">
                      {item.label}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-base text-[#1A395B]">
                      {yen(item.amount)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-base text-[#596F85]">
                      {item.ratio.toFixed(1)}%
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-base text-[#596F85]">
                      {item.count}件
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
