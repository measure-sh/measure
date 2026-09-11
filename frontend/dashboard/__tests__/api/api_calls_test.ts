import { beforeEach, describe, expect, it } from "@jest/globals";

// Mock posthog (imported transitively by api_client)
jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn() },
}));

// Mock api_client.apiClient.fetch so api_calls functions don't touch the
// network. Each test stages its own response via `mockApiClientFetch`.
const mockApiClientFetch = jest.fn();
jest.mock("@/app/api/api_client", () => ({
  __esModule: true,
  apiClient: {
    fetch: (...args: any[]) => mockApiClientFetch(...args),
  },
  ApiClient: class {},
}));

// Full-page navigation goes through the navigation module because jsdom's
// window.location can't be stubbed; mock it to observe the download redirect.
jest.mock("@/app/utils/navigation", () => ({
  navigateTo: jest.fn(),
  reloadPage: jest.fn(),
}));

import {
  changeAppApiKeyFromServer,
  changeAppNameFromServer,
  changeRoleFromServer,
  changeTeamNameFromServer,
  createAppFromServer,
  createTeamFromServer,
  downgradeToFreeFromServer,
  downloadBuildFile,
  undoDowngradeFromServer,
  fetchAlertsOverviewFromServer,
  fetchAppRetentionFromServer,
  fetchAppsFromServer,
  fetchAppThresholdPrefsFromServer,
  fetchAuthzAndMembersFromServer,
  fetchBillingInfoFromServer,
  fetchBugReportFromServer,
  fetchBugReportsOverviewFromServer,
  fetchBugReportsOverviewPlotFromServer,
  fetchBuildsFromServer,
  fetchErrorGroupCommonPathFromServer,
  fetchErrorsDetailsFromServer,
  fetchErrorsDetailsPlotFromServer,
  fetchErrorsDistributionPlotFromServer,
  fetchErrorsOverviewFromServer,
  fetchErrorsOverviewPlotFromServer,
  fetchCheckoutSessionFromServer,
  fetchCustomerPortalUrlFromServer,
  fetchJourneyFromServer,
  fetchMetricsFromServer,
  fetchNetworkEndpointStatusCodesPlotFromServer,
  fetchNetworkLatencyPlotFromServer,
  fetchNetworkStatusCodesPlotFromServer,
  fetchNetworkEndpointsFromServer,
  fetchNetworkTimelinePlotFromServer,
  fetchNetworkTrendsFromServer,
  fetchNotifPrefsFromServer,
  fetchPendingInvitesFromServer,
  fetchRootSpanNamesFromServer,
  fetchSdkConfigFromServer,
  fetchAppHealthPlotFromServer,
  fetchSessionReplayFromServer,
  fetchSessionReplayOverviewFromServer,
  fetchSessionReplayOverviewPlotFromServer,
  fetchSpanMetricsPlotFromServer,
  fetchSpansFromServer,
  fetchTeamsFromServer,
  fetchTeamSlackConnectUrlFromServer,
  fetchTeamSlackStatusFromServer,
  fetchTraceFromServer,
  fetchUsageFromServer,
  inviteMemberFromServer,
  JourneyType,
  removeMemberFromServer,
  removePendingInviteFromServer,
  resendPendingInviteFromServer,
  SdkConfig,
  sendTestSlackAlertFromServer,
  updateAppRetentionFromServer,
  updateAppThresholdPrefsFromServer,
  updateBugReportStatusFromServer,
  updateNotifPrefsFromServer,
  updateSdkConfigFromServer,
  updateTeamSlackStatusFromServer,
  validateInvitesFromServer,
} from "@/app/api/api_calls";
import { ApiError, RequestError } from "@/app/api/api_error";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

// ---- Helpers ------------------------------------------------------------

function mockResponse(
  ok: boolean,
  status: number,
  body: any = {},
): { ok: boolean; status: number; json: () => Promise<any> } {
  return {
    ok,
    status,
    json: async () => body,
  };
}

function successResponse(body: any = {}) {
  return mockResponse(true, 200, body);
}

function errorResponse(status: number = 500, body: any = {}) {
  return mockResponse(false, status, body);
}

const isoFrom = "2026-04-01T00:00:00.000Z";
const isoTo = "2026-04-10T00:00:00.000Z";

// Resolve the most recent fetch call's URL as a string, regardless of
// whether apiClient.fetch was called with a string, URL, or Request.
function lastFetchUrl(): string {
  const call =
    mockApiClientFetch.mock.calls[mockApiClientFetch.mock.calls.length - 1];
  return String(call[0]);
}

function lastFetchOpts(): any {
  const call =
    mockApiClientFetch.mock.calls[mockApiClientFetch.mock.calls.length - 1];
  return call[1];
}

beforeEach(() => {
  mockApiClientFetch.mockReset();
});

