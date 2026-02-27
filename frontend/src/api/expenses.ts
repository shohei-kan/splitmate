import type { Expense, CardUser, BurdenType, Category, Payer } from "./types";
import { apiFetch } from "./client";

export type CreateExpenseInput = {
  date: string;
  store: string;
  amount: number;
  card_user: CardUser; // unknown OK
  payer: Payer;        // ✅ 追加
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