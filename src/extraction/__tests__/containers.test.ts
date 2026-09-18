import path from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import { getOpenStringUnionInfo } from "../../types/open-string-union.js";
import type { PropType } from "../../types/prop-type.js";
import { extractDefinitionsFromParameters } from "../extract-properties.js";

const LIB_DIR = path.dirname(ts.getDefaultLibFilePath({}));

/** The first function's parameter types, parsed with or without a checker. */
function paramTypes(
  source: string,
  { checker }: { checker: boolean },
): PropType[] {
  const entry = "/proj/prompt.ts";
  let sourceFile: ts.SourceFile;
  let typeChecker: ts.TypeChecker | undefined;
  if (checker) {
    const host: ts.CompilerHost = {
      getSourceFile: (name, languageVersion) => {
        const text =
          name === entry
            ? source
            : name.startsWith(LIB_DIR)
              ? ts.sys.readFile(name)
              : undefined;
        return text === undefined
          ? undefined
          : ts.createSourceFile(name, text, languageVersion, true);
      },
      writeFile: () => {},
      getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
      useCaseSensitiveFileNames: () => true,
      getCanonicalFileName: f => f,
      getCurrentDirectory: () => "/proj",
      getNewLine: () => "\n",
      fileExists: name => name === entry || ts.sys.fileExists(name),
      readFile: name => (name === entry ? source : ts.sys.readFile(name)),
    };
    const program = ts.createProgram(
      [entry],
      { strict: true, target: ts.ScriptTarget.ES2022 },
      host,
    );
    typeChecker = program.getTypeChecker();
    sourceFile = program.getSourceFile(entry)!;
  } else {
    sourceFile = ts.createSourceFile(
      entry,
      source,
      ts.ScriptTarget.Latest,
      true,
    );
  }
  let fn: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) fn = node;
    else ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return extractDefinitionsFromParameters(
    fn!.parameters,
    sourceFile,
    typeChecker,
  ).map(d => d.type);
}

const modes = [
  ["syntax tree", { checker: false }],
  ["checker", { checker: true }],
] as const;

describe.each(modes)("records (%s)", (_, opts) => {
  test.each([
    ["Record<string, T>", "function f(x: Record<string, number>) {}"],
    [
      "an index-signature literal",
      "function f(x: { [name: string]: number }) {}",
    ],
    [
      "an index-signature interface",
      "interface Scores { [name: string]: number }\nfunction f(x: Scores) {}",
    ],
  ])("builds a record from %s", (_, source) => {
    const [type] = paramTypes(source, opts);
    expect(type.kind).toBe("record");
    if (type.kind !== "record") return;
    expect(type.value).toMatchObject({
      name: "",
      optional: false,
      type: { kind: "primitive" },
    });
    expect(type.value.type.syntax).toBe("number");
  });

  test("keeps an object with named members an object", () => {
    const [type] = paramTypes(
      "function f(x: { a: string; [name: string]: string }) {}",
      opts,
    );
    expect(type.kind).toBe("object");
  });
});

describe.each(modes)("variadic tuples (%s)", (_, opts) => {
  test("reads the rest element of [A, A, ...A[]]", () => {
    const [type] = paramTypes(
      "type E = string | null\nfunction f(x: readonly [E, E, ...E[]]) {}",
      opts,
    );
    expect(type.kind).toBe("tuple");
    if (type.kind !== "tuple") return;
    expect(type.elements.map(e => e.name)).toEqual(["[0]", "[1]"]);
    expect(type.rest).toBeDefined();
    expect(type.rest!.type.kind).toBe("union");
  });

  test("has no rest element for a fixed tuple", () => {
    const [type] = paramTypes("function f(x: [string, number]) {}", opts);
    expect(type.kind === "tuple" && type.rest).toBeFalsy();
  });

  test("marks optional elements optional", () => {
    const [type] = paramTypes("function f(x: [string, number?]) {}", opts);
    if (type.kind !== "tuple")
      throw new Error(`expected a tuple, got ${type.kind}`);
    expect(type.elements.map(e => e.optional)).toEqual([false, true]);
  });
});

describe.each(modes)("open string unions (%s)", (_, opts) => {
  test("recognizes 'a' | 'b' | (string & {})", () => {
    const [type] = paramTypes(
      "function f(model: 'a' | 'b' | (string & {})) {}",
      opts,
    );
    expect(getOpenStringUnionInfo(type)).toEqual({ suggestions: ["a", "b"] });
  });

  test("does not treat a closed union as open", () => {
    const [type] = paramTypes("function f(model: 'a' | 'b') {}", opts);
    expect(getOpenStringUnionInfo(type)).toBeNull();
  });
});

describe("function parameters (checker)", () => {
  test("marks an optional parameter optional, without undefined in its type", () => {
    const source = `
declare const noul: (instructions?: string, criteria?: { yes?: string } | null) => void
function f(factory: typeof noul) {}`;
    const [type] = paramTypes(source, { checker: true });
    if (type.kind !== "function")
      throw new Error(`expected a function, got ${type.kind}`);
    expect(type.parameters.map(p => [p.name, p.optional])).toEqual([
      ["instructions", true],
      ["criteria", true],
    ]);
    expect(type.parameters[0].type).toMatchObject({
      kind: "primitive",
      syntax: "string",
    });
  });
});
