import { describe, expect, test } from "vitest";
import type { PropDefinition } from "../../../types/prop-definition.js";
import type { PropValue } from "../../../types/prop-value.js";
import {
  ConstantUnionEditor,
  constantUnionSelection,
} from "../ConstantUnionEditor.js";

const noDefault: Pick<PropDefinition, "defaultValue"> = {};
const withDefault: Pick<PropDefinition, "defaultValue"> = {
  defaultValue: { kind: "primitive", value: "triaged" },
};

const options = ["open", "triaged", "done"];

describe("constantUnionSelection", () => {
  test("is undefined with no value and no default", () => {
    expect(
      constantUnionSelection(options, noDefault, undefined),
    ).toBeUndefined();
  });

  test("reflects a chosen primitive value", () => {
    const value: PropValue = { kind: "primitive", value: "open" };
    expect(constantUnionSelection(options, noDefault, value)).toBe(0);
  });

  test("falls back to the definition default when nothing is chosen", () => {
    expect(constantUnionSelection(options, withDefault, undefined)).toBe(1);
  });

  test("a chosen value wins over the default", () => {
    const value: PropValue = { kind: "primitive", value: "done" };
    expect(constantUnionSelection(options, withDefault, value)).toBe(2);
  });

  test("a non-primitive value (e.g. a template) is not a selection", () => {
    const value: PropValue = { kind: "template", value: [] };
    expect(constantUnionSelection(options, noDefault, value)).toBeUndefined();
  });

  test("a value no option holds is not a selection", () => {
    const value: PropValue = { kind: "primitive", value: "gone" };
    expect(constantUnionSelection(options, noDefault, value)).toBeUndefined();
  });

  test("matches constants by value, not by how they print", () => {
    const withUndefined = ["open", undefined];
    expect(
      constantUnionSelection(withUndefined, noDefault, {
        kind: "primitive",
        value: undefined,
      }),
    ).toBe(1);
    expect(
      constantUnionSelection(withUndefined, noDefault, {
        kind: "primitive",
        value: "undefined",
      }),
    ).toBeUndefined();
  });
});

describe("ConstantUnionEditor", () => {
  test.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 42],
    ["a boolean", true],
    ["a string", "open"],
  ])("reports a chosen %s with its real type", (_, constant) => {
    const types = ["other", constant].map(c => ({
      kind: "constant" as const,
      syntax: String(c),
      value: c,
    }));
    const changes: PropValue[] = [];
    const select = ConstantUnionEditor({
      propDef: {
        name: "status",
        optional: false,
        type: { kind: "union", syntax: "", types },
      } as unknown as PropDefinition,
      value: undefined,
      onChange: value => changes.push(value),
    });

    const { children } = select.props;
    const rendered = children.flat().filter(Boolean);
    const option = rendered.find(
      (o: { props: { children: string } }) =>
        o.props.children === String(constant),
    );
    select.props.onChange({ target: { value: option.props.value } });

    expect(changes).toEqual([{ kind: "primitive", value: constant }]);
  });
});
