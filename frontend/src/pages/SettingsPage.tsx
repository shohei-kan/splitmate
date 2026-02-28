import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { updateSettings } from "../api/settings";
import { syncAllSourceExclusionRules } from "../api/exclusionRules";
import { DEFAULT_HIGHLIGHT_THRESHOLD, useSettings } from "../hooks/useSettings";

function toTextarea(words: string[]) {
  return (words ?? []).join("\n");
}

function fromTextarea(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SettingsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const settingsQ = useSettings();

  const baseExcludedWordsText = useMemo(
    () => toTextarea(settingsQ.data?.excluded_words ?? []),
    [settingsQ.data?.excluded_words]
  );
  const baseThresholdText = useMemo(
    () => String(settingsQ.data?.highlight_threshold ?? DEFAULT_HIGHLIGHT_THRESHOLD),
    [settingsQ.data?.highlight_threshold]
  );

  const [excludedWordsDraft, setExcludedWordsDraft] = useState<string | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<string | null>(null);

  const excludedWordsText = excludedWordsDraft ?? baseExcludedWordsText;
  const thresholdText = thresholdDraft ?? baseThresholdText;

  const currentInput = useMemo(
    () => ({
      excluded_words: fromTextarea(excludedWordsText),
      highlight_threshold: Number.isFinite(Number(thresholdText))
        ? Number(thresholdText)
        : DEFAULT_HIGHLIGHT_THRESHOLD,
    }),
    [excludedWordsText, thresholdText]
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      const saved = await updateSettings(currentInput);
      await syncAllSourceExclusionRules(currentInput.excluded_words);
      return saved;
    },
    onSuccess: (saved) => {
      qc.setQueryData(["settings"], saved);
      setExcludedWordsDraft(null);
      setThresholdDraft(null);
      nav("/");
    },
  });

  return (
    <div className="space-y-5">
      <div className="text-3xl font-black text-[#0A2D4D]">設定</div>

      <div className="rounded-xl border border-[#E0E0E0] bg-white p-5">
        <div className="text-base font-semibold">除外ワード</div>
        <div className="mt-1 text-xs text-[#6A7C8E]">改行区切りで入力します</div>
        <textarea
          className="mt-3 min-h-40 w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm"
          value={excludedWordsText}
          onChange={(e) => setExcludedWordsDraft(e.target.value)}
          disabled={settingsQ.isLoading || saveMut.isPending}
          placeholder={"例)\nテスト決済\nポイント利用"}
        />
      </div>

      <div className="rounded-xl border border-[#E0E0E0] bg-white p-5">
        <div className="text-base font-semibold">金額ハイライト閾値</div>
        <div className="mt-1 text-xs text-[#6A7C8E]">この金額以上を赤字表示します</div>
        <input
          className="mt-3 h-10 w-full max-w-xs rounded-lg border border-[#E0E0E0] px-3 text-sm"
          inputMode="numeric"
          value={thresholdText}
          onChange={(e) => setThresholdDraft(e.target.value.replace(/[^\d]/g, ""))}
          disabled={settingsQ.isLoading || saveMut.isPending}
          placeholder="10000"
        />
      </div>

      {(settingsQ.isError || saveMut.isError) && (
        <div className="text-sm text-red-600">
          {((settingsQ.error || saveMut.error) as Error).message}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="h-10 rounded-lg border border-[#C7D6E6] bg-white px-4 text-sm font-semibold text-[#0A2D4D]"
          onClick={() => nav(-1)}
        >
          キャンセル
        </button>
        <button
          type="button"
          className="h-10 rounded-lg bg-[#1F8EED] px-4 text-sm font-semibold text-white"
          onClick={() => saveMut.mutate()}
          disabled={settingsQ.isLoading || saveMut.isPending}
        >
          {saveMut.isPending ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
