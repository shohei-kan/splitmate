import { useState } from "react";

import { PageShell } from "../components/layout/PageShell";
import { Card } from "../components/ui/Card";
import { SummaryTabs } from "../components/summary/SummaryTabs";
import { MonthlySummaryPanel } from "../components/summary/MonthlySummaryPanel";

type SummaryTab = "monthly" | "yearly";

export function SummaryPage() {
  const [activeTab, setActiveTab] = useState<SummaryTab>("monthly");

  return (
    <PageShell>
      <div className="space-y-7">
        <div className="space-y-3">
          <div className="text-3xl font-bold text-[#143A61]">集計</div>
          <div className="text-sm text-[#6A7C8E]">
            月ごとのカテゴリ別支出を、グラフと一覧で確認できます。
          </div>
        </div>

        <SummaryTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "monthly" ? (
          <MonthlySummaryPanel />
        ) : (
          <Card className="p-6">
            <div className="text-lg font-bold text-[#143A61]">年次集計</div>
            <div className="mt-2 text-sm text-[#6A7C8E]">
              年次集計は次のフェーズで追加予定です。
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
