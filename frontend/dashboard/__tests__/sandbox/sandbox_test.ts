import { describe, expect, it } from "@jest/globals";
import {
  bucketsForRange,
  formatBucket,
  parseRange,
  scaledCount,
} from "@/app/sandbox/query";
import { matchFraction, matchesFilterExpr } from "@/app/sandbox/filter";
import { decodeToken, encodeToken } from "@/app/sandbox/layouts";
import { GET as attachmentGet } from "@/app/sandbox-attachments/[token]/route";
import { promiseParams } from "@/__tests__/helpers/promise_params";
import {
  isSandboxPath,
  isSandboxTeamId,
  SANDBOX_TEAM_ID,
} from "@/app/utils/sandbox";

function rangeUrl(group: string, timezone: string): URL {
  return new URL(
    `http://sandbox.local/api/x?from=2026-04-01T00:00:00.000Z&to=2026-04-01T06:00:00.000Z&plot_time_group=${group}&timezone=${timezone}`,
  );
}

describe("sandbox query helpers", () => {
  it("formats day buckets the way the charts parse them", () => {
    const range = parseRange(rangeUrl("days", "UTC"));
    const [first] = bucketsForRange(range);
    expect(formatBucket(first, range.group)).toBe("2026-04-01");
  });

  it("formats hour buckets without zone or milliseconds", () => {
    const range = parseRange(rangeUrl("hours", "UTC"));
    const buckets = bucketsForRange(range);
    expect(buckets).toHaveLength(7);
    expect(formatBucket(buckets[1], range.group)).toBe("2026-04-01T01:00:00");
  });

  it("buckets in the requested timezone like the backend does", () => {
    const range = parseRange(rangeUrl("hours", "Asia/Kolkata"));
    const [first] = bucketsForRange(range);
    expect(formatBucket(first, range.group)).toBe("2026-04-01T05:00:00");
  });

  it("divides the base count down to bucket size for hours, minutes and months", () => {
    const base = 2400;
    expect(scaledCount(base, "days", 1)).toBeGreaterThan(
      scaledCount(base, "hours", 1),
    );
    expect(scaledCount(base, "hours", 1)).toBeGreaterThan(
      scaledCount(base, "minutes", 1),
    );
    expect(scaledCount(base, "months", 1)).toBeGreaterThan(
      scaledCount(base, "days", 1),
    );
  });
});

describe("matchesFilterExpr", () => {
  it("matches everything for a null, empty, unparseable or unknown-key filter", () => {
    const attrs = { version_name: "2.4.1" };
    expect(matchesFilterExpr(attrs, null)).toBe(true);
    expect(matchesFilterExpr(attrs, "")).toBe(true);
    expect(matchesFilterExpr(attrs, "version_name:")).toBe(true);
    expect(matchesFilterExpr(attrs, "device_name:in:Pixel")).toBe(true);
  });

  it("evaluates in/not_in against a list of values", () => {
    const attrs = { version_name: "2.4.1" };
    expect(matchesFilterExpr(attrs, "version_name:in:[2.4.1,2.4.0]")).toBe(
      true,
    );
    expect(matchesFilterExpr(attrs, "version_name:in:2.3.7")).toBe(false);
    expect(matchesFilterExpr(attrs, "version_name:not_in:2.3.7")).toBe(true);
  });

  it("evaluates eq, contains, starts_with and ends_with case-insensitively", () => {
    const attrs = { device_name: "Pixel 8 Pro" };
    expect(matchesFilterExpr(attrs, "device_name:eq:pixel 8 pro")).toBe(true);
    expect(matchesFilterExpr(attrs, "device_name:contains:8 pro")).toBe(true);
    expect(matchesFilterExpr(attrs, "device_name:starts_with:pixel")).toBe(
      true,
    );
    expect(matchesFilterExpr(attrs, "device_name:ends_with:pro")).toBe(true);
    expect(matchesFilterExpr(attrs, "device_name:not_contains:galaxy")).toBe(
      true,
    );
  });

  it("evaluates gt/gte/lt/lte numerically", () => {
    const attrs = { count: 10 };
    expect(matchesFilterExpr(attrs, "count:gt:5")).toBe(true);
    expect(matchesFilterExpr(attrs, "count:gte:10")).toBe(true);
    expect(matchesFilterExpr(attrs, "count:lt:5")).toBe(false);
    expect(matchesFilterExpr(attrs, "count:lte:10")).toBe(true);
  });

  it("reads the patch keys as unset, since the sandbox has no patches", () => {
    const attrs = { version_name: "2.4.1" };
    expect(matchesFilterExpr(attrs, "patch_id:is_set")).toBe(false);
    expect(matchesFilterExpr(attrs, "patch_id:is_not_set")).toBe(true);
    expect(matchesFilterExpr(attrs, "patch_version:in:1")).toBe(false);
    expect(matchesFilterExpr(attrs, "patch_version:not_in:1")).toBe(true);
  });

  it("combines conditions with AND binding tighter than OR, and honours an explicit group", () => {
    const attrs = { version_name: "2.4.1", os_name: "android" };
    expect(
      matchesFilterExpr(attrs, "version_name:in:2.4.1 AND os_name:in:android"),
    ).toBe(true);
    expect(
      matchesFilterExpr(attrs, "version_name:in:2.4.1 AND os_name:in:ios"),
    ).toBe(false);
    expect(
      matchesFilterExpr(
        attrs,
        "version_name:in:9.9.9 AND os_name:in:ios OR os_name:in:android",
      ),
    ).toBe(true);
    expect(
      matchesFilterExpr(
        { version_name: "2.4.1", os_name: "ios" },
        "(version_name:in:2.4.1 AND os_name:in:android) OR os_name:in:ios",
      ),
    ).toBe(true);
  });
});

