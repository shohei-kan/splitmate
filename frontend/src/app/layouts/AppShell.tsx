import { NavLink, Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#F5F9FD] text-[#0A2D4D]">
      <header className="h-14 bg-white border-b border-[#E0E0E0]">
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#1F8EED]" />
            <span className="font-semibold">SplitMate</span>
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <TopNavLink to="/">ホーム</TopNavLink>
            <TopNavLink to="/csv">CSV</TopNavLink>
            <TopNavLink to="/settings">設定</TopNavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function TopNavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-2 py-1 rounded ${
          isActive ? "text-[#1F8EED] font-semibold" : "text-[#6A7C8E] hover:text-[#0A2D4D]"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
