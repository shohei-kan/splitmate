import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchYearlySummary } from "../../api/summary";
import { qk } from "../../lib/queryKeys";
import { Card } from "../ui/Card";
import { YearlyOverviewChartSection } from "./YearlyOverviewChartSection";
import { YearlyCategoryDetailSection } from "./YearlyCategoryDetailSection";

function getInitialYear() {
  return new Date().getFullYear();
}

export function YearlySummaryPanel() {
  const initialYear = useMemo(() => getInitialYear(), []);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedCategory, setSelectedCategory] = useState("food");

  const summaryQuery = useQuery({
    queryKey: qk.summaryYearly(selectedYear),
    queryFn: () => fetchYearlySummary(selectedYear),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          className="h-10 w-10 rounded-full border border-transparent text-2xl text-[#60758B] hover:border-[#D5E2EF] hover:bg-white"
          onClick={() => setSelectedYear((prev) => prev - 1)}
          aria-label="前年"
        >
          ‹
        </button>

        <div className="min-w-40 text-center text-2xl font-bold text-[#19385A]">
          {selectedYear}年
        </div>

        <button
          type="button"
          className="h-10 w-10 rounded-full border border-transparent text-2xl text-[#60758B] hover:border-[#D5E2EF] hover:bg-white"
          onClick={() => setSelectedYear((prev) => prev + 1)}
          aria-label="次年"
        >
          ›
        </button>
      </div>

      {summaryQuery.isLoading ? (
        <Card className="p-6">
          <div className="text-sm text-[#6A7C8E]">年次集計を読み込み中...</div>
        </Card>
      ) : summaryQuery.error ? (
        <Card className="p-6">
          <div className="text-sm text-red-600">
            年次集計の取得に失敗しました: {(summaryQuery.error as Error).message}
          </div>
        </Card>
      ) : summaryQuery.data ? (
        <>
          <YearlyOverviewChartSection data={summaryQuery.data} />
          <YearlyCategoryDetailSection
            data={summaryQuery.data}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </>
      ) : (
        <Card className="p-6">
          <div className="text-sm text-[#6A7C8E]">表示できる年次集計がありません。</div>
        </Card>
      )}
    </div>
  );
}
