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
    <header className="h-14 bg-white border-b border-[#E0E0E0]">
      <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#1F8EED]" />
          <span className="font-semibold">SplitMate</span>
        </div>

        <nav className="flex items-center gap-6 text-sm">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-2 py-1 rounded ${
                  isActive ? "text-[#1F8EED] font-semibold" : "text-[#6A7C8E] hover:text-[#0A2D4D]"
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
