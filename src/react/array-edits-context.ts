import { createContext } from "react";
import type { SlotPath } from "./types.js";

/**
 * Structural edits to arrays, reported to a host that keeps state keyed by
 * {@link SlotPath}. An element's path is its index, so removing one shifts
 * every later element's path down by one. A host holding something per path
 * (a binding, a validation error) can't tell that from the new value alone,
 * and would otherwise leave it at the old index, attached to a different
 * element.
 */
export interface ArrayEdits {
  /**
   * Called when the element at `index` of the array at `path` is removed,
   * just before that array's `onChange` reports the new value.
   */
  onRemoveElement?: (path: SlotPath, index: number) => void;
}

/** Lets every array editor below report its {@link ArrayEdits}. */
export const ArrayEditsContext = createContext<ArrayEdits>({});
