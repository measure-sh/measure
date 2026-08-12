import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { ExprTree } from "@/app/api/filter_types";
import {
  type ExprToken,
  formatFilterExpr,
  parseFilterExpr,
} from "@/app/components/filter_bar/parse";

const casesFile = path.join(
  __dirname,
  "../../../../../backend/libs/exprfilter/testdata/filter_test_expr_cases.json",
);

type TreeCase = { name: string; text: string; tree: ExprTree };
type RefuseCase = {
  name: string;
  text: string;
  message: string;
  position: number;
};

const cases: {
  parse: TreeCase[];
  refuse: RefuseCase[];
  format: TreeCase[];
} = JSON.parse(readFileSync(casesFile, "utf8"));

// Renders a tree on one line, so a mismatch between two trees reads as a
// one-line difference rather than as nested objects.
function describeTree(exprTree: ExprTree | null): string {
  if (!exprTree) {
    return "<nil>";
  }
  if (exprTree.condition) {
    const values = (exprTree.condition.values ?? [])
      .map((value) => value.text)
      .join("|");
    return `{${exprTree.condition.key_name} ${exprTree.condition.operator} ${values}}`;
  }

  const parts = (exprTree.children ?? []).map(describeTree);
  return `(${exprTree.logical_operator} ${parts.join(" ")})`;
}

describe("reading a filter", () => {
  it.each(cases.parse.map((test): [string, TreeCase] => [test.name, test]))(
    "%s",
    (_, test) => {
      const read = parseFilterExpr(test.text);

      expect(read.ok).toBe(true);
      expect(describeTree(read.ok ? read.tree : null)).toBe(
        describeTree(test.tree),
      );
    },
  );
});

describe("refusing a filter", () => {
  it.each(cases.refuse.map((test): [string, RefuseCase] => [test.name, test]))(
    "%s",
    (_, test) => {
      const read = parseFilterExpr(test.text);

      expect(read.ok).toBe(false);
      if (read.ok) {
        return;
      }
      expect(read.error.message).toContain(test.message);
      expect(read.error.position).toBe(test.position);
    },
  );
});

describe("writing a filter", () => {
  it.each(cases.format.map((test): [string, TreeCase] => [test.name, test]))(
    "%s",
    (_, test) => {
      const written = formatFilterExpr(test.tree);
      expect(written).toBe(test.text);

      // The filter bar builds a tree and passes the filter on as text, so what
      // is written has to read back as the tree it was written from.
      const read = parseFilterExpr(written);
      expect(read.ok).toBe(true);
      expect(describeTree(read.ok ? read.tree : null)).toBe(
        describeTree(test.tree),
      );
    },
  );
});

describe("refusing a filter longer than the server accepts", () => {
  it("counts the bytes rather than the characters", () => {
    // Each of these characters takes three bytes in UTF-8, so 2000 of them are
    // over the 4096 byte limit while staying well under it in characters.
    const japanese = "版".repeat(2000);
    expect(japanese.length).toBeLessThan(4096);

    const read = parseFilterExpr(`version_name:in:${japanese}`);
    expect(read.ok).toBe(false);
  });
});

// The shared cases hold no drafts, since the server's parser has no draft
// mode.
describe("reading a filter being built", () => {
  it("reads a condition whose values are still to be picked", () => {
    const read = parseFilterExpr("version_name:in:", { draft: true });

    expect(describeTree(read.ok ? read.tree : null)).toBe("{version_name in }");
  });

  it("reads a condition whose values are still to be picked beside another", () => {
    const read = parseFilterExpr("version_name:in: AND patch_id:is_set", {
      draft: true,
    });

    expect(describeTree(read.ok ? read.tree : null)).toBe(
      "(and {version_name in } {patch_id is_set })",
    );
  });

  it("reads a group with nothing in it yet", () => {
    const read = parseFilterExpr("()", { draft: true });

    expect(describeTree(read.ok ? read.tree : null)).toBe("(and (and ))");
  });

  it("reads a group with nothing in it yet beside a condition", () => {
    const read = parseFilterExpr("a:in:1 AND ()", { draft: true });

    expect(describeTree(read.ok ? read.tree : null)).toBe(
      "(and {a in 1} (and ))",
    );
  });

  it("keeps a group that holds the whole filter", () => {
    const read = parseFilterExpr("(a:in:1 AND b:in:2)", { draft: true });

    expect(describeTree(read.ok ? read.tree : null)).toBe(
      "(and (and {a in 1} {b in 2}))",
    );
  });

  it("keeps a group inside a group that holds the whole filter", () => {
    const read = parseFilterExpr("((a:in:1 AND b:in:2))", { draft: true });

    expect(describeTree(read.ok ? read.tree : null)).toBe(
      "(and (and (and {a in 1} {b in 2})))",
    );
  });

  it("refuses both forms when it is not reading a draft", () => {
    expect(parseFilterExpr("version_name:in:").ok).toBe(false);
    expect(parseFilterExpr("()").ok).toBe(false);
  });
});

