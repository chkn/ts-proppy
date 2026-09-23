// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Alexander Corrado

import { describe, expect, test } from "vitest";
import type { TemplateValue } from "../../../types/prop-value.js";
import { toHTML } from "../TemplateEditor.js";

const code = (text: string) => `<span class="te-code">${text}</span>`;
const token = (expr: string) => `<span class="te-token">\${${expr}}</span>`;

describe("toHTML code spans", () => {
  test("highlights a backtick pair within one string segment", () => {
    expect(toHTML(["call `fn()` now"])).toBe(`call ${code("`fn()`")} now`);
  });

  test("leaves an unmatched backtick literal", () => {
    expect(toHTML(["a stray ` backtick"])).toBe("a stray ` backtick");
  });

  test("a backtick pair wrapping an interpolation is one span", () => {
    const value: TemplateValue = ["call `", { expr: "X" }, "` now"];
    expect(toHTML(value)).toBe(
      `call ${code("`")}${token("X")}${code("`")} now`,
    );
  });

  test("text between two backtick-wrapped interpolations is not code", () => {
    const value: TemplateValue = [
      "call `",
      { expr: "X" },
      "` to finish, or call `",
      { expr: "X" },
      "`.",
    ];
    expect(toHTML(value)).toBe(
      `call ${code("`")}${token("X")}${code("`")} to finish, or call ` +
        `${code("`")}${token("X")}${code("`")}.`,
    );
  });

  test("does not span newlines", () => {
    expect(toHTML(["`a\nb`"])).toBe("`a<br>b`");
  });

  test("escapes HTML inside and outside code spans", () => {
    expect(toHTML(["<b> `<i>`"])).toBe(`&lt;b&gt; ${code("`&lt;i&gt;`")}`);
  });
});
