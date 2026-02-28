import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getInitialYearMonth, shiftMonth } from "../lib/month";
import { importMitsuiCsv, importRakutenCsv } from "../api/import";
import type { CardUser, ImportResult } from "../api/types";
import { CsvDropzone } from "../components/import/CsvDropzone";

type CardKind = "rakuten" | "mitsui";

function ymLabel(year: number, month: number) {
  return `${year}年${String(month).padStart(2, "0")}月`;
}

function parseYM(sp: URLSearchParams) {
  const y = Number(sp.get("year"));
  const m = Number(sp.get("month"));
  if (!Number.isInteger(y) || !Number.isInteger(m)) return null;
  if (y < 2000 || y > 2100 || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

export function CsvImportPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const ym = useMemo(
    () => parseYM(searchParams) ?? getInitialYearMonth(),
    [searchParams]
  );

  const setYM = (year: number, month: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("year", String(year));
    next.set("month", String(month));
    setSearchParams(next);
  };

  const [cardKind, setCardKind] = useState<CardKind>("rakuten");
  const [cardUser, setCardUser] = useState<CardUser>("unknown");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("CSVファイルを選択してください");
      if (cardKind === "rakuten") return importRakutenCsv(file, cardUser);
      return importMitsuiCsv(file, cardUser);
    },
    onSuccess: async (res) => {
      setResult(res);
      await qc.invalidateQueries({ queryKey: ["summary"] });
      await qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const goMonth = (delta: number) => {
    const next = shiftMonth(ym.year, ym.month, delta);
    setYM(next.year, next.month);
  };

  return (
    <div className="space-y-6">
      <div className="text-3xl font-black text-[#0A2D4D]">CSVインポート</div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          className="h-9 w-9 rounded-full border border-[#C7D6E6] bg-white text-lg"
          onClick={() => goMonth(-1)}
        >
          ‹
        </button>
        <div className="min-w-36 text-center text-lg font-bold text-[#0A2D4D]">
          {ymLabel(ym.year, ym.month)}
        </div>
        <button
          type="button"
          className="h-9 w-9 rounded-full border border-[#C7D6E6] bg-white text-lg"
          onClick={() => goMonth(1)}
        >
          ›
        </button>
      </div>

      <div className="rounded-2xl border border-[#E0E0E0] bg-white p-6 shadow-sm">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-bold text-[#0A2D4D]">カード種別</label>
            <select
              value={cardKind}
              onChange={(e) => setCardKind(e.target.value as CardKind)}
              disabled={mutation.isPending}
              className="h-11 rounded-xl border border-[#D5E2EF] bg-white px-3 text-sm font-semibold"
            >
              <option value="rakuten">楽天カード</option>
              <option value="mitsui">三井住友カード</option>
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-bold text-[#0A2D4D]">
              card_user（デフォルト利用者）
            </label>
            <select
              value={cardUser}
              onChange={(e) => setCardUser(e.target.value as CardUser)}
              disabled={mutation.isPending}
              className="h-11 rounded-xl border border-[#D5E2EF] bg-white px-3 text-sm font-semibold"
            >
              <option value="me">me</option>
              <option value="wife">wife</option>
              <option value="unknown">unknown</option>
            </select>
          </div>

          <CsvDropzone file={file} onFile={setFile} disabled={mutation.isPending} />

          <div className="rounded-xl border border-[#E3EAF3] bg-[#F3F7FC] p-3 text-sm font-medium text-[#334155]">
            ※ 取り込み後は、ホームで当月のサマリーと一覧が更新されます。
          </div>

          {mutation.isError && (
            <div className="text-sm font-semibold text-red-600">
              {(mutation.error as Error).message}
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-[#E3EAF3] p-3">
              <div className="mb-2 text-sm font-bold text-[#0A2D4D]">取り込み結果</div>
              <div className="flex flex-wrap gap-2">
                <Badge label="created" value={result.created} />
                <Badge label="skipped" value={result.skipped} />
                <Badge label="excluded" value={result.excluded_count} />
                <Badge label="duplicate" value={result.duplicate_count} />
              </div>
              {result.excluded_samples && result.excluded_samples.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-[#0A2D4D]">
                    excluded_samples を表示
                  </summary>
                  <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-[#F8FBFF] p-2 text-xs text-[#4B5B6A]">
                    {JSON.stringify(result.excluded_samples, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="h-11 rounded-xl border border-[#C7D6E6] bg-white px-5 text-sm font-bold text-[#0A2D4D]"
          onClick={() => nav("/")}
        >
          キャンセル
        </button>
        <button
          type="button"
          className="h-11 rounded-xl bg-[#2563EB] px-6 text-sm font-black text-white disabled:opacity-60"
          onClick={() => mutation.mutate()}
          disabled={!file || mutation.isPending}
        >
          {mutation.isPending ? "インポート中..." : "インポート"}
        </button>
      </div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#E8F2FE] px-3 py-1 text-xs font-bold text-[#0A2D4D]">
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </span>
  );
}
