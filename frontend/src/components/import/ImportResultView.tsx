import type { ImportResult } from "../../api/types";

export function ImportResultView({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="created" value={result.created} />
        <Stat label="skipped" value={result.skipped} />
        <Stat label="excluded" value={result.excluded_count} />
        <Stat label="duplicate" value={result.duplicate_count} />
      </div>

      {result.excluded_samples && result.excluded_samples.length > 0 && (
        <div className="rounded-lg border border-[#E0E0E0] bg-[#FAFCFF] p-3">
          <div className="mb-2 text-xs font-medium text-[#6A7C8E]">excluded_samples</div>
          <pre className="max-h-48 overflow-auto text-[11px] text-[#4B5B6A]">
            {JSON.stringify(result.excluded_samples, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#E0E0E0] bg-white p-3">
      <div className="text-[11px] text-[#6A7C8E]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#0A2D4D]">{value}</div>
    </div>
  );
}
