export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // 月末（day=0で前月最終日）
  return { startISO: toISODate(start), endISO: toISODate(end) };
}