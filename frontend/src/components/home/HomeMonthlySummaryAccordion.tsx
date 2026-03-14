import { Link } from "react-router-dom";

import { Card } from "../ui/Card";
import type { MonthlyCategorySummary } from "../../api/types";
import { MonthlyCategoryBarChart } from "./MonthlyCategoryBarChart";
import { yen } from "../../lib/format";

type HomeMonthlySummaryAccordionProps = {
  isOpen: boolean;
  onToggle: () => void;
  data?: MonthlyCategorySummary;
  isLoading: boolean;
  error?: Error | null;
  summaryLinkTo: string;
};

export function HomeMonthlySummaryAccordion({
  isOpen,
  onToggle,
  data,
  isLoading,
  error,
  summaryLinkTo,
}: HomeMonthlySummaryAccordionProps) {
  return (
    <Card className="px-4 py-3 sm:px-5 sm:py-3.5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 text-left"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="text-base font-semibold text-[#143A61]">今月の内訳</div>
        <div className="text-2xl leading-none text-[#60758B]">{isOpen ? "−" : "+"}</div>
      </button>

      {isOpen && (
        <div className="mt-4 border-t border-[#E7EDF4] pt-4">
          {isLoading ? (
            <div className="text-sm text-[#6A7C8E]">集計を読み込み中...</div>
          ) : error ? (
            <div className="text-sm text-red-600">集計の取得に失敗しました: {error.message}</div>
          ) : data ? (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-4 text-sm text-[#5F7388]">
                <div>対象月: {data.month}</div>
                <div>総支出: {yen(data.total_amount)}</div>
                <div>件数: {data.total_count}件</div>
              </div>
              <MonthlyCategoryBarChart items={data.categories} showTopExpenses />
              <div className="flex justify-end">
                <Link
                  to={summaryLinkTo}
                  className="inline-flex items-center rounded-full border border-[#D1DCE8] bg-white px-4 py-2 text-sm font-semibold text-[#143A61] hover:bg-[#F7FAFD]"
                >
                  集計を見る
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[#6A7C8E]">表示できる集計がありません。</div>
          )}
        </div>
      )}
    </Card>
  );
}