// ========================================================================
// Simple GETs (no filters involved)
// ========================================================================
describe("simple GET helpers", () => {
  describe("fetchTeamsFromServer", () => {
    it("hits /api/teams and returns the body", async () => {
      const data = [{ id: "t1", name: "Team 1" }];
      mockApiClientFetch.mockResolvedValueOnce(successResponse(data));
      const result = await fetchTeamsFromServer();
      expect(lastFetchUrl()).toBe("/api/teams");
      expect(result).toEqual(data);
    });

    it("throws on non-ok response", async () => {
      mockApiClientFetch.mockResolvedValueOnce(errorResponse());
      await expect(fetchTeamsFromServer()).rejects.toThrow(ApiError);
    });

    it("throws on exception", async () => {
      mockApiClientFetch.mockRejectedValueOnce(new Error("boom"));
      await expect(fetchTeamsFromServer()).rejects.toThrow(RequestError);
    });
  });

  describe("fetchAppsFromServer", () => {
    it("returns the body on 200", async () => {
      mockApiClientFetch.mockResolvedValueOnce(successResponse([{ id: "a1" }]));
      const result = await fetchAppsFromServer("team-1");
      expect(lastFetchUrl()).toBe("/api/teams/team-1/apps");
      expect(result).toEqual([{ id: "a1" }]);
    });

    it("returns an empty list on 404", async () => {
      mockApiClientFetch.mockResolvedValueOnce(errorResponse(404));
      const result = await fetchAppsFromServer("team-1");
      expect(result).toEqual([]);
    });

    it("throws on other non-ok statuses", async () => {
      mockApiClientFetch.mockResolvedValueOnce(errorResponse(500));
      await expect(fetchAppsFromServer("team-1")).rejects.toThrow(ApiError);
    });

    it("throws on exception", async () => {
      mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
      await expect(fetchAppsFromServer("team-1")).rejects.toThrow(RequestError);
    });
  });

  describe("fetchRootSpanNamesFromServer", () => {
    const app = { id: "app-1" } as any;

    it("hits /spans/roots/names and returns the names", async () => {
      mockApiClientFetch.mockResolvedValueOnce(
        successResponse({ results: ["main", "db"] }),
      );
      const result = await fetchRootSpanNamesFromServer(app);
      expect(lastFetchUrl()).toBe("/api/apps/app-1/spans/roots/names");
      expect(result).toEqual(["main", "db"]);
    });

    it("returns null when the app has never reported a trace", async () => {
      mockApiClientFetch.mockResolvedValueOnce(
        successResponse({ results: null }),
      );
      const result = await fetchRootSpanNamesFromServer(app);
      expect(result).toBeNull();
    });

    it("keeps an empty results list distinct from a null one", async () => {
      mockApiClientFetch.mockResolvedValueOnce(
        successResponse({ results: [] }),
      );
      const result = await fetchRootSpanNamesFromServer(app);
      expect(result).toEqual([]);
    });

    it("throws on non-ok", async () => {
      mockApiClientFetch.mockResolvedValueOnce(errorResponse());
      await expect(fetchRootSpanNamesFromServer(app)).rejects.toThrow(ApiError);
    });

    it("throws a RequestError when the body is missing altogether", async () => {
      mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
      const err = await fetchRootSpanNamesFromServer(app).catch((e) => e);
      expect(err).toBeInstanceOf(RequestError);
      expect(err.message).toBe("Failed to fetch root span names");
    });

    it("throws on exception", async () => {
      mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
      await expect(fetchRootSpanNamesFromServer(app)).rejects.toThrow(
        RequestError,
      );
    });
  });

  describe("fetchTraceFromServer", () => {
    it("hits /api/apps/{appId}/traces/{traceId}", async () => {
      mockApiClientFetch.mockResolvedValueOnce(
        successResponse({ trace_id: "t1" }),
      );
      const result = await fetchTraceFromServer("app-1", "t1");
      expect(lastFetchUrl()).toBe("/api/apps/app-1/traces/t1");
      expect(result).toEqual({ trace_id: "t1" });
    });

    it("throws on non-ok", async () => {
      mockApiClientFetch.mockResolvedValueOnce(errorResponse());
      await expect(fetchTraceFromServer("a", "t")).rejects.toThrow(ApiError);
    });

    it("throws on exception", async () => {
      mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
      await expect(fetchTraceFromServer("a", "t")).rejects.toThrow(
        RequestError,
      );
    });
  });
});

describe("fetchMetricsFromServer", () => {
  const call = (filterExpr: string | null = null) =>
    fetchMetricsFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
    );

  it("sends the range and timezone in the URL", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ metric: 1 }));
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/metrics");
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    expect(url.searchParams.has("filter_expr")).toBe(false);
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await call("version_name:in:[1.2.0]");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe("version_name:in:[1.2.0]");
  });

  it("returns data, throws on failure", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ a: 1 }));
    expect(await call()).toEqual({ a: 1 });

    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);

    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

describe("fetchSessionReplayOverviewFromServer", () => {
  const call = (filterExpr: string | null = null) =>
    fetchSessionReplayOverviewFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
      5,
      10,
    );

  it("sends the range, timezone and page in the URL", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/sessions");
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("offset")).toBe("10");
    expect(url.searchParams.has("filter_expr")).toBe(false);
    expect(url.searchParams.has("type")).toBe(false);
    expect(url.searchParams.has("free_text")).toBe(false);
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await call("session_events:in:fatal_error");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe(
      "session_events:in:fatal_error",
    );
  });

  it("returns data, throws on failure", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ a: 1 }));
    expect(await call()).toEqual({ a: 1 });

    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);

    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

describe("fetchSessionReplayOverviewPlotFromServer", () => {
  const call = (filterExpr: string | null = null) =>
    fetchSessionReplayOverviewPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
    );

  it("sends the range, timezone and time group in the URL", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/sessions/plots/instances");
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    // A nine day range buckets by day.
    expect(url.searchParams.get("plot_time_group")).toBe("days");
    expect(url.searchParams.has("filter_expr")).toBe(false);
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await call("session_events:in:fatal_error");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe(
      "session_events:in:fatal_error",
    );
  });

  it("returns null when response data is null", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    expect(await call()).toBeNull();
  });

  it("returns data, throws on failure", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([{ id: "v1" }]));
    expect(await call()).toEqual([{ id: "v1" }]);

    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);

    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

