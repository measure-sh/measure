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
  BugReportStatus,
  buildShortFiltersPostBody,
  changeAppApiKeyFromServer,
  changeAppNameFromServer,
  changeRoleFromServer,
  changeTeamNameFromServer,
  createAppFromServer,
  createTeamFromServer,
  defaultFilters,
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
  fetchFiltersFromServer,
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
  Filters,
  FilterSource,
  inviteMemberFromServer,
  JourneyType,
  removeMemberFromServer,
  removePendingInviteFromServer,
  resendPendingInviteFromServer,
  saveListFiltersToServer,
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

function makeFilters(overrides: Partial<Filters> = {}): Filters {
  return {
    ...defaultFilters,
    ready: true,
    app: { id: "app-a", onboarded: true } as any,
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2026-04-10T00:00:00.000Z",
    versions: { selected: [{ name: "1.0.0", code: "100" } as any], all: false },
    filterShortCodePromise: Promise.resolve("code-123"),
    ...overrides,
  };
}

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
// buildShortFiltersPostBody
// ========================================================================
describe("buildShortFiltersPostBody", () => {
  it("returns null when every filter is empty", () => {
    const empty: Filters = {
      ...defaultFilters,
      app: { id: "app-a" } as any,
    };
    expect(buildShortFiltersPostBody(empty)).toBeNull();
  });

  it("omits ud_expression when no matchers are selected", () => {
    const filters = makeFilters();
    const body = buildShortFiltersPostBody(filters);
    expect(body).not.toBeNull();
    expect((body!.filters as any).ud_expression).toBeUndefined();
  });

  it("adds ud_expression with the matcher details when matchers are present", () => {
    const filters = makeFilters({
      udAttrMatchers: [
        { key: "user_id", type: "string", op: "eq", value: "alice" },
      ],
    });
    const body = buildShortFiltersPostBody(filters);
    expect(body).not.toBeNull();
    const udExpression = JSON.parse((body!.filters as any).ud_expression);
    expect(udExpression).toEqual({
      and: [
        { cmp: { key: "user_id", type: "string", op: "eq", value: "alice" } },
      ],
    });
  });

  it("coerces boolean matcher values to strings so the server sees String(true)", () => {
    const filters = makeFilters({
      udAttrMatchers: [{ key: "premium", type: "bool", op: "eq", value: true }],
    });
    const body = buildShortFiltersPostBody(filters);
    const udExpression = JSON.parse((body!.filters as any).ud_expression);
    expect(udExpression.and[0].cmp.value).toBe("true");
  });

  it("produces a different body for different matcher values", () => {
    const a = buildShortFiltersPostBody(
      makeFilters({
        udAttrMatchers: [
          { key: "user_id", type: "string", op: "eq", value: "alice" },
        ],
      }),
    );
    const b = buildShortFiltersPostBody(
      makeFilters({
        udAttrMatchers: [
          { key: "user_id", type: "string", op: "eq", value: "bob" },
        ],
      }),
    );
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

// ========================================================================
// saveListFiltersToServer
// ========================================================================
describe("saveListFiltersToServer", () => {
  it("returns null without a network call when the body would be empty", async () => {
    const empty: Filters = { ...defaultFilters, app: { id: "app-a" } as any };
    const code = await saveListFiltersToServer(empty);
    expect(code).toBeNull();
    expect(mockApiClientFetch).not.toHaveBeenCalled();
  });

  it("POSTs to /shortFilters with the body builder output and returns filter_short_code", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ filter_short_code: "abc" }),
    );
    const code = await saveListFiltersToServer(makeFilters());
    expect(code).toBe("abc");
    expect(lastFetchUrl()).toBe("/api/apps/app-a/shortFilters");
    expect(lastFetchOpts().method).toBe("POST");
    const body = JSON.parse(lastFetchOpts().body);
    expect(body.filters.versions).toEqual(["1.0.0"]);
    expect(body.filters.version_codes).toEqual(["100"]);
  });

  it("returns null on non-ok response", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse(500));
    const code = await saveListFiltersToServer(makeFilters());
    expect(code).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("network"));
    const code = await saveListFiltersToServer(makeFilters());
    expect(code).toBeNull();
  });
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

