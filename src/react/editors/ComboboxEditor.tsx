import { useEffect, useId, useRef, useState } from "react";
import type { OpenStringUnionInfo } from "../../types/open-string-union.js";
import { filterSuggestions } from "../../types/open-string-union.js";
import { defaultPlaceholder } from "../default-placeholder.js";
import { colors, controlStyle, radius } from "../theme.js";
import type { ItemEditorProps } from "../types.js";

interface ComboboxEditorProps extends ItemEditorProps {
  unionInfo: OpenStringUnionInfo;
}

/**
 * Free text with suggestions, for an open string union
 * (`'gpt-4o' | 'o3' | (string & {})`). Whatever is typed is the value; the
 * union's constants are offered as filtered completions, never as the only
 * choices.
 */
export function ComboboxEditor({
  value,
  onChange,
  propDef,
  unionInfo,
  className,
  disabled,
}: ComboboxEditorProps) {
  const text =
    value?.kind === "primitive" && typeof value.value === "string"
      ? value.value
      : "";
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Fixed rather than absolute, so a scrolling ancestor (a menu this editor
  // sits in, say) can't clip the suggestions.
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  const matches = open ? filterSuggestions(unionInfo.suggestions, text) : [];
  // An exact match is already the value; listing it alone adds nothing.
  const shown = matches.length === 1 && matches[0] === text ? [] : matches;

  const listOpen = shown.length > 0;
  useEffect(() => {
    if (!listOpen) return;
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setPosition({ left: r.left, top: r.bottom + 2, width: r.width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [listOpen]);

  const choose = (suggestion: string) => {
    onChange({ kind: "primitive", value: suggestion });
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={shown.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={text}
        placeholder={defaultPlaceholder(propDef)}
        readOnly={disabled}
        className={className}
        data-proppy-editor="combobox"
        onChange={e => {
          onChange({ kind: "primitive", value: e.target.value });
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => !disabled && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (disabled) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive(i => (shown.length ? (i + 1) % shown.length : 0));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive(i =>
              shown.length ? (i - 1 + shown.length) % shown.length : 0,
            );
          } else if (e.key === "Enter" && shown.length > 0) {
            e.preventDefault();
            choose(shown[Math.min(active, shown.length - 1)]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        style={className ? undefined : controlStyle}
      />
      {shown.length > 0 && (
        <div
          id={listId}
          role="listbox"
          style={{
            position: "fixed",
            left: position?.left ?? 0,
            top: position?.top ?? 0,
            width: position?.width,
            visibility: position ? undefined : "hidden",
            boxSizing: "border-box",
            zIndex: 10000,
            margin: 0,
            padding: 4,
            maxHeight: 240,
            overflowY: "auto",
            background: colors.menuBg,
            color: colors.menuColor,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
            fontSize: 12.5,
          }}
        >
          {shown.map((suggestion, i) => (
            <div
              key={suggestion}
              role="option"
              tabIndex={-1}
              aria-selected={i === active}
              // mousedown, not click: the input's blur would close the list first.
              onMouseDown={e => {
                e.preventDefault();
                choose(suggestion);
              }}
              onMouseEnter={() => setActive(i)}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                cursor: "pointer",
                background: i === active ? colors.menuActiveBg : "transparent",
              }}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
