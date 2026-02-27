import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMonthlySummary } from "../api/summary";
import { getInitialYearMonth, shiftMonth } from "../lib/month";
import { yen } from "../lib/format";

export function HomePage() {
  const initial = useMemo(() => getInitialYearMonth(), []);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const { data, isLoading, error } = useQuery({
    queryKey: ["summary", year, month],
    queryFn: () => fetchMonthlySummary(year, month),
  });

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center justify-center gap-6">
        <button
          className="w-10 h-10 rounded-full hover:bg-white border border-transparent hover:border-[#E0E0E0]"
          onClick={() => {
            const r = shiftMonth(year, month, -1);
            setYear(r.year);
            setMonth(r.month);
          }}
          aria-label="prev month"
        >
          ‹
        </button>

        <div className="text-lg font-semibold">
          {year}年{month}月
        </div>

        <button
          className="w-10 h-10 rounded-full hover:bg-white border border-transparent hover:border-[#E0E0E0]"
          onClick={() => {
            const r = shiftMonth(year, month, 1);
            setYear(r.year);
            setMonth(r.month);
          }}
          aria-label="next month"
        >
          ›
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-6 gap-4">
        <Summary title="総支出" value={data ? yen(data.shared_total) : "—"} />

        <Summary
          title="私の共有支出"
          value={data ? yen(data.shared_total - data.wife_shared) : "—"}
        />

        <Summary
          title="妻の共有支出"
          value={data ? yen(data.wife_shared) : "—"}
        />

        <Summary
          title="妻の個人利用"
          value={data ? yen(data.wife_personal) : "—"}
          accent
        />

        <Summary title="折半額" value={data ? yen(data.half) : "—"} blue />

        <Summary
          title="振込（妻→私）"
          value={data ? yen(data.transfer_amount) : "—"}
          blue
        />
      </div>

      {isLoading && <div className="text-sm text-[#6A7C8E]">読み込み中...</div>}
      {error && (
        <div className="text-sm text-red-600">
          取得に失敗しました: {(error as Error).message}
        </div>
      )}

      {/* Next: add form + table */}
      <div className="rounded-xl border border-dashed border-[#B0C4D8] bg-white/50 p-8 text-[#6A7C8E]">
        次：支出追加フォーム＋一覧テーブル
      </div>
    </div>
  );
}

function Summary({
  title,
  value,
  accent,
  blue,
}: {
  title: string;
  value: string;
  accent?: boolean;
  blue?: boolean;
}) {
  return (
    <div className="bg-white border border-[#E0E0E0] rounded-xl p-5">
      <div className="text-sm text-[#6A7C8E]">{title}</div>
      <div
        className={`mt-2 text-xl font-semibold ${
          accent ? "text-pink-400" : blue ? "text-[#1F8EED]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
