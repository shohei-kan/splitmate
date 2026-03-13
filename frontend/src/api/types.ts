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

export interface MonthlyCategorySummaryItem {
  category: Category;
  label: string;
  amount: number;
  ratio: number;
  count: number;
  top_expenses: Array<{
    date: string;
    store: string;
    amount: number;
  }>;
}

export interface MonthlyCategorySummary {
  month: string;
  total_amount: number;
  total_count: number;
  categories: MonthlyCategorySummaryItem[];
}

export interface YearlySummaryCategory {
  category: Category;
  label: string;
  amount: number;
}

export interface YearlySummaryMonth {
  month: string;
  total_amount: number;
  categories: YearlySummaryCategory[];
}

export interface YearlySummary {
  year: number;
  total_amount: number;
  average_monthly_amount: number;
  total_count: number;
  months: YearlySummaryMonth[];
}

export interface StoreSuggestion {
  name: string;
  count: number;
}

export interface StoreSuggestionsResponse {
  stores: StoreSuggestion[];
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
  excluded_samples: ImportSample[];
  created_samples: ImportSample[];
  skipped_samples: ImportSample[];
  duplicate_samples: ImportSample[];
};

export type ImportSample = {
  date: string;
  store: string;
  amount: number | null;
  raw_amount?: string | null;
  reason?: string | null;
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
