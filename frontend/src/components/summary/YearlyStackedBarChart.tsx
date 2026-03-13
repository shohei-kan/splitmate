import type { YearlySummaryMonth } from "../../api/types";
import { yen } from "../../lib/format";

type YearlyStackedBarChartProps = {
  months: YearlySummaryMonth[];
};

function monthLabel(month: string) {
  return `${Number(month.slice(5, 7))}月`;
}

function categoryColor(category: string) {
  if (category === "food") return "#5FA37C";
  if (category === "daily") return "#6C93C7";
  if (category === "outside_food") return "#D19961";
  if (category === "utility") return "#8B70BE";
  if (category === "travel") return "#5E9DAC";
  if (category === "other") return "#A38868";
  return "#8A97A4";
}

export function YearlyStackedBarChart({ months }: YearlyStackedBarChartProps) {
  const maxTotal = Math.max(...months.map((month) => month.total_amount), 0);

  if (maxTotal === 0) {
    return <div className="text-sm text-[#6A7C8E]">この年の集計データはまだありません。</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 items-end gap-3">
        {months.map((month) => {
          const monthHeight = maxTotal > 0 ? (month.total_amount / maxTotal) * 100 : 0;
          return (
            <div key={month.month} className="flex flex-col items-center gap-2">
              <div className="text-[11px] text-[#6A7C8E]">{yen(month.total_amount)}</div>
              <div className="flex h-56 w-full max-w-12 items-end">
                <div
                  className="flex w-full flex-col overflow-hidden rounded-t-lg bg-[#EEF1F5]"
                  style={{ height: `${monthHeight}%`, minHeight: month.total_amount > 0 ? "8%" : "0%" }}
                  title={`${month.month} ${yen(month.total_amount)}`}
                >
                  {[...month.categories]
                    .reverse()
                    .map((category) => {
                      const segmentHeight =
                        month.total_amount > 0 ? (category.amount / month.total_amount) * 100 : 0;
                      return (
                        <div
                          key={category.category}
                          style={{
                            height: `${segmentHeight}%`,
                            backgroundColor: categoryColor(category.category),
                          }}
                          title={`${category.label}: ${yen(category.amount)}`}
                        />
                      );
                    })}
                </div>
              </div>
              <div className="text-xs font-semibold text-[#60758B]">{monthLabel(month.month)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
