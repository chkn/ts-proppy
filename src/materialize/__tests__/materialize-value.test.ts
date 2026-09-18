import { describe, expect, test } from "vitest";
import type { PropValue } from "../../types/prop-value.js";
import { materializeValue } from "../materialize-value.js";

describe("materializeValue", () => {
  test("materializes primitive string", async () => {
    const result = await materializeValue({
      kind: "primitive",
      value: "hello",
    });
    expect(result).toBe("hello");
  });

  test("materializes primitive number", async () => {
    const result = await materializeValue({ kind: "primitive", value: 42 });
    expect(result).toBe(42);
  });

  test("materializes primitive boolean", async () => {
    const result = await materializeValue({ kind: "primitive", value: true });
    expect(result).toBe(true);
  });

  test("materializes null", async () => {
    const result = await materializeValue({ kind: "primitive", value: null });
    expect(result).toBeNull();
  });

  test("materializes undefined", async () => {
    const result = await materializeValue({
      kind: "primitive",
      value: undefined,
    });
    expect(result).toBeUndefined();
  });

  test("materializes object", async () => {
    const val: PropValue = {
      kind: "object",
      properties: {
        name: { kind: "primitive", value: "Alice" },
        age: { kind: "primitive", value: 30 },
      },
    };
    const result = await materializeValue(val);
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  test("materializes array", async () => {
    const val: PropValue = {
      kind: "array",
      elements: [
        { kind: "primitive", value: 1 },
        { kind: "primitive", value: 2 },
        { kind: "primitive", value: 3 },
      ],
    };
    const result = await materializeValue(val);
    expect(result).toEqual([1, 2, 3]);
  });

  test("materializes lambda", async () => {
    const val: PropValue = {
      kind: "lambda",
      parameters: ["x", "y"],
      body: "return x + y",
    };
    const result = await materializeValue(val);
    expect(typeof result).toBe("function");
    expect(result(2, 3)).toBe(5);
  });

  test("materializes a token-free template as joined literal text", async () => {
    const val: PropValue = { kind: "template", value: ["Hello world"] };
    const result = await materializeValue(val);
    expect(result).toBe("Hello world");
  });

  test("materializes a template with flat interpolation tokens", async () => {
    const val: PropValue = {
      kind: "template",
      value: ["Hello ", { expr: "name" }, "!"],
    };
    const result = await materializeValue(val, { name: "Alice" });
    expect(result).toBe("Hello Alice!");
  });

  test("throws when a template token is not found in scope", async () => {
    const val: PropValue = {
      kind: "template",
      value: ["Hello ", { expr: "name" }, "!"],
    };
    await expect(materializeValue(val, {})).rejects.toThrow(/name/);
  });

  test("resolves a dotted member-access token against nested scope", async () => {
    const val: PropValue = {
      kind: "template",
      value: ["host=", { expr: "config.host" }, ""],
    };
    const result = await materializeValue(val, {
      config: { host: "localhost" },
    });
    expect(result).toBe("host=localhost");
  });

  test("resolves a bracket member-access token against nested scope", async () => {
    const val: PropValue = {
      kind: "template",
      value: ["", { expr: "config['host']" }, ""],
    };
    const result = await materializeValue(val, {
      config: { host: "localhost" },
    });
    expect(result).toBe("localhost");
  });

  test("throws when a nested member-access token is missing", async () => {
    const val: PropValue = {
      kind: "template",
      value: ["", { expr: "config.port" }, ""],
    };
    await expect(
      materializeValue(val, { config: { host: "localhost" } }),
    ).rejects.toThrow(/config\.port/);
  });

  test("throws an actionable error identifying the unresolvable raw source when materializing a raw value", async () => {
    const val: PropValue = { kind: "raw", sourceText: "doSomething(x)" };
    await expect(materializeValue(val)).rejects.toThrow(/doSomething\(x\)/);
  });

  test("materializes nested structures", async () => {
    const val: PropValue = {
      kind: "object",
      properties: {
        users: {
          kind: "array",
          elements: [
            {
              kind: "object",
              properties: { name: { kind: "primitive", value: "Alice" } },
            },
            {
              kind: "object",
              properties: { name: { kind: "primitive", value: "Bob" } },
            },
          ],
        },
      },
    };
    const result = await materializeValue(val);
    expect(result).toEqual({ users: [{ name: "Alice" }, { name: "Bob" }] });
  });
});
