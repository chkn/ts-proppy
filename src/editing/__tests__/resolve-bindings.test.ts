import { describe, expect, test } from "vitest";
import type { CalleeBinding, PropValue } from "../../types/prop-value.js";
import { resolveBindings } from "../resolve-bindings.js";

const helper = {
  callee: "prompts",
  import: { name: "prompts", from: "@evalution/vercel-ai-sdk" },
};
const candidates = (name: string): CalleeBinding[] => [
  { kind: "parameter", enclosingCall: helper },
  { kind: "import", spec: { name, from: `@ai-sdk/${name}` } },
];
const call = (callee: string, id: string): PropValue => ({
  kind: "functionCall",
  callee,
  args: [{ kind: "primitive", value: id }],
  binding: candidates(callee),
});

const destructured = `import { prompts } from '@evalution/vercel-ai-sdk';
export default prompts({ id: 'x' }, ({ openai }) => ({ p: () => ({ model: openai('gpt-4o') }) }));
`;

describe("resolveBindings", () => {
  test("binds through an existing destructure, adding the callee to it", () => {
    const { sourceCode, value } = resolveBindings(
      destructured,
      call("anthropic", "claude"),
    );
    expect(sourceCode).toContain("({ openai, anthropic })");
    expect(value).toEqual({
      kind: "functionCall",
      callee: "anthropic",
      args: [{ kind: "primitive", value: "claude" }],
    });
  });

  test("leaves the destructure alone when the callee is already in it", () => {
    const { sourceCode, value } = resolveBindings(
      destructured,
      call("openai", "gpt-5"),
    );
    expect(sourceCode).toBe(destructured);
    expect(value).not.toHaveProperty("binding");
  });

  test("adds several callees to the same destructure in one edit", () => {
    const value: PropValue = {
      kind: "array",
      elements: [call("anthropic", "a"), call("google", "b")],
    };
    const { sourceCode } = resolveBindings(destructured, value);
    expect(sourceCode).toContain("({ openai, anthropic, google })");
  });

  test("creates a destructure in a factory that takes no parameters", () => {
    const blank = `import { prompts } from '@evalution/vercel-ai-sdk';\nexport default prompts({ id: 'x' }, () => ({}));\n`;
    const { sourceCode } = resolveBindings(blank, call("anthropic", "claude"));
    expect(sourceCode).toContain("({ anthropic }) => ({})");
  });

  test("falls back to the import candidate when the helper is not used", () => {
    const plain = `export function p() { return { model: 'x' } }\n`;
    const { sourceCode, value } = resolveBindings(
      plain,
      call("openai", "gpt-4o"),
    );
    expect(sourceCode).toBe(plain);
    expect(value).toMatchObject({
      binding: {
        kind: "import",
        spec: { name: "openai", from: "@ai-sdk/openai" },
      },
    });
  });

  test("falls back to the import candidate when the factory parameter is not a destructure", () => {
    const named = `import { prompts } from '@evalution/vercel-ai-sdk';\nexport default prompts({ id: 'x' }, (providers) => ({}));\n`;
    const { value } = resolveBindings(named, call("openai", "gpt-4o"));
    expect(value).toMatchObject({ binding: { kind: "import" } });
  });

  test("resolves calls nested inside objects and arguments", () => {
    const nested: PropValue = {
      kind: "object",
      properties: {
        q: {
          kind: "functionCall",
          callee: "choice",
          args: [call("openai", "x")],
          binding: [
            {
              kind: "import",
              spec: { name: "choice", from: "@typesafe-ai/sdk" },
            },
          ],
        },
      },
    };
    const { value } = resolveBindings(
      `export function p() { return {} }`,
      nested,
    );
    expect(value).toMatchObject({
      properties: {
        q: {
          binding: { kind: "import", spec: { name: "choice" } },
          args: [{ binding: { kind: "import", spec: { name: "openai" } } }],
        },
      },
    });
  });

  test("leaves a single, already resolved binding untouched", () => {
    const bound: PropValue = {
      kind: "functionCall",
      callee: "openai",
      args: [],
      binding: { kind: "import", spec: { name: "openai", from: "x" } },
    };
    expect(resolveBindings(destructured, bound).value).toEqual(bound);
  });
});
