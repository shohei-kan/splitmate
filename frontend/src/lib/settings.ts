const EXCLUDED_WORDS_KEY = "splitmate.settings.excluded_words.v1";
const HIGHLIGHT_THRESHOLD_KEY = "splitmate.settings.highlight_threshold.v1";
const DEFAULT_HIGHLIGHT_THRESHOLD = 10000;

function hasWindow() {
  return typeof window !== "undefined";
}

export function loadExcludedWordsText() {
  if (!hasWindow()) return "";
  return window.localStorage.getItem(EXCLUDED_WORDS_KEY) ?? "";
}

export function saveExcludedWordsText(value: string) {
  if (!hasWindow()) return;
  window.localStorage.setItem(EXCLUDED_WORDS_KEY, value);
}

export function loadHighlightThreshold() {
  if (!hasWindow()) return DEFAULT_HIGHLIGHT_THRESHOLD;
  const raw = window.localStorage.getItem(HIGHLIGHT_THRESHOLD_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_HIGHLIGHT_THRESHOLD;
  return Math.floor(n);
}

export function saveHighlightThreshold(value: number) {
  if (!hasWindow()) return;
  const normalized =
    Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : DEFAULT_HIGHLIGHT_THRESHOLD;
  window.localStorage.setItem(HIGHLIGHT_THRESHOLD_KEY, String(normalized));
}
