import { apiFetch } from "./client";
import type { StoreSuggestionsResponse } from "./types";

export function fetchStoreSuggestions() {
  return apiFetch<StoreSuggestionsResponse>("/api/stores/suggestions/");
}
