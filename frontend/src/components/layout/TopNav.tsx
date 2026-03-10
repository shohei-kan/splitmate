import { NavLink } from "react-router-dom";

type NavItem = {
  label: string;
  to: string;
};

const items: NavItem[] = [
  { label: "ホーム", to: "/" },
  { label: "CSV", to: "/csv" },
  { label: "設定", to: "/settings" },
];

export function TopNav() {
  return (
    <header className="h-20 border-b border-[#DCE4EE] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-sm bg-[#1F8EED]" />
          <span className="text-sm font-semibold tracking-wide text-[#23405E]">SplitMate</span>
        </div>

        <nav className="flex items-center gap-6 text-sm">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded px-2 py-1 font-semibold transition ${
                  isActive
                    ? "bg-[#EFF6FF] text-[#1F8EED]"
                    : "text-[#6A7C8E] hover:text-[#0A2D4D]"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
