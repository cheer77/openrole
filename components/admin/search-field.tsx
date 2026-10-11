"use client";

import { useRef } from "react";

type Props = {
  ariaLabel: string;
  clearLabel?: string;
  id?: string;
  name?: string;
  placeholder: string;
  value: string;
  maxLength: number;
  autoFocus?: boolean;
  showClear?: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
};

export function AdminSearchField({
  ariaLabel,
  clearLabel = "Clear search",
  id,
  name,
  placeholder,
  value,
  maxLength,
  autoFocus,
  showClear = Boolean(value),
  onChange,
  onClear,
}: Props) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="admin-search-field">
      <input
        ref={input}
        id={id}
        name={name}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {showClear && (
        <button
          className="admin-search-clear"
          type="button"
          aria-label={clearLabel}
          onClick={() => {
            onClear();
            input.current?.focus();
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}
