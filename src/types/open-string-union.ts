import type { PropType } from "./prop-type.js";

/**
 * A string union that is open-ended by design: known values, plus any other
 * string. SDKs spell model IDs this way — `'gpt-4o' | 'o3' | (string & {})` —
 * so the known values are suggestions rather than the only choices.
 */
export interface OpenStringUnionInfo {
  /** The union's string constants, in declaration order. */
  suggestions: string[];
}

function isStringMember(type: PropType): boolean {
  return type.kind === "primitive" && (type.base ?? type.syntax) === "string";
}

/**
 * Describes `type` as an {@link OpenStringUnionInfo}, or null unless it is a
 * union of string constants and at least one string-based member (`string`,
 * `string & {}`, a template literal type) — and nothing else.
 */
export function getOpenStringUnionInfo(
  type: PropType,
): OpenStringUnionInfo | null {
  if (type.kind !== "union") return null;
  const suggestions: string[] = [];
  let open = false;
  for (const member of type.types) {
    if (member.kind === "constant" && typeof member.value === "string")
      suggestions.push(member.value);
    else if (isStringMember(member)) open = true;
    else return null;
  }
  return open && suggestions.length > 0 ? { suggestions } : null;
}

/**
 * The suggestions to show for what has been typed so far: those containing
 * `query` (case-insensitively), prefix matches first, at most `limit` of them.
 * An empty query shows the first `limit` suggestions as they are.
 */
export function filterSuggestions(
  suggestions: readonly string[],
  query: string,
  limit = 50,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return suggestions.slice(0, limit);
  const prefix: string[] = [];
  const infix: string[] = [];
  for (const s of suggestions) {
    const i = s.toLowerCase().indexOf(q);
    if (i === 0) prefix.push(s);
    else if (i > 0) infix.push(s);
  }
  return [...prefix, ...infix].slice(0, limit);
}
