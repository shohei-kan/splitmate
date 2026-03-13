import type { YearlySummaryMonth } from "../../api/types";
import { yen } from "../../lib/format";
import { categoryColor } from "./categoryColors";

type YearlyStackedBarChartProps = {
  months: YearlySummaryMonth[];
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
};

function monthLabel(month: string) {
  return `${Number(month.slice(5, 7))}月`;
}

function monthTitle(month: string) {
  const year = month.slice(0, 4);
  return `${year}年${monthLabel(month)}`;
}

export function YearlyStackedBarChart({
  months,
  selectedCategory,
  onSelectCategory,
}: YearlyStackedBarChartProps) {
  const maxTotal = Math.max(...months.map((month) => month.total_amount), 0);
  const legend = Array.from(
    new Map(
      months.flatMap((month) =>
        month.categories.map((category) => [category.category, category.label] as const)
      )
    ).entries()
  ).map(([category, label]) => ({ category, label }));

  if (maxTotal === 0) {
    return <div className="text-sm text-[#6A7C8E]">この年の集計データはまだありません。</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {legend.map((item) => {
          const isSelected = selectedCategory === item.category;
          return (
            <button
              key={item.category}
              type="button"
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                isSelected
                  ? "border-[#143A61] bg-[#F4F8FC] text-[#143A61]"
                  : "border-[#D7E1EC] bg-white text-[#60758B]"
              }`}
              onClick={() => onSelectCategory?.(item.category)}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: categoryColor(item.category) }}
                aria-hidden="true"
              />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-12 items-end gap-3">
        {months.map((month) => {
          const monthHeight = maxTotal > 0 ? (month.total_amount / maxTotal) * 100 : 0;
          return (
            <div key={month.month} className="group relative flex flex-col items-center gap-2">
              <div className="text-[11px] text-[#6A7C8E]">{yen(month.total_amount)}</div>
              <div className="flex h-56 w-full max-w-12 items-end">
                <div
                  className="flex w-full cursor-default flex-col overflow-hidden rounded-t-lg bg-[#EEF1F5] outline-none"
                  style={{ height: `${monthHeight}%`, minHeight: month.total_amount > 0 ? "8%" : "0%" }}
                  tabIndex={0}
                  aria-label={`${monthTitle(month.month)} 総支出 ${yen(month.total_amount)}`}
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
                        />
                      );
                    })}
                </div>
              </div>
              <div className="text-xs font-semibold text-[#60758B]">{monthLabel(month.month)}</div>
              <div className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden w-52 -translate-x-1/2 -translate-y-full rounded-xl border border-[#D7E1EC] bg-white/98 p-3 text-left shadow-lg group-hover:block group-focus-within:block">
                <div className="text-sm font-semibold text-[#143A61]">{monthTitle(month.month)}</div>
                <div className="mt-1 text-xs text-[#5F7388]">総支出: {yen(month.total_amount)}</div>
                <div className="mt-2 space-y-1">
                  {month.categories.length > 0 ? (
                    month.categories.map((category) => (
                      <div key={category.category} className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-[#4F6479]">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: categoryColor(category.category) }}
                            aria-hidden="true"
                          />
                          <span>{category.label}</span>
                        </div>
                        <span className="font-medium text-[#143A61]">{yen(category.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[#7A8C9E]">支出なし</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
