import { defaultPlaceholder } from "../default-placeholder.js";
import { controlStyle } from "../theme.js";
import type { ItemEditorProps } from "../types.js";

export function DateEditor({
  value,
  onChange,
  propDef,
  disabled,
}: ItemEditorProps) {
  const strValue =
    value?.kind === "primitive" && typeof value.value === "string"
      ? value.value
      : "";

  return (
    <input
      type="datetime-local"
      value={strValue}
      onChange={e => onChange({ kind: "primitive", value: e.target.value })}
      placeholder={defaultPlaceholder(propDef)}
      readOnly={disabled}
      style={controlStyle}
    />
  );
}
