import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const mockFetch = jest.fn();
jest.mock("@/app/api/api_client", () => ({
  apiClient: { fetch: (...args: unknown[]) => mockFetch(...args) },
}));
jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn() },
}));

import {
  fetchMemoryUsagePlotFromServer,
  fetchMemoryUsageBreakdownFromServer,
  fetchHighMemoryUsageSessionsFromServer,
  type MemoryAppImportance,
  type MemoryUsagePlotPoint,
  type MemoryUsageBreakdownRow,
} from "@/app/api/api_calls";

const spec = parse(fs.readFileSync("content/openapi/dashboard.yaml", "utf8"));
const routes = fs.readFileSync(
  path.resolve("../../backend/api/main.go"),
  "utf8",
);
const from = "2026-04-01T00:00:00.000Z";
const to = "2026-04-10T00:00:00.000Z";
const expression = "version_name:in:1.2.3 AND device_total_memory:in:5-6gb";
const trend: MemoryUsagePlotPoint = {
  version: "1.2.3 (42)",
  datetime: "2026-04-01",
  p50: 102400,
  p90: 204800,
  p95: 307200,
  p99: 409600,
  sample_count: 1200,
};
const tier: MemoryUsageBreakdownRow = {
  device_total_memory_tier: "5-6gb",
  p50: 102400,
  p90: 204800,
  p95: 307200,
  session_count: 30,
  sample_count: 1200,
};
const panels = [
  {
    route: "plots/usage",
    handler: "GetMemoryUsagePlot",
    fetch: fetchMemoryUsagePlotFromServer,
    body: [trend],
    schema: "MemoryUsagePlotPoint",
  },
  {
    route: "plots/breakdown",
    handler: "GetMemoryUsageBreakdown",
    fetch: fetchMemoryUsageBreakdownFromServer,
    body: [tier],
    schema: "MemoryUsageBreakdownRow",
  },
];

beforeEach(() => jest.clearAllMocks());

function respond(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body,
  });
}
function lastUrl() {
  return new URL(String(mockFetch.mock.calls.at(-1)![0]), "http://localhost");
}

it.each(panels)(
  "keeps $route aligned across client, route and OpenAPI",
  async (panel) => {
    respond(panel.body);
    expect(
      await panel.fetch("app-a", from, to, expression, "background"),
    ).toEqual(panel.body);
    const url = lastUrl();
    expect(url.pathname).toBe(`/api/apps/app-a/memory/${panel.route}`);
    expect(url.searchParams.get("from")).toBe(from);
    expect(url.searchParams.get("to")).toBe(to);
    expect(url.searchParams.get("filter_expr")).toBe(expression);
    expect(url.searchParams.get("app_importance")).toBe("background");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    expect(url.searchParams.get("plot_time_group")).toBe(
      panel.route === "plots/usage" ? "days" : null,
    );
    expect(routes).toContain(
      `apps.GET(":id/memory/${panel.route}", hdl.${panel.handler})`,
    );
    const operation = spec.paths[`/apps/{id}/memory/${panel.route}`].get;
    expect(operation.operationId).toBe(
      panel.handler[0].toLowerCase() + panel.handler.slice(1),
    );
    expect(
      operation.responses["200"].content["application/json"].schema.items.$ref,
    ).toBe(`#/components/schemas/${panel.schema}`);
    expect(
      Object.keys(spec.components.schemas[panel.schema].properties).sort(),
    ).toEqual(Object.keys(panel.body[0]).sort());
  },
);

it.each(panels)(
  "preserves empty responses and omits Android state for $route on iOS",
  async (panel) => {
    for (const body of [null, []]) {
      respond(body);
      expect(await panel.fetch("app-a", from, to, null)).toEqual(body);
      expect(lastUrl().searchParams.has("app_importance")).toBe(false);
      expect(lastUrl().searchParams.has("filter_expr")).toBe(false);
    }
  },
);

it("keeps high-memory sessions pagination and defaults aligned with the API", async () => {
  for (const importance of [
    undefined,
    "foreground",
    "user_service",
    "background",
  ] as (MemoryAppImportance | undefined)[]) {
    const body = { results: null, meta: { next: false, previous: false } };
    respond(body);
    expect(
      await fetchHighMemoryUsageSessionsFromServer(
        "app-a",
        from,
        to,
        expression,
        5,
        10,
        importance,
      ),
    ).toEqual(body);
    const url = lastUrl();
    expect(url.pathname).toBe("/api/apps/app-a/memory/sessions/high-usage");
    expect(url.searchParams.get("filter_expr")).toBe(expression);
    expect(url.searchParams.get("app_importance")).toBe(importance ?? null);
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("offset")).toBe("10");
    expect(url.searchParams.has("plot_time_group")).toBe(false);
  }
  expect(routes).toContain(
    'apps.GET(":id/memory/sessions/high-usage", hdl.GetHighMemoryUsageSessions)',
  );
  const operation = spec.paths["/apps/{id}/memory/sessions/high-usage"].get;
  expect(operation.operationId).toBe("getHighMemoryUsageSessions");
  expect(
    operation.responses["200"].content["application/json"].schema.$ref,
  ).toBe("#/components/schemas/HighMemoryUsageSessionsResponse");
});
