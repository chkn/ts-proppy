import { describe, expect, it } from "vitest";
import type {
  InterpolatableIdentifier,
  PropDefinition,
} from "../../types/prop-definition.js";
import {
  collapseTemplateValue,
  interpolatablesFromDefinitions,
  interpolationSuggestions,
  parseInterpolationPath,
  resolveInterpolatable,
} from "../interpolation.js";

const str = (name: string): PropDefinition => ({
  name,
  type: { kind: "primitive", syntax: "string" },
  optional: false,
});

describe("interpolatablesFromDefinitions", () => {
  it("maps flat params to flat identifiers", () => {
    expect(interpolatablesFromDefinitions([str("name"), str("age")])).toEqual([
      { name: "name" },
      { name: "age" },
    ]);
  });

  it("expands object params into children", () => {
    const config: PropDefinition = {
      name: "config",
      optional: false,
      type: {
        kind: "object",
        syntax: "{ name: string; age: number }",
        properties: [
          str("name"),
          {
            name: "age",
            type: { kind: "primitive", syntax: "number" },
            optional: false,
          },
        ],
      },
    };
    expect(interpolatablesFromDefinitions([config])).toEqual([
      { name: "config", children: [{ name: "name" }, { name: "age" }] },
    ]);
  });

  it("recurses into nested objects", () => {
    const def: PropDefinition = {
      name: "a",
      optional: false,
      type: {
        kind: "object",
        syntax: "{...}",
        properties: [
          {
            name: "b",
            optional: false,
            type: { kind: "object", syntax: "{...}", properties: [str("c")] },
          },
        ],
      },
    };
    expect(interpolatablesFromDefinitions([def])).toEqual([
      { name: "a", children: [{ name: "b", children: [{ name: "c" }] }] },
    ]);
  });
});

describe("parseInterpolationPath", () => {
  it("parses identifiers and member access", () => {
    expect(parseInterpolationPath("foo")).toEqual(["foo"]);
    expect(parseInterpolationPath("foo.bar")).toEqual(["foo", "bar"]);
    expect(parseInterpolationPath("a.b.c")).toEqual(["a", "b", "c"]);
    expect(parseInterpolationPath("foo['bar']")).toEqual(["foo", "bar"]);
    expect(parseInterpolationPath('foo["bar"]')).toEqual(["foo", "bar"]);
    expect(parseInterpolationPath("foo['bar'].baz")).toEqual([
      "foo",
      "bar",
      "baz",
    ]);
    expect(parseInterpolationPath("  foo.bar  ")).toEqual(["foo", "bar"]);
  });

  it("rejects non-member-access expressions", () => {
    expect(parseInterpolationPath("")).toBeNull();
    expect(parseInterpolationPath("  ")).toBeNull();
    expect(parseInterpolationPath("foo()")).toBeNull();
    expect(parseInterpolationPath("foo + 1")).toBeNull();
    expect(parseInterpolationPath("foo[0]")).toBeNull();
    expect(parseInterpolationPath("foo[bar]")).toBeNull();
    expect(parseInterpolationPath("foo.")).toBeNull();
    expect(parseInterpolationPath(".foo")).toBeNull();
    expect(parseInterpolationPath("foo['bar")).toBeNull();
  });
});

describe("resolveInterpolatable", () => {
  const roots: InterpolatableIdentifier[] = [
    { name: "name" },
    { name: "config", children: [{ name: "host" }, { name: "port" }] },
  ];

  it("resolves known paths and returns the matched node", () => {
    expect(resolveInterpolatable(["name"], roots)).toEqual({ name: "name" });
    expect(resolveInterpolatable(["config"], roots)).toBe(roots[1]);
    expect(resolveInterpolatable(["config", "host"], roots)).toEqual({
      name: "host",
    });
  });

  it("returns null for unknown or empty paths", () => {
    expect(resolveInterpolatable([], roots)).toBeNull();
    expect(resolveInterpolatable(["nope"], roots)).toBeNull();
    expect(resolveInterpolatable(["config", "nope"], roots)).toBeNull();
    expect(resolveInterpolatable(["name", "x"], roots)).toBeNull();
  });
});

describe("interpolationSuggestions", () => {
  const roots: InterpolatableIdentifier[] = [
    { name: "name" },
    { name: "nickname" },
    { name: "config", children: [{ name: "host" }, { name: "port" }] },
  ];

  it("suggests top-level identifiers filtered by the fragment", () => {
    expect(interpolationSuggestions("", roots)).toEqual({
      candidates: roots,
      fragment: "",
    });
    expect(interpolationSuggestions("ni", roots)).toEqual({
      candidates: [{ name: "nickname" }],
      fragment: "ni",
    });
    expect(
      interpolationSuggestions("n", roots).candidates.map(c => c.name),
    ).toEqual(["name", "nickname"]);
  });

  it("drills into children after a dot", () => {
    const { candidates, fragment } = interpolationSuggestions("config.", roots);
    expect(candidates.map(c => c.name)).toEqual(["host", "port"]);
    expect(fragment).toBe("");
  });

  it("filters children by the trailing fragment", () => {
    const { candidates, fragment } = interpolationSuggestions(
      "config.ho",
      roots,
    );
    expect(candidates.map(c => c.name)).toEqual(["host"]);
    expect(fragment).toBe("ho");
  });

  it("drills via bracket accessors", () => {
    expect(
      interpolationSuggestions("config['", roots).candidates.map(c => c.name),
    ).toEqual(["host", "port"]);
    expect(
      interpolationSuggestions('config["ho', roots).candidates.map(c => c.name),
    ).toEqual(["host"]);
  });

  it("returns no candidates for an unknown parent", () => {
    expect(interpolationSuggestions("nope.", roots).candidates).toEqual([]);
  });
});

describe("collapseTemplateValue", () => {
  it("returns a primitive string when there are no tokens", () => {
    expect(collapseTemplateValue(["hello world"])).toEqual({
      kind: "primitive",
      value: "hello world",
    });
    expect(collapseTemplateValue(["a", "b"])).toEqual({
      kind: "primitive",
      value: "ab",
    });
    expect(collapseTemplateValue([""])).toEqual({
      kind: "primitive",
      value: "",
    });
  });

  it("returns a template when at least one token is present", () => {
    const value = ["Hello ", { expr: "name" }, ""];
    expect(collapseTemplateValue(value)).toEqual({ kind: "template", value });
  });
});
