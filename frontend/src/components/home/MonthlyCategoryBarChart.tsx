import type { MonthlyCategorySummaryItem } from "../../api/types";
import { yen } from "../../lib/format";
import { categoryColor, categoryTrackColor } from "../summary/categoryColors";

type MonthlyCategoryBarChartProps = {
  items: MonthlyCategorySummaryItem[];
  onSelectCategory?: (category: MonthlyCategorySummaryItem["category"]) => void;
  showTopExpenses?: boolean;
};

function categoryBarColors(category: MonthlyCategorySummaryItem["category"]) {
  return {
    fill: categoryColor(category),
    track: categoryTrackColor(category),
  };
}

export function MonthlyCategoryBarChart({
  items,
  onSelectCategory,
  showTopExpenses = false,
}: MonthlyCategoryBarChartProps) {
  if (items.length === 0) {
    return <div className="text-sm text-[#6A7C8E]">この月のカテゴリ集計はまだありません。</div>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const width = `${Math.max(Math.round(item.ratio), item.ratio > 0 ? 1 : 0)}%`;
        const colors = categoryBarColors(item.category);
        const content = (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="font-semibold text-[#153B61]">{item.label}</div>
              <div className="text-right text-[#5F7388]">
                <span>{yen(item.amount)}</span>
                <span className="ml-2 text-xs">{item.ratio.toFixed(1)}%</span>
              </div>
            </div>
            <div
              className="h-3 rounded-full"
              style={{ backgroundColor: colors.track }}
            >
              <div
                className="h-3 rounded-full"
                style={{ width, backgroundColor: colors.fill }}
                aria-hidden="true"
              />
            </div>
            <div className="text-xs text-[#7A8C9E]">{item.count}件</div>
          </>
        );
        return (
          <div key={item.category} className="group relative space-y-1">
            {onSelectCategory ? (
              <button
                type="button"
                className="block w-full cursor-pointer text-left"
                onClick={() => onSelectCategory(item.category)}
              >
                {content}
              </button>
            ) : (
              content
            )}
            {showTopExpenses && (
              <div className="pointer-events-none absolute left-0 top-0 z-10 hidden w-80 max-w-[calc(100vw-2rem)] -translate-y-full rounded-xl border border-[#D7E1EC] bg-white/98 p-3 text-left shadow-lg group-hover:block">
                <div className="text-sm font-semibold text-[#143A61]">
                  {item.label} の上位明細
                </div>
                <div className="mt-2 space-y-1.5">
                  {item.top_expenses.length > 0 ? (
                    item.top_expenses.map((expense, index) => (
                      <div
                        key={`${item.category}-${expense.date}-${expense.store}-${index}`}
                        className="rounded-lg bg-[#F8FBFE] px-2.5 py-2 text-xs text-[#4F6479]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="whitespace-nowrap text-[#5F7388]">
                            {expense.date.slice(5).replace("-", "/")}
                          </span>
                          <span className="whitespace-nowrap font-medium text-[#143A61]">
                            {yen(expense.amount)}
                          </span>
                        </div>
                        <div className="mt-1 wrap-break-word leading-snug text-[#35516E]">
                          {expense.store}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[#7A8C9E]">明細なし</div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
