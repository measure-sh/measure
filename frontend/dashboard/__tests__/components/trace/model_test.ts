import { describe, expect, it } from "@jest/globals";
import {
  ERROR_PALETTE,
  PreparedSpan,
  Span,
  Trace,
  getSpanColor,
  matchesSearch,
  prepareTrace,
  resolveSpanColor,
  statusLabel,
} from "@/app/components/trace/model";

const TRACE_START = "2024-01-01T00:00:00.000Z";

function makeSpan(overrides: Partial<Span> = {}): Span {
  return {
    span_name: "foo",
    span_id: "id-1",
    parent_id: "",
    status: 0,
    start_time: TRACE_START,
    end_time: "2024-01-01T00:00:01.000Z",
    duration: 1000,
    thread_name: "main",
    checkpoints: null,
    ...overrides,
  };
}

function makeTrace(spans: Span[], overrides: Partial<Trace> = {}): Trace {
  return {
    app_id: "app",
    trace_id: "trace",
    session_id: "sess",
    user_id: "user",
    start_time: TRACE_START,
    end_time: "2024-01-01T00:00:10.000Z",
    duration: 10000,
    app_version: "1.0.0",
    os_version: "android 14",
    device_model: "Pixel 8",
    device_manufacturer: "Google",
    network_type: "wifi",
    spans,
    ...overrides,
  };
}

function makePreparedSpan(overrides: Partial<PreparedSpan> = {}): PreparedSpan {
  return {
    ...makeSpan(),
    depth: 0,
    ancestorIds: [],
    ancestorColors: [],
    directChildCount: 0,
    subtreeSize: 0,
    colorKey: "id-1",
    startMs: 0,
    endMs: 1000,
    checkpoints: null,
    ...overrides,
  };
}

describe("getSpanColor", () => {
  it("returns a ThreadColor shape", () => {
    const c = getSpanColor("anything");
    expect(c).toHaveProperty("bg");
    expect(c).toHaveProperty("border");
  });

  it("is deterministic for the same input", () => {
    expect(getSpanColor("foo")).toBe(getSpanColor("foo"));
  });

  it("handles empty string", () => {
    expect(getSpanColor("")).toBeDefined();
  });

  it("returns one of the palette colours", () => {
    const c = getSpanColor("foo");
    expect(c.bg.startsWith("bg-")).toBe(true);
    expect(c.border.startsWith("border-")).toBe(true);
  });
});

describe("resolveSpanColor", () => {
  it("returns ERROR_PALETTE when status=2 and showErrorAsRed=true", () => {
    expect(resolveSpanColor({ status: 2, colorKey: "x" }, true)).toBe(
      ERROR_PALETTE,
    );
  });

  it("returns thread color when status=2 but showErrorAsRed=false", () => {
    expect(resolveSpanColor({ status: 2, colorKey: "x" }, false)).not.toBe(
      ERROR_PALETTE,
    );
  });

  it("returns thread color for non-error statuses", () => {
    expect(resolveSpanColor({ status: 0, colorKey: "x" }, true)).not.toBe(
      ERROR_PALETTE,
    );
    expect(resolveSpanColor({ status: 1, colorKey: "x" }, true)).not.toBe(
      ERROR_PALETTE,
    );
  });
});

describe("statusLabel", () => {
  it.each([
    [0, "Unset"],
    [1, "Okay"],
    [2, "Error"],
    [99, "Unset"],
    [-1, "Unset"],
  ])("status %i → %s", (status, label) => {
    expect(statusLabel(status as number)).toBe(label);
  });
});

