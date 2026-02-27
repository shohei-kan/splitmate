export function getInitialYearMonth(): { year: number; month: number } {
  // 初期表示は「当月」
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function shiftMonth(year: number, month: number, delta: number) {
  const totalMonths = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12 + 12) % 12 + 1;
  return { year: nextYear, month: nextMonth };
}