// ========================================================================
// fetchFiltersFromServer — has NoData / NotOnboarded branches
// ========================================================================
describe("fetchFiltersFromServer", () => {
  const onboardedApp = { id: "app-1", onboarded: true } as any;
  const notOnboardedApp = { id: "app-1", onboarded: false } as any;

  it("appends type=error,anr for Errors filterSource", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ versions: [] }));
    await fetchFiltersFromServer(onboardedApp, FilterSource.Errors);
    const url = lastFetchUrl();
    expect(url).toContain("type=error,anr");
  });

  it("has no source-specific param for Events", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ versions: [] }));
    await fetchFiltersFromServer(onboardedApp, FilterSource.Events);
    const url = lastFetchUrl();
    expect(url).not.toContain("crash=");
    expect(url).not.toContain("anr=");
    expect(url).not.toContain("span=");
    expect(url).toContain("ud_attr_keys=1");
  });

  it("throws a RequestError when the body is missing altogether", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    const err = await fetchFiltersFromServer(
      onboardedApp,
      FilterSource.Events,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(RequestError);
    expect(err.message).toBe("Failed to fetch filters");
  });

  it("reports options when the server has filter data", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ versions: ["1.0.0"] }),
    );
    const result = await fetchFiltersFromServer(
      onboardedApp,
      FilterSource.Events,
    );
    expect(result).toEqual({ kind: "options", data: { versions: ["1.0.0"] } });
  });

  it("returns NoBuilds for the Builds source when the app has no builds", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ versions: null }),
    );
    const result = await fetchFiltersFromServer(
      onboardedApp,
      FilterSource.Builds,
    );
    expect(result).toEqual({ kind: "no-builds" });
  });

  it("reports no-data when the app is onboarded but has no versions", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ versions: null }),
    );
    const result = await fetchFiltersFromServer(
      onboardedApp,
      FilterSource.Events,
    );
    expect(result).toEqual({ kind: "no-data" });
  });

  it("reports options when versions is an empty array (onboarded app, no versions yet)", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ versions: [] }));
    const result = await fetchFiltersFromServer(
      onboardedApp,
      FilterSource.Events,
    );
    expect(result).toEqual({ kind: "options", data: { versions: [] } });
  });

  it("returns NotOnboarded when the app is not onboarded", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ versions: null }),
    );
    const result = await fetchFiltersFromServer(
      notOnboardedApp,
      FilterSource.Events,
    );
    expect(result).toEqual({ kind: "not-onboarded" });
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(
      fetchFiltersFromServer(onboardedApp, FilterSource.Events),
    ).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(
      fetchFiltersFromServer(onboardedApp, FilterSource.Events),
    ).rejects.toThrow(RequestError);
  });
});

// ========================================================================
// Functions that use applyGenericFiltersToUrl
// ========================================================================
describe("fetch functions that use applyGenericFiltersToUrl", () => {
  it("fetchMetricsFromServer adds filter_short_code from filterShortCodePromise", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ metric: 1 }));
    await fetchMetricsFromServer(makeFilters());
    const url = lastFetchUrl();
    expect(url).toContain("/api/apps/app-a/metrics");
    expect(url).toContain("filter_short_code=code-123");
    expect(url).toContain("from=");
    expect(url).toContain("to=");
  });

  it("fetchMetricsFromServer does not add filter_short_code when promise resolves to null", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await fetchMetricsFromServer(
      makeFilters({ filterShortCodePromise: Promise.resolve(null) }),
    );
    expect(lastFetchUrl()).not.toContain("filter_short_code");
  });

  it.each([["fetchMetricsFromServer", fetchMetricsFromServer]])(
    "%s: returns data, throws on failure",
    async (_name, fn) => {
      mockApiClientFetch.mockResolvedValueOnce(successResponse({ a: 1 }));
      expect(await (fn as any)(makeFilters())).toEqual({ a: 1 });

      mockApiClientFetch.mockResolvedValueOnce(errorResponse());
      await expect((fn as any)(makeFilters())).rejects.toThrow(ApiError);

      mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
      await expect((fn as any)(makeFilters())).rejects.toThrow(RequestError);
    },
  );

  it("fetchSessionReplayOverviewFromServer includes limit/offset", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await fetchSessionReplayOverviewFromServer(makeFilters(), 10, 20);
    expect(lastFetchUrl()).toContain("/api/apps/app-a/sessions");
    expect(lastFetchUrl()).toContain("limit=10");
    expect(lastFetchUrl()).toContain("offset=20");
  });

  it("fetchSessionReplayOverviewPlotFromServer returns null when the body is null", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    const result =
      await fetchSessionReplayOverviewPlotFromServer(makeFilters());
    expect(result).toBeNull();
  });

  it("fetchSessionReplayOverviewPlotFromServer throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(
      fetchSessionReplayOverviewPlotFromServer(makeFilters()),
    ).rejects.toThrow(ApiError);
  });

  it("fetchSessionReplayOverviewPlotFromServer throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(
      fetchSessionReplayOverviewPlotFromServer(makeFilters()),
    ).rejects.toThrow(RequestError);
  });
});

