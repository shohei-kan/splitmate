import type {
  MonthlyCategorySummary,
  MonthlyLineNotificationStatus,
  MonthlyLineNotifyResponse,
  MonthlySummary,
  YearlySummary,
} from "./types";
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

export function fetchMonthlyLineNotificationStatus(month: string) {
  const q = new URLSearchParams({ month });
  return apiFetch<MonthlyLineNotificationStatus>(
    `/api/integrations/line/notify-monthly-status/?${q.toString()}`
  );
}

export function notifyMonthlyLine(month: string) {
  return apiFetch<MonthlyLineNotifyResponse>("/api/integrations/line/notify-monthly/", {
    method: "POST",
    body: JSON.stringify({ month }),
  });
}
