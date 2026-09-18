import { useState } from "react";
import type { PropDefinition } from "../../types/prop-definition.js";
import type { PropValue } from "../../types/prop-value.js";
import type { SelectableUnionInfo } from "../../types/selectable-union.js";
import { matchUnionMember } from "../../types/selectable-union.js";
import { ItemEditor } from "../ItemEditor.js";
import { controlStyle } from "../theme.js";
import type { EditorPlugin, SlotPath } from "../types.js";

interface UnionMemberEditorProps {
  propDef: PropDefinition;
  unionInfo: SelectableUnionInfo;
  value: PropValue | undefined;
  onChange: (value: PropValue) => void;
  plugins?: EditorPlugin[];
  className?: string;
  path?: SlotPath;
  disabled?: boolean;
}

/**
 * Editor for a union with at least one open-ended member (see
 * {@link SelectableUnionInfo}) — `string | null`, `'auto' | 'none' | number`,
 * `string | number`, …
 *
 * A dropdown picks the member, and an open-ended one reveals its own editor
 * beneath it; a member that is a single constant needs no editor. Options carry
 * their index rather than the member's value, so a chosen constant reaches
 * `onChange` with its real type (`null`, `42`) rather than stringified.
 *
 * Switching members keeps what was entered under the one being left, so
 * toggling `string | null` to `null` and back doesn't discard the text. Those
 * drafts live as long as the editor is mounted, like any other unsubmitted
 * form state.
 */
export function UnionMemberEditor({
  propDef,
  unionInfo,
  value,
  onChange,
  plugins,
  className,
  path,
  disabled,
}: UnionMemberEditorProps) {
  const { members } = unionInfo;

  // The selection normally follows the value, but an explicit pick has to stick
  // even when the value can't express it: an empty value is indistinguishable
  // from an `undefined` constant.
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked ?? matchUnionMember(unionInfo, value);
  const member = members[selected];

  // What was last entered under each open-ended member, so switching away and
  // back restores it rather than starting over. Keyed by member index, which is
  // stable for as long as this editor is mounted against the same property.
  const [drafts, setDrafts] = useState<Record<number, PropValue | undefined>>(
    {},
  );

  const handleSelect = (option: string) => {
    const index = Number(option);
    setDrafts(prev => ({ ...prev, [selected]: value }));
    setPicked(index);

    // A constant member is its own value; an open-ended one resumes its draft,
    // falling back to empty the first time it's selected.
    const chosen = members[index];
    onChange(
      chosen.kind === "constant"
        ? { kind: "primitive", value: chosen.value }
        : (drafts[index] ?? { kind: "primitive", value: undefined }),
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <select
        value={String(selected)}
        onChange={e => handleSelect(e.target.value)}
        className={className}
        style={className ? undefined : controlStyle}
        disabled={disabled}
      >
        {members.map((m, i) => (
          <option key={i} value={String(i)}>
            {m.syntax}
          </option>
        ))}
      </select>

      {member.kind !== "constant" && (
        <ItemEditor
          propDef={{ ...propDef, type: member }}
          value={value}
          onChange={onChange}
          plugins={plugins}
          className={className}
          path={path}
          disabled={disabled}
        />
      )}
    </div>
  );
}
