import { apiFetch } from "./client";
import {
  loadExcludedWordsText,
  loadHighlightThreshold,
  saveExcludedWordsText,
  saveHighlightThreshold,
} from "../lib/settings";

export type AppSettings = {
  excluded_words: string[];
  highlight_threshold: number;
};

const SETTINGS_PATH = "/api/settings/";

function textToWords(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function wordsToText(words: string[]) {
  return (words ?? []).join("\n");
}

function loadFallbackSettings(): AppSettings {
  return {
    excluded_words: textToWords(loadExcludedWordsText()),
    highlight_threshold: loadHighlightThreshold(),
  };
}

function saveFallbackSettings(settings: AppSettings) {
  saveExcludedWordsText(wordsToText(settings.excluded_words));
  saveHighlightThreshold(settings.highlight_threshold);
}

export async function fetchSettings() {
  try {
    const settings = await apiFetch<AppSettings>(SETTINGS_PATH);
    saveFallbackSettings(settings);
    return settings;
  } catch {
    return loadFallbackSettings();
  }
}

export async function updateSettings(input: AppSettings) {
  try {
    const saved = await apiFetch<AppSettings>(SETTINGS_PATH, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    saveFallbackSettings(saved);
    return saved;
  } catch {
    saveFallbackSettings(input);
    return input;
  }
}
