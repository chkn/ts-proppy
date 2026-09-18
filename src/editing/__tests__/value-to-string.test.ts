import { describe, expect, test } from "vitest";
import type { PropValue } from "../../types/prop-value.js";
import { valueToSourceText } from "../value-to-string.js";

describe("valueToSourceText", () => {
  test("serializes string primitive", () => {
    const val: PropValue = { kind: "primitive", value: "hello" };
    expect(valueToSourceText(val)).toBe('"hello"');
  });

  test("serializes primitive string with ${ literally (no backticks)", () => {
    const val: PropValue = { kind: "primitive", value: "Hello ${name}!" };
    expect(valueToSourceText(val)).toBe('"Hello ${name}!"');
  });

  test("serializes a template with one interp token", () => {
    const val: PropValue = {
      kind: "template",
      value: ["Hello ", { expr: "name" }, "!"],
    };
    expect(valueToSourceText(val)).toBe("`Hello ${name}!`");
  });

  test("escapes literal ${ that lives in a string segment (not a token)", () => {
    const val: PropValue = { kind: "template", value: ["Hello ${name}!"] };
    expect(valueToSourceText(val)).toBe("`Hello \\${name}!`");
  });

  test("escapes a literal backslash in a string segment", () => {
    const val: PropValue = { kind: "template", value: ["\\path\\to"] };
    expect(valueToSourceText(val)).toBe("`\\\\path\\\\to`");
  });

  test("mixes a literal ${name}-looking string and a real token", () => {
    const val: PropValue = {
      kind: "template",
      value: ["Hello ${name} and ", { expr: "language" }, ""],
    };
    expect(valueToSourceText(val)).toBe("`Hello \\${name} and ${language}`");
  });

  test("preserves a literal backslash before a token", () => {
    const val: PropValue = {
      kind: "template",
      value: ["\\", { expr: "name" }, ""],
    };
    expect(valueToSourceText(val)).toBe("`\\\\${name}`");
  });

  test("serializes number", () => {
    expect(valueToSourceText({ kind: "primitive", value: 42 })).toBe("42");
  });

  test("serializes boolean", () => {
    expect(valueToSourceText({ kind: "primitive", value: true })).toBe("true");
    expect(valueToSourceText({ kind: "primitive", value: false })).toBe(
      "false",
    );
  });

  test("serializes null and undefined", () => {
    expect(valueToSourceText({ kind: "primitive", value: null })).toBe("null");
    expect(valueToSourceText({ kind: "primitive", value: undefined })).toBe(
      "undefined",
    );
  });

  test("serializes function call", () => {
    const val: PropValue = {
      kind: "functionCall",
      callee: "openai",
      args: [{ kind: "primitive", value: "gpt-4" }],
      binding: { kind: "import", spec: { name: "openai", from: "ai" } },
    };
    expect(valueToSourceText(val)).toBe('openai("gpt-4")');
  });

  test("serializes lambda", () => {
    const val: PropValue = {
      kind: "lambda",
      parameters: ["x", "y"],
      body: "x + y",
    };
    expect(valueToSourceText(val)).toBe("(x, y) => x + y");
  });

  test("serializes object", () => {
    const val: PropValue = {
      kind: "object",
      properties: {
        name: { kind: "primitive", value: "Alice" },
        age: { kind: "primitive", value: 30 },
      },
    };
    expect(valueToSourceText(val)).toBe('{ name: "Alice", age: 30 }');
  });

  test("serializes empty object", () => {
    expect(valueToSourceText({ kind: "object", properties: {} })).toBe("{}");
  });

  test("serializes array", () => {
    const val: PropValue = {
      kind: "array",
      elements: [
        { kind: "primitive", value: 1 },
        { kind: "primitive", value: 2 },
      ],
    };
    expect(valueToSourceText(val)).toBe("[1, 2]");
  });

  test("serializes tuple", () => {
    const val: PropValue = {
      kind: "tuple",
      elements: [
        { kind: "primitive", value: "hello" },
        { kind: "primitive", value: 42 },
      ],
    };
    expect(valueToSourceText(val)).toBe('["hello", 42]');
  });

  test("serializes raw", () => {
    const val: PropValue = {
      kind: "raw",
      sourceText: "someComplexExpression()",
    };
    expect(valueToSourceText(val)).toBe("someComplexExpression()");
  });

  test("round-trips: function call with nested args", () => {
    const val: PropValue = {
      kind: "functionCall",
      callee: "createModel",
      args: [
        { kind: "primitive", value: "gpt-4" },
        {
          kind: "object",
          properties: { temperature: { kind: "primitive", value: 0.7 } },
        },
      ],
      binding: {
        kind: "import",
        spec: { name: "createModel", from: "@ai/sdk" },
      },
    };
    expect(valueToSourceText(val)).toBe(
      'createModel("gpt-4", { temperature: 0.7 })',
    );
  });
});
