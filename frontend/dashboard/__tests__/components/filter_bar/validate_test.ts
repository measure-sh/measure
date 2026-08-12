import { describe, expect, it } from "@jest/globals";

import type { FilterKey, FilterOperator } from "@/app/api/filter_types";
import type {
  ConditionGroup,
  ConditionOrGroup,
  ConditionRow,
} from "@/app/components/filter_bar/conditions";
import {
  MAX_CONDITIONS,
  MAX_DEPTH,
  MAX_FILTER_BYTES,
  MAX_VALUES_PER_CONDITION,
} from "@/app/components/filter_bar/limits";
import {
  buildConditionGroup,
  buildDraftTree,
} from "@/app/components/filter_bar/conditions";
import {
  formatFilterExpr,
  parseFilterExpr,
} from "@/app/components/filter_bar/parse";
import {
  findFilterIssues,
  validateLimits,
} from "@/app/components/filter_bar/validate";

function key(name: string, operators: FilterOperator[]): FilterKey {
  return {
    name,
    label: name,
    description: "",
    key_group: "Build",
    value_type: "string",
    operators,
    value_suggestion_mode: "sample",
  };
}

// IDs only need to distinguish one row from another here, so they are simple
// counters rather than positions in the filter like the bar's own IDs.
let rowCount = 0;

function row(
  keyName: string,
  operator: FilterOperator,
  ...texts: string[]
): ConditionRow {
  rowCount += 1;
  return {
    id: `test-row-${rowCount}`,
    key: key(keyName, ["in", "not_in", "contains", "starts_with"]),
    operator,
    values: texts.map((text) => ({ text })),
  };
}

let groupCount = 0;

function group(
  logicalOperator: "and" | "or",
  ...children: ConditionOrGroup[]
): ConditionGroup {
  groupCount += 1;
  return { id: `test-group-${groupCount}`, logicalOperator, children };
}

describe("the limits the bar keeps a filter inside", () => {
  function rowsOf(count: number): ConditionRow[] {
    return Array.from({ length: count }, () => row("version_name", "in", "1"));
  }

  // Two levels is the least a filter can be: one group holding one condition.
  function nested(depth: number): ConditionGroup {
    let filter = group("and", row("version_name", "in", "1"));
    for (let level = 2; level < depth; level++) {
      filter = group("and", filter);
    }
    return filter;
  }

  it("passes a filter inside every limit", () => {
    expect(validateLimits(group("and", ...rowsOf(3)))).toBeNull();
  });

  it("names the conditions limit, and only past it", () => {
    const at = group("and", ...rowsOf(MAX_CONDITIONS));
    const past = group("and", ...rowsOf(MAX_CONDITIONS + 1));

    expect(validateLimits(at)).toBeNull();
    expect(validateLimits(past)).toBe(
      `A filter can hold at most ${MAX_CONDITIONS} conditions`,
    );
  });

  it("counts the conditions inside groups too", () => {
    const half = Math.floor(MAX_CONDITIONS / 2) + 1;
    const past = group(
      "and",
      group("and", ...rowsOf(half)),
      group("or", ...rowsOf(half)),
    );

    expect(validateLimits(past)).toBe(
      `A filter can hold at most ${MAX_CONDITIONS} conditions`,
    );
  });

  it("counts a row that is not finished towards the conditions limit", () => {
    const past = group(
      "and",
      ...rowsOf(MAX_CONDITIONS),
      row("version_name", "in"),
    );

    expect(validateLimits(past)).toBe(
      `A filter can hold at most ${MAX_CONDITIONS} conditions`,
    );
  });

  it("names the nesting limit, and only past it", () => {
    expect(validateLimits(nested(MAX_DEPTH))).toBeNull();
    expect(validateLimits(nested(MAX_DEPTH + 1))).toBe(
      "Filter groups cannot be nested deeper",
    );
  });

  it("measures the deepest branch a filter holds", () => {
    const single = row("version_name", "in", "1");
    const inside = group("and", single, nested(MAX_DEPTH - 1));
    const past = group("and", single, nested(MAX_DEPTH));

    expect(validateLimits(inside)).toBeNull();
    expect(validateLimits(past)).toBe("Filter groups cannot be nested deeper");
  });

  it("names the values limit, and only past it", () => {
    const texts = Array.from({ length: MAX_VALUES_PER_CONDITION }, (_, i) =>
      String(i),
    );
    const at = group("and", row("version_name", "in", ...texts));
    const past = group("and", row("version_name", "in", ...texts, "one more"));

    expect(validateLimits(at)).toBeNull();
    expect(validateLimits(past)).toBe(
      `A condition can hold at most ${MAX_VALUES_PER_CONDITION} values`,
    );
  });

  it("names the length limit", () => {
    const long = group(
      "and",
      row("version_name", "in", "a".repeat(MAX_FILTER_BYTES + 1)),
    );

    expect(validateLimits(long)).toBe(
      `A filter can be at most ${MAX_FILTER_BYTES} bytes long`,
    );
  });

  it("counts a value in bytes rather than characters", () => {
    const japanese = "\u65e5".repeat(1500);
    const conditions = group("and", row("version_name", "in", japanese));

    expect(japanese.length).toBeLessThan(MAX_FILTER_BYTES);
    expect(validateLimits(conditions)).toBe(
      `A filter can be at most ${MAX_FILTER_BYTES} bytes long`,
    );
  });

  // The length is measured on the expression,
  // so incomplete rows do not count toward the limit.
  it("leaves a row that is not finished out of the length", () => {
    const conditions = group(
      "and",
      row("version_name", "in", "a".repeat(4000)),
      row("version_name", "in"),
    );

    expect(validateLimits(conditions)).toBeNull();
  });
});

