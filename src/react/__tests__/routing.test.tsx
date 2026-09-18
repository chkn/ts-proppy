import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { PropDefinition } from "../../types/prop-definition.js";
import type { PropType } from "../../types/prop-type.js";
import { ItemEditor } from "../ItemEditor.js";
import { PropsEditor } from "../PropsEditor.js";

// TemplateEditor's layout effect is a no-op on the server; its warning is noise here.
vi.spyOn(console, "error").mockImplementation(() => {});

const str: PropType = { kind: "primitive", syntax: "string" };
const def = (name: string, type: PropType): PropDefinition => ({
  name,
  type,
  optional: false,
});
const interpolatables = [{ name: "ticket" }];

function render(
  propDef: PropDefinition,
  value?: Parameters<typeof ItemEditor>[0]["value"],
) {
  return renderToStaticMarkup(
    <ItemEditor propDef={propDef} value={value} onChange={() => {}} />,
  );
}

describe("nested interpolation", () => {
  test("gives a string three levels deep a template editor", () => {
    const nested = def("questions", {
      kind: "record",
      syntax: "Questions",
      value: def("", {
        kind: "object",
        syntax: "Q",
        properties: [
          def("criteria", {
            kind: "array",
            syntax: "string[]",
            element: def("", str),
          }),
        ],
      }),
    });
    const html = render(
      { ...nested, interpolatables },
      {
        kind: "object",
        properties: {
          refund: {
            kind: "object",
            properties: {
              criteria: {
                kind: "array",
                elements: [{ kind: "primitive", value: "yes" }],
              },
            },
          },
        },
      },
    );
    expect(html).toContain('contenteditable="true"');
  });

  test("leaves strings plain when no interpolatables are in scope", () => {
    const html = render(
      def("o", { kind: "object", syntax: "O", properties: [def("s", str)] }),
      {
        kind: "object",
        properties: { s: { kind: "primitive", value: "x" } },
      },
    );
    expect(html).not.toContain("contenteditable");
  });

  test("PropsEditor scopes interpolatables to every field", () => {
    const html = renderToStaticMarkup(
      <PropsEditor
        props={{
          definitions: [
            def("o", {
              kind: "object",
              syntax: "O",
              properties: [def("s", str)],
            }),
          ],
        }}
        onChange={() => {}}
        interpolatables={interpolatables}
      />,
    );
    expect(html).toContain('contenteditable="true"');
  });
});

describe("container routing", () => {
  test("renders an open string union as a combobox holding free text", () => {
    const html = render(
      def("model", {
        kind: "union",
        syntax: "'a' | (string & {})",
        types: [
          { kind: "constant", syntax: "'a'", value: "a" },
          { kind: "primitive", syntax: "string & {}", base: "string" },
        ],
      }),
      { kind: "primitive", value: "my-fine-tune" },
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('value="my-fine-tune"');
  });

  test("renders a record with an editable key per entry, in order", () => {
    const html = render(
      def("r", { kind: "record", syntax: "R", value: def("", str) }),
      {
        kind: "object",
        properties: {
          billing: { kind: "primitive", value: "x" },
          technical: { kind: "primitive", value: "y" },
        },
      },
    );
    const keys = [
      ...html.matchAll(
        /data-proppy-editor="record-key"[^>]*value="([^"]*)"|value="([^"]*)"[^>]*data-proppy-editor="record-key"/g,
      ),
    ].map(m => m[1] ?? m[2]);
    expect(keys).toEqual(["billing", "technical"]);
  });

  test("offers removal only for a variadic tuple’s rest elements", () => {
    const e = def("", str);
    const html = render(
      def("t", {
        kind: "tuple",
        syntax: "T",
        elements: [
          { ...e, name: "[0]" },
          { ...e, name: "[1]" },
        ],
        rest: e,
      }),
      {
        kind: "array",
        elements: ["a", "b", "c"].map(value => ({
          kind: "primitive" as const,
          value,
        })),
      },
    );
    expect(html).not.toContain("Remove item 1");
    expect(html).not.toContain("Remove item 2");
    expect(html).toContain("Remove item 3");
    expect(html).toContain("+ Add item");
  });
});
