import { useId } from "react";
import type {
  DiscriminatedUnionCase,
  DiscriminatedUnionInfo,
} from "../../types/discriminated-union.js";
import type { PropValue } from "../../types/prop-value.js";
import { ItemEditor } from "../ItemEditor.js";
import { PropRow } from "../PropRow.js";
import { colors, controlStyle, nestedGroupStyle } from "../theme.js";
import type { EditorPlugin, SlotPath } from "../types.js";

interface DiscriminatedUnionEditorProps {
  discriminatedUnionInfo: DiscriminatedUnionInfo;
  value: PropValue | undefined;
  onChange: (value: PropValue) => void;
  plugins?: EditorPlugin[];
  path?: SlotPath;
  disabled?: boolean;
}

/**
 * Which of `cases` the discriminator already written into `value`'s object
 * properties names — never a fallback to `cases[0]`. Pre-selecting a case here
 * would let `updateField` capture that case's fields into `value` while the
 * discriminator itself was never chosen, silently producing an object with
 * no way to tell which case it was meant to be. Nothing case-specific is
 * offered until a real choice exists to attach it to.
 */
export function currentCaseIndex(
  cases: readonly DiscriminatedUnionCase[],
  discriminator: string,
  objProps: Record<string, PropValue>,
): number | undefined {
  const prop = objProps[discriminator];
  if (prop?.kind !== "primitive") return undefined;
  const index = cases.findIndex(c => c.discriminatorValue === prop.value);
  return index === -1 ? undefined : index;
}

/**
 * Options carry their case's index rather than its discriminator, so a chosen
 * one reaches `onChange` with its real type (`1`, `true`) rather than
 * stringified.
 */
export function DiscriminatedUnionEditor({
  discriminatedUnionInfo,
  value,
  onChange,
  plugins,
  path = [],
  disabled,
}: DiscriminatedUnionEditorProps) {
  const discriminatorId = useId();
  const { discriminator, cases } = discriminatedUnionInfo;

  const objProps: Record<string, PropValue> =
    value?.kind === "object" ? value.properties : {};
  const selected = currentCaseIndex(cases, discriminator, objProps);
  const currentCase = selected === undefined ? undefined : cases[selected];

  const handleCaseChange = (index: number) => {
    const { discriminatorValue } = cases[index];
    onChange({
      kind: "object",
      properties: {
        [discriminator]: { kind: "primitive", value: discriminatorValue },
      },
    });
  };

  const updateField = (fieldName: string, fieldValue: PropValue) => {
    const newProps = { ...objProps, [fieldName]: fieldValue };
    onChange({ kind: "object", properties: newProps });
  };

  return (
    <div style={nestedGroupStyle}>
      <div>
        <label
          htmlFor={discriminatorId}
          style={{
            display: "block",
            fontSize: 12,
            marginBottom: 4,
            fontWeight: 500,
            color: colors.textPrimary,
          }}
        >
          {discriminator} *
        </label>
        <select
          id={discriminatorId}
          value={selected === undefined ? "" : String(selected)}
          onChange={e => handleCaseChange(Number(e.target.value))}
          style={controlStyle}
          disabled={disabled}
        >
          {selected === undefined && <option value="">-- Select --</option>}
          {cases.map((c, index) => (
            <option key={index} value={String(index)}>
              {String(c.discriminatorValue)}
            </option>
          ))}
        </select>
      </div>

      {currentCase?.properties.map(prop => (
        <PropRow
          key={prop.name}
          name={prop.name}
          type={prop.type}
          optional={prop.optional}
          description={prop.description}
        >
          <ItemEditor
            propDef={prop}
            value={objProps[prop.name]}
            onChange={newValue => updateField(prop.name, newValue)}
            plugins={plugins}
            path={[...path, prop.name]}
            disabled={disabled}
          />
        </PropRow>
      ))}
    </div>
  );
}