describe("findFilterIssues", () => {
  const keys = [
    key("version_name", ["in", "not_in", "contains"]),
    key("mapping_type", ["in", "not_in"]),
  ];

  function issuesIn(text: string) {
    const parsed = parseFilterExpr(text, { draft: true });
    const conditions = buildConditionGroup(
      parsed.ok ? parsed.tree : null,
      keys,
    );
    return findFilterIssues(parsed, keys, conditions);
  }

  it("finds nothing wrong with a filter this app can use", () => {
    expect(issuesIn("version_name:in:1.0.0")).toEqual([]);
  });

  it("reports text it could not read", () => {
    const [issue, ...rest] = issuesIn("version_name:in:1.0.0)");

    expect(issue.message).toBe('Unexpected ")"');
    expect(issue.span).toBeUndefined();
    expect(rest).toEqual([]);
  });

  it("reports a key this app does not have, with the span it covers", () => {
    const [issue] = issuesIn("device_cohort:in:new");

    expect(issue.message).toBe("There is no filter named device_cohort");
    expect([issue.span?.start, issue.span?.end]).toEqual([0, 13]);
  });

  it("reports an operator the key does not offer", () => {
    const [issue] = issuesIn("mapping_type:contains:pro");

    expect(issue.message).toBe("mapping_type cannot be compared with contains");
  });

  it("tells a word that is no operator apart from one the key lacks", () => {
    const [issue] = issuesIn("mapping_type:nonsense:pro");

    expect(issue.message).toBe("There is no operator named nonsense");
    expect([issue.span?.start, issue.span?.end]).toEqual([13, 21]);
  });

  it("keeps the keys it found alongside text it could not read", () => {
    const issues = issuesIn("device_cohort:in:new AND other:in:x)");

    expect(issues.map((issue) => issue.span?.start)).toEqual([
      0,
      25,
      undefined,
    ]);
    expect(issues.at(-1)?.message).toBe('Unexpected ")"');
  });

  it("orders issues by where they appear in the text", () => {
    const starts = issuesIn(
      "version_name:in:1.0.0 AND device_cohort:in:new AND other:in:x",
    ).map((issue) => issue.span?.start);

    expect(starts).toEqual([26, 51]);
  });

  it("puts a limit last, having nowhere to point", () => {
    const tooMany = group(
      "and",
      ...Array.from({ length: MAX_CONDITIONS + 1 }, () =>
        row("version_name", "in", "1"),
      ),
    );
    const parsed = parseFilterExpr(formatFilterExpr(buildDraftTree(tooMany)), {
      draft: true,
    });
    const issues = findFilterIssues(parsed, keys, tooMany);

    expect(issues).toHaveLength(1);
    expect(issues[0].span).toBeUndefined();
  });
});
