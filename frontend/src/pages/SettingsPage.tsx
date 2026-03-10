import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { updateSettings } from "../api/settings";
import { syncAllSourceExclusionRules } from "../api/exclusionRules";
import { DEFAULT_HIGHLIGHT_THRESHOLD, useSettings } from "../hooks/useSettings";
import { qk } from "../lib/queryKeys";
import { PageShell } from "../components/layout/PageShell";

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
      qc.setQueryData(qk.settings(), saved);
      setExcludedWordsDraft(null);
      setThresholdDraft(null);
      nav("/");
    },
  });

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-3xl font-bold text-[#163A5E]">設定</div>

        <div className="rounded-3xl border border-[#D7DFE8] bg-[#F2F4F7] p-6 sm:p-7">
          <div className="text-2xl font-bold text-[#163A5E]">除外ワード</div>
          <div className="mt-2 text-base text-[#6A7C8E]">
            CSVインポート時に除外する文字列を改行区切りで入力してください
          </div>
          <textarea
            className="mt-3 min-h-44 w-full rounded-xl border border-[#CFD8E3] bg-white px-4 py-3 text-base text-[#163A5E]"
            value={excludedWordsText}
            onChange={(e) => setExcludedWordsDraft(e.target.value)}
            disabled={settingsQ.isLoading || saveMut.isPending}
            placeholder={"Suica\nPASMO\nチャージ"}
          />
          <div className="mt-2 text-base text-[#6A7C8E]">
            例：交通系ICカードへのチャージ、ポイント払い など
          </div>

          <div className="mt-8 text-2xl font-bold text-[#163A5E]">金額ハイライト閾値</div>
          <div className="mt-2 text-base text-[#6A7C8E]">この金額以上の支出を赤色で強調表示します</div>
          <div className="mt-3 flex items-center gap-2">
            <input
              className="h-12 w-full max-w-42.5 rounded-xl border border-[#CFD8E3] bg-white px-4 text-base text-[#163A5E]"
              inputMode="numeric"
              value={thresholdText}
              onChange={(e) => setThresholdDraft(e.target.value.replace(/[^\d]/g, ""))}
              disabled={settingsQ.isLoading || saveMut.isPending}
              placeholder="10000"
            />
            <span className="text-2xl font-semibold text-[#60758B]">円</span>
          </div>
        </div>

        {(settingsQ.isError || saveMut.isError) && (
          <div className="text-sm text-red-600">
            {((settingsQ.error || saveMut.error) as Error).message}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="h-12 rounded-2xl border border-[#C8D3DE] bg-white px-8 text-base font-bold text-[#60758B]"
            onClick={() => nav(-1)}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="h-12 rounded-2xl bg-[#2B8CE6] px-8 text-base font-bold text-white"
            onClick={() => saveMut.mutate()}
            disabled={settingsQ.isLoading || saveMut.isPending}
          >
            {saveMut.isPending ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </PageShell>
  );
}
