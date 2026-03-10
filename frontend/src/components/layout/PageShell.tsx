import type { ReactNode } from "react";
import { TopNav } from "./TopNav";

type PageShellProps = {
  children: ReactNode;
};

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[#E7ECF3] text-[#0A2D4D]">
      <TopNav />
      <main className="mx-auto w-full max-w-[1360px] px-8 py-12">{children}</main>
    </div>
  );
}
