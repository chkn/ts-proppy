import type { PropDefinition } from "../../types/prop-definition.js";
import type { PropType } from "../../types/prop-type.js";
import type { PropValue } from "../../types/prop-value.js";
import { controlStyle } from "../theme.js";
import type { ItemEditorProps } from "../types.js";

function parseConstantUnion(propType: PropType): any[] {
  if (propType.kind !== "union") return [];
  return propType.types
    .filter(
      (t): t is Extract<PropType, { kind: "constant" }> =>
        t.kind === "constant",
    )
    .map(t => t.value);
}

/**
 * What the select should show as chosen: the live `value`, or `propDef`'s own
 * known default — never a bare `''` fallback. `undefined` means neither
 * exists, which the caller must render as a real placeholder option rather
 * than let the browser silently highlight the first real one: a `<select>`
 * with no option matching its `value` still shows *something* selected, and
 * that implied choice would never be one `onChange` actually reported.
 */
export function constantUnionSelection(
  propDef: Pick<PropDefinition, "defaultValue">,
  value: PropValue | undefined,
): string | undefined {
  if (value?.kind === "primitive") return String(value.value);
  if (propDef.defaultValue?.kind === "primitive")
    return String(propDef.defaultValue.value);
  return undefined;
}

export function ConstantUnionEditor({
  value,
  onChange,
  propDef,
  className,
  disabled,
}: ItemEditorProps) {
  const options = parseConstantUnion(propDef.type);
  const currentValue = constantUnionSelection(propDef, value);

  return (
    <select
      value={currentValue ?? ""}
      onChange={e => onChange({ kind: "primitive", value: e.target.value })}
      className={className}
      disabled={disabled}
      style={className ? undefined : controlStyle}
    >
      {currentValue === undefined && <option value="">-- Select --</option>}
      {options.map((option: any) => (
        <option key={String(option)} value={String(option)}>
          {String(option)}
        </option>
      ))}
    </select>
  );
}
