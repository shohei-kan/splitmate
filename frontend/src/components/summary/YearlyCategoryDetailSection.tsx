import type { YearlySummary, YearlySummaryCategory } from "../../api/types";
import { yen } from "../../lib/format";
import { Card } from "../ui/Card";
import { YearlyCategoryBarChart } from "./YearlyCategoryBarChart";

type YearlyCategoryDetailSectionProps = {
  data: YearlySummary;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
};

function buildCategoryOptions(data: YearlySummary): YearlySummaryCategory[] {
  const map = new Map<string, YearlySummaryCategory>();

  for (const month of data.months) {
    for (const category of month.categories) {
      const existing = map.get(category.category);
      if (existing) {
        existing.amount += category.amount;
      } else {
        map.set(category.category, { ...category });
      }
    }
  }

  return [...map.values()].sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
}

export function YearlyCategoryDetailSection({
  data,
  selectedCategory,
  onSelectCategory,
}: YearlyCategoryDetailSectionProps) {
  const options = buildCategoryOptions(data);
  const effectiveCategory = options.find((item) => item.category === selectedCategory)?.category
    ?? options[0]?.category
    ?? "uncategorized";
  const selected = options.find((item) => item.category === effectiveCategory);

  const monthlyAmounts = data.months.map((month) => {
    const current = month.categories.find((item) => item.category === effectiveCategory);
    return {
      month: month.month,
      amount: current?.amount ?? 0,
    };
  });
  const totalAmount = monthlyAmounts.reduce((sum, item) => sum + item.amount, 0);
  const averageAmount = totalAmount / 12;
  const maxMonth = monthlyAmounts.reduce((best, item) => (item.amount > best.amount ? item : best), {
    month: data.months[0]?.month ?? "",
    amount: 0,
  });

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-bold text-[#143A61]">カテゴリ別の月推移</div>
          <div className="mt-1 text-sm text-[#6A7C8E]">
            1カテゴリを選んで、月ごとの増減を確認できます。
          </div>
        </div>
        <label className="grid gap-1 text-sm text-[#60758B]">
          カテゴリ
          <select
            className="h-10 min-w-44 rounded-lg border border-[#D1DCE8] bg-white px-3 text-sm text-[#153B61]"
            value={effectiveCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
          >
            {options.map((option) => (
              <option key={option.category} value={option.category}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5">
        <YearlyCategoryBarChart months={data.months} category={effectiveCategory} />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Card className="px-5 py-4">
          <div className="text-sm font-semibold text-[#6A7C8E]">年間合計</div>
          <div className="mt-2 text-2xl font-bold text-[#163A5E]">{yen(totalAmount)}</div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-sm font-semibold text-[#6A7C8E]">月平均</div>
          <div className="mt-2 text-2xl font-bold text-[#163A5E]">{yen(Math.round(averageAmount))}</div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-sm font-semibold text-[#6A7C8E]">最大月</div>
          <div className="mt-2 text-2xl font-bold text-[#163A5E]">
            {maxMonth.month ? `${Number(maxMonth.month.slice(5, 7))}月` : "—"}
          </div>
          <div className="mt-1 text-sm text-[#6A7C8E]">{yen(maxMonth.amount)}</div>
        </Card>
      </div>

      {selected && (
        <div className="mt-4 text-sm text-[#6A7C8E]">
          選択中: {selected.label}
        </div>
      )}
    </Card>
  );
}
