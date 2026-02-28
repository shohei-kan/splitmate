export interface MonthlySummary {
  year: number;
  month: number;
  shared_total: number;
  wife_shared: number;
  wife_personal: number;
  me_only_total: number;
  half: number;
  transfer_amount: number;
}

export type CardUser = "me" | "wife" | "unknown";
export type Payer = "me" | "wife" | "unknown";
export type BurdenType = "shared" | "wife_only" | "me_only";
export type Status = "draft" | "final";

export type Category =
  | "uncategorized"
  | "food"
  | "daily"
  | "outside_food"
  | "utility"
  | "travel"
  | "other";

export interface Expense {
  id: number;
  date: string;
  store: string;
  card_user: CardUser | null;
  payer: Payer;
  burden_type: BurdenType;
  category: Category;
  amount: number;
  memo: string;
  source: "csv_rakuten" | "csv_mitsui" | "manual";
  status: Status;
  created_at: string;
  updated_at: string;
}

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};



export type ImportResult = {
  created: number;
  skipped: number;
  excluded_count: number;
  duplicate_count: number;
  excluded_samples?: Array<unknown>;
};

export type ExclusionRule = {
  id: number;
  keyword: string;
  target_source: "all" | "csv_rakuten" | "csv_mitsui";
  is_active: boolean;
  memo: string;
  created_at: string;
  updated_at: string;
};