// ========================================================================
// fetchJourneyFromServer
// ========================================================================
describe("fetchJourneyFromServer", () => {
  it("hits /journey for Paths", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await fetchJourneyFromServer(false, makeFilters());
    expect(lastFetchUrl()).toContain("/api/apps/app-a/journey");
  });

  // NOTE: bidirectional (bigraph) is currently DROPPED by
  // `applyGenericFiltersToUrl` — it overwrites `u.search` with a fresh
  // URLSearchParams containing only the generic filter params. This pins
  // the current buggy behaviour; fixing the underlying issue should flip
  // these assertions to check for bigraph=1/0.
  it("passes bidirectional=true path through (bigraph dropped by URL rebuild)", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await fetchJourneyFromServer(true, makeFilters());
    expect(lastFetchUrl()).toContain("/api/apps/app-a/journey");
  });

  it("passes bidirectional=false path through", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await fetchJourneyFromServer(false, makeFilters());
    expect(lastFetchUrl()).toContain("/api/apps/app-a/journey");
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(fetchJourneyFromServer(false, makeFilters())).rejects.toThrow(
      ApiError,
    );
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(fetchJourneyFromServer(false, makeFilters())).rejects.toThrow(
      RequestError,
    );
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

    const r = await fetchAppHealthPlotFromServer(makeFilters());
    expect(r?.map((s: any) => s.id)).toEqual(["Sessions", "Crashes", "ANRs"]);
  });

  it("hits the health plots endpoint", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    await fetchAppHealthPlotFromServer(makeFilters());
    expect(mockApiClientFetch.mock.calls[0][0]).toContain(
      "/health/plots/instances",
    );
  });

  it("throws when the fetch returns a non-ok response", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(fetchAppHealthPlotFromServer(makeFilters())).rejects.toThrow(
      ApiError,
    );
  });

  it("returns null when the response body is null", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    const r = await fetchAppHealthPlotFromServer(makeFilters());
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
    const r = await fetchAppHealthPlotFromServer(makeFilters());
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
    const r = await fetchAppHealthPlotFromServer(makeFilters());
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
    const r = await fetchAppHealthPlotFromServer(makeFilters());
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
    const r = await fetchAppHealthPlotFromServer(makeFilters());
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
    const r = await fetchAppHealthPlotFromServer(makeFilters());
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
  const scoped = ["example.com", "/api/users"] as const;

  it("fetchNetworkEndpointsFromServer hits /networkRequests/endpoints and returns them", async () => {
    const results = [{ domain: "example.com", path_pattern: "/v1/users/*" }];
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results }));
    const r = await fetchNetworkEndpointsFromServer(makeFilters(), "users");
    const url = lastFetchUrl();
    expect(url).toContain("/api/apps/app-a/networkRequests/endpoints");
    expect(url).toContain("query=users");
    expect(r).toEqual(results);
  });

  it("fetchNetworkEndpointsFromServer forwards a cancellation signal", async () => {
    const controller = new AbortController();
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));

    await fetchNetworkEndpointsFromServer(
      makeFilters(),
      "users",
      controller.signal,
    );

    expect(mockApiClientFetch.mock.calls[0][1]).toMatchObject({
      signal: controller.signal,
    });
  });

  it("fetchNetworkEndpointsFromServer forwards selected HTTP methods", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchNetworkEndpointsFromServer(
      makeFilters({
        httpMethods: { all: false, selected: ["GET", "POST"] as any },
      }),
      "users",
    );

    expect(lastFetchUrl()).toContain("http_methods=GET");
    expect(lastFetchUrl()).toContain("http_methods=POST");
  });

  it("fetchNetworkEndpointsFromServer omits an empty query and tolerates no results", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ results: null }),
    );
    const r = await fetchNetworkEndpointsFromServer(makeFilters(), "");
    expect(lastFetchUrl()).not.toContain("query=");
    expect(r).toEqual([]);
  });

  it("fetchNetworkLatencyPlotFromServer uses the latency path and sends the scope", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ points: [1] }));
    const r = await fetchNetworkLatencyPlotFromServer(makeFilters(), ...scoped);
    const url = lastFetchUrl();
    expect(url).toContain("/api/apps/app-a/networkRequests/plots/latency");
    expect(url).toContain("domain=example.com");
    expect(url).toContain("path=%2Fapi%2Fusers");
    expect(r).toEqual({ points: [1] });
  });

  it("fetchNetworkEndpointStatusCodesPlotFromServer uses the endpointStatusCodes path and returns the body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ status_codes: [200], data_points: [{ count_200: 1 }] }),
    );
    const r = await fetchNetworkEndpointStatusCodesPlotFromServer(
      makeFilters(),
      ...scoped,
    );
    expect(lastFetchUrl()).toContain(
      "/api/apps/app-a/networkRequests/plots/endpointStatusCodes",
    );
    expect(lastFetchUrl()).toContain("domain=example.com");
    expect(lastFetchUrl()).toContain("path=%2Fapi%2Fusers");
    expect(r).toEqual({ status_codes: [200], data_points: [{ count_200: 1 }] });
  });

  it("fetchNetworkStatusCodesPlotFromServer sends an empty scope for every endpoint", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([{ code: 200 }]));
    await fetchNetworkStatusCodesPlotFromServer(makeFilters(), "", "");
    const url = lastFetchUrl();
    expect(url).toContain("domain=&");
    expect(url).toContain("path=");
  });

  it("fetchNetworkTimelinePlotFromServer uses the timeline path and returns the points", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ points: [{ t: 1 }] }),
    );
    const r = await fetchNetworkTimelinePlotFromServer(
      makeFilters(),
      ...scoped,
    );
    expect(lastFetchUrl()).toContain(
      "/api/apps/app-a/networkRequests/plots/timeline",
    );
    expect(r).toEqual({ points: [{ t: 1 }] });
  });

  it("fetchNetworkTrendsFromServer uses /networkRequests/trends with trends_limit and throws on failure", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchNetworkTrendsFromServer(makeFilters(), 15);
    const url = lastFetchUrl();
    expect(url).toContain("/api/apps/app-a/networkRequests/trends");
    expect(url).toContain("trends_limit=15");

    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(fetchNetworkTrendsFromServer(makeFilters())).rejects.toThrow(
      ApiError,
    );

    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(fetchNetworkTrendsFromServer(makeFilters())).rejects.toThrow(
      RequestError,
    );
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

  it("fetchBugReportsOverviewFromServer includes path and filters", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchBugReportsOverviewFromServer(makeFilters(), 5, 0);
    expect(lastFetchUrl()).toContain("/api/apps/app-a/bugReports");
  });

  it("fetchBugReportsOverviewPlotFromServer returns null on a null body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    const r = await fetchBugReportsOverviewPlotFromServer(makeFilters());
    expect(r).toBeNull();
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

  it("fetchAlertsOverviewFromServer hits /alerts with filters", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchAlertsOverviewFromServer(makeFilters(), 20, 0);
    expect(lastFetchUrl()).toContain("/api/apps/app-a/alerts");
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
// applyGenericFiltersToUrl — exercised via any function that uses it.
// These tests cover the per-field append branches (session types, span
// statuses, bug report statuses, free text, span filters,
// http methods) by passing filters with non-default values.
// ========================================================================
describe("applyGenericFiltersToUrl filter branches", () => {
  it("does NOT append session-type flags (only endpoints that opt-in via appendSessionTypesToUrl do)", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    const filters = makeFilters({
      sessionTypes: {
        all: false,
        selected: [
          "Fatal Error Sessions",
          "Unhandled Error Sessions",
          "Handled Error Sessions",
          "ANR Sessions",
          "Bug Report Sessions",
          "User Interaction Sessions",
          "Foreground Sessions",
          "Background Sessions",
        ] as any,
      },
    });
    await fetchMetricsFromServer(filters);
    const url = lastFetchUrl();
    expect(url).not.toContain("type=");
    expect(url).not.toContain("severity=");
    expect(url).not.toContain("bug_report=");
    expect(url).not.toContain("user_interaction=");
    expect(url).not.toContain("foreground=");
    expect(url).not.toContain("background=");
  });

  it("appends bug_report_statuses for Open/Closed", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await fetchBugReportsOverviewFromServer(
      makeFilters({
        bugReportStatuses: {
          all: false,
          selected: [BugReportStatus.Open, BugReportStatus.Closed],
        },
      }),
      5,
      0,
    );
    const url = lastFetchUrl();
    // NOTE: fetchBugReportsOverviewFromServer calls both
    // applyGenericFiltersToUrl (which appends bug_report_statuses) AND
    // appendBugReportStatusesToUrl (which appends them again) — so each
    // status shows up twice in the final URL. This is a duplication in
    // api_calls.ts; pin the current behaviour here rather than the ideal.
    expect(url).toContain("bug_report_statuses=0");
    expect(url).toContain("bug_report_statuses=1");
  });

  it("appends free_text when non-empty", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await fetchMetricsFromServer(makeFilters({ freeText: "search me" }));
    expect(lastFetchUrl()).toContain("free_text=search+me");
  });

  it("URL-encodes special characters in free_text", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    await fetchMetricsFromServer(makeFilters({ freeText: "a&b=c?d 100%" }));
    expect(lastFetchUrl()).toContain("free_text=a%26b%3Dc%3Fd+100%25");
  });
});

