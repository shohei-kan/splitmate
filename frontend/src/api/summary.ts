import type { MonthlySummary } from "./types";
import { apiFetch } from "./client";

export function fetchMonthlySummary(year: number, month: number) {
  return apiFetch<MonthlySummary>(`/api/summary/monthly/?year=${year}&month=${month}`);
}
