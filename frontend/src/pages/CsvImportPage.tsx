import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getInitialYearMonth, shiftMonth } from "../lib/month";
import { importMitsuiCsv, importRakutenCsv } from "../api/import";
import type { CardUser, ImportResult } from "../api/types";
import { CsvDropzone } from "../components/import/CsvDropzone";
import { qk } from "../lib/queryKeys";
import { PageShell } from "../components/layout/PageShell";

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
  const [openPicker, setOpenPicker] = useState<null | (() => void)>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("CSVファイルを選択してください");
      if (cardKind === "rakuten") return importRakutenCsv(file, cardUser);
      return importMitsuiCsv(file, cardUser);
    },
    onSuccess: async (res) => {
      setResult(res);
      await qc.invalidateQueries({ queryKey: qk.summaryMonth(ym.year, ym.month) });
      await qc.invalidateQueries({ queryKey: qk.expensesMonth(ym.year, ym.month) });
    },
  });

  const goMonth = (delta: number) => {
    const next = shiftMonth(ym.year, ym.month, delta);
    setYM(next.year, next.month);
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="text-3xl font-bold text-[#163A5E]">CSVインポート</div>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            className="h-10 w-10 rounded-full border border-transparent text-2xl text-[#60758B] hover:border-[#D5E2EF] hover:bg-white"
            onClick={() => goMonth(-1)}
          >
            ‹
          </button>
          <div className="min-w-40 text-center text-3xl font-bold text-[#19385A]">
            {ymLabel(ym.year, ym.month)}
          </div>
          <button
            type="button"
            className="h-10 w-10 rounded-full border border-transparent text-2xl text-[#60758B] hover:border-[#D5E2EF] hover:bg-white"
            onClick={() => goMonth(1)}
          >
            ›
          </button>
        </div>

        <div className="rounded-3xl border border-[#D7DFE8] bg-[#F2F4F7] p-6 sm:p-7">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-2xl font-bold text-[#163A5E]">カード種別</label>
              <select
                value={cardKind}
                onChange={(e) => setCardKind(e.target.value as CardKind)}
                disabled={mutation.isPending || !!result}
                className="h-12 rounded-xl border border-[#CFD8E3] bg-white px-4 text-base font-semibold text-[#163A5E]"
              >
                <option value="rakuten">楽天カード</option>
                <option value="mitsui">三井住友カード</option>
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-bold text-[#41586E]">
                card_user（デフォルト利用者）
              </label>
              <select
                value={cardUser}
                onChange={(e) => setCardUser(e.target.value as CardUser)}
                disabled={mutation.isPending || !!result}
                className="h-11 rounded-xl border border-[#CFD8E3] bg-white px-4 text-sm font-semibold text-[#163A5E]"
              >
                <option value="me">me</option>
                <option value="wife">wife</option>
                <option value="unknown">unknown</option>
              </select>
            </div>

            <CsvDropzone
              file={file}
              onFile={setFile}
              disabled={mutation.isPending || !!result}
              registerOpenPicker={setOpenPicker}
            />

            <div className="rounded-xl border border-[#CFD8E3] bg-[#E9EEF4] p-4 text-sm font-medium leading-7 text-[#1F3D5D]">
              ※ すべて <span className="font-bold">shared（共有支出）</span> として取り込まれます。
              <br />
              個人利用（wife_only）のみ、一覧画面で変更してください。
            </div>

            {mutation.isError && (
              <div className="text-sm font-semibold text-red-600">
                {(mutation.error as Error).message}
              </div>
            )}

            {result && (
              <div className="rounded-xl border border-[#CFD8E3] bg-white p-3">
                <div className="mb-2 text-sm font-bold text-[#0A2D4D]">取り込み結果</div>
                {(() => {
                  const samples = result.excluded_samples?.slice(0, 10) ?? [];
                  return (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Badge label="created" value={result.created} />
                        <Badge label="skipped" value={result.skipped} />
                        <Badge label="excluded" value={result.excluded_count} />
                        <Badge label="duplicate" value={result.duplicate_count} />
                      </div>
                      {samples.length > 0 && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-semibold text-[#0A2D4D]">
                            excluded_samples を表示
                          </summary>
                          <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-[#F8FBFF] p-2 text-xs text-[#4B5B6A]">
                            {JSON.stringify(samples, null, 2)}
                          </pre>
                        </details>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          {result ? (
            <>
              <button
                type="button"
                className="h-12 rounded-2xl border border-[#C8D3DE] bg-white px-8 text-base font-bold text-[#60758B]"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setTimeout(() => openPicker?.(), 0);
                }}
              >
                続けて取り込む
              </button>
              <button
                type="button"
                className="h-12 rounded-2xl bg-[#2B8CE6] px-10 text-base font-bold text-white"
                onClick={() => nav("/?page=1")}
              >
                ホームに戻る
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="h-12 rounded-2xl border border-[#C8D3DE] bg-white px-8 text-base font-bold text-[#60758B]"
                onClick={() => nav("/")}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="h-12 rounded-2xl bg-[#2B8CE6] px-10 text-base font-bold text-white disabled:opacity-60"
                onClick={() => mutation.mutate()}
                disabled={!file || mutation.isPending}
              >
                {mutation.isPending ? "インポート中..." : "インポート"}
              </button>
            </>
          )}
        </div>
      </div>
    </PageShell>
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