describe("applyHttpMethodsToUrl", () => {
  it("appends http_methods params for selected methods", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await fetchNetworkLatencyPlotFromServer(
      makeFilters({
        httpMethods: { all: false, selected: ["get", "post"] as any },
      }),
      "example.com",
      "/path",
    );
    const url = lastFetchUrl();
    expect(url).toContain("http_methods=get");
    expect(url).toContain("http_methods=post");
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

// ========================================================================
// Failure paths for the fetch functions that didn't get them in the
// happy-path tests above. Parameterized to keep it compact.
// ========================================================================
describe("fetch functions: failure paths", () => {
  const cases: Array<[string, () => Promise<unknown>]> = [
    [
      "fetchJourneyFromServer",
      () => fetchJourneyFromServer(false, makeFilters()),
    ],
    ["fetchMetricsFromServer", () => fetchMetricsFromServer(makeFilters())],
    [
      "fetchSessionReplayOverviewFromServer",
      () => fetchSessionReplayOverviewFromServer(makeFilters(), 10, 0),
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
      () => fetchBugReportsOverviewFromServer(makeFilters(), 5, 0),
    ],
    [
      "fetchBugReportsOverviewPlotFromServer",
      () => fetchBugReportsOverviewPlotFromServer(makeFilters()),
    ],
    ["fetchBugReportFromServer", () => fetchBugReportFromServer("a", "b")],
    [
      "fetchAlertsOverviewFromServer",
      () => fetchAlertsOverviewFromServer(makeFilters(), 20, 0),
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
      () => fetchNetworkEndpointsFromServer(makeFilters(), "q"),
    ],
    [
      "fetchNetworkLatencyPlotFromServer",
      () => fetchNetworkLatencyPlotFromServer(makeFilters(), "d", "p"),
    ],
    [
      "fetchNetworkTimelinePlotFromServer",
      () => fetchNetworkTimelinePlotFromServer(makeFilters(), "d", "p"),
    ],
    [
      "fetchNetworkStatusCodesPlotFromServer",
      () => fetchNetworkStatusCodesPlotFromServer(makeFilters(), "", ""),
    ],
    [
      "fetchNetworkEndpointStatusCodesPlotFromServer",
      () =>
        fetchNetworkEndpointStatusCodesPlotFromServer(
          makeFilters(),
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
// Additional branch coverage — NoData paths, all SessionType values via
// session replay fetches, etc.
// ========================================================================
describe("additional branch coverage", () => {
  it("fetchAppHealthPlotFromServer throws when the fetch throws", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("network down"));
    await expect(fetchAppHealthPlotFromServer(makeFilters())).rejects.toThrow(
      RequestError,
    );
  });

  it("appends all session types via fetchSessionReplayOverviewFromServer", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await fetchSessionReplayOverviewFromServer(
      makeFilters({
        sessionTypes: {
          all: false,
          selected: [
            "Fatal Error Sessions",
            "Unhandled Error Sessions",
            "Handled Error Sessions",
            "ANR Sessions",
            "Bug Report Sessions",
            "User Interaction Sessions",
            "Foreground Sessions",
            "Background Sessions",
          ] as any,
        },
      }),
      10,
      0,
    );
    const url = lastFetchUrl();
    // appendSessionTypesToUrl path — error severities flatten into type=error
    // + severity=fatal,unhandled,handled, anr stays as a separate type entry.
    expect(url).toContain("type=error%2Canr");
    expect(url).toContain("severity=fatal%2Cunhandled%2Chandled");
    expect(url).toContain("bug_report=1");
    expect(url).toContain("user_interaction=1");
    expect(url).toContain("foreground=1");
    expect(url).toContain("background=1");
  });

  it("emits no session-type params when sessionTypes.all is true", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await fetchSessionReplayOverviewFromServer(
      makeFilters({
        sessionTypes: {
          all: true,
          selected: ["Fatal Error Sessions", "ANR Sessions"] as any,
        },
      }),
      10,
      0,
    );
    // With every session type selected the server-side filter is a no-op,
    // so appendSessionTypesToUrl adds nothing to the URL.
    const url = lastFetchUrl();
    expect(url).not.toContain("type=");
    expect(url).not.toContain("severity=");
    expect(url).not.toContain("bug_report=");
    expect(url).not.toContain("user_interaction=");
    expect(url).not.toContain("foreground=");
    expect(url).not.toContain("background=");
  });

  it("fetchBugReportsOverviewPlotFromServer throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(
      fetchBugReportsOverviewPlotFromServer(makeFilters()),
    ).rejects.toThrow(ApiError);
  });

  it("fetchUsageFromServer returns null on 404", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse(404));
    const r = await fetchUsageFromServer("t1");
    expect(r).toBeNull();
  });

  it("fetchNetworkTimelinePlotFromServer returns null on a null body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    const r = await fetchNetworkTimelinePlotFromServer(makeFilters(), "", "");
    expect(r).toBeNull();
  });

  it("fetchNetworkTrendsFromServer returns null on a null body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    const r = await fetchNetworkTrendsFromServer(makeFilters());
    expect(r).toBeNull();
  });

  it("AppVersion class constructs name/code/displayName", async () => {
    const { AppVersion } = jest.requireActual("@/app/api/api_calls");
    const v = new AppVersion("1.0.0", "100");
    expect(v.name).toBe("1.0.0");
    expect(v.code).toBe("100");
    expect(v.displayName).toBe("1.0.0 (100)");
  });

  it("OsVersion class adds Android API Level label", async () => {
    const { OsVersion } = jest.requireActual("@/app/api/api_calls");
    expect(new OsVersion("android", "14").displayName).toBe(
      "Android API Level 14",
    );
  });

  it("OsVersion class adds iOS label", async () => {
    const { OsVersion } = jest.requireActual("@/app/api/api_calls");
    expect(new OsVersion("ios", "17").displayName).toBe("iOS 17");
  });

  it("OsVersion class adds iPadOS label", async () => {
    const { OsVersion } = jest.requireActual("@/app/api/api_calls");
    expect(new OsVersion("ipados", "17").displayName).toBe("iPadOS 17");
  });

  it("OsVersion class passes through unknown OS name", async () => {
    const { OsVersion } = jest.requireActual("@/app/api/api_calls");
    expect(new OsVersion("windows", "11").displayName).toBe("windows 11");
  });

  it("fetchBugReportsOverviewPlotFromServer passes an empty body through", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({}));
    const r = await fetchBugReportsOverviewPlotFromServer(makeFilters());
    expect(r).toEqual({});
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