// ========================================================================
// fetchJourneyFromServer
// ========================================================================
describe("fetchJourneyFromServer", () => {
  const call = (filterExpr: string | null = null) =>
    fetchJourneyFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
    );

  it("sends the range and timezone in the URL", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/journey");
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    expect(url.searchParams.has("filter_expr")).toBe(false);
    expect(url.searchParams.has("bigraph")).toBe(false);
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await call("version_name:in:1.2.0");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe("version_name:in:1.2.0");
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

// ========================================================================
// fetchAppHealthPlotFromServer — single /health/plots/instances fetch
// ========================================================================
describe("fetchAppHealthPlotFromServer", () => {
  it("maps the three server series to display series", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse([
        { id: "sessions", data: [{ datetime: "2026-01-01", instances: 100 }] },
        { id: "crashes", data: [{ datetime: "2026-01-01", instances: 10 }] },
        { id: "anrs", data: [{ datetime: "2026-01-01", instances: 1 }] },
      ]),
    );

    const r = await fetchAppHealthPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      null,
    );
    expect(r?.map((s: any) => s.id)).toEqual(["Sessions", "Crashes", "ANRs"]);
  });

  it("sends the range, timezone and time group in the URL", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    await fetchAppHealthPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      null,
    );
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/health/plots/instances");
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    expect(url.searchParams.get("plot_time_group")).toBe("days");
    expect(url.searchParams.has("filter_expr")).toBe(false);
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    await fetchAppHealthPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      "version_name:in:[1.2.0]",
    );
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe("version_name:in:[1.2.0]");
  });

  it("throws when the fetch returns a non-ok response", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(
      fetchAppHealthPlotFromServer(
        "app-a",
        "2026-04-01T00:00:00.000Z",
        "2026-04-10T00:00:00.000Z",
        null,
      ),
    ).rejects.toThrow(ApiError);
  });

  it("returns null when the response body is null", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    const r = await fetchAppHealthPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      null,
    );
    expect(r).toBeNull();
  });

  it("returns null when every series value is zero", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse([
        { id: "sessions", data: [{ datetime: "2026-01-01", instances: 0 }] },
        { id: "crashes", data: [{ datetime: "2026-01-01", instances: 0 }] },
        { id: "anrs", data: [{ datetime: "2026-01-01", instances: 0 }] },
      ]),
    );
    const r = await fetchAppHealthPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      null,
    );
    expect(r).toBeNull();
  });

  it("drops the ANRs series when all ANR values are zero", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse([
        { id: "sessions", data: [{ datetime: "2026-01-01", instances: 100 }] },
        { id: "crashes", data: [{ datetime: "2026-01-01", instances: 10 }] },
        { id: "anrs", data: [{ datetime: "2026-01-01", instances: 0 }] },
      ]),
    );
    const r = await fetchAppHealthPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      null,
    );
    expect(r?.map((s: any) => s.id)).toEqual(["Sessions", "Crashes"]);
  });

  it("treats null instances as zero", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse([
        {
          id: "sessions",
          data: [
            { datetime: "2026-01-01", instances: null },
            { datetime: "2026-01-02", instances: 100 },
          ],
        },
        { id: "crashes", data: [] },
        { id: "anrs", data: [] },
      ]),
    );
    const r = await fetchAppHealthPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      null,
    );
    const sessions = r?.find((s: any) => s.id === "Sessions");
    expect(sessions?.data.map((p: any) => p.y)).toEqual([0, 100]);
  });

  it("keeps a series with a single data point", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse([
        { id: "sessions", data: [{ datetime: "2026-01-01", instances: 500 }] },
        { id: "crashes", data: [{ datetime: "2026-01-01", instances: 5 }] },
        { id: "anrs", data: [{ datetime: "2026-01-01", instances: 1 }] },
      ]),
    );
    const r = await fetchAppHealthPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      null,
    );
    expect(r).toHaveLength(3);
    for (const series of r!) {
      expect(series.data).toHaveLength(1);
    }
    expect(r![0].data[0]).toMatchObject({ x: "2026-01-01", y: 500 });
  });

  it("aligns all series on the sorted union of dates, zero-filling gaps", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse([
        {
          id: "sessions",
          data: [
            { datetime: "2026-01-01", instances: 100 },
            { datetime: "2026-01-02", instances: 200 },
          ],
        },
        {
          id: "crashes",
          data: [
            { datetime: "2026-01-01", instances: 5 },
            { datetime: "2026-01-02", instances: 7 },
            { datetime: "2026-01-03", instances: 3 },
          ],
        },
        { id: "anrs", data: [{ datetime: "2026-01-02", instances: 1 }] },
      ]),
    );
    const r = await fetchAppHealthPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      null,
    );
    // Three unique dates exist across the series, so every series is padded
    // to three points with zeroes where it had no data.
    for (const series of r!) {
      expect(series.data.map((p: any) => p.x)).toEqual([
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
      ]);
    }
    const sessions = r!.find((s: any) => s.id === "Sessions");
    const anrs = r!.find((s: any) => s.id === "ANRs");
    expect(sessions!.data.map((p: any) => p.y)).toEqual([100, 200, 0]);
    expect(anrs!.data.map((p: any) => p.y)).toEqual([0, 1, 0]);
  });
});

// ========================================================================
// Network endpoint fetches
// ========================================================================
describe("network endpoint fetches", () => {
  const from = isoFrom;
  const to = isoTo;
  const scoped = ["example.com", "/api/users"] as const;

  it("fetchNetworkEndpointsFromServer hits /networkRequests/endpoints and returns them", async () => {
    const results = [{ domain: "example.com", path_pattern: "/v1/users/*" }];
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results }));
    const r = await fetchNetworkEndpointsFromServer(
      "app-a",
      from,
      to,
      null,
      "users",
    );
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/networkRequests/endpoints");
    expect(url.searchParams.get("from")).toBe(from);
    expect(url.searchParams.get("to")).toBe(to);
    expect(url.searchParams.get("timezone")).toBeTruthy();
    expect(url.searchParams.get("query")).toBe("users");
    expect(url.searchParams.has("filter_expr")).toBe(false);
    expect(r).toEqual(results);
  });

  it("fetchNetworkEndpointsFromServer forwards a cancellation signal", async () => {
    const controller = new AbortController();
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));

    await fetchNetworkEndpointsFromServer(
      "app-a",
      from,
      to,
      null,
      "users",
      controller.signal,
    );

    expect(mockApiClientFetch.mock.calls[0][1]).toMatchObject({
      signal: controller.signal,
    });
  });

  it("fetchNetworkEndpointsFromServer sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchNetworkEndpointsFromServer(
      "app-a",
      from,
      to,
      "http_method:in:get",
      "users",
    );

    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe("http_method:in:get");
  });

  it("fetchNetworkEndpointsFromServer omits an empty query and tolerates no results", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ results: null }),
    );
    const r = await fetchNetworkEndpointsFromServer(
      "app-a",
      from,
      to,
      null,
      "",
    );
    expect(lastFetchUrl()).not.toContain("query=");
    expect(r).toEqual([]);
  });

  it("fetchNetworkLatencyPlotFromServer uses the latency path and sends the scope", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ points: [1] }));
    const r = await fetchNetworkLatencyPlotFromServer(
      "app-a",
      from,
      to,
      "http_method:in:post",
      ...scoped,
    );
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/networkRequests/plots/latency");
    expect(url.searchParams.get("domain")).toBe("example.com");
    expect(url.searchParams.get("path")).toBe("/api/users");
    expect(url.searchParams.get("filter_expr")).toBe("http_method:in:post");
    expect(url.searchParams.get("plot_time_group")).toBe("days");
    expect(r).toEqual({ points: [1] });
  });

  it("fetchNetworkEndpointStatusCodesPlotFromServer uses the endpointStatusCodes path and returns the body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ status_codes: [200], data_points: [{ count_200: 1 }] }),
    );
    const r = await fetchNetworkEndpointStatusCodesPlotFromServer(
      "app-a",
      from,
      to,
      null,
      ...scoped,
    );
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe(
      "/api/apps/app-a/networkRequests/plots/endpointStatusCodes",
    );
    expect(url.searchParams.get("domain")).toBe("example.com");
    expect(url.searchParams.get("path")).toBe("/api/users");
    expect(url.searchParams.get("plot_time_group")).toBe("days");
    expect(r).toEqual({ status_codes: [200], data_points: [{ count_200: 1 }] });
  });

  it("fetchNetworkStatusCodesPlotFromServer sends an empty scope for every endpoint", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([{ code: 200 }]));
    await fetchNetworkStatusCodesPlotFromServer(
      "app-a",
      from,
      to,
      null,
      "",
      "",
    );
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe(
      "/api/apps/app-a/networkRequests/plots/statusCodes",
    );
    expect(url.searchParams.get("domain")).toBe("");
    expect(url.searchParams.get("path")).toBe("");
    expect(url.searchParams.get("plot_time_group")).toBe("days");
  });

  it("fetchNetworkTimelinePlotFromServer uses the timeline path and returns the points", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ points: [{ t: 1 }] }),
    );
    const r = await fetchNetworkTimelinePlotFromServer(
      "app-a",
      from,
      to,
      null,
      ...scoped,
    );
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/networkRequests/plots/timeline");
    expect(url.searchParams.has("plot_time_group")).toBe(false);
    expect(r).toEqual({ points: [{ t: 1 }] });
  });

  it("fetchNetworkTrendsFromServer uses /networkRequests/trends with trends_limit and throws on failure", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchNetworkTrendsFromServer("app-a", from, to, null, 15);
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/networkRequests/trends");
    expect(url.searchParams.get("trends_limit")).toBe("15");

    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(
      fetchNetworkTrendsFromServer("app-a", from, to, null, 10),
    ).rejects.toThrow(ApiError);

    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(
      fetchNetworkTrendsFromServer("app-a", from, to, null, 10),
    ).rejects.toThrow(RequestError);
  });
});

