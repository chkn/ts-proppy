import ts from "typescript";
import { describe, expect, test } from "vitest";
import { updateProperty } from "../../editing/apply-value.js";
import { valueToSourceText } from "../../editing/value-to-string.js";
import { materializeValue } from "../../materialize/materialize-value.js";
import type { PropValue } from "../../types/prop-value.js";
import { extractPropertiesFromObjectLiteral } from "../extract-values.js";

/** The values of the object literal `fn` returns in `source`. */
function returned(source: string) {
  const sourceFile = ts.createSourceFile(
    "prompt.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let object: ts.ObjectLiteralExpression | undefined;
  const visit = (node: ts.Node) => {
    if (
      !object &&
      ts.isArrowFunction(node) &&
      ts.isParenthesizedExpression(node.body) &&
      ts.isObjectLiteralExpression(node.body.expression)
    ) {
      object = node.body.expression;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return {
    sourceFile,
    extracted: extractPropertiesFromObjectLiteral(
      object!,
      undefined,
      sourceFile,
    ),
  };
}

describe("parsing references", () => {
  test("parses a parameter, a path into one, and shorthand", () => {
    const { extracted } = returned(`
const POLICY = 'be kind'
export const triage = (ticket: Ticket, product: string) => ({
  state: { ticket, subject: ticket.subject, id: ticket['id'], policy: POLICY },
  product: product,
})`);
    expect(extracted.values).toEqual({
      state: {
        kind: "object",
        properties: {
          ticket: { kind: "reference", path: ["ticket"] },
          subject: { kind: "reference", path: ["ticket", "subject"] },
          id: { kind: "reference", path: ["ticket", "id"] },
          // A module constant isn't something the editor can offer, so it stays raw.
          policy: { kind: "raw", sourceText: "POLICY" },
        },
      },
      product: { kind: "reference", path: ["product"] },
    });
  });

  test("parses a destructured parameter as a reference", () => {
    const { extracted } = returned(
      `export const p = ({ ticket }: { ticket: Ticket }) => ({ state: ticket })`,
    );
    expect(extracted.values?.state).toEqual({
      kind: "reference",
      path: ["ticket"],
    });
  });

  test("keeps a shorthand for something that is not a parameter raw", () => {
    const { extracted } = returned(
      `const policy = 'x'\nexport const p = () => ({ state: { policy } })`,
    );
    expect(extracted.values?.state).toEqual({
      kind: "object",
      properties: { policy: { kind: "raw", sourceText: "policy" } },
    });
  });

  test("keeps an object with a spread or computed key whole, as raw", () => {
    const { extracted } = returned(
      `export const p = (base: object, k: string) => ({ a: { ...base, x: 1 }, b: { [k]: 1 } })`,
    );
    expect(extracted.values?.a).toEqual({
      kind: "raw",
      sourceText: "{ ...base, x: 1 }",
    });
    expect(extracted.values?.b).toEqual({
      kind: "raw",
      sourceText: "{ [k]: 1 }",
    });
  });

  test("reads quoted keys without their quotes", () => {
    const { extracted } = returned(
      `export const p = () => ({ criteria: { "needs review": null, 'ok': null } })`,
    );
    expect(
      Object.keys(
        (extracted.values!.criteria as Extract<PropValue, { kind: "object" }>)
          .properties,
      ),
    ).toEqual(["needs review", "ok"]);
  });

  test("does not treat a call or an optional chain as a reference", () => {
    const { extracted } = returned(
      `export const p = (t: T) => ({ a: t.f(), b: t?.x })`,
    );
    expect(extracted.values?.a.kind).toBe("functionCall");
    expect(extracted.values?.b.kind).toBe("raw");
  });
});

describe("writing references", () => {
  test("writes a path, with bracket access where a segment is not an identifier", () => {
    expect(
      valueToSourceText({ kind: "reference", path: ["ticket", "subject"] }),
    ).toBe("ticket.subject");
    expect(
      valueToSourceText({ kind: "reference", path: ["ticket", "first name"] }),
    ).toBe('ticket["first name"]');
  });

  test("writes shorthand when the key matches, and quotes keys that need it", () => {
    const value: PropValue = {
      kind: "object",
      properties: {
        ticket: { kind: "reference", path: ["ticket"] },
        subject: { kind: "reference", path: ["ticket", "subject"] },
        "needs review": { kind: "primitive", value: null },
      },
    };
    expect(valueToSourceText(value)).toBe(
      '{ ticket, subject: ticket.subject, "needs review": null }',
    );
  });

  test("round-trips a state with references through an edit", () => {
    const source = `export const p = (ticket: Ticket) => ({\n  state: { policy: 'x' },\n})`;
    const { extracted } = returned(source);
    const next = updateProperty(source, extracted.definitions[0], {
      kind: "object",
      properties: {
        ticket: { kind: "reference", path: ["ticket"] },
        policy: { kind: "primitive", value: "x" },
      },
    });
    expect(next).toContain('state: { ticket, policy: "x" }');
    expect(returned(next).extracted.values?.state).toEqual({
      kind: "object",
      properties: {
        ticket: { kind: "reference", path: ["ticket"] },
        policy: { kind: "primitive", value: "x" },
      },
    });
  });
});

describe("materializing references", () => {
  test("resolves a path in scope", async () => {
    const scope = { ticket: { subject: "Refund", tags: ["billing"] } };
    expect(
      await materializeValue(
        { kind: "reference", path: ["ticket", "subject"] },
        scope,
      ),
    ).toBe("Refund");
    expect(
      await materializeValue({ kind: "reference", path: ["ticket"] }, scope),
    ).toBe(scope.ticket);
  });

  test("throws for a path that is not in scope", async () => {
    await expect(
      materializeValue({ kind: "reference", path: ["nope"] }, {}),
    ).rejects.toThrow(/not found/);
    await expect(
      materializeValue(
        { kind: "reference", path: ["ticket", "nope"] },
        { ticket: {} },
      ),
    ).rejects.toThrow(/not found/);
  });
});