// Builds a Filters object with the Errors-source fields set, useful for
// asserting on URL parameters added by appendErrorFiltersToUrl.
function makeErrorsFilters(
  overrides: Partial<Filters> = {},
  errorOverrides: Partial<{
    selectedErrorTypes: string[];
    selectedSeverities: string[];
    customErrorsOnly: boolean;
  }> = {},
): Filters {
  return {
    ...defaultFilters,
    ready: true,
    app: { id: "app-a", onboarded: true } as any,
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2026-04-10T00:00:00.000Z",
    versions: { selected: [{ name: "1.0.0", code: "100" } as any], all: false },
    filterShortCodePromise: Promise.resolve("code-123"),
    selectedErrorTypes: errorOverrides.selectedErrorTypes ?? [],
    selectedSeverities: errorOverrides.selectedSeverities ?? [],
    customErrorsOnly: errorOverrides.customErrorsOnly ?? false,
    ...overrides,
  };
}

// Parse the most recent fetch URL into URLSearchParams so query-param
// assertions can be order-independent.
function lastFetchParams(): URLSearchParams {
  const url = lastFetchUrl();
  const qIndex = url.indexOf("?");
  if (qIndex === -1) {
    return new URLSearchParams("");
  }
  return new URLSearchParams(url.slice(qIndex + 1));
}