// ========================================================================
// Sessions / bug reports / alerts
// ========================================================================
describe("sessions, bug reports, alerts", () => {
  it("fetchSessionReplayFromServer hits /sessions/{sessionId}", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ session: {} }));
    await fetchSessionReplayFromServer("app-1", "sess-1");
    expect(lastFetchUrl()).toBe("/api/apps/app-1/sessions/sess-1");
  });

  it("fetchBugReportFromServer returns the body on 200", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ bug: {} }));
    const r = await fetchBugReportFromServer("app-1", "bug-1");
    expect(lastFetchUrl()).toContain("/api/apps/app-1/bugReports/bug-1");
    expect(r).toEqual({ bug: {} });
  });

  it("updateBugReportStatusFromServer PATCHes with new status", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await updateBugReportStatusFromServer("app-1", "bug-1", 1);
    expect(lastFetchUrl()).toContain("/api/apps/app-1/bugReports/bug-1");
    expect(lastFetchOpts().method).toBe("PATCH");
  });

  it("fetchAlertsOverviewFromServer hits /alerts with the range and pagination", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchAlertsOverviewFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      20,
      0,
    );
    const url = lastFetchUrl();
    expect(url).toContain("/api/apps/app-a/alerts");
    expect(url).toContain("from=");
    expect(url).toContain("to=");
    expect(url).toContain("limit=20");
    expect(url).toContain("offset=0");
  });

  it("fetchBuildsFromServer hits /builds with the range, expression and pagination", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchBuildsFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      "version_name:in:v1",
      10,
      20,
    );
    const url = lastFetchUrl();
    expect(url).toContain("/api/apps/app-a/builds");
    expect(url).toContain("from=");
    expect(url).toContain("to=");
    expect(url).toContain(
      `filter_expr=${encodeURIComponent("version_name:in:v1")}`,
    );
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=20");
  });

  it("fetchBuildsFromServer omits filter_expr when there is none", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchBuildsFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      null,
      10,
      0,
    );
    expect(lastFetchUrl()).not.toContain("filter_expr");
  });

  it("fetchBuildsFromServer throws on a non-ok response", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(
      fetchBuildsFromServer(
        "app-a",
        "2026-04-01T00:00:00.000Z",
        "2026-04-10T00:00:00.000Z",
        null,
        10,
        0,
      ),
    ).rejects.toThrow(ApiError);
  });

  it("fetchBuildsFromServer throws when the request throws", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("boom"));
    await expect(
      fetchBuildsFromServer(
        "app-a",
        "2026-04-01T00:00:00.000Z",
        "2026-04-10T00:00:00.000Z",
        null,
        10,
        0,
      ),
    ).rejects.toThrow(RequestError);
  });
});

// ========================================================================
// downloadBuildFile
// ========================================================================
describe("downloadBuildFile", () => {
  const assignMock = jest.requireMock<typeof import("@/app/utils/navigation")>(
    "@/app/utils/navigation",
  ).navigateTo as jest.Mock;

  it("refreshes the session through apiClient before navigating", async () => {
    assignMock.mockClear();
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await downloadBuildFile("/api/apps/app-a/builds/b-1/download");
    expect(lastFetchUrl()).toBe("/api/auth/session");
    expect(assignMock).toHaveBeenCalledWith(
      "/api/apps/app-a/builds/b-1/download",
    );
  });

  it("navigates even when the session touch fails", async () => {
    // A thrown probe is a network failure, not an auth failure: the
    // session state is unknown rather than known-dead, so the download
    // is still attempted; the worst case is a retryable failure.
    assignMock.mockClear();
    mockApiClientFetch.mockRejectedValueOnce(new Error("offline"));
    await downloadBuildFile("/api/apps/app-a/builds/b-1/download");
    expect(assignMock).toHaveBeenCalledWith(
      "/api/apps/app-a/builds/b-1/download",
    );
  });

  it("does not navigate when the session is dead", async () => {
    // A non-ok probe means the refresh failed too: apiClient has already
    // started the redirect to login, and a hard navigation would override
    // it and land the browser on the api's raw 401 body.
    assignMock.mockClear();
    mockApiClientFetch.mockResolvedValueOnce(errorResponse(401));
    await downloadBuildFile("/api/apps/app-a/builds/b-1/download");
    expect(assignMock).not.toHaveBeenCalled();
  });
});

