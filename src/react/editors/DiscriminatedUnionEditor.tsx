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
 * The discriminator value already written into `value`'s object properties —
 * never a fallback to `cases[0]`. Pre-selecting a case here would let
 * `updateField` capture that case's fields into `value` while the
 * discriminator itself was never chosen, silently producing an object with
 * no way to tell which case it was meant to be. Nothing case-specific is
 * offered until a real choice exists to attach it to.
 */
export function currentDiscriminatorValue(
  discriminator: string,
  objProps: Record<string, PropValue>,
): string | undefined {
  const prop = objProps[discriminator];
  return prop?.kind === "primitive" ? String(prop.value) : undefined;
}

/** The case named by an explicit {@link currentDiscriminatorValue}, if any. */
export function currentCaseFor(
  cases: readonly DiscriminatedUnionCase[],
  discriminatorValue: string | undefined,
): DiscriminatedUnionCase | undefined {
  if (discriminatorValue === undefined) return undefined;
  return cases.find(c => String(c.discriminatorValue) === discriminatorValue);
}

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
  const discriminatorValue = currentDiscriminatorValue(discriminator, objProps);
  const currentCase = currentCaseFor(cases, discriminatorValue);

  const handleDiscriminatorChange = (newValue: string) => {
    onChange({
      kind: "object",
      properties: { [discriminator]: { kind: "primitive", value: newValue } },
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
          value={discriminatorValue ?? ""}
          onChange={e => handleDiscriminatorChange(e.target.value)}
          style={controlStyle}
          disabled={disabled}
        >
          {discriminatorValue === undefined && (
            <option value="">-- Select --</option>
          )}
          {cases.map(c => (
            <option
              key={String(c.discriminatorValue)}
              value={String(c.discriminatorValue)}
            >
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