describe("fetchErrorsOverviewFromServer", () => {
  it("returns the body on 200", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ results: [{ id: "g1" }] }),
    );
    const r = await fetchErrorsOverviewFromServer(makeErrorsFilters(), 5, 0);
    expect(r).toEqual({ results: [{ id: "g1" }] });
  });

  it("hits /apps/:id/errorGroups", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchErrorsOverviewFromServer(makeErrorsFilters(), 5, 0);
    expect(lastFetchUrl()).toContain("/api/apps/app-a/errorGroups");
  });

  it("appends limit/offset", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchErrorsOverviewFromServer(makeErrorsFilters(), 25, 100);
    const params = lastFetchParams();
    expect(params.get("limit")).toBe("25");
    expect(params.get("offset")).toBe("100");
  });

  it("appends type/severity/custom when all are set", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchErrorsOverviewFromServer(
      makeErrorsFilters(
        {},
        {
          selectedErrorTypes: ["error", "anr"],
          selectedSeverities: ["fatal", "handled"],
          customErrorsOnly: true,
        },
      ),
      5,
      0,
    );
    const params = lastFetchParams();
    expect(params.get("type")).toBe("error,anr");
    expect(params.get("severity")).toBe("fatal,handled");
    expect(params.get("custom")).toBe("true");
  });

  it("omits type/severity/custom when all are at defaults", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchErrorsOverviewFromServer(
      makeErrorsFilters(
        {},
        {
          selectedErrorTypes: [],
          selectedSeverities: [],
          customErrorsOnly: false,
        },
      ),
      5,
      0,
    );
    const params = lastFetchParams();
    expect(params.has("type")).toBe(false);
    expect(params.has("severity")).toBe(false);
    expect(params.has("custom")).toBe(false);
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse(500));
    await expect(
      fetchErrorsOverviewFromServer(makeErrorsFilters(), 5, 0),
    ).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("boom"));
    await expect(
      fetchErrorsOverviewFromServer(makeErrorsFilters(), 5, 0),
    ).rejects.toThrow(RequestError);
  });
});