// ========================================================================
// Team management POSTs/PATCHes/DELETEs
// ========================================================================
describe("team management mutations", () => {
  describe("changeTeamNameFromServer", () => {
    it("returns the body on 200", async () => {
      mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
      const r = await changeTeamNameFromServer("t1", "New");
      expect(lastFetchOpts().method).toBe("PATCH");
      expect(JSON.parse(lastFetchOpts().body).name).toBe("New");
      expect(r).toBeUndefined();
    });

    it("throws on non-ok", async () => {
      mockApiClientFetch.mockResolvedValueOnce(errorResponse());
      await expect(changeTeamNameFromServer("t", "x")).rejects.toThrow(
        ApiError,
      );
    });

    it("throws on exception", async () => {
      mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
      await expect(changeTeamNameFromServer("t", "x")).rejects.toThrow(
        RequestError,
      );
    });
  });

  it("createTeamFromServer POSTs with name", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ id: "t1" }));
    await createTeamFromServer("Team 1");
    expect(lastFetchOpts().method).toBe("POST");
    expect(JSON.parse(lastFetchOpts().body).name).toBe("Team 1");
  });

  it("createAppFromServer POSTs with name", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ id: "a1" }));
    await createAppFromServer("team-1", "My App");
    expect(lastFetchUrl()).toContain("/api/teams/team-1/apps");
    expect(JSON.parse(lastFetchOpts().body).name).toBe("My App");
  });

  it("changeRoleFromServer PATCHes with role", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await changeRoleFromServer("t1", "admin", "m1");
    expect(lastFetchUrl()).toContain("/api/teams/t1/members/m1/role");
    expect(lastFetchOpts().method).toBe("PATCH");
  });

  it("inviteMemberFromServer POSTs invite array", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await inviteMemberFromServer("t1", "bob@example.com", "Admin");
    expect(lastFetchOpts().method).toBe("POST");
    const body = JSON.parse(lastFetchOpts().body);
    expect(body[0].email).toBe("bob@example.com");
    expect(body[0].role).toBe("admin"); // lowercased
  });

  it("inviteMemberFromServer trims the email", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await inviteMemberFromServer("t1", "  bob@example.com  ", "Admin");
    const body = JSON.parse(lastFetchOpts().body);
    expect(body[0].email).toBe("bob@example.com");
  });

  it("inviteMemberFromServer throws the server error message", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      mockResponse(false, 400, { error: "bad" }),
    );
    await expect(
      inviteMemberFromServer("t1", "x@y.z", "admin"),
    ).rejects.toThrow("bad");
  });

  it("removeMemberFromServer DELETEs", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await removeMemberFromServer("t1", "m1");
    expect(lastFetchUrl()).toContain("/api/teams/t1/members/m1");
    expect(lastFetchOpts().method).toBe("DELETE");
  });

  it("resendPendingInviteFromServer PATCHes the invite resource", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await resendPendingInviteFromServer("t1", "invite-1");
    expect(lastFetchUrl()).toContain("/api/teams/t1/invite/invite-1");
    expect(lastFetchOpts().method).toBe("PATCH");
  });

  it("removePendingInviteFromServer DELETEs", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await removePendingInviteFromServer("t1", "invite-1");
    expect(lastFetchOpts().method).toBe("DELETE");
  });

  it("fetchPendingInvitesFromServer returns the body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([{ id: "i1" }]));
    const r = await fetchPendingInvitesFromServer("t1");
    expect(lastFetchUrl()).toContain("/api/teams/t1/invites");
    expect(r).toEqual([{ id: "i1" }]);
  });

  it("fetchAuthzAndMembersFromServer returns the body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ members: [] }));
    const r = await fetchAuthzAndMembersFromServer("t1");
    expect(lastFetchUrl()).toContain("/api/teams/t1/authz");
    expect(r).toEqual({ members: [] });
  });
});

// ========================================================================
// Slack / notifications
// ========================================================================
describe("slack and notifications", () => {
  it("fetchTeamSlackConnectUrlFromServer GETs the team's connect-url endpoint", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ url: "https://slack/oauth" }),
    );
    const r = await fetchTeamSlackConnectUrlFromServer("t1");
    expect(lastFetchUrl()).toBe("/api/teams/t1/slack/connect-url");
    expect(r).toEqual({ url: "https://slack/oauth" });
  });

  it("fetchTeamSlackStatusFromServer returns the status body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ active: true }));
    const r = await fetchTeamSlackStatusFromServer("t1");
    expect(r).toEqual({ active: true });
  });

  it("updateTeamSlackStatusFromServer PATCHes with active flag", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await updateTeamSlackStatusFromServer("t1", true);
    expect(lastFetchOpts().method).toBe("PATCH");
  });

  it("sendTestSlackAlertFromServer POSTs", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await sendTestSlackAlertFromServer("t1");
    expect(lastFetchOpts().method).toBe("POST");
  });

  it("fetchNotifPrefsFromServer hits /prefs/notifPrefs", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ prefs: {} }));
    await fetchNotifPrefsFromServer();
    expect(lastFetchUrl()).toContain("/api/prefs/notifPrefs");
  });

  it("updateNotifPrefsFromServer PATCHes", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await updateNotifPrefsFromServer({} as any);
    expect(lastFetchOpts().method).toBe("PATCH");
  });
});

// ========================================================================
// App-level settings
// ========================================================================
describe("app settings", () => {
  it("fetchAppThresholdPrefsFromServer hits /thresholdPrefs", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await fetchAppThresholdPrefsFromServer("app-1");
    expect(lastFetchUrl()).toContain("/api/apps/app-1/thresholdPrefs");
  });

  it("updateAppThresholdPrefsFromServer PATCHes with body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await updateAppThresholdPrefsFromServer("app-1", {
      error_good_threshold: 1,
    } as any);
    expect(lastFetchOpts().method).toBe("PATCH");
  });

  it("fetchAppRetentionFromServer hits /retention", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await fetchAppRetentionFromServer("app-1");
    expect(lastFetchUrl()).toContain("/api/apps/app-1/retention");
  });

  it("updateAppRetentionFromServer PATCHes", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await updateAppRetentionFromServer("app-1", { retention: 90 } as any);
    expect(lastFetchOpts().method).toBe("PATCH");
  });

  it("changeAppNameFromServer PATCHes with name", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await changeAppNameFromServer("app-1", "New Name");
    expect(lastFetchOpts().method).toBe("PATCH");
    expect(JSON.parse(lastFetchOpts().body).name).toBe("New Name");
  });

  it("changeAppApiKeyFromServer PATCHes /apiKey", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await changeAppApiKeyFromServer("app-1");
    expect(lastFetchUrl()).toContain("/api/apps/app-1/apiKey");
    expect(lastFetchOpts().method).toBe("PATCH");
  });

  it("fetchSdkConfigFromServer hits /config", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await fetchSdkConfigFromServer("app-1");
    expect(lastFetchUrl()).toContain("/api/apps/app-1/config");
  });

  it("updateSdkConfigFromServer PATCHes with partial body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await updateSdkConfigFromServer("app-1", {
      crash_take_screenshot: true,
    } as Partial<SdkConfig>);
    expect(lastFetchOpts().method).toBe("PATCH");
  });
});

