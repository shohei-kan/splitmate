import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMonthlySummary } from "../api/summary";
import { createExpense } from "../api/expenses";
import type { CardUser, Payer, BurdenType, Category } from "../api/types";
import { getInitialYearMonth, shiftMonth } from "../lib/month";
import { yen } from "../lib/format";

export function HomePage() {
  const qc = useQueryClient();

  const initial = useMemo(() => getInitialYearMonth(), []);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["summary", year, month],
    queryFn: () => fetchMonthlySummary(year, month),
  });

  const meShared = data ? data.shared_total - data.wife_shared : null;
  const showWifePersonal = (data?.wife_personal ?? 0) > 0;

  const go = (delta: number) => {
    const r = shiftMonth(year, month, delta);
    setYear(r.year);
    setMonth(r.month);
  };

  const goInitial = () => {
    const r = getInitialYearMonth();
    setYear(r.year);
    setMonth(r.month);
  };

  // ---- Manual form state ----
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState({
    date: todayISO,
    store: "",
    amount: "",
    payer: "me" as Payer,
    card_user: "unknown" as CardUser,
    burden_type: "shared" as BurdenType,
    category: "uncategorized" as Category,
    memo: "",
  });

  const canSubmit =
    form.date.trim() !== "" &&
    form.store.trim() !== "" &&
    form.amount.trim() !== "" &&
    Number(form.amount) > 0;

  const createMut = useMutation({
    mutationFn: () =>
      createExpense({
        date: form.date,
        store: form.store.trim(),
        amount: Number(form.amount),
        payer: form.payer,
        card_user: form.card_user,
        burden_type: form.burden_type,
        category: form.category,
        memo: form.memo.trim() ? form.memo.trim() : undefined,
      }),
    onSuccess: async () => {
      // サマリー更新
      await qc.invalidateQueries({ queryKey: ["summary", year, month] });

      // TODO: 一覧を作ったらこれも解放
      // await qc.invalidateQueries({ queryKey: ["expenses", year, month] });

      // フォームクリア（dateは維持）
      setForm((prev) => ({
        ...prev,
        store: "",
        amount: "",
        memo: "",
        card_user: "unknown",
        burden_type: "shared",
        category: "uncategorized",
        payer: prev.payer, // payerは維持でもOK
      }));
    },
  });

  return (
    <div className="space-y-5">
      {/* Top status (loading/error) */}
      <div className="min-h-[20px]">
        {error ? (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <div>取得に失敗しました: {(error as Error).message}</div>
            <button
              className="rounded-md bg-white px-2 py-1 text-xs font-medium text-red-700 border border-red-200 hover:bg-red-50"
              onClick={() => refetch()}
            >
              再試行
            </button>
          </div>
        ) : isLoading ? (
          <div className="text-sm text-[#6A7C8E]">読み込み中...</div>
        ) : null}
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-3">
        <button
          className="w-10 h-10 rounded-full hover:bg-white border border-transparent hover:border-[#E0E0E0]"
          onClick={() => go(-1)}
          aria-label="prev month"
        >
          ‹
        </button>

        <div className="px-3 py-2 rounded-full bg-white border border-[#E0E0E0] text-base font-semibold">
          {year}年{month}月
        </div>

        <button
          className="w-10 h-10 rounded-full hover:bg-white border border-transparent hover:border-[#E0E0E0]"
          onClick={() => go(1)}
          aria-label="next month"
        >
          ›
        </button>

        <button
          className="ml-2 h-10 px-4 rounded-full bg-white border border-[#E0E0E0] hover:bg-[#F7FAFD] text-sm font-medium"
          onClick={goInitial}
          aria-label="back to default month"
          title="初期表示（前月）に戻る"
        >
          今月
        </button>

        {isFetching && !isLoading && (
          <div className="ml-2 text-xs text-[#6A7C8E]">更新中...</div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Summary title="総支出（共有）" value={data ? yen(data.shared_total) : null} />
        <Summary title="私の共有支出" value={meShared !== null ? yen(meShared) : null} />
        <Summary title="妻の共有支出" value={data ? yen(data.wife_shared) : null} />
        {showWifePersonal && (
          <Summary title="妻の個人利用" value={data ? yen(data.wife_personal) : null} accent />
        )}
        <Summary title="折半額" value={data ? yen(data.half) : null} blue />
        <Summary title="振込（妻→私）" value={data ? yen(data.transfer_amount) : null} blue />
      </div>

      {/* Manual form + table placeholder */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Form */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">手入力で追加</div>
              {createMut.isPending && (
                <div className="text-xs text-[#6A7C8E]">登録中...</div>
              )}
            </div>

            {createMut.isError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                登録に失敗しました: {(createMut.error as Error).message}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <Field label="日付">
                <input
                  type="date"
                  className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </Field>

              <Field label="購入先">
                <input
                  className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm"
                  placeholder="例）東京電力 / Amazon"
                  value={form.store}
                  onChange={(e) => setForm((p) => ({ ...p, store: e.target.value }))}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="金額">
                  <input
                    inputMode="numeric"
                    className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm"
                    placeholder="例）12000"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, amount: e.target.value.replace(/[^\d]/g, "") }))
                    }
                  />
                </Field>

                <Field label="支払者（精算）">
                  <select
                    className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm bg-white"
                    value={form.payer}
                    onChange={(e) => setForm((p) => ({ ...p, payer: e.target.value as Payer }))}
                  >
                    <option value="me">私</option>
                    <option value="wife">妻</option>
                    <option value="unknown">不明</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="カード利用者（参考）">
                  <select
                    className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm bg-white"
                    value={form.card_user}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, card_user: e.target.value as CardUser }))
                    }
                  >
                    <option value="unknown">不明</option>
                    <option value="me">私</option>
                    <option value="wife">妻</option>
                  </select>
                </Field>

                <Field label="負担区分">
                  <select
                    className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm bg-white"
                    value={form.burden_type}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, burden_type: e.target.value as BurdenType }))
                    }
                  >
                    <option value="shared">共有</option>
                    <option value="wife_only">妻のみ</option>
                    <option value="me_only">私のみ</option>
                  </select>
                </Field>
              </div>

              <Field label="カテゴリ">
                <select
                  className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm bg-white"
                  value={form.category}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, category: e.target.value as Category }))
                  }
                >
                  <option value="uncategorized">未分類</option>
                  <option value="food">食費</option>
                  <option value="daily">日用品</option>
                  <option value="outside_food">外食</option>
                  <option value="utility">光熱費</option>
                  <option value="travel">旅行</option>
                  <option value="other">その他</option>
                </select>
              </Field>

              <Field label="メモ">
                <textarea
                  className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm min-h-[80px]"
                  placeholder="任意"
                  value={form.memo}
                  onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                />
              </Field>

              <button
                className="w-full h-11 rounded-lg bg-[#1F8EED] text-white font-semibold disabled:opacity-50"
                disabled={!canSubmit || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                追加する
              </button>

              <div className="text-[11px] text-[#6A7C8E]">
                ※「支払者（精算）」が精算ロジックに影響します。カード利用者は参考情報です。
              </div>
            </div>
          </div>
        </div>

        {/* Table placeholder */}
        <div className="lg:col-span-8">
          <div className="rounded-xl border border-dashed border-[#B0C4D8] bg-white/50 p-8 text-[#6A7C8E]">
            次：支出一覧テーブル
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-[#6A7C8E]">{label}</div>
      {children}
    </div>
  );
}

function Summary({
  title,
  value,
  accent,
  blue,
}: {
  title: string;
  value: string | null;
  accent?: boolean;
  blue?: boolean;
}) {
  return (
    <div className="bg-white border border-[#E0E0E0] rounded-xl p-5">
      <div className="text-sm text-[#6A7C8E]">{title}</div>

      {value === null ? (
        <div className="mt-3 h-7 w-32 rounded-md bg-[#EEF4FA] animate-pulse" />
      ) : (
        <div
          className={`mt-2 text-xl font-semibold ${
            accent ? "text-pink-400" : blue ? "text-[#1F8EED]" : ""
          }`}
        >
          {value}
        </div>
      )}
    </div>
  );
}