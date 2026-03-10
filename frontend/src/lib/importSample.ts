import { yen } from "./format";

export type ImportSampleView = {
  date: string;
  store: string;
  amountText: string;
  reasonText?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function normalizeAmount(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }

  if (typeof input === "string") {
    const normalized = input.replace(/[¥,\s]/g, "").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function formatAmount(input: unknown): string {
  const amount = normalizeAmount(input);
  if (amount === null) return "—";
  return yen(amount);
}

export function normalizeDate(input: unknown): string {
  if (typeof input === "string") {
    const value = input.trim();
    return value.length > 0 ? value : "—";
  }

  if (input === null || input === undefined) return "—";
  const value = String(input).trim();
  return value.length > 0 ? value : "—";
}

export function reasonLabel(reason: unknown): string {
  if (reason === "excluded_by_rule") return "除外ワード一致";
  if (reason === "duplicate") return "重複";
  if (reason === "invalid_row") return "形式不正";
  if (reason === "invalid_date") return "日付不正";
  if (reason === "non_data_row") return "明細行ではない";

  if (typeof reason === "string") {
    const value = reason.trim();
    if (!value) return "除外（理由不明）";
    return `その他（${value}）`;
  }

  return "除外（理由不明）";
}

export function coerceSample(raw: unknown): ImportSampleView {
  const row = asRecord(raw);
  if (!row) {
    return {
      date: "—",
      store: "—",
      amountText: "—",
      reasonText: "—",
    };
  }

  const storeValue = row.store;
  const store =
    typeof storeValue === "string"
      ? storeValue.trim() || "—"
      : storeValue === null || storeValue === undefined
        ? "—"
        : String(storeValue).trim() || "—";

  const hasReason = Object.prototype.hasOwnProperty.call(row, "reason");

  return {
    date: normalizeDate(row.date),
    store,
    amountText: formatAmount(row.amount),
    reasonText: hasReason ? reasonLabel(row.reason) : "—",
  };
}
