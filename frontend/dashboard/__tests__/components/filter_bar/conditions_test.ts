import { describe, expect, it } from "@jest/globals";

import type { FilterKey, FilterOperator } from "@/app/api/filter_types";
import {
  buildConditionGroup,
  buildExprTree,
  type ConditionGroup,
  type ConditionOrGroup,
  type ConditionRow,
  dropById,
  isConditionGroup,
  isRowComplete,
  updateGroup,
  updateRow,
} from "@/app/components/filter_bar/conditions";
import { formatFilterExpr } from "@/app/components/filter_bar/parse";

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

describe("when a condition is finished", () => {
  it("needs a value for the operators that take one", () => {
    expect(isRowComplete(row("version_name", "in"))).toBe(false);
    expect(isRowComplete(row("version_name", "in", "1.0"))).toBe(true);
  });

  it("is finished without values when the operator takes none", () => {
    expect(isRowComplete(row("patch_id", "is_set"))).toBe(true);
  });

  it("is unfinished while a single-value operator holds several", () => {
    expect(
      isRowComplete(row("version_name", "starts_with", "1.0", "1.1")),
    ).toBe(false);
    expect(isRowComplete(row("version_name", "starts_with", "1.0"))).toBe(true);
  });
});

describe("the expression the bar sends", () => {
  it("is nothing while the bar is empty", () => {
    expect(buildExprTree(group("and"))).toBeNull();
    expect(buildExprTree(group("and", row("version_name", "in")))).toBeNull();
  });

  // A group the user placed around the whole filter must survive a round trip,
  // so the filter is always serialized as a group.
  it("is a group even when there is only one condition", () => {
    const exprTree = buildExprTree(
      group("and", row("version_name", "in", "1.0")),
    );
    expect(exprTree).toEqual({
      logical_operator: "and",
      children: [
        {
          condition: {
            key_name: "version_name",
            operator: "in",
            values: [{ text: "1.0" }],
          },
        },
      ],
    });
  });

  it("is a group joined by the logicalOperator when there are several", () => {
    const exprTree = buildExprTree(
      group("or", row("version_name", "in", "1.0"), row("patch_id", "is_set")),
    );

    expect(exprTree?.logical_operator).toBe("or");
    expect(exprTree?.children).toHaveLength(2);
    expect(exprTree?.children?.[1].condition).toEqual({
      key_name: "patch_id",
      operator: "is_set",
      values: undefined,
    });
  });

  it("leaves out a condition that is still being built", () => {
    const exprTree = buildExprTree(
      group("and", row("version_name", "in", "1.0"), row("mapping_type", "in")),
    );

    expect(exprTree?.children).toEqual([
      {
        condition: {
          key_name: "version_name",
          operator: "in",
          values: [{ text: "1.0" }],
        },
      },
    ]);
  });

  it("nests a group inside the filter it sits in", () => {
    const exprTree = buildExprTree(
      group(
        "and",
        row("version_name", "in", "1.0"),
        group("or", row("patch_id", "in", "a"), row("patch_id", "in", "b")),
      ),
    );

    expect(exprTree?.logical_operator).toBe("and");
    expect(exprTree?.children?.[1]).toMatchObject({ logical_operator: "or" });
    expect(exprTree?.children?.[1].children).toHaveLength(2);
  });

  it("keeps a group holding one finished condition", () => {
    const exprTree = buildExprTree(
      group(
        "and",
        row("version_name", "in", "1.0"),
        group("or", row("patch_id", "in", "a"), row("patch_id", "in")),
      ),
    );

    expect(exprTree?.children?.[1]).toEqual({
      logical_operator: "or",
      children: [
        {
          condition: {
            key_name: "patch_id",
            operator: "in",
            values: [{ text: "a" }],
          },
        },
      ],
    });
  });

  it("leaves out a group holding nothing finished", () => {
    const exprTree = buildExprTree(
      group(
        "and",
        row("version_name", "in", "1.0"),
        group("or", row("patch_id", "in")),
      ),
    );

    expect(exprTree?.children).toHaveLength(1);
    expect(exprTree?.children?.[0]).toMatchObject({
      condition: { key_name: "version_name" },
    });
  });
});

