import { useEffect, useRef, useState } from "react";

import type { MonthlyCategorySummaryItem } from "../../api/types";
import { yen } from "../../lib/format";
import { categoryColor, categoryTrackColor } from "../summary/categoryColors";

type MonthlyCategoryBarChartProps = {
  items: MonthlyCategorySummaryItem[];
  onSelectCategory?: (category: MonthlyCategorySummaryItem["category"]) => void;
  showTopExpenses?: boolean;
};

type TooltipPlacement = {
  horizontal: "left" | "center" | "right";
  vertical: "top" | "bottom";
};

function categoryBarColors(category: MonthlyCategorySummaryItem["category"]) {
  return {
    fill: categoryColor(category),
    track: categoryTrackColor(category),
  };
}

function tooltipPlacementClasses(placement: TooltipPlacement) {
  const horizontal =
    placement.horizontal === "left"
      ? "left-0"
      : placement.horizontal === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";
  const vertical =
    placement.vertical === "top"
      ? "bottom-full mb-2"
      : "top-full mt-2";

  return `${horizontal} ${vertical}`;
}

function MonthlyCategoryBarChartRow({
  item,
  onSelectCategory,
  showTopExpenses,
}: {
  item: MonthlyCategorySummaryItem;
  onSelectCategory?: (category: MonthlyCategorySummaryItem["category"]) => void;
  showTopExpenses: boolean;
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [placement, setPlacement] = useState<TooltipPlacement>({
    horizontal: "left",
    vertical: "top",
  });
  const rowRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const width = `${Math.max(Math.round(item.ratio), item.ratio > 0 ? 1 : 0)}%`;
  const colors = categoryBarColors(item.category);

  useEffect(() => {
    if (!tooltipVisible) return;

    const updatePlacement = () => {
      const rowElement = rowRef.current;
      const tooltipElement = tooltipRef.current;
      if (!rowElement || !tooltipElement) return;

      const rowRect = rowElement.getBoundingClientRect();
      const tooltipRect = tooltipElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const margin = 16;

      let horizontal: TooltipPlacement["horizontal"] = "center";
      if (rowRect.left + tooltipRect.width > viewportWidth - margin) {
        horizontal = "right";
      } else if (rowRect.right - tooltipRect.width < margin) {
        horizontal = "left";
      }

      const canShowAbove = rowRect.top - tooltipRect.height - margin >= 0;
      setPlacement({
        horizontal,
        vertical: canShowAbove ? "top" : "bottom",
      });
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [tooltipVisible]);

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
    <div
      ref={rowRef}
      className="relative space-y-1"
      onMouseEnter={() => showTopExpenses && setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      onFocus={() => showTopExpenses && setTooltipVisible(true)}
      onBlur={() => setTooltipVisible(false)}
    >
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
      {showTopExpenses && tooltipVisible && (
        <div
          ref={tooltipRef}
          className={`pointer-events-none absolute z-10 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[#D7E1EC] bg-white/98 p-3 text-left shadow-lg ${tooltipPlacementClasses(placement)}`}
        >
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
      {items.map((item) => (
        <MonthlyCategoryBarChartRow
          key={item.category}
          item={item}
          onSelectCategory={onSelectCategory}
          showTopExpenses={showTopExpenses}
        />
      ))}
    </div>
  );
}
