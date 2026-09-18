import type { ImportSpecifier, PropValue } from "../types/prop-value.js";

export function valueToDisplayString(value: PropValue): string {
  if (value.displayValue !== undefined) return value.displayValue;
  return valueToSourceText(value);
}

/** Convert a PropValue to TypeScript source text */
export function valueToSourceText(value: PropValue): string {
  switch (value.kind) {
    case "primitive": {
      if (value.value === null) return "null";
      if (value.value === undefined) return "undefined";
      if (typeof value.value === "string") return JSON.stringify(value.value);
      return String(value.value);
    }

    case "template": {
      // Emit a backtick template literal: string segments are literal text
      // (with `\`, `` ` ``, and `${` escaped so they survive the host
      // language's template parser), and tokens become `${expr}` interps.
      let out = "";
      for (const seg of value.value) {
        if (typeof seg === "string") {
          out += seg
            .replace(/\\/g, "\\\\")
            .replace(/`/g, "\\`")
            .replace(/\$\{/g, "\\${");
        } else {
          out += "${" + seg.expr + "}";
        }
      }
      return "`" + out + "`";
    }

    case "functionCall": {
      const args = value.args.map(valueToSourceText).join(", ");
      return `${value.callee}(${args})`;
    }

    case "lambda": {
      const params = value.parameters.join(", ");
      return `(${params}) => ${value.body}`;
    }

    case "object": {
      const entries = Object.entries(value.properties);
      if (entries.length === 0) return "{}";
      const props = entries
        .map(([k, v]) => {
          // `{ ticket }` rather than `{ ticket: ticket }`.
          if (
            v.kind === "reference" &&
            v.path.length === 1 &&
            v.path[0] === k &&
            isIdentifier(k)
          )
            return k;
          return `${propertyKeyToSource(k)}: ${valueToSourceText(v)}`;
        })
        .join(", ");
      return `{ ${props} }`;
    }

    case "reference":
      return referenceToSource(value.path);

    case "array":
    case "tuple": {
      const els = value.elements.map(valueToSourceText).join(", ");
      return `[${els}]`;
    }

    case "raw":
      return value.sourceText;
  }
}

/** Collect all ImportSpecifiers from a PropValue tree */
export function collectImports(value: PropValue): ImportSpecifier[] {
  const imports: ImportSpecifier[] = [];

  function walk(v: PropValue) {
    if (v.kind === "functionCall") {
      // A list of candidates hasn't been resolved against a file yet (see
      // `resolveBindings`), so there is no one import to add.
      if (!Array.isArray(v.binding) && v.binding?.kind === "import")
        imports.push(v.binding.spec);
      v.args.forEach(walk);
    } else if (v.kind === "object") {
      Object.values(v.properties).forEach(walk);
    } else if (v.kind === "array" || v.kind === "tuple") {
      v.elements.forEach(walk);
    }
  }

  walk(value);
  return imports;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function isIdentifier(text: string): boolean {
  return IDENTIFIER.test(text);
}

/** An object key as source: bare when it's an identifier, quoted otherwise. */
export function propertyKeyToSource(key: string): string {
  return isIdentifier(key) ? key : JSON.stringify(key);
}

/** A reference path as source: `a.b`, with bracket access for non-identifier segments. */
export function referenceToSource(path: readonly string[]): string {
  return path
    .map((segment, i) =>
      i === 0
        ? segment
        : isIdentifier(segment)
          ? `.${segment}`
          : `[${JSON.stringify(segment)}]`,
    )
    .join("");
}
