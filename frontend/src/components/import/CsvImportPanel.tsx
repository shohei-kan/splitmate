import { useState } from "react";
import { importMitsuiCsv, importRakutenCsv } from "../../api/import";
import { CsvImportForm } from "./CsvImportForm";

type Props = {
  invalidateKeys: Array<unknown[]>;
};

export function CsvImportPanel({ invalidateKeys }: Props) {
  const [provider, setProvider] = useState<"rakuten" | "mitsui">("rakuten");

  return (
    <div className="rounded-xl border border-[#E0E0E0] bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="text-base font-semibold">CSV取り込み</div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={`h-8 rounded-lg px-3 text-xs font-medium ${
              provider === "rakuten"
                ? "bg-[#1F8EED] text-white"
                : "border border-[#E0E0E0] bg-white text-[#0A2D4D]"
            }`}
            onClick={() => setProvider("rakuten")}
            aria-pressed={provider === "rakuten"}
          >
            楽天
          </button>
          <button
            type="button"
            className={`h-8 rounded-lg px-3 text-xs font-medium ${
              provider === "mitsui"
                ? "bg-[#1F8EED] text-white"
                : "border border-[#E0E0E0] bg-white text-[#0A2D4D]"
            }`}
            onClick={() => setProvider("mitsui")}
            aria-pressed={provider === "mitsui"}
          >
            三井
          </button>
        </div>
      </div>

      {provider === "rakuten" ? (
        <CsvImportForm
          provider="rakuten"
          upload={importRakutenCsv}
          invalidateKeys={invalidateKeys}
          defaultCardUser="unknown"
        />
      ) : (
        <CsvImportForm
          provider="mitsui"
          upload={importMitsuiCsv}
          invalidateKeys={invalidateKeys}
          defaultCardUser="unknown"
        />
      )}
    </div>
  );
}
