"use client";

import { useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

export type DoomSelectOption = {
  value: string;
  label: string;
  meta?: string;
};

type DoomSelectProps = {
  value: string;
  options: readonly DoomSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
};

export function DoomSelect({ value, options, onChange, ariaLabel, className = "" }: DoomSelectProps) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex] ?? options[0];

  const focusOption = (index: number) => {
    const normalized = (index + options.length) % options.length;
    optionRefs.current[normalized]?.focus();
  };

  const openWithFocus = (index: number) => {
    setOpen(true);
    window.requestAnimationFrame(() => focusOption(index));
  };

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openWithFocus(selectedIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openWithFocus(selectedIndex);
    } else if (event.key === "Home") {
      event.preventDefault();
      openWithFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      openWithFocus(options.length - 1);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const onOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number, optionValue: string) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(options.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(optionValue);
    }
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  };

  return (
    <div className={`doom-select ${open ? "doom-select--open" : ""} ${className}`} onBlur={onBlur}>
      <button
        ref={triggerRef}
        className="doom-select__trigger"
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="doom-select__readout">
          <strong>{selected?.label ?? "Select"}</strong>
          {selected?.meta ? <small>{selected.meta}</small> : null}
        </span>
        <span className="doom-select__mechanism" aria-hidden="true"><i /><i /></span>
      </button>
      {open ? (
        <div className="doom-select__menu" id={listboxId} role="listbox" aria-label={ariaLabel}>
          <span className="doom-select__menu-rail" aria-hidden="true" />
          {options.map((option, index) => (
            <button
              ref={(element) => { optionRefs.current[index] = element; }}
              className="doom-select__option"
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value || "all"}
              onClick={() => choose(option.value)}
              onKeyDown={(event) => onOptionKeyDown(event, index, option.value)}
            >
              <span className="doom-select__option-marker" aria-hidden="true" />
              <span><strong>{option.label}</strong>{option.meta ? <small>{option.meta}</small> : null}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
