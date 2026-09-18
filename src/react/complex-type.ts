import type { PropType } from "../types/prop-type.js";
import { getSelectableUnionInfo } from "../types/selectable-union.js";

/**
 * Whether a type renders as its own multi-field editor (an object, array,
 * tuple, or open-ended union) rather than a single control. Mirrors the
 * routing in {@link ItemEditor} — kept here so any row that needs to know
 * "is there something to expand/collapse under this label" doesn't have to
 * re-derive it.
 */
export function isComplexPropType(type: PropType): boolean {
  // Constant unions get a dropdown, not a nested editor.
  if (type.kind === "union" && type.types.every(t => t.kind === "constant"))
    return false;
  // Any other union pairs a dropdown with the selected member's own editor;
  // that member's own complexity is what matters, not the union itself.
  if (getSelectableUnionInfo(type)) return false;
  if (type.kind === "function") return false;
  return (
    type.kind === "object" ||
    type.kind === "record" ||
    type.kind === "union" ||
    type.kind === "array" ||
    type.kind === "tuple"
  );
}
