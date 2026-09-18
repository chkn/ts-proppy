import { valueToSourceText } from "../../editing/value-to-string.js";
import { defaultPlaceholder } from "../default-placeholder.js";
import { controlStyle, monoFont } from "../theme.js";
import type { ItemEditorProps } from "../types.js";

export function JsonFallbackEditor({
  value,
  onChange,
  propDef,
  className,
  disabled,
}: ItemEditorProps) {
  const text = value ? valueToSourceText(value) : "";

  return (
    <textarea
      value={text}
      onChange={e => onChange({ kind: "raw", sourceText: e.target.value })}
      placeholder={defaultPlaceholder(propDef)}
      className={className}
      data-proppy-editor="json-fallback"
      readOnly={disabled}
      style={
        className
          ? undefined
          : {
              ...controlStyle,
              fontSize: 11,
              fontFamily: monoFont,
              minHeight: 40,
              resize: "vertical",
            }
      }
    />
  );
}
