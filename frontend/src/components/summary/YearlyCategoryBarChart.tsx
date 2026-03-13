import type { YearlySummaryMonth } from "../../api/types";
import { yen } from "../../lib/format";

type YearlyCategoryBarChartProps = {
  months: YearlySummaryMonth[];
  category: string;
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

export function YearlyCategoryBarChart({ months, category }: YearlyCategoryBarChartProps) {
  const amounts = months.map((month) => {
    const current = month.categories.find((item) => item.category === category);
    return current?.amount ?? 0;
  });
  const maxAmount = Math.max(...amounts, 0);

  return (
    <div className="grid grid-cols-12 items-end gap-3">
      {months.map((month, index) => {
        const amount = amounts[index];
        const height = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
        return (
          <div key={month.month} className="flex flex-col items-center gap-2">
            <div className="text-[11px] text-[#6A7C8E]">{yen(amount)}</div>
            <div className="flex h-48 w-full max-w-12 items-end rounded-t-lg bg-[#EEF1F5]">
              <div
                className="w-full rounded-t-lg"
                style={{
                  height: `${height}%`,
                  minHeight: amount > 0 ? "6%" : "0%",
                  backgroundColor: categoryColor(category),
                }}
              />
            </div>
            <div className="text-xs font-semibold text-[#60758B]">{monthLabel(month.month)}</div>
          </div>
        );
      })}
    </div>
  );
}
