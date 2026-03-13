import type { MonthlyCategorySummary, MonthlySummary } from "./types";
import { apiFetch } from "./client";

export function fetchMonthlySummary(year: number, month: number) {
  return apiFetch<MonthlySummary>(`/api/summary/monthly/?year=${year}&month=${month}`);
}

export function fetchMonthlyCategorySummary(month?: string) {
  const q = new URLSearchParams();
  if (month) q.set("month", month);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiFetch<MonthlyCategorySummary>(`/api/summary/monthly-by-category/${suffix}`);
}
