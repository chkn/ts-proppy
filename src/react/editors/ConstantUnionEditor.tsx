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
 * Which of `options` the select should show as chosen: the live `value`, or
 * `propDef`'s own known default — never a bare `''` fallback. `undefined` means
 * neither is one of the options, which the caller must render as a real
 * placeholder option rather than let the browser silently highlight the first
 * real one: a `<select>` with no option matching its `value` still shows
 * *something* selected, and that implied choice would never be one `onChange`
 * actually reported.
 */
export function constantUnionSelection(
  options: readonly unknown[],
  propDef: Pick<PropDefinition, "defaultValue">,
  value: PropValue | undefined,
): number | undefined {
  const chosen = value?.kind === "primitive" ? value : propDef.defaultValue;
  if (chosen?.kind !== "primitive") return undefined;
  const index = options.indexOf(chosen.value);
  return index === -1 ? undefined : index;
}

/**
 * Options carry their index rather than the constant, so a chosen one reaches
 * `onChange` with its real type (`undefined`, `null`, `42`) rather than
 * stringified.
 */
export function ConstantUnionEditor({
  value,
  onChange,
  propDef,
  className,
  disabled,
}: ItemEditorProps) {
  const options = parseConstantUnion(propDef.type);
  const selected = constantUnionSelection(options, propDef, value);

  return (
    <select
      value={selected === undefined ? "" : String(selected)}
      onChange={e =>
        onChange({ kind: "primitive", value: options[Number(e.target.value)] })
      }
      className={className}
      disabled={disabled}
      style={className ? undefined : controlStyle}
    >
      {selected === undefined && <option value="">-- Select --</option>}
      {options.map((option, index) => (
        <option key={index} value={String(index)}>
          {String(option)}
        </option>
      ))}
    </select>
  );
}
