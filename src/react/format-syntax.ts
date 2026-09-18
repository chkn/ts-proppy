import type { PropType } from "../types/prop-type.js";

/**
 * Default truncation length for {@link shortSyntax}, exposed so callers that
 * need to know whether a given `syntax` string *would* get truncated (e.g. to
 * decide whether a `title` tooltip is worth adding) can stay in sync with it.
 */
export const DEFAULT_SYNTAX_MAX = 42;

/**
 * `syntax` collapsed to one line and cut to `max` characters. A checker-
 * derived type (a branded string, a generic instantiated over an absolute
 * `typeof import(...)` path) can run to hundreds of characters; the full text
 * is still reachable via `title` wherever this is used in a label.
 */
export function shortSyntax(syntax: string, max = DEFAULT_SYNTAX_MAX): string {
  const oneLine = syntax.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max - 1).trimEnd() + "…";
}

/**
 * A compact stand-in for a complex type's `syntax` — used where the type's
 * own editor renders right below the label, so repeating its full structural
 * type there would just be noise. Returns null for a type that isn't complex
 * (see {@link isComplexPropType}), or has nothing shorter to say than its
 * `syntax` already does.
 */
export function typeSummary(type: PropType): string | null {
  switch (type.kind) {
    case "object": {
      const n = type.properties.length;
      return n === 0 ? "{}" : `${n} field${n === 1 ? "" : "s"}`;
    }
    case "array":
      return `${shortSyntax(type.element.type.syntax, 28)}[]`;
    case "tuple":
      return `tuple(${type.elements.length}${type.rest ? "+" : ""})`;
    case "record":
      return `{ [key]: ${shortSyntax(type.value.type.syntax, 28)} }`;
    default:
      return null;
  }
}
