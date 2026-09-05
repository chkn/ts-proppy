import type { PropDefinition } from "../../types/prop-definition.js";
import type { PropValue } from "../../types/prop-value.js";
import { ItemEditor } from "../ItemEditor.js";
import { PropRow } from "../PropRow.js";
import { nestedGroupStyle } from "../theme.js";
import type { EditorPlugin, SlotPath } from "../types.js";

interface ObjectEditorProps {
  properties: PropDefinition[];
  value: PropValue | undefined;
  onChange: (value: PropValue) => void;
  plugins?: EditorPlugin[];
  path?: SlotPath;
}

/**
 * An object type's fields, one {@link PropRow} each. Nesting reads as an
 * indented tree (a left rule, not a bordered box per level) so a few levels
 * deep still looks like one shape rather than boxes stacked inside boxes.
 */
export function ObjectEditor({
  properties,
  value,
  onChange,
  plugins,
  path = [],
}: ObjectEditorProps) {
  const objProps: Record<string, PropValue> =
    value?.kind === "object" ? { ...value.properties } : {};

  const updateField = (fieldName: string, fieldValue: PropValue) => {
    const newProps = { ...objProps, [fieldName]: fieldValue };
    onChange({ kind: "object", properties: newProps });
  };

  // Several sibling fields of the same shape (e.g. one per tool in a toolset)
  // is exactly the case that turns into a wall of repeated forms if every one
  // starts open — so collapse by default once there's more than one to show.
  // A single nested object has nothing to declutter, so it opens as-is.
  const defaultCollapsed = properties.length > 1;

  return (
    <div style={nestedGroupStyle}>
      {properties.map(prop => (
        <PropRow
          key={prop.name}
          name={prop.name}
          type={prop.type}
          optional={prop.optional}
          description={prop.description}
          defaultCollapsed={defaultCollapsed}
        >
          <ItemEditor
            propDef={prop}
            value={objProps[prop.name]}
            onChange={newValue => updateField(prop.name, newValue)}
            plugins={plugins}
            path={[...path, prop.name]}
          />
        </PropRow>
      ))}
    </div>
  );
}
