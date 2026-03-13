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
};

export function HomeMonthlySummaryAccordion({
  isOpen,
  onToggle,
  data,
  isLoading,
  error,
}: HomeMonthlySummaryAccordionProps) {
  return (
    <Card className="p-5 sm:p-6">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 text-left"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div>
          <div className="text-lg font-bold text-[#143A61]">今月の内訳を見る</div>
          <div className="mt-1 text-sm text-[#6A7C8E]">
            カテゴリごとの支出額と割合を確認できます
          </div>
        </div>
        <div className="text-2xl text-[#60758B]">{isOpen ? "−" : "+"}</div>
      </button>

      {isOpen && (
        <div className="mt-5 border-t border-[#E7EDF4] pt-5">
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
            </div>
          ) : (
            <div className="text-sm text-[#6A7C8E]">表示できる集計がありません。</div>
          )}
        </div>
      )}
    </Card>
  );
}
