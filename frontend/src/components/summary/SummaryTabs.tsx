type SummaryTab = "monthly" | "yearly";

type SummaryTabsProps = {
  activeTab: SummaryTab;
  onChange: (tab: SummaryTab) => void;
};

const tabs: Array<{ key: SummaryTab; label: string }> = [
  { key: "monthly", label: "月次" },
  { key: "yearly", label: "年次" },
];

export function SummaryTabs({ activeTab, onChange }: SummaryTabsProps) {
  return (
    <div className="inline-flex rounded-2xl border border-[#D8E3EE] bg-white p-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-[#143A61] text-white"
                : "text-[#63798F] hover:bg-[#F5F8FC] hover:text-[#143A61]"
            }`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
