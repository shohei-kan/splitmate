import { useState } from "react";

import { PageShell } from "../components/layout/PageShell";
import { SummaryTabs } from "../components/summary/SummaryTabs";
import { MonthlySummaryPanel } from "../components/summary/MonthlySummaryPanel";
import { YearlySummaryPanel } from "../components/summary/YearlySummaryPanel";

type SummaryTab = "monthly" | "yearly";

export function SummaryPage() {
  const [activeTab, setActiveTab] = useState<SummaryTab>("monthly");

  return (
    <PageShell>
      <div className="space-y-7">
        <div className="space-y-3">
          <div className="text-3xl font-bold text-[#143A61]">集計</div>
          <div className="text-sm text-[#6A7C8E]">
            月次・年次の支出傾向を、グラフと一覧で確認できます。
          </div>
        </div>

        <SummaryTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "monthly" ? (
          <MonthlySummaryPanel />
        ) : (
          <YearlySummaryPanel />
        )}
      </div>
    </PageShell>
  );
}
