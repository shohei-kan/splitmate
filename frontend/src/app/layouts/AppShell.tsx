import { Outlet } from "react-router-dom";
import { TopNav } from "../../components/layout/TopNav";

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#F5F9FD] text-[#0A2D4D]">
      <TopNav />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
