import type { YearlySummary } from "../../api/types";
import { yen } from "../../lib/format";
import { Card } from "../ui/Card";
import { YearlyStackedBarChart } from "./YearlyStackedBarChart";

type YearlyOverviewChartSectionProps = {
  data: YearlySummary;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
};

export function YearlyOverviewChartSection({
  data,
  selectedCategory,
  onSelectCategory,
}: YearlyOverviewChartSectionProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="px-6 py-5">
          <div className="text-base font-semibold text-[#6A7C8E]">年間総支出</div>
          <div className="mt-2 text-3xl font-bold text-[#163A5E]">{yen(data.total_amount)}</div>
        </Card>
        <Card className="px-6 py-5">
          <div className="text-base font-semibold text-[#6A7C8E]">月平均</div>
          <div className="mt-2 text-3xl font-bold text-[#163A5E]">
            {yen(data.average_monthly_amount)}
          </div>
        </Card>
        <Card className="px-6 py-5">
          <div className="text-base font-semibold text-[#6A7C8E]">年間件数</div>
          <div className="mt-2 text-3xl font-bold text-[#163A5E]">{data.total_count}件</div>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="text-lg font-bold text-[#143A61]">年次積み上げ棒グラフ</div>
        <div className="mt-1 text-sm text-[#6A7C8E]">
          各月の総支出とカテゴリ構成をまとめて確認できます。
        </div>
        <div className="mt-5">
          <YearlyStackedBarChart
            months={data.months}
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
          />
        </div>
      </Card>
    </div>
  );
}
