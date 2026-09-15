import { describe, expect, test } from "vitest";
import type { PropDefinition } from "../../../types/prop-definition.js";
import type { PropValue } from "../../../types/prop-value.js";
import { booleanSelection } from "../BooleanEditor.js";

const noDefault: Pick<PropDefinition, "defaultValue"> = {};
const withDefault: Pick<PropDefinition, "defaultValue"> = {
  defaultValue: { kind: "primitive", value: true },
};

describe("booleanSelection", () => {
  test("is undefined with no value and no default", () => {
    expect(booleanSelection(noDefault, undefined)).toBeUndefined();
  });

  test("reflects an explicit false, not just an explicit true", () => {
    const value: PropValue = { kind: "primitive", value: false };
    expect(booleanSelection(noDefault, value)).toBe(false);
  });

  test("falls back to the definition default when nothing is chosen", () => {
    expect(booleanSelection(withDefault, undefined)).toBe(true);
  });

  test("a chosen value wins over the default", () => {
    const value: PropValue = { kind: "primitive", value: false };
    expect(booleanSelection(withDefault, value)).toBe(false);
  });

  test("a non-boolean primitive value is not a selection", () => {
    const value: PropValue = { kind: "primitive", value: "true" };
    expect(booleanSelection(noDefault, value)).toBeUndefined();
  });
});
