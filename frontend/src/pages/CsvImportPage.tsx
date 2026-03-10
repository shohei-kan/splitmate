import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getInitialYearMonth, shiftMonth } from "../lib/month";
import { importMitsuiCsv, importRakutenCsv } from "../api/import";
import type { CardUser, ImportResult } from "../api/types";
import { CsvDropzone } from "../components/import/CsvDropzone";
import { qk } from "../lib/queryKeys";
import { PageShell } from "../components/layout/PageShell";
import { yen } from "../lib/format";

type CardKind = "rakuten" | "mitsui";
type DetailKey = "created" | "skipped" | "excluded" | "duplicate";

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
  const [showAllExcluded, setShowAllExcluded] = useState(false);
  const [activeDetail, setActiveDetail] = useState<DetailKey | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("CSVファイルを選択してください");
      if (cardKind === "rakuten") return importRakutenCsv(file, cardUser);
      return importMitsuiCsv(file, cardUser);
    },
    onSuccess: async (res) => {
      setResult(res);
      setShowAllExcluded(false);
      setActiveDetail(null);
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
                カード利用者
              </label>
              <select
                value={cardUser}
                onChange={(e) => setCardUser(e.target.value as CardUser)}
                disabled={mutation.isPending || !!result}
                className="h-11 rounded-xl border border-[#CFD8E3] bg-white px-4 text-sm font-semibold text-[#163A5E]"
              >
                <option value="me">パパ</option>
                <option value="wife">ママ</option>
                <option value="unknown">未選択</option>
              </select>
            </div>

            <CsvDropzone
              file={file}
              onFile={setFile}
              disabled={mutation.isPending || !!result}
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
                  const allSamples = getDetailSamples(result, activeDetail);
                  const visibleSamples = showAllExcluded ? allSamples : allSamples.slice(0, 10);
                  return (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <BadgeButton
                          label="新規登録"
                          value={result.created}
                          active={activeDetail === "created"}
                          onClick={() => {
                            setShowAllExcluded(false);
                            setActiveDetail((prev) => (prev === "created" ? null : "created"));
                          }}
                        />
                        <BadgeButton
                          label="スキップ"
                          value={result.skipped}
                          active={activeDetail === "skipped"}
                          onClick={() => {
                            setShowAllExcluded(false);
                            setActiveDetail((prev) => (prev === "skipped" ? null : "skipped"));
                          }}
                        />
                        <BadgeButton
                          label="除外"
                          value={result.excluded_count}
                          active={activeDetail === "excluded"}
                          onClick={() => {
                            setShowAllExcluded(false);
                            setActiveDetail((prev) => (prev === "excluded" ? null : "excluded"));
                          }}
                        />
                        <BadgeButton
                          label="重複"
                          value={result.duplicate_count}
                          active={activeDetail === "duplicate"}
                          onClick={() => {
                            setShowAllExcluded(false);
                            setActiveDetail((prev) => (prev === "duplicate" ? null : "duplicate"));
                          }}
                        />
                      </div>

                      {activeDetail && allSamples.length > 0 && (
                        <div className="mt-4 rounded-lg border border-[#DDE6F0] bg-[#FAFCFF] p-3">
                          <div className="text-sm font-semibold text-[#0A2D4D]">
                            {detailTitle(activeDetail)}
                          </div>
                          <div className="mt-1 text-xs text-[#617488]">
                            {activeDetail === "excluded"
                              ? "設定の除外ワードに一致した明細の一部です"
                              : "取り込み対象データの一部です"}
                          </div>

                          <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="border-b border-[#E7EDF4] text-[#667D93]">
                                  <th className="whitespace-nowrap px-2 py-2 text-left font-semibold">日付</th>
                                  <th className="whitespace-nowrap px-2 py-2 text-left font-semibold">店名</th>
                                  <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">金額</th>
                                  {activeDetail === "excluded" && (
                                    <th className="whitespace-nowrap px-2 py-2 text-left font-semibold">除外理由</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {visibleSamples.map((sample, index) => (
                                  <tr key={`${index}-${sampleDate(sample)}-${sampleStore(sample)}`} className="border-b border-[#EEF3F8] last:border-b-0">
                                    <td className="whitespace-nowrap px-2 py-2 text-[#1A395B]">
                                      {sampleDate(sample)}
                                    </td>
                                    <td className="min-w-45 px-2 py-2 text-[#1A395B]">
                                      {sampleStore(sample)}
                                    </td>
                                    <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-[#1A395B]">
                                      {sampleAmount(sample)}
                                    </td>
                                    {activeDetail === "excluded" && (
                                      <td className="px-2 py-2 text-[#4E6277]">
                                        {sampleReason(sample)}
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {allSamples.length > 10 && (
                            <div className="mt-3">
                              <button
                                type="button"
                                className="rounded-md border border-[#C8D3DE] bg-white px-3 py-1 text-xs font-semibold text-[#41586E] hover:bg-[#F4F8FC]"
                                onClick={() => setShowAllExcluded((prev) => !prev)}
                              >
                                {showAllExcluded ? "10件表示に戻す" : "もっと見る"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {activeDetail && allSamples.length === 0 && (
                        <div className="mt-4 rounded-lg border border-[#DDE6F0] bg-[#FAFCFF] p-3 text-sm text-[#617488]">
                          この項目は詳細データが返却されていません。
                        </div>
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
                  setShowAllExcluded(false);
                  setActiveDetail(null);
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

function BadgeButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
        active ? "bg-[#2B8CE6] text-white" : "bg-[#E8F2FE] text-[#0A2D4D]"
      }`}
    >
      <span className="opacity-70">{label}</span>
      <span>{value}件</span>
    </button>
  );
}

function detailTitle(key: DetailKey) {
  if (key === "created") return "新規登録の明細";
  if (key === "skipped") return "スキップの明細";
  if (key === "excluded") return "除外された明細（例）";
  return "重複の明細";
}

function getDetailSamples(result: ImportResult, key: DetailKey | null): Array<unknown> {
  if (!key) return [];
  if (key === "created") return result.created_samples ?? [];
  if (key === "skipped") return result.skipped_samples ?? [];
  if (key === "duplicate") return result.duplicate_samples ?? [];
  return result.excluded_samples ?? [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function sampleDate(sample: unknown) {
  const row = asRecord(sample);
  if (!row) return "—";
  const value = row.date;
  return typeof value === "string" && value.length > 0 ? value : "—";
}

function sampleStore(sample: unknown) {
  const row = asRecord(sample);
  if (!row) return "—";
  const value = row.store;
  return typeof value === "string" && value.length > 0 ? value : "—";
}

function sampleAmount(sample: unknown) {
  const row = asRecord(sample);
  if (!row) return "—";
  const raw = row.amount;
  const amount =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(amount) ? yen(amount) : "—";
}

function sampleReason(sample: unknown) {
  const row = asRecord(sample);
  if (!row) return "除外（理由不明）";
  const reason = row.reason;
  if (reason === "excluded_by_rule") return "除外ワード一致";
  return typeof reason === "string" && reason.length > 0
    ? `除外（${reason}）`
    : "除外（理由不明）";
}
