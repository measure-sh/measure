import { describe, expect, it } from "@jest/globals";

import { negotiate, parseAccept } from "@/app/utils/llms/content_negotiation";

const BOTH = ["text/html", "text/markdown"];

describe("parseAccept", () => {
  it("reads media ranges with q-values and their order", () => {
    expect(parseAccept("text/markdown, text/html;q=0.9, */*;q=0.1")).toEqual([
      { type: "text", subtype: "markdown", q: 1, position: 0 },
      { type: "text", subtype: "html", q: 0.9, position: 1 },
      { type: "*", subtype: "*", q: 0.1, position: 2 },
    ]);
  });

  it("lowercases types and ignores whitespace and other parameters", () => {
    expect(parseAccept(" Text/HTML ; charset=utf-8 ; Q = 0.5 ")).toEqual([
      { type: "text", subtype: "html", q: 0.5, position: 0 },
    ]);
  });

  it("skips entries that are not type/subtype", () => {
    expect(parseAccept("html, , text/html/x, text/markdown")).toEqual([
      { type: "text", subtype: "markdown", q: 1, position: 3 },
    ]);
  });

  it("clamps q to [0, 1] and keeps 1 for a malformed q", () => {
    expect(
      parseAccept("a/b;q=2, c/d;q=-1, e/f;q=abc, g/h;q=").map((r) => r.q),
    ).toEqual([1, 0, 1, 1]);
  });
});

describe("negotiate", () => {
  it.each([
    ["text/markdown", "text/markdown"],
    ["text/html", "text/html"],
    ["text/markdown, text/html", "text/markdown"],
    ["text/html, text/markdown", "text/html"],
    ["text/markdown, text/html;q=0.9", "text/markdown"],
    ["text/html, text/markdown;q=0.1", "text/html"],
    ["text/html;q=0.5, text/markdown;q=0.9", "text/markdown"],
    ["text/markdown;q=0, */*", "text/html"],
    ["text/html;q=0, */*", "text/markdown"],
    ["text/markdown, */*;q=0.8", "text/markdown"],
    [
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "text/html",
    ],
    ["*/*", "text/html"],
    ["text/*", "text/html"],
    ["text/*, text/html;q=0.2", "text/markdown"],
  ])("Accept %p picks %p", (accept, expected) => {
    expect(negotiate(accept, BOTH)).toBe(expected);
  });

  it.each([null, "", " , "])(
    "treats a missing or empty Accept (%p) as accepting anything",
    (accept) => {
      expect(negotiate(accept, BOTH)).toBe("text/html");
    },
  );

  it.each([
    "application/pdf",
    "text/markdown;q=0, text/html;q=0",
    "*/*;q=0",
    "image/avif,image/webp",
  ])("returns null when Accept %p refuses every offered type", (accept) => {
    expect(negotiate(accept, BOTH)).toBeNull();
  });

  it("uses the most specific range even when a wildcard gives a higher q", () => {
    expect(negotiate("text/html;q=0.1, */*", ["text/html"])).toBe("text/html");
    expect(negotiate("text/html;q=0, */*", ["text/html"])).toBeNull();
  });

  it("returns null for a markdown-only Accept when only HTML is offered", () => {
    expect(negotiate("text/markdown", ["text/html"])).toBeNull();
  });
});
