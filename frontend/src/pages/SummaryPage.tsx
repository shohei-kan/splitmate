import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { PageShell } from "../components/layout/PageShell";
import { SummaryTabs } from "../components/summary/SummaryTabs";
import { MonthlySummaryPanel } from "../components/summary/MonthlySummaryPanel";
import { YearlySummaryPanel } from "../components/summary/YearlySummaryPanel";

type SummaryTab = "monthly" | "yearly";

export function SummaryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo<SummaryTab>(() => {
    const tab = searchParams.get("tab");
    return tab === "yearly" ? "yearly" : "monthly";
  }, [searchParams]);
  const monthParam = searchParams.get("month") ?? undefined;

  return (
    <PageShell>
      <div className="space-y-7">
        <div className="space-y-3">
          <div className="text-3xl font-bold text-[#143A61]">集計</div>
          <div className="text-sm text-[#6A7C8E]">
            月次・年次の支出傾向を、グラフと一覧で確認できます。
          </div>
        </div>

        <SummaryTabs
          activeTab={activeTab}
          onChange={(tab) => {
            const next = new URLSearchParams(searchParams);
            next.set("tab", tab);
            setSearchParams(next);
          }}
        />

        {activeTab === "monthly" ? (
          <MonthlySummaryPanel initialMonth={monthParam} />
        ) : (
          <YearlySummaryPanel />
        )}
      </div>
    </PageShell>
  );
}
