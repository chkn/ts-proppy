import { describe, expect, test } from "vitest";
import type { DiscriminatedUnionCase } from "../../../types/discriminated-union.js";
import type { PropValue } from "../../../types/prop-value.js";
import {
  currentCaseFor,
  currentDiscriminatorValue,
} from "../DiscriminatedUnionEditor.js";

const triaged: DiscriminatedUnionCase = {
  discriminatorValue: "triaged",
  properties: [],
};
const done: DiscriminatedUnionCase = {
  discriminatorValue: "done",
  properties: [],
};
const cases = [triaged, done];

describe("currentDiscriminatorValue", () => {
  test("is undefined when the object has no discriminator property yet", () => {
    expect(currentDiscriminatorValue("status", {})).toBeUndefined();
  });

  test("reads the discriminator once it has been written", () => {
    const objProps: Record<string, PropValue> = {
      status: { kind: "primitive", value: "done" },
    };
    expect(currentDiscriminatorValue("status", objProps)).toBe("done");
  });

  test("ignores a non-primitive value under the discriminator key", () => {
    const objProps: Record<string, PropValue> = {
      status: { kind: "object", properties: {} },
    };
    expect(currentDiscriminatorValue("status", objProps)).toBeUndefined();
  });
});

describe("currentCaseFor", () => {
  test("is undefined with no discriminator value, never a fallback to the first case", () => {
    expect(currentCaseFor(cases, undefined)).toBeUndefined();
  });

  test("finds the case matching an explicit discriminator value", () => {
    expect(currentCaseFor(cases, "done")).toBe(done);
  });
});
