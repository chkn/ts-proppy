import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type {
  PropDefinition,
  ValueFactory,
} from "../../types/prop-definition.js";
import type { PropType } from "../../types/prop-type.js";
import type { PropValue } from "../../types/prop-value.js";
import { CatalogIconContext } from "../catalog-icon-context.js";
import { ItemEditor } from "../ItemEditor.js";

const str: PropType = { kind: "primitive", syntax: "string" };
const def = (
  name: string,
  type: PropType,
  optional = false,
): PropDefinition => ({ name, type, optional });

const choice: ValueFactory = {
  def: def("choice", {
    kind: "function",
    syntax: "",
    parameters: [
      def("instructions", str),
      def("criteria", {
        kind: "record",
        syntax: "ChoiceCriteria",
        value: def("", str),
      }),
    ],
  }),
  binding: {
    kind: "import",
    spec: { name: "choice", from: "@typesafe-ai/sdk" },
  },
};
const noul: ValueFactory = {
  def: def("noul", {
    kind: "function",
    syntax: "",
    parameters: [def("instructions", str, true)],
  }),
  binding: { kind: "import", spec: { name: "noul", from: "@typesafe-ai/sdk" } },
};

const questions: PropDefinition = def("questions", {
  kind: "record",
  syntax: "Questions",
  value: {
    ...def("", {
      kind: "object",
      syntax: "Question",
      properties: [
        def("type", { kind: "constant", syntax: "'noul'", value: "noul" }),
      ],
    }),
    catalogs: [
      {
        label: "Questions",
        groups: [
          { label: "Choice", factory: choice },
          { label: "Yes/no", factory: noul },
        ],
      },
    ],
  },
});

const render = (propDef: PropDefinition, value: PropValue | undefined) =>
  renderToStaticMarkup(
    <ItemEditor propDef={propDef} value={value} onChange={() => {}} />,
  );

describe("catalog routing", () => {
  test("edits a call to a catalog factory argument by argument, against the factory's parameters", () => {
    const html = render(questions, {
      kind: "object",
      properties: {
        team: {
          kind: "functionCall",
          callee: "choice",
          args: [
            { kind: "primitive", value: "Which team?" },
            {
              kind: "object",
              properties: { billing: { kind: "primitive", value: "Payments" } },
            },
          ],
        },
      },
    });
    expect(html).toContain('data-proppy-editor="function-call"');
    expect(html).toContain("Which team?");
    // The nested criteria record renders its own key.
    expect(html).toMatch(/value="billing"/);
    // The record's add row offers each factory.
    expect(html).toContain('data-proppy-editor="record-add"');
    expect(html).toContain(">Yes/no</option>");
  });

  test("sends a value that isn't a factory call to the slot's own editor", () => {
    const html = render(questions, {
      kind: "object",
      properties: {
        refund: {
          kind: "object",
          properties: { type: { kind: "primitive", value: "noul" } },
        },
      },
    });
    expect(html).not.toContain('data-proppy-editor="function-call"');
  });

  test("shows a preset by its label, with the host's icon", () => {
    const model: PropDefinition = {
      ...def("model", str),
      catalogs: [
        {
          label: "Gateway",
          groups: [
            {
              label: "OpenAI",
              icon: "openai",
              presets: [
                {
                  label: "GPT-5.5",
                  value: { kind: "primitive", value: "openai/gpt-5.5" },
                },
              ],
            },
          ],
          literal: true,
        },
      ],
    };
    const html = renderToStaticMarkup(
      <CatalogIconContext.Provider value={icon => <i data-icon={icon} />}>
        <ItemEditor
          propDef={model}
          value={{ kind: "primitive", value: "openai/gpt-5.5" }}
          onChange={() => {}}
        />
      </CatalogIconContext.Provider>,
    );
    expect(html).toContain("GPT-5.5");
    expect(html).toContain('data-icon="openai"');
  });

  test("offers a choice of factory for an empty slot", () => {
    const slot: PropDefinition = {
      ...questions,
      type: str,
      catalogs: (questions.type as any).value.catalogs,
    };
    const html = render(slot, undefined);
    expect(html).toContain("Choose…");
    expect(html).toContain(">Choice</option>");
  });

  test("shows the slot's default when nothing is set, the value and the '(default)' note as separate spans", () => {
    const model: PropDefinition = {
      ...def("model", str, true),
      defaultValue: { kind: "primitive", value: "jev-latest" },
      catalogs: [{ label: "Models", groups: [], literal: true }],
    };
    const html = render(model, undefined);
    // Two spans, not one run of text: the value reads like a normal label,
    // and only the "(default)" note is muted.
    expect(html).toMatch(
      /<span[^>]*>jev-latest<span[^>]*>\s*\(default\)<\/span><\/span>/,
    );
    expect(html).not.toContain("placeholder");
  });
});