// ========================================================================
// Billing
// ========================================================================
describe("billing endpoints", () => {
  it("fetchBillingInfoFromServer hits /billing", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ plan: "free" }));
    await fetchBillingInfoFromServer("t1");
    expect(lastFetchUrl()).toContain("/api/teams/t1/billing");
  });

  it("fetchUsageFromServer hits /usage", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await fetchUsageFromServer("t1");
    expect(lastFetchUrl()).toContain("/api/teams/t1/usage");
  });

  it("fetchCheckoutSessionFromServer PATCHes with success URL", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ checkout_url: "https://stripe/checkout" }),
    );
    await fetchCheckoutSessionFromServer("t1", "https://ok");
    expect(lastFetchUrl()).toContain("/api/teams/t1/billing/checkout");
    expect(lastFetchOpts().method).toBe("PATCH");
    const body = JSON.parse(lastFetchOpts().body);
    expect(body.success_url).toBe("https://ok");
  });

  it("downgradeToFreeFromServer POSTs", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    const r = await downgradeToFreeFromServer("t1");
    expect(lastFetchUrl()).toContain("/api/teams/t1/billing/downgrade");
    expect(lastFetchOpts().method).toBe("PATCH");
    expect(r).toEqual({});
  });

  it("undoDowngradeFromServer PATCHes the undo-downgrade endpoint", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ status: "cancellation_reverted" }),
    );
    const r = await undoDowngradeFromServer("t1");
    expect(lastFetchUrl()).toContain("/api/teams/t1/billing/undo-downgrade");
    expect(lastFetchOpts().method).toBe("PATCH");
    expect(r).toEqual({ status: "cancellation_reverted" });
  });

  it("fetchCustomerPortalUrlFromServer POSTs with return url", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ url: "https://portal" }),
    );
    const r = await fetchCustomerPortalUrlFromServer("t1", "https://back");
    expect(lastFetchOpts().method).toBe("POST");
    const body = JSON.parse(lastFetchOpts().body);
    expect(body.return_url).toBe("https://back");
    expect(r).toEqual({ url: "https://portal" });
  });
});

// ========================================================================
// Expression-filter span fetchers
// ========================================================================
describe("fetchSpansFromServer", () => {
  const call = (filterExpr: string | null = null, spanName = "root.a") =>
    fetchSpansFromServer(
      "app-a",
      spanName,
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
      5,
      10,
    );

  it("sends the span, range, timezone and page in the URL", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/spans");
    expect(url.searchParams.get("span_name")).toBe("root.a");
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("offset")).toBe("10");
    expect(url.searchParams.has("filter_expr")).toBe(false);
  });

  it("carries a span name with reserved characters intact", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await call(null, "load & render 100%");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("span_name")).toBe("load & render 100%");
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await call("span_status:in:error");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe("span_status:in:error");
  });

  it("returns data, throws on failure", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ a: 1 }));
    expect(await call()).toEqual({ a: 1 });

    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);

    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

describe("fetchSpanMetricsPlotFromServer", () => {
  const call = (filterExpr: string | null = null) =>
    fetchSpanMetricsPlotFromServer(
      "app-a",
      "root.a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
    );

  it("sends the span, range, timezone and time group in the URL", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/spans/plots/metrics");
    expect(url.searchParams.get("span_name")).toBe("root.a");
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    // A nine day range buckets by day.
    expect(url.searchParams.get("plot_time_group")).toBe("days");
    expect(url.searchParams.has("filter_expr")).toBe(false);
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await call("span_status:in:ok");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe("span_status:in:ok");
  });

  it("returns null when response data is null", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    expect(await call()).toBeNull();
  });

  it("returns data, throws on failure", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([{ id: "v1" }]));
    expect(await call()).toEqual([{ id: "v1" }]);

    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);

    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

describe("fetchBugReportsOverviewFromServer", () => {
  const call = (filterExpr: string | null = null) =>
    fetchBugReportsOverviewFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
      5,
      10,
    );

  it("sends the range, timezone and page in the URL", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/bugReports");
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("offset")).toBe("10");
    expect(url.searchParams.has("filter_expr")).toBe(false);
    expect(url.searchParams.has("bug_report_statuses")).toBe(false);
    expect(url.searchParams.has("free_text")).toBe(false);
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await call("bug_report_status:in:open");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe(
      "bug_report_status:in:open",
    );
  });

  it("returns data, throws on failure", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ a: 1 }));
    expect(await call()).toEqual({ a: 1 });

    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);

    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

describe("fetchBugReportsOverviewPlotFromServer", () => {
  const call = (filterExpr: string | null = null) =>
    fetchBugReportsOverviewPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
    );

  it("sends the range, timezone and time group in the URL", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/bugReports/plots/instances");
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    // A nine day range buckets by day.
    expect(url.searchParams.get("plot_time_group")).toBe("days");
    expect(url.searchParams.has("filter_expr")).toBe(false);
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await call("bug_report_status:in:open");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe(
      "bug_report_status:in:open",
    );
  });

  it("returns null when response data is null", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    expect(await call()).toBeNull();
  });

  it("returns data, throws on failure", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([{ id: "v1" }]));
    expect(await call()).toEqual([{ id: "v1" }]);

    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);

    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

// ========================================================================
// Failure paths for the fetch functions that didn't get them in the
// happy-path tests above. Parameterized to keep it compact.
// ========================================================================
describe("fetch functions: failure paths", () => {
  const cases: Array<[string, () => Promise<unknown>]> = [
    [
      "fetchJourneyFromServer",
      () =>
        fetchJourneyFromServer(
          "app-a",
          "2026-04-01T00:00:00.000Z",
          "2026-04-10T00:00:00.000Z",
          null,
        ),
    ],
    [
      "fetchMetricsFromServer",
      () =>
        fetchMetricsFromServer(
          "app-a",
          "2026-04-01T00:00:00.000Z",
          "2026-04-10T00:00:00.000Z",
          null,
        ),
    ],
    [
      "fetchSessionReplayOverviewFromServer",
      () =>
        fetchSessionReplayOverviewFromServer(
          "app-a",
          "2026-04-01T00:00:00.000Z",
          "2026-04-10T00:00:00.000Z",
          null,
          10,
          0,
        ),
    ],
    [
      "fetchAuthzAndMembersFromServer",
      () => fetchAuthzAndMembersFromServer("t1"),
    ],
    [
      "fetchSessionReplayFromServer",
      () => fetchSessionReplayFromServer("a", "s"),
    ],
    [
      "fetchBugReportsOverviewFromServer",
      () =>
        fetchBugReportsOverviewFromServer(
          "app-a",
          "2026-04-01T00:00:00.000Z",
          "2026-04-10T00:00:00.000Z",
          null,
          5,
          0,
        ),
    ],
    [
      "fetchBugReportsOverviewPlotFromServer",
      () =>
        fetchBugReportsOverviewPlotFromServer(
          "app-a",
          "2026-04-01T00:00:00.000Z",
          "2026-04-10T00:00:00.000Z",
          null,
        ),
    ],
    ["fetchBugReportFromServer", () => fetchBugReportFromServer("a", "b")],
    [
      "fetchAlertsOverviewFromServer",
      () =>
        fetchAlertsOverviewFromServer(
          "app-a",
          "2026-04-01T00:00:00.000Z",
          "2026-04-10T00:00:00.000Z",
          20,
          0,
        ),
    ],
    [
      "fetchPendingInvitesFromServer",
      () => fetchPendingInvitesFromServer("t1"),
    ],
    [
      "fetchTeamSlackConnectUrlFromServer",
      () => fetchTeamSlackConnectUrlFromServer("t"),
    ],
    [
      "fetchTeamSlackStatusFromServer",
      () => fetchTeamSlackStatusFromServer("t1"),
    ],
    [
      "fetchAppThresholdPrefsFromServer",
      () => fetchAppThresholdPrefsFromServer("a"),
    ],
    ["fetchAppRetentionFromServer", () => fetchAppRetentionFromServer("a")],
    ["fetchSdkConfigFromServer", () => fetchSdkConfigFromServer("a")],
    ["fetchBillingInfoFromServer", () => fetchBillingInfoFromServer("t")],
    ["fetchUsageFromServer", () => fetchUsageFromServer("t")],
    [
      "fetchCheckoutSessionFromServer",
      () => fetchCheckoutSessionFromServer("t", "o"),
    ],
    ["fetchNotifPrefsFromServer", () => fetchNotifPrefsFromServer()],
    [
      "fetchNetworkEndpointsFromServer",
      () => fetchNetworkEndpointsFromServer("a", isoFrom, isoTo, null, "q"),
    ],
    [
      "fetchNetworkLatencyPlotFromServer",
      () =>
        fetchNetworkLatencyPlotFromServer("a", isoFrom, isoTo, null, "d", "p"),
    ],
    [
      "fetchNetworkTimelinePlotFromServer",
      () =>
        fetchNetworkTimelinePlotFromServer("a", isoFrom, isoTo, null, "d", "p"),
    ],
    [
      "fetchNetworkStatusCodesPlotFromServer",
      () =>
        fetchNetworkStatusCodesPlotFromServer(
          "a",
          isoFrom,
          isoTo,
          null,
          "",
          "",
        ),
    ],
    [
      "fetchNetworkEndpointStatusCodesPlotFromServer",
      () =>
        fetchNetworkEndpointStatusCodesPlotFromServer(
          "a",
          isoFrom,
          isoTo,
          null,
          "example.com",
          "/api/users",
        ),
    ],
  ];

  it.each(cases)("%s throws on non-ok", async (_name, fn) => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(fn()).rejects.toThrow(ApiError);
  });

  it.each(cases)("%s throws on exception", async (_name, fn) => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("boom"));
    await expect(fn()).rejects.toThrow(RequestError);
  });
});