describe("reading an expression back into the bar", () => {
  const keys = [
    key("version_name", ["in", "not_in"]),
    key("patch_id", ["in", "is_set"]),
  ];

  const versionNameIn = {
    condition: {
      key_name: "version_name",
      operator: "in" as FilterOperator,
      values: [{ text: "1.0" }],
    },
  };
  const patchIdIsSet = {
    condition: { key_name: "patch_id", operator: "is_set" as FilterOperator },
  };

  function rowsOf(filter: ConditionGroup): ConditionRow[] {
    return filter.children.filter(
      (item): item is ConditionRow => !isConditionGroup(item),
    );
  }

  it("draws nothing for no expression", () => {
    expect(buildConditionGroup(null, keys)).toMatchObject({
      children: [],
      logicalOperator: "and",
    });
  });

  it("draws one row for a single condition", () => {
    const restored = buildConditionGroup(versionNameIn, keys);

    expect(restored.logicalOperator).toBe("and");
    expect(rowsOf(restored)).toHaveLength(1);
    expect(rowsOf(restored)[0].key?.name).toBe("version_name");
    expect(rowsOf(restored)[0].values).toEqual([{ text: "1.0" }]);
  });

  it("keeps the logicalOperator a group was written with", () => {
    const restored = buildConditionGroup(
      {
        logical_operator: "or",
        children: [versionNameIn, patchIdIsSet],
      },
      keys,
    );

    expect(restored.logicalOperator).toBe("or");
    expect(rowsOf(restored)).toHaveLength(2);
  });

  it("draws a nested group as a group of its own", () => {
    const restored = buildConditionGroup(
      {
        logical_operator: "and",
        children: [
          versionNameIn,
          { logical_operator: "or", children: [patchIdIsSet, versionNameIn] },
        ],
      },
      keys,
    );

    expect(restored.children).toHaveLength(2);
    const nested = restored.children[1];
    expect(isConditionGroup(nested)).toBe(true);
    expect(isConditionGroup(nested) && nested.logicalOperator).toBe("or");
    expect(isConditionGroup(nested) && nested.children).toHaveLength(2);
  });

  it("leaves out a condition naming a key this entity no longer has", () => {
    const restored = buildConditionGroup(
      {
        logical_operator: "and",
        children: [
          versionNameIn,
          {
            condition: {
              key_name: "device_cohort",
              operator: "in",
              values: [{ text: "beta" }],
            },
          },
        ],
      },
      keys,
    );

    expect(rowsOf(restored)).toHaveLength(1);
    expect(rowsOf(restored)[0].key?.name).toBe("version_name");
  });

  it("leaves out a group the lost keys emptied", () => {
    const unknownKey = {
      condition: {
        key_name: "device_cohort",
        operator: "in" as FilterOperator,
      },
    };
    const restored = buildConditionGroup(
      {
        logical_operator: "and",
        children: [
          versionNameIn,
          { logical_operator: "or", children: [unknownKey] },
        ],
      },
      keys,
    );

    expect(restored.children).toHaveLength(1);
    expect(rowsOf(restored)[0].key?.name).toBe("version_name");
  });

  it("writes back the filter it was given, groups and all", () => {
    const given = {
      logical_operator: "and" as const,
      children: [
        versionNameIn,
        {
          logical_operator: "and" as const,
          children: [patchIdIsSet, versionNameIn],
        },
      ],
    };

    const drawn = buildConditionGroup(given, keys);

    expect(formatFilterExpr(buildExprTree(drawn))).toBe(
      "version_name:in:1.0 AND (patch_id:is_set AND version_name:in:1.0)",
    );
  });

  it("gives every row an id of its own", () => {
    const restored = buildConditionGroup(
      {
        logical_operator: "and",
        children: [versionNameIn, patchIdIsSet],
      },
      keys,
    );

    expect(rowsOf(restored)[0].id).not.toBe(rowsOf(restored)[1].id);
  });
});

describe("changing one part of a filter", () => {
  it("rewrites the row the id names, and leaves the rest alone", () => {
    const first = row("version_name", "in", "1.0");
    const second = row("patch_id", "in", "a");
    const filter = group("and", first, second);

    const changed = updateRow(filter, second.id, { values: [{ text: "b" }] });

    expect(changed.children[0]).toBe(first);
    expect(changed.children[1]).toMatchObject({ values: [{ text: "b" }] });
  });

  it("reaches a row inside a group", () => {
    const nested = row("patch_id", "in", "a");
    const filter = group(
      "and",
      row("version_name", "in", "1.0"),
      group("or", nested),
    );

    const changed = updateRow(filter, nested.id, { values: [{ text: "b" }] });

    const inner = changed.children[1] as ConditionGroup;
    expect(inner.children[0]).toMatchObject({ values: [{ text: "b" }] });
  });

  it("changes the whole filter when the id is its own", () => {
    const filter = group("and", row("version_name", "in", "1.0"));

    const changed = updateGroup(filter, filter.id, (self) => ({
      ...self,
      logicalOperator: "or",
    }));

    expect(changed.logicalOperator).toBe("or");
  });

  it("changes a group inside the filter", () => {
    const inner = group("and", row("patch_id", "in", "a"));
    const filter = group("and", row("version_name", "in", "1.0"), inner);

    const changed = updateGroup(filter, inner.id, (self) => ({
      ...self,
      logicalOperator: "or",
    }));

    expect((changed.children[1] as ConditionGroup).logicalOperator).toBe("or");
  });

  it("drops the condition or group the id names", () => {
    const dropped = row("patch_id", "in", "a");
    const filter = group("and", row("version_name", "in", "1.0"), dropped);

    expect(dropById(filter, dropped.id).children).toHaveLength(1);
  });

  it("drops a group along with its last condition", () => {
    const only = row("patch_id", "in", "a");
    const filter = group(
      "and",
      row("version_name", "in", "1.0"),
      group("or", only),
    );

    const changed = dropById(filter, only.id);

    expect(changed.children).toHaveLength(1);
    expect(changed.children[0]).toMatchObject({
      key: { name: "version_name" },
    });
  });

  it("leaves a group holding what it still has", () => {
    const dropped = row("patch_id", "in", "a");
    const kept = row("patch_id", "in", "b");
    const filter = group("and", group("or", dropped, kept));

    const inner = dropById(filter, dropped.id).children[0] as ConditionGroup;

    expect(inner.children).toEqual([kept]);
  });
});
