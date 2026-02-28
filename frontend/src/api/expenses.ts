import type { Expense, CardUser, Payer, BurdenType, Category, Paginated } from "./types";
import { apiFetch } from "./client";

export type CreateExpenseInput = {
  date: string;
  store: string;
  amount: number;
  card_user: CardUser; // unknown OK
  payer: Payer;        // ✅ 精算に効く
  burden_type: BurdenType;
  category: Category;
  memo?: string;
};

export function createExpense(input: CreateExpenseInput) {
  return apiFetch<Expense>("/api/expenses/", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      memo: input.memo ?? "",
    }),
  });
}

export function fetchExpenses(params: {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  ordering?: string; // ex: "-date"
  search?: string;
  page?: number; // optional
}) {
  const q = new URLSearchParams({
    date_from: params.dateFrom,
    date_to: params.dateTo,
    ordering: params.ordering ?? "-date",
  });

  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));

  return apiFetch<Paginated<Expense>>(`/api/expenses/?${q.toString()}`);
}