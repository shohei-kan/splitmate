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
let apiUnavailable = false;
const USE_SETTINGS_API = (import.meta.env.VITE_USE_SETTINGS_API as string | undefined) === "true";

function isNotFoundError(error: unknown) {
  return error instanceof Error && error.message.includes("API error 404");
}

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
  if (!USE_SETTINGS_API || apiUnavailable) {
    return loadFallbackSettings();
  }

  try {
    const settings = await apiFetch<AppSettings>(SETTINGS_PATH);
    saveFallbackSettings(settings);
    return settings;
  } catch (error) {
    if (isNotFoundError(error)) {
      apiUnavailable = true;
    }
    return loadFallbackSettings();
  }
}

export async function updateSettings(input: AppSettings) {
  if (!USE_SETTINGS_API || apiUnavailable) {
    saveFallbackSettings(input);
    return input;
  }

  try {
    const saved = await apiFetch<AppSettings>(SETTINGS_PATH, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    saveFallbackSettings(saved);
    return saved;
  } catch (error) {
    if (isNotFoundError(error)) {
      apiUnavailable = true;
    }
    saveFallbackSettings(input);
    return input;
  }
}
