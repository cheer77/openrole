"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

type Props = {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  name?: string;
  id?: string;
  "aria-label"?: string;
};

export function Select({
  children,
  value,
  defaultValue = "",
  disabled = false,
  onChange,
  name,
  id,
  "aria-label": label,
}: Props) {
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string; children: ReactNode }>(child))
      return [];
    const text = String(child.props.children);
    return [{ value: child.props.value ?? text, label: text }];
  });
  const generatedId = useId();
  const listId = `${generatedId}-options`;
  const [localValue, setLocalValue] = useState(defaultValue);
  const selected = value ?? localValue;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});
  const [host, setHost] = useState<Element | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typing = useRef({ text: "", time: 0 });

  useEffect(() => {
    const form = trigger.current?.closest("form");
    const reset = () => {
      setLocalValue(defaultValue);
      setOpen(false);
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    const button = trigger.current!;
    const place = () => {
      const rect = button.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      const below = top + height - rect.bottom - 12;
      const above = rect.top - top - 12;
      const upwards = below < 220 && above > below;
      const available = Math.max(44, Math.min(280, upwards ? above : below));
      const menuWidth = Math.min(Math.max(rect.width, 200), width - 24);
      setPosition({
        left: Math.max(
          left + 12,
          Math.min(rect.left, left + width - menuWidth - 12),
        ),
        top: upwards ? rect.top - 6 : rect.bottom + 6,
        transform: upwards ? "translateY(-100%)" : undefined,
        width: menuWidth,
        maxHeight: available,
      });
    };
    const outside = (event: PointerEvent) => {
      if (
        !button.contains(event.target as Node) &&
        !list.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const scroll = (event: Event) => {
      if (!list.current?.contains(event.target as Node)) place();
    };
    place();
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", scroll, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", scroll, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open]);

  useEffect(() => {
    if (open)
      list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function show() {
    trigger.current?.focus({ preventScroll: true });
    setHost(trigger.current?.closest("dialog") ?? document.body);
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === selected),
      ),
    );
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    setLocalValue(option.value);
    onChange?.(option.value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  return (
    <>
      {name && <input type="hidden" name={name} value={selected} />}
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        id={id}
        className="custom-select"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        data-value={selected}
        onClick={() => (open ? setOpen(false) : show())}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            return;
          }
          if (event.key === "Tab") {
            setOpen(false);
            return;
          }
          if (
            ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(
              event.key,
            )
          ) {
            event.preventDefault();
            if (!open) {
              show();
              return;
            }
            if (event.key === "Enter" || event.key === " ") choose(active);
            else
              setActive((current) =>
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? options.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          options.length - 1,
                          current + (event.key === "ArrowDown" ? 1 : -1),
                        ),
                      ),
              );
          } else if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
            const now = event.timeStamp;
            typing.current.text =
              (now - typing.current.time > 700 ? "" : typing.current.text) +
              event.key.toLowerCase();
            typing.current.time = now;
            const found = options.findIndex((option) =>
              option.label.toLowerCase().startsWith(typing.current.text),
            );
            if (!open) show();
            if (found >= 0) setActive(found);
          }
        }}
      >
        <span className="custom-select-label">
          {options.find((option) => option.value === selected)?.label ??
            options[0]?.label}
        </span>
      </button>
      {open &&
        host &&
        createPortal(
          <div
            ref={list}
            id={listId}
            className="select-menu"
            role="listbox"
            aria-label={label ?? "Options"}
            style={position}
            onMouseDown={(event) => event.preventDefault()}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === selected}
                data-value={option.value}
                data-active={index === active}
                className="select-option"
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                <span aria-hidden="true" className="select-check">
                  {option.value === selected ? "✓" : ""}
                </span>
              </div>
            ))}
          </div>,
          host,
        )}
    </>
  );
}
