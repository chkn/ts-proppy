// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { PropDefinition } from "../../types/prop-definition.js";
import type { PropValue } from "../../types/prop-value.js";
import { ArrayEditsContext } from "../array-edits-context.js";
import { ItemEditor } from "../ItemEditor.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const str: PropDefinition = {
  name: "",
  type: { kind: "primitive", syntax: "string" },
  optional: false,
};
const tags: PropDefinition = {
  name: "tags",
  type: { kind: "array", syntax: "string[]", element: str },
  optional: false,
};
const value: PropValue = {
  kind: "array",
  elements: ["a", "b", "c"].map(v => ({ kind: "primitive", value: v })),
};

let container: HTMLDivElement | undefined;
afterEach(() => {
  container?.remove();
  container = undefined;
});

function render(ui: React.ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return container;
}

function clickRemove(el: HTMLElement, label: string) {
  const button = el.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
  if (!button) throw new Error(`No button labelled ${label}`);
  act(() => button.click());
}

describe("ArrayEditsContext", () => {
  test("tells the host which element of which array was removed", () => {
    const onRemoveElement = vi.fn();
    const onChange = vi.fn();
    const el = render(
      <ArrayEditsContext.Provider value={{ onRemoveElement }}>
        <ItemEditor
          propDef={tags}
          value={value}
          onChange={onChange}
          path={["tags"]}
        />
      </ArrayEditsContext.Provider>,
    );

    clickRemove(el, "Remove item 2");

    expect(onRemoveElement).toHaveBeenCalledWith(["tags"], 1);
    expect(onChange).toHaveBeenCalledWith({
      kind: "array",
      elements: [
        { kind: "primitive", value: "a" },
        { kind: "primitive", value: "c" },
      ],
    });
  });

  test("reports the removal before the new value", () => {
    const calls: string[] = [];
    const el = render(
      <ArrayEditsContext.Provider
        value={{ onRemoveElement: () => calls.push("remove") }}
      >
        <ItemEditor
          propDef={tags}
          value={value}
          onChange={() => calls.push("change")}
          path={["tags"]}
        />
      </ArrayEditsContext.Provider>,
    );

    clickRemove(el, "Remove item 1");

    expect(calls).toEqual(["remove", "change"]);
  });

  test("removing still works with no provider", () => {
    const onChange = vi.fn();
    const el = render(
      <ItemEditor propDef={tags} value={value} onChange={onChange} />,
    );

    clickRemove(el, "Remove item 3");

    expect(onChange).toHaveBeenCalledWith({
      kind: "array",
      elements: [
        { kind: "primitive", value: "a" },
        { kind: "primitive", value: "b" },
      ],
    });
  });
});