describe("prepareTrace", () => {
  it("flattens tree depth-first ordered by start time", () => {
    const trace = makeTrace([
      makeSpan({ span_id: "root", parent_id: "" }),
      makeSpan({
        span_id: "b",
        parent_id: "root",
        start_time: "2024-01-01T00:00:00.500Z",
      }),
      makeSpan({
        span_id: "a",
        parent_id: "root",
        start_time: "2024-01-01T00:00:00.100Z",
      }),
    ]);
    const { spans } = prepareTrace(trace);
    expect(spans.map((s) => s.span_id)).toEqual(["root", "a", "b"]);
  });

  it("orders multiple roots by start time", () => {
    const trace = makeTrace([
      makeSpan({
        span_id: "r2",
        parent_id: "",
        start_time: "2024-01-01T00:00:01.000Z",
      }),
      makeSpan({
        span_id: "r1",
        parent_id: "",
        start_time: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    const { spans } = prepareTrace(trace);
    expect(spans.map((s) => s.span_id)).toEqual(["r1", "r2"]);
  });

  it("computes depth from parent chain", () => {
    const trace = makeTrace([
      makeSpan({ span_id: "root", parent_id: "" }),
      makeSpan({ span_id: "child", parent_id: "root" }),
      makeSpan({ span_id: "grandchild", parent_id: "child" }),
    ]);
    const { byId } = prepareTrace(trace);
    expect(byId.get("root")!.depth).toBe(0);
    expect(byId.get("child")!.depth).toBe(1);
    expect(byId.get("grandchild")!.depth).toBe(2);
  });

  it("computes ancestorIds from root downward", () => {
    const trace = makeTrace([
      makeSpan({ span_id: "root", parent_id: "" }),
      makeSpan({ span_id: "child", parent_id: "root" }),
      makeSpan({ span_id: "grandchild", parent_id: "child" }),
    ]);
    const { byId } = prepareTrace(trace);
    expect(byId.get("root")!.ancestorIds).toEqual([]);
    expect(byId.get("child")!.ancestorIds).toEqual(["root"]);
    expect(byId.get("grandchild")!.ancestorIds).toEqual(["root", "child"]);
  });

  it("ancestorColors has the same length as ancestorIds", () => {
    const trace = makeTrace([
      makeSpan({ span_id: "root", parent_id: "" }),
      makeSpan({ span_id: "child", parent_id: "root" }),
      makeSpan({ span_id: "grandchild", parent_id: "child" }),
    ]);
    const { byId } = prepareTrace(trace);
    expect(byId.get("grandchild")!.ancestorColors).toHaveLength(2);
  });

  it("colorKey: root + depth-1 spans use their own span_id", () => {
    const trace = makeTrace([
      makeSpan({ span_id: "root", parent_id: "" }),
      makeSpan({ span_id: "d1a", parent_id: "root" }),
      makeSpan({ span_id: "d1b", parent_id: "root" }),
    ]);
    const { byId } = prepareTrace(trace);
    expect(byId.get("root")!.colorKey).toBe("root");
    expect(byId.get("d1a")!.colorKey).toBe("d1a");
    expect(byId.get("d1b")!.colorKey).toBe("d1b");
  });

  it("colorKey: depth-2+ spans inherit their depth-1 ancestor's id", () => {
    const trace = makeTrace([
      makeSpan({ span_id: "root", parent_id: "" }),
      makeSpan({ span_id: "d1", parent_id: "root" }),
      makeSpan({ span_id: "d2", parent_id: "d1" }),
      makeSpan({ span_id: "d3", parent_id: "d2" }),
    ]);
    const { byId } = prepareTrace(trace);
    expect(byId.get("d2")!.colorKey).toBe("d1");
    expect(byId.get("d3")!.colorKey).toBe("d1");
  });

  it("startMs / endMs are relative to trace start", () => {
    const trace = makeTrace([
      makeSpan({
        span_id: "s",
        start_time: "2024-01-01T00:00:00.250Z",
        end_time: "2024-01-01T00:00:00.750Z",
      }),
    ]);
    const { byId } = prepareTrace(trace);
    expect(byId.get("s")!.startMs).toBe(250);
    expect(byId.get("s")!.endMs).toBe(750);
  });

  it("computes startMs for checkpoints relative to trace start", () => {
    const trace = makeTrace([
      makeSpan({
        span_id: "s",
        checkpoints: [
          { name: "cp1", timestamp: "2024-01-01T00:00:00.300Z" },
          { name: "cp2", timestamp: "2024-01-01T00:00:00.700Z" },
        ],
      }),
    ]);
    const { byId } = prepareTrace(trace);
    const cps = byId.get("s")!.checkpoints!;
    expect(cps[0].startMs).toBe(300);
    expect(cps[1].startMs).toBe(700);
  });

  it("preserves null checkpoints", () => {
    const trace = makeTrace([makeSpan({ span_id: "s", checkpoints: null })]);
    expect(prepareTrace(trace).byId.get("s")!.checkpoints).toBeNull();
  });

  it("errorSpanIds contains only spans with status=2 in order", () => {
    const trace = makeTrace([
      makeSpan({ span_id: "a", status: 0 }),
      makeSpan({
        span_id: "b",
        status: 2,
        start_time: "2024-01-01T00:00:00.100Z",
      }),
      makeSpan({ span_id: "c", status: 1 }),
      makeSpan({
        span_id: "d",
        status: 2,
        start_time: "2024-01-01T00:00:00.200Z",
      }),
    ]);
    expect(prepareTrace(trace).errorSpanIds).toEqual(["b", "d"]);
  });

  it("computes directChildCount and subtreeSize", () => {
    const trace = makeTrace([
      makeSpan({ span_id: "root", parent_id: "" }),
      makeSpan({ span_id: "c1", parent_id: "root" }),
      makeSpan({ span_id: "c2", parent_id: "root" }),
      makeSpan({ span_id: "c1a", parent_id: "c1" }),
    ]);
    const { byId } = prepareTrace(trace);
    expect(byId.get("root")!.directChildCount).toBe(2);
    expect(byId.get("root")!.subtreeSize).toBe(3);
    expect(byId.get("c1")!.directChildCount).toBe(1);
    expect(byId.get("c1")!.subtreeSize).toBe(1);
    expect(byId.get("c2")!.directChildCount).toBe(0);
    expect(byId.get("c2")!.subtreeSize).toBe(0);
  });

  it("byId contains every span", () => {
    const trace = makeTrace([
      makeSpan({ span_id: "a", parent_id: "" }),
      makeSpan({ span_id: "b", parent_id: "a" }),
    ]);
    const { byId } = prepareTrace(trace);
    expect(byId.size).toBe(2);
    expect(byId.get("a")).toBeDefined();
    expect(byId.get("b")).toBeDefined();
  });

  it("handles a single root with no children", () => {
    const trace = makeTrace([makeSpan({ span_id: "solo", parent_id: "" })]);
    const { spans, byId, errorSpanIds } = prepareTrace(trace);
    expect(spans).toHaveLength(1);
    expect(byId.size).toBe(1);
    expect(errorSpanIds).toEqual([]);
  });
});

describe("matchesSearch", () => {
  it("returns false for an empty query", () => {
    expect(matchesSearch(makePreparedSpan(), "")).toBe(false);
  });

  it("matches span_name case-insensitively", () => {
    const span = makePreparedSpan({ span_name: "CheckoutFlow" });
    expect(matchesSearch(span, "checkout")).toBe(true);
    expect(matchesSearch(span, "FLOW")).toBe(true);
  });

  it("matches thread_name", () => {
    const span = makePreparedSpan({ thread_name: "okhttp" });
    expect(matchesSearch(span, "http")).toBe(true);
  });

  it("matches user_defined_attribute key", () => {
    const span = makePreparedSpan({
      user_defined_attributes: { endpoint: "/api/payments" },
    });
    expect(matchesSearch(span, "endpoint")).toBe(true);
  });

  it("matches user_defined_attribute value", () => {
    const span = makePreparedSpan({
      user_defined_attributes: { endpoint: "/api/payments" },
    });
    expect(matchesSearch(span, "/api")).toBe(true);
  });

  it("matches numeric attribute value as string", () => {
    const span = makePreparedSpan({
      user_defined_attributes: { latency_ms: 1234 },
    });
    expect(matchesSearch(span, "1234")).toBe(true);
  });

  it("ignores null attribute values", () => {
    const span = makePreparedSpan({
      user_defined_attributes: { maybe: null },
    });
    expect(matchesSearch(span, "null")).toBe(false);
  });

  it("matches checkpoint name", () => {
    const span = makePreparedSpan({
      checkpoints: [
        { name: "request_sent", timestamp: TRACE_START, startMs: 0 },
      ],
    });
    expect(matchesSearch(span, "request")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchesSearch(makePreparedSpan(), "nothing-matches")).toBe(false);
  });
});
