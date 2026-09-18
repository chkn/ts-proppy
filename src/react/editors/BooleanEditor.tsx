import type { PropDefinition } from "../../types/prop-definition.js";
import type { PropValue } from "../../types/prop-value.js";
import { controlStyle } from "../theme.js";
import type { ItemEditorProps } from "../types.js";

/**
 * What the select should show as chosen: the live `value`, or `propDef`'s own
 * known default — never an implied `false`. `undefined` means neither exists,
 * which the caller must render as a real placeholder option rather than let
 * the browser silently highlight `true` (the first `<option>`) — an implied
 * choice `onChange` would never actually report.
 */
export function booleanSelection(
  propDef: Pick<PropDefinition, "defaultValue">,
  value: PropValue | undefined,
): boolean | undefined {
  if (value?.kind === "primitive" && typeof value.value === "boolean")
    return value.value;
  if (
    propDef.defaultValue?.kind === "primitive" &&
    typeof propDef.defaultValue.value === "boolean"
  ) {
    return propDef.defaultValue.value;
  }
  return undefined;
}

export function BooleanEditor({
  value,
  onChange,
  propDef,
  className,
  disabled,
}: ItemEditorProps) {
  const boolValue = booleanSelection(propDef, value);

  return (
    <select
      value={boolValue === undefined ? "" : boolValue ? "true" : "false"}
      onChange={e =>
        onChange({ kind: "primitive", value: e.target.value === "true" })
      }
      className={className}
      disabled={disabled}
      style={className ? undefined : controlStyle}
    >
      {boolValue === undefined && <option value="">-- Select --</option>}
      <option value="true">true</option>
      <option value="false">false</option>
    </select>
  );
}
