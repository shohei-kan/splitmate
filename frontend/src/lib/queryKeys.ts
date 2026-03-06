// frontend/src/lib/queryKeys.ts
export const qk = {
  settings: () => ["settings"] as const,

  // HomePage の現状: ["summary", year, month]
  summaryMonth: (year: number, month: number) =>
    ["summary", year, month] as const,

  // HomePage の現状: ["expenses", year, month, page]
  expensesMonthPage: (year: number, month: number, page: number) =>
    ["expenses", year, month, page] as const,

  // HomePage の invalidate で使ってる: ["expenses", year, month]
  // （page違いのキャッシュもまとめて落とせる）
  expensesMonth: (year: number, month: number) =>
    ["expenses", year, month] as const,

  // ざっくり全体
  expensesRoot: () => ["expenses"] as const,
  summaryRoot: () => ["summary"] as const,
};