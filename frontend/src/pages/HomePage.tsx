import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMonthlySummary } from "../api/summary";
import { getInitialYearMonth, shiftMonth } from "../lib/month";
import { yen } from "../lib/format";

export function HomePage() {
  const initial = useMemo(() => getInitialYearMonth(), []);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["summary", year, month],
    queryFn: () => fetchMonthlySummary(year, month),
  });

  const meShared = data ? data.shared_total - data.wife_shared : null;
  const showWifePersonal = (data?.wife_personal ?? 0) > 0;

  const go = (delta: number) => {
    const r = shiftMonth(year, month, delta);
    setYear(r.year);
    setMonth(r.month);
  };

  const goInitial = () => {
    const r = getInitialYearMonth();
    setYear(r.year);
    setMonth(r.month);
  };

  return (
    <div className="space-y-5">
      {/* Top status (loading/error) */}
      <div className="min-h-[20px]">
        {error ? (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <div>取得に失敗しました: {(error as Error).message}</div>
            <button
              className="rounded-md bg-white px-2 py-1 text-xs font-medium text-red-700 border border-red-200 hover:bg-red-50"
              onClick={() => refetch()}
            >
              再試行
            </button>
          </div>
        ) : isLoading ? (
          <div className="text-sm text-[#6A7C8E]">読み込み中...</div>
        ) : null}
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-3">
        <button
          className="w-10 h-10 rounded-full hover:bg-white border border-transparent hover:border-[#E0E0E0]"
          onClick={() => go(-1)}
          aria-label="prev month"
        >
          ‹
        </button>

        <div className="px-3 py-2 rounded-full bg-white border border-[#E0E0E0] text-base font-semibold">
          {year}年{month}月
        </div>

        <button
          className="w-10 h-10 rounded-full hover:bg-white border border-transparent hover:border-[#E0E0E0]"
          onClick={() => go(1)}
          aria-label="next month"
        >
          ›
        </button>

        <button
          className="ml-2 h-10 px-4 rounded-full bg-white border border-[#E0E0E0] hover:bg-[#F7FAFD] text-sm font-medium"
          onClick={goInitial}
          aria-label="back to default month"
          title="初期表示（前月）に戻る"
        >
          今月
        </button>

        {/* fetch中のさりげない表示 */}
        {isFetching && !isLoading && (
          <div className="ml-2 text-xs text-[#6A7C8E]">更新中...</div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Summary title="総支出（共有）" value={data ? yen(data.shared_total) : null} />

        <Summary title="私の共有支出" value={meShared !== null ? yen(meShared) : null} />

        <Summary title="妻の共有支出" value={data ? yen(data.wife_shared) : null} />

        {showWifePersonal && (
          <Summary
            title="妻の個人利用"
            value={data ? yen(data.wife_personal) : null}
            accent
          />
        )}

        <Summary title="折半額" value={data ? yen(data.half) : null} blue />

        <Summary
          title="振込（妻→私）"
          value={data ? yen(data.transfer_amount) : null}
          blue
        />
      </div>

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
  value: string | null; // null の時は skeleton 表示
  accent?: boolean;
  blue?: boolean;
}) {
  return (
    <div className="bg-white border border-[#E0E0E0] rounded-xl p-5">
      <div className="text-sm text-[#6A7C8E]">{title}</div>

      {value === null ? (
        <div className="mt-3 h-7 w-32 rounded-md bg-[#EEF4FA] animate-pulse" />
      ) : (
        <div
          className={`mt-2 text-xl font-semibold ${
            accent ? "text-pink-400" : blue ? "text-[#1F8EED]" : ""
          }`}
        >
          {value}
        </div>
      )}
    </div>
  );
}