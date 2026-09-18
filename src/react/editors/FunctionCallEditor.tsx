import { setCallArgument } from "../../types/catalog.js";
import type { PropDefinition } from "../../types/prop-definition.js";
import type { PropValue } from "../../types/prop-value.js";
import { ItemEditor } from "../ItemEditor.js";
import { PropRow } from "../PropRow.js";
import { colors, monoFont, nestedGroupStyle } from "../theme.js";
import type { EditorPlugin, SlotPath } from "../types.js";

type FunctionCallValue = Extract<PropValue, { kind: "functionCall" }>;

interface FunctionCallEditorProps {
  /** The call being edited. */
  value: FunctionCallValue;
  /** The called function's `function`-kind definition. */
  def: PropDefinition;
  onChange: (value: PropValue) => void;
  plugins?: EditorPlugin[];
  path?: SlotPath;
  disabled?: boolean;
}

/**
 * A call's arguments, edited one parameter at a time against the called
 * function's own parameter types: `choice(instructions, criteria)` gets an
 * editor for `instructions` and one for `criteria`. The callee and its binding
 * are kept as they are.
 */
export function FunctionCallEditor({
  value,
  def,
  onChange,
  plugins,
  path = [],
  disabled,
}: FunctionCallEditorProps) {
  const parameters = def.type.kind === "function" ? def.type.parameters : [];

  return (
    <div data-proppy-editor="function-call">
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 11,
          color: colors.textSecondary,
        }}
      >
        {value.callee}(
      </div>
      <div style={nestedGroupStyle}>
        {parameters.map((param, index) => (
          <PropRow
            key={index}
            name={param.name}
            type={param.type}
            optional={param.optional}
            description={param.description}
          >
            <ItemEditor
              propDef={param}
              value={value.args[index]}
              onChange={arg =>
                onChange(setCallArgument(value, parameters, index, arg))
              }
              plugins={plugins}
              path={[...path, param.name]}
              disabled={disabled}
            />
          </PropRow>
        ))}
      </div>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 11,
          color: colors.textSecondary,
        }}
      >
        )
      </div>
    </div>
  );
}
