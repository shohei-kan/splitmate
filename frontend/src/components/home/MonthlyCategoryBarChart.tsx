import type { MonthlyCategorySummaryItem } from "../../api/types";
import { yen } from "../../lib/format";

type MonthlyCategoryBarChartProps = {
  items: MonthlyCategorySummaryItem[];
};

function categoryBarColors(category: MonthlyCategorySummaryItem["category"]) {
  if (category === "food") {
    return { fill: "#5FA37C", track: "#E7F6EC" };
  }
  if (category === "daily") {
    return { fill: "#6C93C7", track: "#F1F6FF" };
  }
  if (category === "outside_food") {
    return { fill: "#D19961", track: "#FFF4E7" };
  }
  if (category === "utility") {
    return { fill: "#8B70BE", track: "#F3EDFF" };
  }
  if (category === "travel") {
    return { fill: "#5E9DAC", track: "#E8FBFF" };
  }
  if (category === "other") {
    return { fill: "#A38868", track: "#F7F0E8" };
  }
  return { fill: "#8A97A4", track: "#EEF1F5" };
}

export function MonthlyCategoryBarChart({ items }: MonthlyCategoryBarChartProps) {
  if (items.length === 0) {
    return <div className="text-sm text-[#6A7C8E]">この月のカテゴリ集計はまだありません。</div>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const width = `${Math.max(Math.round(item.ratio), item.ratio > 0 ? 1 : 0)}%`;
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