describe("writing a filter being built", () => {
  it("ends a condition whose values are still to be picked with a colon", () => {
    const tree: ExprTree = {
      logical_operator: "and",
      children: [
        { condition: { key_name: "version_name", operator: "in", values: [] } },
      ],
    };

    expect(formatFilterExpr(tree)).toBe("version_name:in:");
  });

  it("writes a group with nothing in it as a pair of parentheses", () => {
    const tree: ExprTree = {
      logical_operator: "and",
      children: [{ logical_operator: "and", children: [] }],
    };

    expect(formatFilterExpr(tree)).toBe("()");
  });

  it.each([
    ["version_name:in:"],
    ["()"],
    ["a:in:1 AND ()"],
    ["a:in:1 AND (b:in:2 OR c:in:)"],
    ["(a:in:1 AND b:in:2)"],
    ["((a:in:1 AND b:in:2))"],
    ["(a:in:1 AND (b:in:2 OR c:in:3))"],
  ])("reads %s back as what it was written from", (text) => {
    const read = parseFilterExpr(text, { draft: true });
    expect(read.ok).toBe(true);

    expect(formatFilterExpr(read.ok ? read.tree : null)).toBe(text);
  });
});

describe("quoting a value", () => {
  const written = (text: string) =>
    formatFilterExpr({
      condition: {
        key_name: "version_name",
        operator: "in",
        values: [{ text }],
      },
    });

  it("leaves a plain value alone", () => {
    expect(written("1.0.2")).toBe("version_name:in:1.0.2");
  });

  it.each([
    ["a space", "1.0 beta", '"1.0 beta"'],
    ["a colon", "a:b", '"a:b"'],
    ["a comma", "a,b", '"a,b"'],
    ["brackets", "a[b]", '"a[b]"'],
    ["parentheses", "a(b)", '"a(b)"'],
  ])("quotes a value holding %s", (_case, text, expected) => {
    expect(written(text)).toBe(`version_name:in:${expected}`);
    expect(parseFilterExpr(written(text)).ok).toBe(true);
  });
});

describe("the tokens a filter reads as", () => {
  function kinds(text: string): [ExprToken["kind"], string][] {
    return parseFilterExpr(text).tokens.map((token) => [
      token.kind,
      token.text,
    ]);
  }

  it("names every part of a condition", () => {
    expect(kinds("version_name:in:1.2.0")).toEqual([
      ["key", "version_name"],
      ["punctuation", ":"],
      ["operator", "in"],
      ["punctuation", ":"],
      ["value", "1.2.0"],
    ]);
  });

  it("names the parts of a list and what joins conditions", () => {
    expect(kinds("a:in:[1,2] OR (b:is_set)")).toEqual([
      ["key", "a"],
      ["punctuation", ":"],
      ["operator", "in"],
      ["punctuation", ":"],
      ["punctuation", "["],
      ["value", "1"],
      ["punctuation", ","],
      ["value", "2"],
      ["punctuation", "]"],
      ["logical", "OR"],
      ["paren", "("],
      ["key", "b"],
      ["punctuation", ":"],
      ["operator", "is_set"],
      ["paren", ")"],
    ]);
  });

  it("covers a quoted value from one quote to the other", () => {
    const tokens = parseFilterExpr('a:in:"1.2 (beta)"').tokens;
    const value = tokens.find((token) => token.kind === "value");

    expect(value).toEqual({
      kind: "value",
      start: 5,
      end: 17,
      text: '"1.2 (beta)"',
    });
  });

  it("comes back from a filter that could not be read, up to where it stopped", () => {
    expect(kinds("a:in:1 AND b:")).toEqual([
      ["key", "a"],
      ["punctuation", ":"],
      ["operator", "in"],
      ["punctuation", ":"],
      ["value", "1"],
      ["logical", "AND"],
      ["key", "b"],
      ["punctuation", ":"],
    ]);
  });
});
