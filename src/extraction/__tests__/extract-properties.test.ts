import ts from "typescript";
import { describe, expect, test } from "vitest";
import { getDiscriminatedUnionInfo } from "../../types/discriminated-union.js";
import { extractPropertiesFromTypeNode } from "../extract-properties.js";

function extractFromSource(source: string) {
  const sourceFile = ts.createSourceFile(
    "test.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
  );

  // Find the first type node that is a type reference in a parameter, or a direct type literal
  // Strategy: find the Props type and extract from it
  let typeNode: ts.TypeNode | undefined;

  function visit(node: ts.Node) {
    // Look for the first parameter type annotation in a default export function
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      if (node.parameters.length > 0 && node.parameters[0].type) {
        typeNode = node.parameters[0].type;
        return;
      }
    }
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      const expr = node.expression;
      if (
        ts.isArrowFunction(expr) &&
        expr.parameters.length > 0 &&
        expr.parameters[0].type
      ) {
        typeNode = expr.parameters[0].type;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  if (!typeNode) return { definitions: [] };
  return extractPropertiesFromTypeNode(typeNode, sourceFile);
}

describe("extractPropertiesFromTypeNode", () => {
  test("extracts props from interface", () => {
    const result = extractFromSource(`
export interface Props {
  name: string
  age: number
  optional?: boolean
}
export default ({ name, age }: Props) => <div>{name}</div>
`);

    expect(result.definitions).toHaveLength(3);
    expect(result.definitions[0]).toEqual({
      name: "name",
      type: { kind: "primitive", syntax: "string" },
      optional: false,
    });
    expect(result.definitions[1]).toEqual({
      name: "age",
      type: { kind: "primitive", syntax: "number" },
      optional: false,
    });
    expect(result.definitions[2]).toEqual({
      name: "optional",
      type: { kind: "primitive", syntax: "boolean" },
      optional: true,
    });
  });

  test("extracts props from type alias", () => {
    const result = extractFromSource(`
export type MyProps = {
  title: string
  count?: number
}
export default ({ title }: MyProps) => <div>{title}</div>
`);

    expect(result.definitions).toHaveLength(2);
    expect(result.definitions[0]).toEqual({
      name: "title",
      type: { kind: "primitive", syntax: "string" },
      optional: false,
    });
    expect(result.definitions[1]).toEqual({
      name: "count",
      type: { kind: "primitive", syntax: "number" },
      optional: true,
    });
  });

  test("returns empty definitions when no params", () => {
    const sourceFile = ts.createSourceFile(
      "test.tsx",
      "const x = 1",
      ts.ScriptTarget.Latest,
      true,
    );
    // Create a type node for 'string' to test with an unresolvable type
    const result = extractPropertiesFromTypeNode(
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      sourceFile,
    );
    expect(result.definitions).toHaveLength(0);
  });

  test("extracts complex types", () => {
    const result = extractFromSource(`
export interface Props {
  items: string[]
  callback: (x: number) => void
  config: { key: string }
}
export default (props: Props) => <div>Complex</div>
`);

    expect(result.definitions).toHaveLength(3);
    expect(result.definitions[0].name).toBe("items");
    expect(result.definitions[0].type.kind).toBe("array");
    if (result.definitions[0].type.kind === "array") {
      expect(result.definitions[0].type.element.type.kind).toBe("primitive");
      expect(result.definitions[0].type.element.type.syntax).toBe("string");
    }

    expect(result.definitions[1].name).toBe("callback");
    expect(result.definitions[1].type.kind).toBe("function");
    if (result.definitions[1].type.kind === "function") {
      expect(result.definitions[1].type.parameters[0].name).toBe("x");
    }

    expect(result.definitions[2].name).toBe("config");
    expect(result.definitions[2].type.kind).toBe("object");
    if (result.definitions[2].type.kind === "object") {
      expect(result.definitions[2].type.properties[0].name).toBe("key");
    }
  });

  test("extracts JSDoc comments", () => {
    const result = extractFromSource(`
export interface Props {
  /**
   * The user's name
   */
  name: string
  /**
   * The user's age in years
   */
  age: number
  /** Optional flag */
  optional?: boolean
}
export default ({ name, age }: Props) => <div>{name}</div>
`);

    expect(result.definitions[0].description).toBe("The user's name");
    expect(result.definitions[1].description).toBe("The user's age in years");
    expect(result.definitions[2].description).toBe("Optional flag");
  });

  test("ignores non-JSDoc comments", () => {
    const result = extractFromSource(`
export interface Props {
  // This is a regular comment
  name: string
  /* This is a block comment */
  age: number
  /**
   * This is a JSDoc comment
   */
  optional?: boolean
}
export default ({ name, age }: Props) => <div>{name}</div>
`);

    expect(result.definitions[0].description).toBeUndefined();
    expect(result.definitions[1].description).toBeUndefined();
    expect(result.definitions[2].description).toBe("This is a JSDoc comment");
  });

  test("extracts last JSDoc comment when multiple exist", () => {
    const result = extractFromSource(`
export interface Props {
  /**
   * First comment
   */
  /* Regular block comment */
  /**
   * Second comment (should be used)
   */
  name: string
}
export default ({ name }: Props) => <div>{name}</div>
`);

    expect(result.definitions[0].description).toBe(
      "Second comment (should be used)",
    );
  });

  test("extracts function type parameters", () => {
    const result = extractFromSource(`
export interface Props {
  onClick: () => void
  onHover: (x: number) => void
}
export default ({ onClick }: Props) => <div>test</div>
`);

    expect(result.definitions[0].type.kind).toBe("function");
    if (result.definitions[0].type.kind === "function") {
      expect(result.definitions[0].type.parameters).toHaveLength(0);
    }
    expect(result.definitions[1].type.kind).toBe("function");
    if (result.definitions[1].type.kind === "function") {
      expect(result.definitions[1].type.parameters[0].name).toBe("x");
      expect(result.definitions[1].type.parameters[0].type.syntax).toBe(
        "number",
      );
    }
  });

  test("extracts nested properties from type reference", () => {
    const result = extractFromSource(`
export interface Config {
  /** API key */
  apiKey: string
  /** Timeout in milliseconds */
  timeout: number
}
export interface Props {
  /** Configuration object */
  config: Config
}
export default ({ config }: Props) => <div>{config.apiKey}</div>
`);

    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0].name).toBe("config");
    expect(result.definitions[0].description).toBe("Configuration object");
    expect(result.definitions[0].type.kind).toBe("object");
    if (result.definitions[0].type.kind === "object") {
      expect(result.definitions[0].type.properties).toHaveLength(2);
      expect(result.definitions[0].type.properties[0].name).toBe("apiKey");
      expect(result.definitions[0].type.properties[0].description).toBe(
        "API key",
      );
      expect(result.definitions[0].type.properties[1].name).toBe("timeout");
      expect(result.definitions[0].type.properties[1].description).toBe(
        "Timeout in milliseconds",
      );
    }
  });

  test("extracts inherited props from base interface", () => {
    const result = extractFromSource(`
export interface BaseProps {
  /** Base property: ID */
  id: string
  /** Base property: Name */
  name: string
}
export interface Props extends BaseProps {
  /** Extended property: Title */
  title: string
  /** Extended property: Count */
  count?: number
}
export default ({ id, name, title }: Props) => <div>{title}</div>
`);

    expect(result.definitions).toHaveLength(4);
    expect(result.definitions[0].name).toBe("id");
    expect(result.definitions[0].description).toBe("Base property: ID");
    expect(result.definitions[1].name).toBe("name");
    expect(result.definitions[1].description).toBe("Base property: Name");
    expect(result.definitions[2].name).toBe("title");
    expect(result.definitions[2].description).toBe("Extended property: Title");
    expect(result.definitions[3].name).toBe("count");
    expect(result.definitions[3].optional).toBe(true);
    expect(result.definitions[3].description).toBe("Extended property: Count");
  });

  test("extracts constant literal types", () => {
    const result = extractFromSource(`
export interface Props {
  status: 'active' | 'inactive'
  count: 42
  enabled: true
}
export default ({ status }: Props) => <div>{status}</div>
`);

    expect(result.definitions[0].type.kind).toBe("union");
    if (result.definitions[0].type.kind === "union") {
      expect(result.definitions[0].type.types[0].kind).toBe("constant");
      if (result.definitions[0].type.types[0].kind === "constant") {
        expect(result.definitions[0].type.types[0].value).toBe("active");
      }
    }

    expect(result.definitions[1].type.kind).toBe("constant");
    expect(result.definitions[2].type.kind).toBe("constant");
  });

  test("handles mixed union types", () => {
    const result = extractFromSource(`
export interface Props {
  value: string | number | boolean
}
export default ({ value }: Props) => <div>{value}</div>
`);

    expect(result.definitions[0].type.kind).toBe("union");
    if (result.definitions[0].type.kind === "union") {
      expect(result.definitions[0].type.types).toHaveLength(3);
      expect(result.definitions[0].type.types[0].kind).toBe("primitive");
      expect(result.definitions[0].type.types[0].syntax).toBe("string");
    }
  });

  test("surfaces null and undefined members as constants", () => {
    const result = extractFromSource(`
export interface Props {
  description: string | null
  title: string | undefined
}
export default ({ description }: Props) => <div>{description}</div>
`);

    // A nullable primitive is a union of the primitive and a single-value
    // constant, so it reaches the dropdown as a member rather than opaquely.
    for (const def of result.definitions) {
      expect(def.type.kind).toBe("union");
      if (def.type.kind !== "union") continue;
      expect(def.type.types[0]).toEqual({
        kind: "primitive",
        syntax: "string",
      });
      expect(def.type.types[1].kind).toBe("constant");
    }

    const nullable = result.definitions[0].type;
    const undefinable = result.definitions[1].type;
    if (nullable.kind === "union" && nullable.types[1].kind === "constant") {
      expect(nullable.types[1].value).toBeNull();
    }
    if (
      undefinable.kind === "union" &&
      undefinable.types[1].kind === "constant"
    ) {
      expect(undefinable.types[1].value).toBeUndefined();
    }
  });

  test("extracts array types with element type", () => {
    const result = extractFromSource(`
export interface Props {
  items: string[]
  numbers: number[]
  complexArray: { id: number; name: string }[]
}
export default ({ items }: Props) => <div>{items}</div>
`);

    expect(result.definitions[0].type.kind).toBe("array");
    if (result.definitions[0].type.kind === "array") {
      expect(result.definitions[0].type.element.type.syntax).toBe("string");
    }

    expect(result.definitions[2].type.kind).toBe("array");
    if (result.definitions[2].type.kind === "array") {
      expect(result.definitions[2].type.element.type.kind).toBe("object");
    }
  });

  test("extracts tuple types", () => {
    const result = extractFromSource(`
export interface Props {
  coordinate: [number, number]
  mixed: [string, number, boolean]
}
export default ({ coordinate }: Props) => <div>{coordinate}</div>
`);

    expect(result.definitions[0].type.kind).toBe("tuple");
    if (result.definitions[0].type.kind === "tuple") {
      expect(result.definitions[0].type.elements).toHaveLength(2);
      expect(result.definitions[0].type.elements[0].type.syntax).toBe("number");
    }

    expect(result.definitions[1].type.kind).toBe("tuple");
    if (result.definitions[1].type.kind === "tuple") {
      expect(result.definitions[1].type.elements).toHaveLength(3);
    }
  });

  test("extracts Date type as primitive", () => {
    const result = extractFromSource(`
export interface Props {
  createdAt: Date
  updatedAt?: Date
}
export default ({ createdAt }: Props) => <div>{createdAt.toString()}</div>
`);

    expect(result.definitions[0].type.kind).toBe("primitive");
    expect(result.definitions[0].type.syntax).toBe("Date");
    expect(result.definitions[1].optional).toBe(true);
  });

  test("detects discriminated union", () => {
    const result = extractFromSource(`
export interface Props {
  action: { type: 'create'; name: string } | { type: 'delete'; id: number }
}
export default ({ action }: Props) => <div>{action.type}</div>
`);

    expect(result.definitions[0].type.kind).toBe("union");
    if (result.definitions[0].type.kind === "union") {
      const info = getDiscriminatedUnionInfo(result.definitions[0].type);
      expect(info).not.toBeNull();
      expect(info!.discriminator).toBe("type");
      expect(info!.cases).toHaveLength(2);
      expect(info!.cases[0].discriminatorValue).toBe("create");
      expect(info!.cases[0].properties[0].name).toBe("name");
      expect(info!.cases[1].discriminatorValue).toBe("delete");
      expect(info!.cases[1].properties[0].name).toBe("id");
    }
  });

  test("detects discriminated union from separate interfaces", () => {
    const result = extractFromSource(`
export interface RichTextContent {
  type: 'richtext'
  html: string
}
export interface FileAttachmentContent {
  type: 'file'
  fileName: string
  fileSize: number
}
export type MessageContent = RichTextContent | FileAttachmentContent
export interface Props {
  content: MessageContent
}
export default ({ content }: Props) => <div>{content.type}</div>
`);

    expect(result.definitions[0].type.kind).toBe("union");
    if (result.definitions[0].type.kind === "union") {
      const info = getDiscriminatedUnionInfo(result.definitions[0].type);
      expect(info).not.toBeNull();
      expect(info!.discriminator).toBe("type");
      expect(info!.cases).toHaveLength(2);
      expect(info!.cases[0].discriminatorValue).toBe("richtext");
      expect(info!.cases[1].discriminatorValue).toBe("file");
      expect(info!.cases[1].properties).toHaveLength(2);
    }
  });

  test("handles export default function syntax", () => {
    const result = extractFromSource(`
export interface ButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
}
export default function Button({ label, onClick, disabled }: ButtonProps) {
  return <button onClick={onClick} disabled={disabled}>{label}</button>
}
`);

    expect(result.definitions).toHaveLength(3);
    expect(result.definitions[0].name).toBe("label");
    expect(result.definitions[1].name).toBe("onClick");
    expect(result.definitions[1].type.kind).toBe("function");
    expect(result.definitions[2].name).toBe("disabled");
    expect(result.definitions[2].optional).toBe(true);
  });

  test("extracts from inline type literal", () => {
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'const x: { foo: string; bar?: number } = { foo: "hi" }',
      ts.ScriptTarget.Latest,
      true,
    );
    // Find the type literal node
    let typeNode: ts.TypeNode | undefined;
    function visit(node: ts.Node) {
      if (ts.isTypeLiteralNode(node)) typeNode = node;
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);

    const result = extractPropertiesFromTypeNode(typeNode!, sourceFile);
    expect(result.definitions).toHaveLength(2);
    expect(result.definitions[0].name).toBe("foo");
    expect(result.definitions[1].name).toBe("bar");
    expect(result.definitions[1].optional).toBe(true);
  });
});
