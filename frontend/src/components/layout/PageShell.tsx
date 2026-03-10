import type { ReactNode } from "react";
import { TopNav } from "./TopNav";

type PageShellProps = {
  children: ReactNode;
};

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[#E7ECF3] text-[#0A2D4D]">
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-12">{children}</main>
    </div>
  );
}
