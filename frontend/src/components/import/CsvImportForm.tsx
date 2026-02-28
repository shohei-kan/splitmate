import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CardUser, ImportResult } from "../../api/types";
import { ImportResultView } from "./ImportResultView";

type Provider = "rakuten" | "mitsui";

type Props = {
  provider: Provider;
  defaultCardUser?: CardUser;
  invalidateKeys: Array<unknown[]>;
  upload: (file: File, cardUser: CardUser) => Promise<ImportResult>;
};

export function CsvImportForm({
  provider,
  defaultCardUser = "unknown",
  upload,
  invalidateKeys,
}: Props) {
  const qc = useQueryClient();
  const [cardUser, setCardUser] = useState<CardUser>(defaultCardUser);
  const [file, setFile] = useState<File | null>(null);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("CSVファイルを選択してください");
      return upload(file, cardUser);
    },
    onSuccess: async (result) => {
      setLastResult(result);
      await Promise.all(
        invalidateKeys.map((key) => qc.invalidateQueries({ queryKey: key }))
      );
    },
  });

  const providerLabel = provider === "rakuten" ? "楽天カード" : "三井住友カード";

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">{providerLabel} CSV 取り込み</div>

      <div className="grid gap-3">
        <div className="grid gap-1">
          <label className="text-xs text-[#6A7C8E]">card_user（デフォルト利用者）</label>
          <select
            className="h-10 rounded-lg border border-[#E0E0E0] bg-white px-3 text-sm"
            value={cardUser}
            onChange={(e) => setCardUser(e.target.value as CardUser)}
            disabled={mutation.isPending}
          >
            <option value="unknown">unknown</option>
            <option value="me">me</option>
            <option value="wife">wife</option>
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-xs text-[#6A7C8E]">CSVファイル</label>
          <input
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-[#E0E0E0] file:bg-white file:px-3 file:py-2 file:text-sm"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={mutation.isPending}
          />
        </div>

        <button
          type="button"
          className="h-10 rounded-lg bg-black px-3 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => mutation.mutate()}
          disabled={!file || mutation.isPending}
        >
          {mutation.isPending ? "取り込み中..." : "取り込み"}
        </button>

        {mutation.isError && (
          <div className="text-sm text-red-600">{(mutation.error as Error).message}</div>
        )}

        {mutation.isSuccess && (
          <div className="text-xs text-emerald-700">取り込み完了</div>
        )}
      </div>

      {lastResult && <ImportResultView result={lastResult} />}
    </div>
  );
}
