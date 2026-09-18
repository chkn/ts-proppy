import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { interpolatablePaths } from "../../editing/interpolation.js";
import type { PropDefinition } from "../../types/prop-definition.js";
import type { PropType } from "../../types/prop-type.js";
import type { PropValue } from "../../types/prop-value.js";
import { ItemEditor } from "../ItemEditor.js";

const interpolatables = [
  { name: "ticket", children: [{ name: "subject" }] },
  { name: "product" },
];
const def = (type: PropType): PropDefinition => ({
  name: "slot",
  type,
  optional: false,
  interpolatables,
});
const render = (propDef: PropDefinition, value?: PropValue) =>
  renderToStaticMarkup(
    <ItemEditor propDef={propDef} value={value} onChange={() => {}} />,
  );

const objectType: PropType = {
  kind: "object",
  syntax: "State",
  properties: [
    {
      name: "a",
      optional: false,
      type: { kind: "primitive", syntax: "number" },
    },
  ],
};

describe("reference editing", () => {
  test("shows a reference as a token chip, whatever the slot type", () => {
    const html = render(def(objectType), {
      kind: "reference",
      path: ["ticket", "subject"],
    });
    expect(html).toContain('data-proppy-editor="reference"');
    expect(html).toContain("${ticket.subject}");
  });

  test("offers a parameter beside a structured slot", () => {
    expect(render(def(objectType))).toContain(
      'data-proppy-editor="parameter-menu"',
    );
    expect(
      render(
        def({
          kind: "record",
          syntax: "R",
          value: { name: "", optional: false, type: objectType },
        }),
      ),
    ).toContain('data-proppy-editor="parameter-menu"');
  });

  test("offers no parameter menu beside a string, number or constant choice", () => {
    expect(render(def({ kind: "primitive", syntax: "string" }))).not.toContain(
      "parameter-menu",
    );
    expect(render(def({ kind: "primitive", syntax: "number" }))).not.toContain(
      "parameter-menu",
    );
    expect(
      render(
        def({
          kind: "union",
          syntax: "'a' | 'b'",
          types: [
            { kind: "constant", syntax: "'a'", value: "a" },
            { kind: "constant", syntax: "'b'", value: "b" },
          ],
        }),
      ),
    ).not.toContain("parameter-menu");
  });

  test("offers no parameter menu when nothing is in scope", () => {
    expect(
      render({ ...def(objectType), interpolatables: undefined }),
    ).not.toContain("parameter-menu");
  });

  test("lists every path through the interpolatables, parents first", () => {
    expect(interpolatablePaths(interpolatables)).toEqual([
      ["ticket"],
      ["ticket", "subject"],
      ["product"],
    ]);
  });

  test("offers no parameter menu beside a union that takes text, or a slot with catalogs", () => {
    const entry: PropType = {
      kind: "union",
      syntax: "EntryType",
      types: [{ kind: "primitive", syntax: "string" }, objectType],
    };
    expect(render(def(entry))).not.toContain("parameter-menu");
    expect(
      render({
        ...def(objectType),
        catalogs: [{ label: "x", groups: [], literal: true }],
      }),
    ).not.toContain("parameter-menu");
  });
});
