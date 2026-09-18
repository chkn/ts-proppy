import type {
  InterpolatableIdentifier,
  PropDefinition,
} from "../types/prop-definition.js";
import type { PropValue, TemplateValue } from "../types/prop-value.js";

/**
 * Collapse an edited {@link TemplateValue} into the narrowest {@link PropValue}:
 * a plain `primitive` string when it contains no interpolation tokens, or a
 * `template` when at least one token is present. This keeps token-free strings
 * from being serialized as backtick template literals.
 *
 * @param value - The template value produced by the editor.
 * @returns A `primitive` PropValue if there are no tokens, else a `template`.
 */
export function collapseTemplateValue(value: TemplateValue): PropValue {
  if (value.some(seg => typeof seg !== "string"))
    return { kind: "template", value };
  return { kind: "primitive", value: value.join("") };
}

/**
 * Build the list of {@link InterpolatableIdentifier}s available for `${…}`
 * interpolation from a set of property/parameter definitions. Object-typed
 * definitions contribute their fields as `children`, recursively, so nested
 * access like `config.name` can be offered and resolved.
 *
 * @param defs - Definitions (e.g. a prompt's function parameters).
 * @returns One identifier per definition, with nested `children` for objects.
 */
export function interpolatablesFromDefinitions(
  defs: PropDefinition[],
): InterpolatableIdentifier[] {
  return defs.map(defToInterpolatable);
}

function defToInterpolatable(def: PropDefinition): InterpolatableIdentifier {
  const node: InterpolatableIdentifier = { name: def.name };
  if (def.type.kind === "object" && def.type.properties.length > 0) {
    node.children = def.type.properties.map(defToInterpolatable);
  }
  return node;
}

const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/y;

/**
 * Parse a pure member-access expression into its path segments.
 *
 * Accepts an identifier head followed by any number of `.ident`, `['key']`, or
 * `["key"]` accessors (e.g. `foo`, `foo.bar`, `foo['bar']`, `a.b['c']`).
 * Returns `null` for anything else — function calls, operators, computed or
 * numeric index access, empty/whitespace — so callers treat those as literal.
 *
 * @param expr - The interpolation expression text (without the surrounding `${}`).
 * @returns The path segments, or `null` if `expr` is not a plain member-access chain.
 */
export function parseInterpolationPath(expr: string): string[] | null {
  const s = expr.trim();
  if (s === "") return null;

  IDENTIFIER.lastIndex = 0;
  const head = IDENTIFIER.exec(s);
  if (head?.index !== 0) return null;

  const segments: string[] = [head[0]];
  let i = IDENTIFIER.lastIndex;

  while (i < s.length) {
    if (s[i] === ".") {
      IDENTIFIER.lastIndex = i + 1;
      const m = IDENTIFIER.exec(s);
      if (!m || m.index !== i + 1) return null;
      segments.push(m[0]);
      i = IDENTIFIER.lastIndex;
    } else if (s[i] === "[") {
      const quote = s[i + 1];
      if (quote !== '"' && quote !== "'") return null;
      let j = i + 2;
      let key = "";
      while (j < s.length && s[j] !== quote) {
        key += s[j];
        j++;
      }
      if (j >= s.length || s[j + 1] !== "]") return null;
      segments.push(key);
      i = j + 2;
    } else {
      return null;
    }
  }

  return segments;
}

/**
 * Resolve a path of segments against a tree of interpolatables.
 *
 * @param path - Segments, e.g. `['config', 'name']`.
 * @param roots - The top-level interpolatable identifiers.
 * @returns The matched node (whose `children` callers may inspect), or `null`
 *   if any segment is missing or the path is empty.
 */
export function resolveInterpolatable(
  path: string[],
  roots: InterpolatableIdentifier[],
): InterpolatableIdentifier | null {
  let level = roots;
  let node: InterpolatableIdentifier | null = null;
  for (const seg of path) {
    node = level.find(n => n.name === seg) ?? null;
    if (!node) return null;
    level = node.children ?? [];
  }
  return node;
}

/**
 * Compute autocomplete candidates for an in-progress interpolation.
 *
 * @param activeExpr - The text between the open `${` and the caret (no closing `}`).
 * @param roots - The available top-level interpolatable identifiers.
 * @returns `candidates` — the identifiers available at the current path level,
 *   filtered by the trailing `fragment` (case-insensitive prefix). `fragment`
 *   is the partial identifier being typed; its length tells the editor how many
 *   characters to replace when a candidate is accepted.
 */
export function interpolationSuggestions(
  activeExpr: string,
  roots: InterpolatableIdentifier[],
): { candidates: InterpolatableIdentifier[]; fragment: string } {
  const fragment = /[A-Za-z0-9_$]*$/.exec(activeExpr)![0];
  let prefix = activeExpr.slice(0, activeExpr.length - fragment.length);

  // Drop a single trailing accessor so `prefix` is a resolvable path (or empty):
  //   "config."   -> "config"     "config['" -> "config"
  //   "config[\"" -> "config"     "config["  -> "config"
  const sep = /(\.|\[\s*['"]?)\s*$/.exec(prefix);
  if (sep) prefix = prefix.slice(0, prefix.length - sep[0].length);

  let level: InterpolatableIdentifier[];
  if (prefix.trim() === "") {
    level = roots;
  } else {
    const path = parseInterpolationPath(prefix);
    const node = path ? resolveInterpolatable(path, roots) : null;
    level = node?.children ?? [];
  }

  const lower = fragment.toLowerCase();
  const candidates = level.filter(n => n.name.toLowerCase().startsWith(lower));
  return { candidates, fragment };
}

/**
 * Every path through a tree of interpolatables, parents before their
 * children: `[['ticket'], ['ticket', 'subject'], ['product']]`. What a slot
 * can be set to reference.
 */
export function interpolatablePaths(
  roots: readonly InterpolatableIdentifier[],
): string[][] {
  const out: string[][] = [];
  const walk = (
    nodes: readonly InterpolatableIdentifier[],
    prefix: string[],
  ) => {
    for (const node of nodes) {
      const path = [...prefix, node.name];
      out.push(path);
      if (node.children) walk(node.children, path);
    }
  };
  walk(roots, []);
  return out;
}