// ========================================================================
// Mutation failure paths
// ========================================================================
describe("mutation functions: failure paths", () => {
  const mutations: Array<[string, () => Promise<unknown>]> = [
    ["createTeamFromServer", () => createTeamFromServer("x") as any],
    ["createAppFromServer", () => createAppFromServer("t", "a") as any],
    ["changeTeamNameFromServer", () => changeTeamNameFromServer("t", "x")],
    ["changeRoleFromServer", () => changeRoleFromServer("t", "admin", "m")],
    [
      "inviteMemberFromServer",
      () => inviteMemberFromServer("t", "x@y.z", "admin"),
    ],
    ["removeMemberFromServer", () => removeMemberFromServer("t", "m")],
    [
      "resendPendingInviteFromServer",
      () => resendPendingInviteFromServer("t", "i"),
    ],
    [
      "removePendingInviteFromServer",
      () => removePendingInviteFromServer("t", "i"),
    ],
    [
      "updateTeamSlackStatusFromServer",
      () => updateTeamSlackStatusFromServer("t", true),
    ],
    ["sendTestSlackAlertFromServer", () => sendTestSlackAlertFromServer("t")],
    [
      "updateAppThresholdPrefsFromServer",
      () => updateAppThresholdPrefsFromServer("a", {} as any),
    ],
    [
      "updateAppRetentionFromServer",
      () => updateAppRetentionFromServer("a", {} as any),
    ],
    ["changeAppNameFromServer", () => changeAppNameFromServer("a", "n")],
    ["changeAppApiKeyFromServer", () => changeAppApiKeyFromServer("a")],
    ["updateNotifPrefsFromServer", () => updateNotifPrefsFromServer({} as any)],
    ["updateSdkConfigFromServer", () => updateSdkConfigFromServer("a", {})],
    [
      "updateBugReportStatusFromServer",
      () => updateBugReportStatusFromServer("a", "b", 1),
    ],
    ["downgradeToFreeFromServer", () => downgradeToFreeFromServer("t")],
    ["undoDowngradeFromServer", () => undoDowngradeFromServer("t")],
    [
      "fetchCustomerPortalUrlFromServer",
      () => fetchCustomerPortalUrlFromServer("t", "url"),
    ],
  ];

  it.each(mutations)("%s throws on non-ok", async (_name, fn) => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(fn()).rejects.toThrow(ApiError);
  });

  it.each(mutations)("%s throws on exception", async (_name, fn) => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("boom"));
    await expect(fn()).rejects.toThrow(RequestError);
  });
});

// ========================================================================
// Additional branch coverage — NoData paths and the remaining failure
// branches.
// ========================================================================
describe("additional branch coverage", () => {
  it("fetchAppHealthPlotFromServer throws when the fetch throws", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("network down"));
    await expect(
      fetchAppHealthPlotFromServer(
        "app-a",
        "2026-04-01T00:00:00.000Z",
        "2026-04-10T00:00:00.000Z",
        null,
      ),
    ).rejects.toThrow(RequestError);
  });

  it("fetchUsageFromServer returns null on 404", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse(404));
    const r = await fetchUsageFromServer("t1");
    expect(r).toBeNull();
  });

  it("fetchNetworkTimelinePlotFromServer returns null on a null body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    const r = await fetchNetworkTimelinePlotFromServer(
      "a",
      isoFrom,
      isoTo,
      null,
      "",
      "",
    );
    expect(r).toBeNull();
  });

  it("fetchNetworkTrendsFromServer returns null on a null body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    const r = await fetchNetworkTrendsFromServer("a", isoFrom, isoTo, null, 10);
    expect(r).toBeNull();
  });

  it("createTeamFromServer throws the server message on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      mockResponse(false, 400, { error: "name taken" }),
    );
    await expect(createTeamFromServer("x")).rejects.toThrow("name taken");
  });

  it("reports a dropped connection as a RequestError naming the operation", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const err = await createTeamFromServer("x").catch((e) => e);
    expect(err).toBeInstanceOf(RequestError);
    expect(err.message).toBe("Failed to create team");
    expect(err.cause).toBeInstanceOf(TypeError);
  });

  it("reports an unreadable success body as a RequestError", async () => {
    mockApiClientFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });
    const err = await createTeamFromServer("x").catch((e) => e);
    expect(err).toBeInstanceOf(RequestError);
    expect(err.message).toBe("Failed to create team");
  });

  it("createTeamFromServer falls back when the error body is not JSON", async () => {
    // A proxy that answers 502 with an HTML page makes res.json() throw.
    // The message that the user sees must still name the operation.
    mockApiClientFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token '<'");
      },
    });
    const err = await createTeamFromServer("x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.message).toBe("Failed to create team");
  });

  it("createTeamFromServer throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(createTeamFromServer("x")).rejects.toThrow(RequestError);
  });

  it("createAppFromServer throws the server message on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      mockResponse(false, 400, { error: "oops" }),
    );
    await expect(createAppFromServer("t", "a")).rejects.toThrow("oops");
  });

  it("createAppFromServer throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(createAppFromServer("t", "a")).rejects.toThrow(RequestError);
  });
});

