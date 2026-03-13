import type { MonthlyCategorySummary, MonthlySummary, YearlySummary } from "./types";
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

export function fetchYearlySummary(year?: number) {
  const q = new URLSearchParams();
  if (year) q.set("year", String(year));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiFetch<YearlySummary>(`/api/summary/yearly/${suffix}`);
}
