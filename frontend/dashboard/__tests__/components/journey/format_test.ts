import type { JourneyNode } from "@/app/api/api_calls";
import {
  formatUsers,
  linkStats,
  nodeStats,
  shortName,
} from "@/app/components/journey/format";
import { describe, expect, it } from "@jest/globals";

function node(overrides: Partial<JourneyNode> = {}): JourneyNode {
  return {
    id: "sh.measure.demo.CartActivity",
    name: "sh.measure.demo.CartActivity",
    kind: "screen",
    step: 2,
    users: 1_000,
    continuing: 750,
    median_ms_from_previous: 4_000,
    ...overrides,
  };
}

describe("shortName", () => {
  it("keeps the last segment of a qualified class name", () => {
    expect(shortName("sh.measure.demo.CartActivity")).toBe("CartActivity");
  });

  it("keeps a name without dots as it is", () => {
    expect(shortName("add_to_cart")).toBe("add_to_cart");
  });

  it("keeps a name that ends with a dot as it is", () => {
    expect(shortName("cart.")).toBe("cart.");
  });
});

describe("formatUsers", () => {
  it("says user for one and users otherwise", () => {
    expect(formatUsers(1)).toBe("1 user");
    expect(formatUsers(0)).toBe("0 users");
    expect(formatUsers(1_500)).toBe("1.5K users");
  });
});

describe("nodeStats", () => {
  it("shows users, continuing, dropping off and the median time", () => {
    expect(nodeStats(node())).toEqual([
      { label: "Users", value: "1K" },
      { label: "Continuing", value: "750 (75%)" },
      {
        label: "Dropping off",
        value: "250 (25%)",
        className: "text-red-600 dark:text-red-400",
      },
      { label: "Median time from previous step", value: "4s" },
    ]);
  });

  it("doesn't colour dropping off when every user continues", () => {
    const dropping = nodeStats(node({ continuing: 1_000 })).find(
      (s) => s.label === "Dropping off",
    );

    expect(dropping?.className).toBeUndefined();
  });

  it("leaves out the median time when there is no previous step", () => {
    const labels = nodeStats(node({ median_ms_from_previous: null })).map(
      (s) => s.label,
    );

    expect(labels).toEqual(["Users", "Continuing", "Dropping off"]);
  });

  it("leaves out continuing and dropping off for the fatal error node", () => {
    const labels = nodeStats(
      node({ kind: "fatal", name: "Fatal error", continuing: 0 }),
    ).map((s) => s.label);

    expect(labels).toEqual(["Users", "Median time from previous step"]);
  });
});

describe("linkStats", () => {
  it("shows the link's users and its share of the source's users", () => {
    expect(linkStats(node(), 250)).toEqual([
      { label: "Users", value: "250" },
      { label: "Conversion from CartActivity", value: "25%" },
    ]);
  });
});