describe("fetchErrorsOverviewPlotFromServer", () => {
  it("returns the plot body on 200", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse([{ data: [{ datetime: "x", instances: 1 }] }]),
    );
    const r = await fetchErrorsOverviewPlotFromServer(makeErrorsFilters());
    expect(r).toEqual([{ data: [{ datetime: "x", instances: 1 }] }]);
  });

  it("hits /apps/:id/errorGroups/plots/instances", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await fetchErrorsOverviewPlotFromServer(makeErrorsFilters());
    expect(lastFetchUrl()).toContain(
      "/api/apps/app-a/errorGroups/plots/instances",
    );
  });

  it("appends type/severity/custom when set", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await fetchErrorsOverviewPlotFromServer(
      makeErrorsFilters(
        {},
        {
          selectedErrorTypes: ["error"],
          selectedSeverities: ["fatal"],
          customErrorsOnly: true,
        },
      ),
    );
    const params = lastFetchParams();
    expect(params.get("type")).toBe("error");
    expect(params.get("severity")).toBe("fatal");
    expect(params.get("custom")).toBe("true");
  });

  it("omits type/severity/custom when at defaults", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await fetchErrorsOverviewPlotFromServer(makeErrorsFilters());
    const params = lastFetchParams();
    expect(params.has("type")).toBe(false);
    expect(params.has("severity")).toBe(false);
    expect(params.has("custom")).toBe(false);
  });

  it("returns null on a null body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    const r = await fetchErrorsOverviewPlotFromServer(makeErrorsFilters());
    expect(r).toBeNull();
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(
      fetchErrorsOverviewPlotFromServer(makeErrorsFilters()),
    ).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(
      fetchErrorsOverviewPlotFromServer(makeErrorsFilters()),
    ).rejects.toThrow(RequestError);
  });
});

describe("fetchErrorsDetailsFromServer", () => {
  it("hits /apps/:id/errorGroups/:id/errors", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchErrorsDetailsFromServer("group-1", 0, makeErrorsFilters());
    expect(lastFetchUrl()).toContain(
      "/api/apps/app-a/errorGroups/group-1/errors",
    );
  });

  it("returns the body on 200", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ results: [{ id: "e1" }] }),
    );
    const r = await fetchErrorsDetailsFromServer(
      "group-1",
      0,
      makeErrorsFilters(),
    );
    expect(r).toEqual({ results: [{ id: "e1" }] });
  });

  it("does NOT append type/severity/custom (single-group endpoint, filters don't apply)", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchErrorsDetailsFromServer(
      "group-1",
      10,
      makeErrorsFilters(
        {},
        {
          selectedErrorTypes: ["anr"],
          selectedSeverities: ["handled"],
          customErrorsOnly: true,
        },
      ),
    );
    const params = lastFetchParams();
    expect(params.get("type")).toBeNull();
    expect(params.get("severity")).toBeNull();
    expect(params.get("custom")).toBeNull();
    expect(params.get("offset")).toBe("10");
  });

  it("omits type/severity/custom when at defaults", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }));
    await fetchErrorsDetailsFromServer("group-1", 0, makeErrorsFilters());
    const params = lastFetchParams();
    expect(params.has("type")).toBe(false);
    expect(params.has("severity")).toBe(false);
    expect(params.has("custom")).toBe(false);
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(
      fetchErrorsDetailsFromServer("group-1", 0, makeErrorsFilters()),
    ).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(
      fetchErrorsDetailsFromServer("group-1", 0, makeErrorsFilters()),
    ).rejects.toThrow(RequestError);
  });
});

describe("fetchErrorGroupCommonPathFromServer", () => {
  it("hits /apps/:id/errorGroups/:id/path", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ sessions_analyzed: 0, steps: [] }),
    );
    await fetchErrorGroupCommonPathFromServer("group-1", makeErrorsFilters());
    expect(lastFetchUrl()).toContain(
      "/api/apps/app-a/errorGroups/group-1/path",
    );
  });

  it("does NOT add any filter query params (path endpoint takes none)", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ sessions_analyzed: 0, steps: [] }),
    );
    await fetchErrorGroupCommonPathFromServer(
      "group-1",
      makeErrorsFilters(
        {},
        {
          selectedErrorTypes: ["error", "anr"],
          selectedSeverities: ["fatal"],
          customErrorsOnly: true,
        },
      ),
    );
    const url = lastFetchUrl();
    expect(url).not.toContain("type=");
    expect(url).not.toContain("severity=");
    expect(url).not.toContain("custom=");
    expect(url).not.toContain("from=");
    expect(url).not.toContain("to=");
    expect(url).not.toContain("filter_short_code=");
  });

  it("returns the body on 200", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ sessions_analyzed: 3, steps: [] }),
    );
    const r = await fetchErrorGroupCommonPathFromServer(
      "group-1",
      makeErrorsFilters(),
    );
    expect((r as any).sessions_analyzed).toBe(3);
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(
      fetchErrorGroupCommonPathFromServer("group-1", makeErrorsFilters()),
    ).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(
      fetchErrorGroupCommonPathFromServer("group-1", makeErrorsFilters()),
    ).rejects.toThrow(RequestError);
  });
});

