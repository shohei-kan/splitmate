import type { MonthlyCategorySummaryItem } from "../../api/types";
import { yen } from "../../lib/format";

type MonthlyCategoryBarChartProps = {
  items: MonthlyCategorySummaryItem[];
};

function categoryBarColors(category: MonthlyCategorySummaryItem["category"]) {
  if (category === "food") {
    return { fill: "#24734B", track: "#E7F6EC" };
  }
  if (category === "daily") {
    return { fill: "#2B5E9E", track: "#F1F6FF" };
  }
  if (category === "outside_food") {
    return { fill: "#A8641F", track: "#FFF4E7" };
  }
  if (category === "utility") {
    return { fill: "#6741A6", track: "#F3EDFF" };
  }
  if (category === "travel") {
    return { fill: "#1B6C80", track: "#E8FBFF" };
  }
  if (category === "other") {
    return { fill: "#7A5C36", track: "#F7F0E8" };
  }
  return { fill: "#5E6E7E", track: "#EEF1F5" };
}

export function MonthlyCategoryBarChart({ items }: MonthlyCategoryBarChartProps) {
  if (items.length === 0) {
    return <div className="text-sm text-[#6A7C8E]">この月のカテゴリ集計はまだありません。</div>;
  }

  const maxAmount = items[0]?.amount ?? 0;

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const width = maxAmount > 0 ? `${Math.max((item.amount / maxAmount) * 100, 8)}%` : "0%";
        const colors = categoryBarColors(item.category);
        return (
          <div key={item.category} className="space-y-1">
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
          </div>
        );
      })}
    </div>
  );
}
