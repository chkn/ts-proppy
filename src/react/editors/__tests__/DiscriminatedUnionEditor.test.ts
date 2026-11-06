import { describe, expect, test, vi } from "vitest";
import type { DiscriminatedUnionCase } from "../../../types/discriminated-union.js";
import type { PropValue } from "../../../types/prop-value.js";
import {
  currentCaseIndex,
  DiscriminatedUnionEditor,
} from "../DiscriminatedUnionEditor.js";

// The editor is called as a plain function below, outside a render, where
// `useId` is its only hook.
vi.mock("react", async importOriginal => ({
  ...(await importOriginal<typeof import("react")>()),
  useId: () => "id",
}));

const triaged: DiscriminatedUnionCase = {
  discriminatorValue: "triaged",
  properties: [],
};
const done: DiscriminatedUnionCase = {
  discriminatorValue: "done",
  properties: [],
};
const cases = [triaged, done];

describe("currentCaseIndex", () => {
  test("is undefined when the object has no discriminator property yet, never a fallback to the first case", () => {
    expect(currentCaseIndex(cases, "status", {})).toBeUndefined();
  });

  test("finds the case the written discriminator names", () => {
    const objProps: Record<string, PropValue> = {
      status: { kind: "primitive", value: "done" },
    };
    expect(currentCaseIndex(cases, "status", objProps)).toBe(1);
  });

  test("ignores a non-primitive value under the discriminator key", () => {
    const objProps: Record<string, PropValue> = {
      status: { kind: "object", properties: {} },
    };
    expect(currentCaseIndex(cases, "status", objProps)).toBeUndefined();
  });

  test("a value no case holds is not a selection", () => {
    const objProps: Record<string, PropValue> = {
      status: { kind: "primitive", value: "gone" },
    };
    expect(currentCaseIndex(cases, "status", objProps)).toBeUndefined();
  });

  test("matches discriminators by value, not by how they print", () => {
    const numbered = [1, 2].map(discriminatorValue => ({
      discriminatorValue,
      properties: [],
    }));
    const read = (value: string | number) =>
      currentCaseIndex(numbered, "version", {
        version: { kind: "primitive", value },
      });
    expect(read(2)).toBe(1);
    expect(read("2")).toBeUndefined();
  });
});

describe("DiscriminatedUnionEditor", () => {
  test.each([
    ["a string", "done"],
    ["a number", 2],
    ["a boolean", false],
  ])("reports a chosen %s with its real type", (_, discriminatorValue) => {
    const changes: PropValue[] = [];
    const editor = DiscriminatedUnionEditor({
      discriminatedUnionInfo: {
        discriminator: "status",
        cases: [
          { discriminatorValue: "other", properties: [] },
          { discriminatorValue, properties: [] },
        ],
      },
      value: undefined,
      onChange: value => changes.push(value),
    });

    const [field] = editor.props.children;
    const select = field.props.children[1];
    const rendered = select.props.children.flat().filter(Boolean);
    const option = rendered.find(
      (o: { props: { children: string } }) =>
        o.props.children === String(discriminatorValue),
    );
    select.props.onChange({ target: { value: option.props.value } });

    expect(changes).toEqual([
      {
        kind: "object",
        properties: {
          status: { kind: "primitive", value: discriminatorValue },
        },
      },
    ]);
  });
});
