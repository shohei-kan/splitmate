export function getInitialYearMonth(): { year: number; month: number } {
  // 初期表示は「当月」
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