describe("matchFraction", () => {
  it("returns 1 for an empty item list or a null filter", () => {
    expect(matchFraction([], () => ({}), "version_name:in:2.4.1")).toBe(1);
    expect(
      matchFraction(
        [{ v: "2.4.1" }, { v: "2.3.7" }],
        (item) => ({ version_name: item.v }),
        null,
      ),
    ).toBe(1);
  });

  it("returns about the share of items whose attributes match", () => {
    const items = [
      { v: "2.4.1" },
      { v: "2.4.1" },
      { v: "2.3.7" },
      { v: "2.3.7" },
    ];
    const fraction = matchFraction(
      items,
      (item) => ({ version_name: item.v }),
      "version_name:in:2.4.1",
    );
    expect(fraction).toBeGreaterThan(0.3);
    expect(fraction).toBeLessThan(0.7);
  });
});

describe("sandbox path and team id", () => {
  it("recognises /sandbox and paths under it, and nothing else", () => {
    expect(isSandboxPath("/sandbox")).toBe(true);
    expect(isSandboxPath("/sandbox/overview")).toBe(true);
    expect(isSandboxPath("/sandbox/apps/some-id")).toBe(true);
    expect(isSandboxPath("/team-001/overview")).toBe(false);
    expect(isSandboxPath("/sandboxed/overview")).toBe(false);
    expect(isSandboxPath("/")).toBe(false);
  });

  it("recognises the sandbox team id", () => {
    expect(isSandboxTeamId(SANDBOX_TEAM_ID)).toBe(true);
    expect(isSandboxTeamId("sandbox")).toBe(true);
    expect(isSandboxTeamId("team-001")).toBe(false);
  });
});

describe("sandbox attachment tokens", () => {
  const vp = {
    style: "android" as const,
    width: 1080,
    height: 2400,
    unitScale: 3,
  };

  it("round-trips a token whose state names a known screen and rejects an unknown one", () => {
    const token = { vp, state: "cart", highlight: null };
    expect(decodeToken(encodeToken(token))).toEqual(token);
    expect(
      decodeToken(encodeToken({ vp, state: "nowhere", highlight: null })),
    ).toBeNull();
    expect(
      decodeToken(encodeToken({ vp, state: "nowhere:p3", highlight: null })),
    ).toBeNull();
  });

  it("answers 404 from the attachment route for an unknown screen", async () => {
    const token = encodeToken({ vp, state: "nowhere", highlight: null });
    for (const file of [`${token}.json`, `${token}.svg`]) {
      const res = await attachmentGet({} as any, {
        params: promiseParams({ token: file }),
      });
      expect(res.status).toBe(404);
    }
    const ok = await attachmentGet({} as any, {
      params: promiseParams({
        token: `${encodeToken({ vp, state: "cart", highlight: null })}.json`,
      }),
    });
    expect(ok.status).toBe(200);
  });
});