describe("fetchErrorsDetailsPlotFromServer", () => {
  it("hits /apps/:id/errorGroups/:id/plots/instances", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse([{ data: [{ datetime: "x", instances: 1 }] }]),
    );
    await fetchErrorsDetailsPlotFromServer("group-1", makeErrorsFilters());
    expect(lastFetchUrl()).toContain(
      "/api/apps/app-a/errorGroups/group-1/plots/instances",
    );
  });

  it("does NOT append type/severity/custom (single-group endpoint, filters don't apply)", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse([]));
    await fetchErrorsDetailsPlotFromServer(
      "group-1",
      makeErrorsFilters(
        {},
        {
          selectedErrorTypes: ["error", "anr"],
          selectedSeverities: ["fatal"],
          customErrorsOnly: true,
        },
      ),
    );
    const url = lastFetchUrl();
    expect(url).not.toContain("type=");
    expect(url).not.toContain("severity=");
    expect(url).not.toContain("custom=");
  });

  it("returns the body on 200", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse([{ data: [{ datetime: "x", instances: 1 }] }]),
    );
    const r = await fetchErrorsDetailsPlotFromServer(
      "group-1",
      makeErrorsFilters(),
    );
    expect(r).toEqual([{ data: [{ datetime: "x", instances: 1 }] }]);
  });

  it("returns null on a null body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    const r = await fetchErrorsDetailsPlotFromServer(
      "group-1",
      makeErrorsFilters(),
    );
    expect(r).toBeNull();
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(
      fetchErrorsDetailsPlotFromServer("group-1", makeErrorsFilters()),
    ).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(
      fetchErrorsDetailsPlotFromServer("group-1", makeErrorsFilters()),
    ).rejects.toThrow(RequestError);
  });
});

describe("fetchErrorsDistributionPlotFromServer", () => {
  it("hits /apps/:id/errorGroups/:id/plots/distribution", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ os_version: { "android 13": 5 } }),
    );
    await fetchErrorsDistributionPlotFromServer("group-1", makeErrorsFilters());
    expect(lastFetchUrl()).toContain(
      "/api/apps/app-a/errorGroups/group-1/plots/distribution",
    );
  });

  it("does NOT append type/severity/custom (single-group endpoint, filters don't apply)", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ os_version: { "android 13": 5 } }),
    );
    await fetchErrorsDistributionPlotFromServer(
      "group-1",
      makeErrorsFilters(
        {},
        {
          selectedErrorTypes: ["error"],
          selectedSeverities: ["fatal", "handled"],
          customErrorsOnly: true,
        },
      ),
    );
    const params = lastFetchParams();
    expect(params.get("type")).toBeNull();
    expect(params.get("severity")).toBeNull();
    expect(params.get("custom")).toBeNull();
  });

  it("returns the body when it is non-empty", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ os_version: { "android 13": 5 } }),
    );
    const r = await fetchErrorsDistributionPlotFromServer(
      "group-1",
      makeErrorsFilters(),
    );
    expect(r).toEqual({ os_version: { "android 13": 5 } });
  });

  it("returns null on a null body", async () => {
    mockApiClientFetch.mockResolvedValueOnce(successResponse(null));
    const r = await fetchErrorsDistributionPlotFromServer(
      "group-1",
      makeErrorsFilters(),
    );
    expect(r).toBeNull();
  });

  it("returns null on a body where every attribute is empty", async () => {
    mockApiClientFetch.mockResolvedValueOnce(
      successResponse({ os_version: {}, country: {} }),
    );
    const r = await fetchErrorsDistributionPlotFromServer(
      "group-1",
      makeErrorsFilters(),
    );
    expect(r).toBeNull();
  });

  it("throws on non-ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce(errorResponse());
    await expect(
      fetchErrorsDistributionPlotFromServer("group-1", makeErrorsFilters()),
    ).rejects.toThrow(ApiError);
  });

  it("throws on exception", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("x"));
    await expect(
      fetchErrorsDistributionPlotFromServer("group-1", makeErrorsFilters()),
    ).rejects.toThrow(RequestError);
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
