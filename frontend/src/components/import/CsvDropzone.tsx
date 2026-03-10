import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

type Props = {
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  registerOpenPicker?: (fn: () => void) => void;
};

export function CsvDropzone({ file, onFile, disabled, registerOpenPicker }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = () => {
    if (!inputRef.current) return;
    inputRef.current.value = "";
    inputRef.current.click();
  };

  useEffect(() => {
    registerOpenPicker?.(openPicker);
  }, [registerOpenPicker]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setDragOver(false);

    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    onFile(f);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    onFile(f);
  };

  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-10 text-center ${
        dragOver ? "border-[#6FAEF2] bg-[#EAF4FF]" : "border-[#C7D2DE] bg-[#F2F4F7]"
      } ${disabled ? "opacity-60" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (disabled) return;
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#DFE9F4] text-2xl text-[#2B8CE6]">
        ⬆
      </div>

      <div className="mb-1 text-base font-semibold text-[#0A2D4D]">
        CSVファイルをドラッグ＆ドロップ
      </div>
      <div className="mb-4 text-sm text-[#6A7C8E]">または</div>

      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className="h-10 rounded-xl border border-[#C7D6E6] bg-white px-4 text-sm font-semibold text-[#0A2D4D] disabled:cursor-not-allowed"
      >
        ファイルを選択
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onChange}
        disabled={disabled}
        className="hidden"
      />

      {file && (
        <div className="mt-4 text-xs text-[#4B5B6A]">
          選択中: <span className="font-semibold">{file.name}</span>
        </div>
      )}
    </div>
  );
}
