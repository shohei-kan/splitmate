import { NavLink } from "react-router-dom";

type NavItem = {
  label: string;
  to: string;
  icon: "home" | "summary" | "csv" | "settings";
  mobileVisible?: boolean;
};

const items: NavItem[] = [
  { label: "ホーム", to: "/", icon: "home", mobileVisible: true },
  { label: "集計", to: "/summary", icon: "summary", mobileVisible: true },
  { label: "CSV", to: "/csv", icon: "csv" },
  { label: "設定", to: "/settings", icon: "settings" },
];

function NavIcon({ icon }: { icon: NavItem["icon"] }) {
  if (icon === "home") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V20h13V9.5" />
      </svg>
    );
  }
  if (icon === "summary") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19h16" />
        <path d="M7 15V9" />
        <path d="M12 15V5" />
        <path d="M17 15v-3" />
      </svg>
    );
  }
  if (icon === "csv") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5" />
        <path d="M10 13h4" />
        <path d="M10 17h4" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="m5.6 5.6 2.1 2.1" />
      <path d="m16.3 16.3 2.1 2.1" />
      <path d="m18.4 5.6-2.1 2.1" />
      <path d="m7.7 16.3-2.1 2.1" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function TopNav() {
  return (
    <header className="h-16 border-b border-[#DCE4EE] bg-white/95 backdrop-blur sm:h-20">
      <div className="mx-auto flex h-full w-full max-w-340 items-center justify-between px-4 sm:px-8">
        <div className="flex items-center">
          <img
            src="/brand/splitmate-logo.png"
            alt="SplitMate"
            className="h-34 w-auto select-none object-contain sm:h-50"
            draggable={false}
          />
        </div>

        <nav className="flex items-center gap-2 text-sm sm:gap-6">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${item.mobileVisible ? "inline-flex sm:inline-flex" : "hidden sm:inline-flex"} items-center justify-center rounded-full px-2.5 py-2 font-semibold transition sm:rounded sm:px-2 sm:py-1 ${
                  isActive
                    ? "bg-[#EFF6FF] text-[#1F8EED]"
                    : "text-[#6A7C8E] hover:text-[#0A2D4D]"
                }`
              }
              aria-label={item.label}
            >
              <span className="sm:hidden">
                <NavIcon icon={item.icon} />
              </span>
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