// ========================================================================
// Errors (unified Crashes + ANRs)
// ========================================================================

describe("fetchErrorsOverviewFromServer", () => {
  const call = (filterExpr: string | null = null) =>
    fetchErrorsOverviewFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
      5,
      0,
    );

  it("sends the range, timezone and page in the URL", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/errorGroups");
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("offset")).toBe("0");
    expect(url.searchParams.has("filter_expr")).toBe(false);
  });

  it("appends limit/offset", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchErrorsOverviewFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      null,
      25,
      100,
    );
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("offset")).toBe("100");
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await call("error_type:in:[Crash]");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe("error_type:in:[Crash]");
  });

  it("returns the body on 200", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ results: [{ id: "g1" }] }),
    );
    expect(await call()).toEqual({ results: [{ id: "g1" }] });
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse(500));
    await expect(call()).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("boom"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

describe("fetchErrorsOverviewPlotFromServer", () => {
  const call = (filterExpr: string | null = null) =>
    fetchErrorsOverviewPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
    );

  it("sends the range, timezone and time group in the URL", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/errorGroups/plots/instances");
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    expect(url.searchParams.get("plot_time_group")).toBe("days");
    expect(url.searchParams.has("filter_expr")).toBe(false);
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await call("os_name:in:[android]");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe("os_name:in:[android]");
  });

  it("returns null on a null body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    expect(await call()).toBeNull();
  });

  it("returns data, throws on failure", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse([{ data: [{ datetime: "x", instances: 1 }] }]),
    );
    expect(await call()).toEqual([{ data: [{ datetime: "x", instances: 1 }] }]);

    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);

    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

describe("fetchErrorsDetailsFromServer", () => {
  const call = (filterExpr: string | null = null, offset = 0) =>
    fetchErrorsDetailsFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
      "group-1",
      1,
      offset,
    );

  it("hits /apps/:id/errorGroups/:id/errors with the range, timezone and page", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await call(null, 10);
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/errorGroups/group-1/errors");
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    expect(url.searchParams.get("limit")).toBe("1");
    expect(url.searchParams.get("offset")).toBe("10");
    expect(url.searchParams.has("filter_expr")).toBe(false);
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await call("user_id:eq:demo-user-id");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe("user_id:eq:demo-user-id");
  });

  it("returns the body on 200", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ results: [{ id: "e1" }] }),
    );
    expect(await call()).toEqual({ results: [{ id: "e1" }] });
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

describe("fetchErrorGroupCommonPathFromServer", () => {
  const call = () => fetchErrorGroupCommonPathFromServer("app-a", "group-1");

  it("hits /apps/:id/errorGroups/:id/path with no query params", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ sessions_analyzed: 0, steps: [] }),
    );
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe("/api/apps/app-a/errorGroups/group-1/path");
    expect(url.search).toBe("");
  });

  it("returns the body on 200", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ sessions_analyzed: 3, steps: [] }),
    );
    const r = await call();
    expect((r as any).sessions_analyzed).toBe(3);
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

describe("fetchErrorsDetailsPlotFromServer", () => {
  const call = (filterExpr: string | null = null) =>
    fetchErrorsDetailsPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
      "group-1",
    );

  it("hits /apps/:id/errorGroups/:id/plots/instances with the range and time group", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse([{ data: [{ datetime: "x", instances: 1 }] }]),
    );
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe(
      "/api/apps/app-a/errorGroups/group-1/plots/instances",
    );
    expect(url.searchParams.get("plot_time_group")).toBe("days");
    expect(url.searchParams.has("filter_expr")).toBe(false);
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await call("device_manufacturer:eq:Google");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe(
      "device_manufacturer:eq:Google",
    );
  });

  it("returns the body on 200", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse([{ data: [{ datetime: "x", instances: 1 }] }]),
    );
    expect(await call()).toEqual([{ data: [{ datetime: "x", instances: 1 }] }]);
  });

  it("returns null on a null body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    expect(await call()).toBeNull();
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

describe("fetchErrorsDistributionPlotFromServer", () => {
  const call = (filterExpr: string | null = null) =>
    fetchErrorsDistributionPlotFromServer(
      "app-a",
      "2026-04-01T00:00:00.000Z",
      "2026-04-10T00:00:00.000Z",
      filterExpr,
      "group-1",
    );

  it("hits /apps/:id/errorGroups/:id/plots/distribution with the range and timezone, no time group", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ os_version: { "android 13": 5 } }),
    );
    await call();
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.pathname).toBe(
      "/api/apps/app-a/errorGroups/group-1/plots/distribution",
    );
    expect(url.searchParams.get("from")).toBe("2026-04-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-04-10T00:00:00.000Z");
    expect(url.searchParams.get("timezone")).toBeTruthy();
    expect(url.searchParams.has("plot_time_group")).toBe(false);
    expect(url.searchParams.has("filter_expr")).toBe(false);
  });

  it("sends the filter expression when one is given", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ os_version: { "android 13": 5 } }),
    );
    await call("network_type:eq:wifi");
    const url = new URL(lastFetchUrl(), "http://localhost");
    expect(url.searchParams.get("filter_expr")).toBe("network_type:eq:wifi");
  });

  it("returns the body when it is non-empty", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ os_version: { "android 13": 5 } }),
    );
    expect(await call()).toEqual({ os_version: { "android 13": 5 } });
  });

  it("returns null on a null body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    expect(await call()).toBeNull();
  });

  it("returns null on a body where every attribute is empty", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ os_version: {}, country: {} }),
    );
    expect(await call()).toBeNull();
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(call()).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(call()).rejects.toThrow(RequestError);
  });
});

// ========================================================================
// validateInvitesFromServer
// ========================================================================
describe("validateInvitesFromServer", () => {
  it("returns the body on 200", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    const r = await validateInvitesFromServer("invite-1");
    expect(lastFetchUrl()).toContain("/api/auth/validateInvite");
    expect(lastFetchOpts().method).toBe("POST");
    expect(r).toBeUndefined();
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse(400));
    await expect(validateInvitesFromServer("invite-1")).rejects.toThrow(
      ApiError,
    );
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(validateInvitesFromServer("invite-1")).rejects.toThrow(
      RequestError,
    );
  });
});
