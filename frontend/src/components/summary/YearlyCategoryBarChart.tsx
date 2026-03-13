import type { YearlySummaryMonth } from "../../api/types";
import { yen } from "../../lib/format";
import { categoryColor, categoryTrackColor } from "./categoryColors";

type YearlyCategoryBarChartProps = {
  months: YearlySummaryMonth[];
  category: string;
  categoryLabel?: string;
};

function monthLabel(month: string) {
  return `${Number(month.slice(5, 7))}月`;
}

export function YearlyCategoryBarChart({
  months,
  category,
  categoryLabel,
}: YearlyCategoryBarChartProps) {
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
          <div key={month.month} className="group relative flex flex-col items-center gap-2">
            <div className="text-[11px] text-[#6A7C8E]">{yen(amount)}</div>
            <div
              className="flex h-48 w-full max-w-12 items-end rounded-t-lg"
              style={{ backgroundColor: categoryTrackColor(category) }}
            >
              <div
                className="w-full rounded-t-lg outline-none"
                style={{
                  height: `${height}%`,
                  minHeight: amount > 0 ? "6%" : "0%",
                  backgroundColor: categoryColor(category),
                }}
                tabIndex={0}
                aria-label={`${monthLabel(month.month)} ${categoryLabel ?? category} ${yen(amount)}`}
              />
            </div>
            <div className="text-xs font-semibold text-[#60758B]">{monthLabel(month.month)}</div>
            <div className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden w-40 -translate-x-1/2 -translate-y-full rounded-xl border border-[#D7E1EC] bg-white/98 p-3 text-left shadow-lg group-hover:block group-focus-within:block">
              <div className="text-sm font-semibold text-[#143A61]">{monthLabel(month.month)}</div>
              <div className="mt-1 text-xs text-[#4F6479]">
                {categoryLabel ?? category}: <span className="font-medium text-[#143A61]">{yen(amount)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
