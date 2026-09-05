import { colors, radius } from "../theme.js";
import type { ItemEditorProps } from "../types.js";

/**
 * Placeholder for an `opaque` {@link PropType} — a slot whose type no form can
 * construct a value of.
 *
 * Deliberately not a JSON/raw-text fallback: a textarea over a database handle
 * invites input that can never be right. A host that *can* fill such a slot
 * (from a value it produces at run time) is expected to register an
 * {@link EditorPlugin} matching `kind: 'opaque'` and render its own picker
 * here.
 *
 * Doesn't repeat the type's `syntax` — whatever rendered this editor (a
 * {@link PropRow}, in this library's own editors) already showed it right
 * above, and it can run long (a generic instantiated over an absolute import
 * path) with no bearing on what to do about it, which the message does.
 */
export function OpaqueEditor(_props: ItemEditorProps) {
  return (
    <div
      data-proppy-editor="opaque"
      style={{
        padding: "8px 10px",
        border: `1px dashed ${colors.border}`,
        borderRadius: radius.sm,
        fontSize: 11,
        color: colors.textMuted,
      }}
    >
      No value editor for this type.
    </div>
  );
}
