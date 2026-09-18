import { describe, expect, test } from "vitest";
import type { PropDefinition } from "../../../types/prop-definition.js";
import type { PropValue } from "../../../types/prop-value.js";
import { constantUnionSelection } from "../ConstantUnionEditor.js";

const noDefault: Pick<PropDefinition, "defaultValue"> = {};
const withDefault: Pick<PropDefinition, "defaultValue"> = {
  defaultValue: { kind: "primitive", value: "triaged" },
};

describe("constantUnionSelection", () => {
  test("is undefined with no value and no default", () => {
    expect(constantUnionSelection(noDefault, undefined)).toBeUndefined();
  });

  test("reflects a chosen primitive value", () => {
    const value: PropValue = { kind: "primitive", value: "open" };
    expect(constantUnionSelection(noDefault, value)).toBe("open");
  });

  test("falls back to the definition default when nothing is chosen", () => {
    expect(constantUnionSelection(withDefault, undefined)).toBe("triaged");
  });

  test("a chosen value wins over the default", () => {
    const value: PropValue = { kind: "primitive", value: "done" };
    expect(constantUnionSelection(withDefault, value)).toBe("done");
  });

  test("a non-primitive value (e.g. a template) is not a selection", () => {
    const value: PropValue = { kind: "template", value: [] };
    expect(constantUnionSelection(noDefault, value)).toBeUndefined();
  });
});
