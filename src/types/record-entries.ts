import type { PropValue } from "./prop-value.js";

/**
 * `properties` with the key `from` renamed to `to`, in place: the entry keeps
 * its position, so renaming a question or an option doesn't reorder the
 * source.
 */
export function renameRecordKey(
  properties: Readonly<Record<string, PropValue>>,
  from: string,
  to: string,
): Record<string, PropValue> {
  if (from === to || !(from in properties)) return { ...properties };
  const out: Record<string, PropValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    out[key === from ? to : key] = value;
  }
  return out;
}

/**
 * Why `next` can't replace `current` as a key of `properties`, or null if it
 * can. Keys must be non-empty and unique.
 */
export function recordKeyError(
  properties: Readonly<Record<string, PropValue>>,
  current: string | undefined,
  next: string,
): string | null {
  if (next === "") return "Key can't be empty";
  if (next !== current && Object.hasOwn(properties, next))
    return "Key already exists";
  return null;
}

/** `base`, or `base2`, `base3`, … — the first that isn't already a key of `properties`. */
export function uniqueRecordKey(
  properties: Readonly<Record<string, PropValue>>,
  base = "key",
): string {
  if (!Object.hasOwn(properties, base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}${n}`;
    if (!Object.hasOwn(properties, candidate)) return candidate;
  }
}

/** The elements of a tuple- or array-shaped value, or `[]` for anything else. */
export function listElements(value: PropValue | undefined): PropValue[] {
  return value?.kind === "tuple" || value?.kind === "array"
    ? value.elements
    : [];
}

/**
 * Whether the element at `index` of a tuple with `fixed` fixed elements can be
 * removed: only elements past the fixed ones — those a rest element allows —
 * can go, so a tuple never gets shorter than its type requires.
 */
export function canRemoveTupleElement(index: number, fixed: number): boolean {
  return index >= fixed;
}
