import { defaultValueForType } from "../../types/default-value.js";
import type { PropDefinition } from "../../types/prop-definition.js";
import type { PropValue } from "../../types/prop-value.js";
import { isComplexPropType } from "../complex-type.js";
import { ItemEditor } from "../ItemEditor.js";
import {
  buttonStyle,
  colors,
  nestedGroupStyle,
  radius,
  rowHeaderHeight,
} from "../theme.js";
import type { EditorPlugin, SlotPath } from "../types.js";

interface ArrayEditorProps {
  /** The definition every element is edited against. */
  element: PropDefinition;
  value: PropValue | undefined;
  onChange: (value: PropValue) => void;
  plugins?: EditorPlugin[];
  path?: SlotPath;
  disabled?: boolean;
}

export function ArrayEditor({
  element,
  value,
  onChange,
  plugins,
  path = [],
  disabled,
}: ArrayEditorProps) {
  const elements: PropValue[] = value?.kind === "array" ? value.elements : [];

  const addItem = () => {
    onChange({
      kind: "array",
      elements: [
        ...elements,
        element.defaultValue ?? defaultValueForType(element.type),
      ],
    });
  };

  const removeItem = (index: number) => {
    onChange({
      kind: "array",
      elements: elements.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, newValue: PropValue) => {
    const newElements = [...elements];
    newElements[index] = newValue;
    onChange({ kind: "array", elements: newElements });
  };

  // A complex element (object, tuple, ...) renders its own PropRow header
  // above its actual controls, so the row's flex-start top lands on that
  // label rather than on anything editable. Nudge the button down past it.
  const removeButtonOffset = isComplexPropType(element.type)
    ? rowHeaderHeight
    : 0;

  return (
    <div style={nestedGroupStyle}>
      <div style={{ fontSize: 11, color: colors.textSecondary }}>
        {elements.length} item{elements.length !== 1 ? "s" : ""}
      </div>
      {elements.map((item, index) => (
        <div
          key={index}
          style={{ display: "flex", gap: 6, alignItems: "flex-start" }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <ItemEditor
              propDef={element}
              value={item}
              onChange={newValue => updateItem(index, newValue)}
              plugins={plugins}
              path={[...path, String(index)]}
              disabled={disabled}
            />
          </div>
          <button
            type="button"
            onClick={() => removeItem(index)}
            aria-label={`Remove item ${index + 1}`}
            disabled={disabled}
            style={{
              ...buttonStyle,
              padding: "5px 8px",
              marginTop: removeButtonOffset,
              background: colors.dangerBg,
              color: colors.dangerColor,
              borderColor: colors.dangerBorder,
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        disabled={disabled}
        style={{
          ...buttonStyle,
          width: "100%",
          padding: "6px",
          borderStyle: "dashed",
          borderRadius: radius.sm,
        }}
      >
        + Add item
      </button>
    </div>
  );
}
