import { useState, type ChangeEvent, type InputHTMLAttributes, type KeyboardEvent } from "react";

import type { StoreSuggestion } from "../../api/types";

type StoreComboboxProps = {
  value: string;
  suggestions: StoreSuggestion[];
  onValueChange: (value: string, meta?: { isComposing: boolean }) => void;
  inputClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;

const DATALIST_ID = "store-suggestions";

export function StoreCombobox({
  value,
  suggestions,
  onValueChange,
  inputClassName = "",
  ...props
}: StoreComboboxProps) {
  const [isComposing, setIsComposing] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nativeEvent = e.nativeEvent as InputEvent & { isComposing?: boolean };
    onValueChange(e.target.value, {
      isComposing: isComposing || Boolean(nativeEvent.isComposing),
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((isComposing || e.nativeEvent.isComposing) && e.key === "Enter") {
      e.preventDefault();
      return;
    }
    props.onKeyDown?.(e);
  };

  return (
    <>
      <input
        {...props}
        list={DATALIST_ID}
        value={value}
        onChange={handleChange}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={(e) => {
          setIsComposing(false);
          onValueChange(e.currentTarget.value, { isComposing: false });
        }}
        onKeyDown={handleKeyDown}
        className={inputClassName}
      />
      <datalist id={DATALIST_ID}>
        {suggestions.map((store) => (
          <option key={store.name} value={store.name}>
            {store.name}
          </option>
        ))}
      </datalist>
    </>
  );
}
