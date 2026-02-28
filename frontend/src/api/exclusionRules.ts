import { apiFetch } from "./client";
import type { ExclusionRule, Paginated } from "./types";

const EXCLUSION_RULES_PATH = "/api/exclusion-rules/";
const SETTINGS_SYNC_MEMO = "settings:excluded_words";

function normalizeKeywords(words: string[]) {
  return Array.from(
    new Set(words.map((w) => w.trim()).filter(Boolean))
  );
}

function extractItems(payload: Paginated<ExclusionRule> | ExclusionRule[]) {
  if (Array.isArray(payload)) return payload;
  return payload.results;
}

export async function syncAllSourceExclusionRules(words: string[]) {
  const desiredKeywords = normalizeKeywords(words);
  const desiredSet = new Set(desiredKeywords);

  const payload = await apiFetch<Paginated<ExclusionRule> | ExclusionRule[]>(EXCLUSION_RULES_PATH);
  const allRules = extractItems(payload);

  const managedRules = allRules.filter(
    (r) => r.target_source === "all" && (r.memo ?? "") === SETTINGS_SYNC_MEMO
  );

  for (const rule of managedRules) {
    if (desiredSet.has(rule.keyword)) {
      desiredSet.delete(rule.keyword);
      if (!rule.is_active) {
        await apiFetch<ExclusionRule>(`${EXCLUSION_RULES_PATH}${rule.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: true }),
        });
      }
      continue;
    }

    await apiFetch<void>(`${EXCLUSION_RULES_PATH}${rule.id}/`, {
      method: "DELETE",
    });
  }

  for (const keyword of desiredSet) {
    await apiFetch<ExclusionRule>(EXCLUSION_RULES_PATH, {
      method: "POST",
      body: JSON.stringify({
        keyword,
        target_source: "all",
        is_active: true,
        memo: SETTINGS_SYNC_MEMO,
      }),
    });
  }
}
