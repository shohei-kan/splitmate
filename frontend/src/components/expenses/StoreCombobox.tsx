import type { ChangeEvent, InputHTMLAttributes } from "react";

import type { StoreSuggestion } from "../../api/types";

type StoreComboboxProps = {
  value: string;
  suggestions: StoreSuggestion[];
  onValueChange: (value: string) => void;
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
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onValueChange(e.target.value);
  };

  return (
    <>
      <input
        {...props}
        list={DATALIST_ID}
        value={value}
        onChange={handleChange}
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
