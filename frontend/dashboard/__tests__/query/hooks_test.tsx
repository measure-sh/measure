import { beforeEach, describe, expect, it } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";

import { ApiError } from "@/app/api/api_error";

jest.mock("@/app/api/api_calls", () => {
  const actual = jest.requireActual("@/app/api/api_calls");
  return {
    ...actual,
    fetchAppsFromServer: jest.fn(),
    fetchBugReportsOverviewFromServer: jest.fn(),
    fetchBugReportsOverviewPlotFromServer: jest.fn(),
    fetchBuildsFromServer: jest.fn(),
    fetchFilterKeys: jest.fn(),
    fetchRootSpanNamesFromServer: jest.fn(),
    fetchSpansFromServer: jest.fn(),
    fetchSpanMetricsPlotFromServer: jest.fn(),
    fetchErrorsOverviewFromServer: jest.fn(),
    fetchErrorsOverviewPlotFromServer: jest.fn(),
    fetchErrorsDetailsFromServer: jest.fn(),
    fetchErrorsDetailsPlotFromServer: jest.fn(),
    fetchErrorsDistributionPlotFromServer: jest.fn(),
    fetchErrorsAttributeDistributionPlotFromServer: jest.fn(),
    fetchErrorGroupCommonPathFromServer: jest.fn(),
    fetchFunnelsFromServer: jest.fn(),
    fetchPinnedFunnelsFromServer: jest.fn(),
    setFunnelPinnedFromServer: jest.fn(),
    reorderPinnedFunnelsFromServer: jest.fn(),
    fetchFunnelFromServer: jest.fn(),
    fetchFunnelEventNamesFromServer: jest.fn(),
    fetchFunnelConversionFromServer: jest.fn(),
    fetchFunnelStepErrorsFromServer: jest.fn(),
    fetchFunnelStepTracesFromServer: jest.fn(),
    fetchFunnelStepNetworkFromServer: jest.fn(),
    fetchFunnelTrendFromServer: jest.fn(),
    fetchFunnelCadenceFromServer: jest.fn(),
    fetchFunnelStepSessionsFromServer: jest.fn(),
    createFunnelFromServer: jest.fn(),
    updateFunnelFromServer: jest.fn(),
    deleteFunnelFromServer: jest.fn(),
  };
});

// The hooks still on the filters store read it through the provider; each
// test stages the slice it needs here.
let mockFiltersState: any = { ready: false, app: null };
jest.mock("@/app/stores/provider", () => ({
  __esModule: true,
  useFiltersStore: (selector?: any) =>
    selector
      ? selector({
          filters: mockFiltersState,
          selectedApp: mockFiltersState.app,
          selectedStartDate: mockFiltersState.startDate ?? "",
          selectedEndDate: mockFiltersState.endDate ?? "",
        })
      : { filters: mockFiltersState },
}));

jest.mock("@/app/api/api_client", () => ({
  apiClient: {
    fetch: jest.fn(),
    redirectToLogin: jest.fn(),
    init: jest.fn(),
  },
}));

import {
  createFunnelFromServer,
  deleteFunnelFromServer,
  fetchAppsFromServer,
  fetchBugReportsOverviewFromServer,
  fetchBugReportsOverviewPlotFromServer,
  fetchBuildsFromServer,
  fetchErrorGroupCommonPathFromServer,
  fetchErrorsDetailsFromServer,
  fetchErrorsDetailsPlotFromServer,
  fetchErrorsDistributionPlotFromServer,
  fetchErrorsAttributeDistributionPlotFromServer,
  fetchErrorsOverviewFromServer,
  fetchErrorsOverviewPlotFromServer,
  fetchFilterKeys,
  fetchFunnelConversionFromServer,
  fetchFunnelEventNamesFromServer,
  fetchFunnelFromServer,
  fetchFunnelsFromServer,
  fetchFunnelCadenceFromServer,
  fetchFunnelStepErrorsFromServer,
  fetchFunnelStepNetworkFromServer,
  fetchFunnelStepSessionsFromServer,
  fetchFunnelStepTracesFromServer,
  fetchFunnelTrendFromServer,
  fetchPinnedFunnelsFromServer,
  fetchRootSpanNamesFromServer,
  fetchSpanMetricsPlotFromServer,
  fetchSpansFromServer,
  reorderPinnedFunnelsFromServer,
  setFunnelPinnedFromServer,
  updateFunnelFromServer,
  type Funnel,
  type FunnelStepOutcome,
  type FunnelTrendPeriod,
  type PinnedFunnelsResponse,
} from "@/app/api/api_calls";
import { apiClient } from "@/app/api/api_client";
import {
  fetchCurrentSession,
  FUNNEL_STEP_LIST_LIMIT,
  FUNNELS_LIMIT,
  RootSpanMetricsQuantile,
  signOut,
  type FilterParams,
  useAppsQuery,
  useBugReportsOverviewPlotQuery,
  useBugReportsOverviewQuery,
  useBuildsQuery,
  useErrorGroupCommonPathQuery,
  useErrorsDetailsPlotQuery,
  useErrorsDetailsQuery,
  useErrorsDistributionPlotQuery,
  useErrorsAttributeDistributionPlotQuery,
  useErrorsOverviewPlotQuery,
  useErrorsOverviewQuery,
  useDeleteFunnelMutation,
  useFilterKeysQuery,
  useFunnelCadenceQuery,
  useFunnelConversionQuery,
  useFunnelEventNamesQuery,
  useFunnelQuery,
  useFunnelsQuery,
  useFunnelStepErrorsQuery,
  useFunnelStepNetworkQuery,
  useFunnelStepSessionsQuery,
  useFunnelStepTracesQuery,
  useFunnelTrendQuery,
  usePinnedFunnelsQuery,
  useReorderPinnedFunnelsMutation,
  useRootSpanNamesQuery,
  useSaveFunnelMutation,
  useSessionQuery,
  useSetFunnelPinnedMutation,
  useSpanMetricsPlotQuery,
  useSpansQuery,
} from "@/app/query/hooks";

const mockFetchApps = fetchAppsFromServer as jest.Mock;
const mockFetchBugReportsOverview =
  fetchBugReportsOverviewFromServer as jest.Mock;
const mockFetchBugReportsOverviewPlot =
  fetchBugReportsOverviewPlotFromServer as jest.Mock;
const mockFetchBuilds = fetchBuildsFromServer as jest.Mock;
const mockFetchFilterKeys = fetchFilterKeys as jest.Mock;
const mockFetchRootSpanNames = fetchRootSpanNamesFromServer as jest.Mock;
const mockFetchSpans = fetchSpansFromServer as jest.Mock;
const mockFetchSpanMetricsPlot = fetchSpanMetricsPlotFromServer as jest.Mock;
const mockFetchErrorsOverview = fetchErrorsOverviewFromServer as jest.Mock;
const mockFetchErrorsOverviewPlot =
  fetchErrorsOverviewPlotFromServer as jest.Mock;
const mockFetchErrorsDetails = fetchErrorsDetailsFromServer as jest.Mock;
const mockFetchErrorsDetailsPlot =
  fetchErrorsDetailsPlotFromServer as jest.Mock;
const mockFetchErrorsDistributionPlot =
  fetchErrorsDistributionPlotFromServer as jest.Mock;
const mockFetchErrorsAttributeDistributionPlot =
  fetchErrorsAttributeDistributionPlotFromServer as jest.Mock;
const mockFetchErrorGroupCommonPath =
  fetchErrorGroupCommonPathFromServer as jest.Mock;
const mockFetchFunnels = fetchFunnelsFromServer as jest.Mock;
const mockFetchPinnedFunnels = fetchPinnedFunnelsFromServer as jest.Mock;
const mockSetFunnelPinned = setFunnelPinnedFromServer as jest.Mock;
const mockReorderPinnedFunnels = reorderPinnedFunnelsFromServer as jest.Mock;
const mockFetchFunnel = fetchFunnelFromServer as jest.Mock;
const mockFetchFunnelEventNames = fetchFunnelEventNamesFromServer as jest.Mock;
const mockFetchFunnelConversion = fetchFunnelConversionFromServer as jest.Mock;
const mockFetchFunnelStepErrors = fetchFunnelStepErrorsFromServer as jest.Mock;
const mockFetchFunnelStepTraces = fetchFunnelStepTracesFromServer as jest.Mock;
const mockFetchFunnelStepNetwork =
  fetchFunnelStepNetworkFromServer as jest.Mock;
const mockFetchFunnelTrend = fetchFunnelTrendFromServer as jest.Mock;
const mockFetchFunnelCadence = fetchFunnelCadenceFromServer as jest.Mock;
const mockFetchFunnelStepSessions =
  fetchFunnelStepSessionsFromServer as jest.Mock;
const mockCreateFunnel = createFunnelFromServer as jest.Mock;
const mockUpdateFunnel = updateFunnelFromServer as jest.Mock;
const mockDeleteFunnel = deleteFunnelFromServer as jest.Mock;
const mockApiClientFetch = apiClient.fetch as jest.Mock;
const mockRedirectToLogin = apiClient.redirectToLogin as jest.Mock;

const globalFetchMock = jest.fn();
(global as any).fetch = globalFetchMock;

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, client };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFiltersState = { ready: false, app: null };
});

describe("useAppsQuery", () => {
  it("does not fetch when teamId is undefined", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAppsQuery(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchApps).not.toHaveBeenCalled();
  });

  it("returns the apps list", async () => {
    mockFetchApps.mockResolvedValueOnce([{ id: "a1", name: "App 1" }]);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAppsQuery("team-1"), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.data).toEqual([{ id: "a1", name: "App 1" }]);
    expect(mockFetchApps).toHaveBeenCalledWith("team-1");
  });

  it("passes an empty list through", async () => {
    mockFetchApps.mockResolvedValueOnce([]);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAppsQuery("team-1"), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.data).toEqual([]);
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchApps.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAppsQuery("team-1"), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

describe("useFilterKeysQuery", () => {
  it("keeps the last keys while a changed name set refetches", async () => {
    mockFetchFilterKeys
      .mockResolvedValueOnce({ keys: [{ name: "k1" }], key_groups: ["g"] })
      // The second response never arrives, so the hook stays mid-fetch.
      .mockReturnValueOnce(new Promise(() => {}));

    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ names }: { names: string[] }) =>
        useFilterKeysQuery("app-1", "builds", names),
      { wrapper, initialProps: { names: [] as string[] } },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));

    rerender({ names: ["custom.plan"] });

    await waitFor(() =>
      expect(mockFetchFilterKeys).toHaveBeenLastCalledWith("app-1", "builds", [
        "custom.plan",
      ]),
    );
    expect(result.current.isFetching).toBe(true);
    expect(result.current.data?.keys).toEqual([{ name: "k1" }]);
  });
});

describe("useRootSpanNamesQuery", () => {
  const app = { id: "a1", name: "App 1", onboarded: true } as any;

  it("is disabled without an app", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRootSpanNamesQuery(null), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchRootSpanNames).not.toHaveBeenCalled();
  });

  it("fetches for the app and returns the parsed results", async () => {
    mockFetchRootSpanNames.mockResolvedValueOnce(["root.a", "root.b"]);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRootSpanNamesQuery(app), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.data).toEqual(["root.a", "root.b"]);
    expect(mockFetchRootSpanNames).toHaveBeenCalledWith(app);
  });

  it("refetches when the app changes", async () => {
    mockFetchRootSpanNames
      .mockResolvedValueOnce(["root.a"])
      .mockResolvedValueOnce(["root.b"]);

    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ current }: { current: any }) => useRootSpanNamesQuery(current),
      { wrapper, initialProps: { current: app } },
    );

    await waitFor(() => expect(result.current.data).toEqual(["root.a"]));

    rerender({ current: { ...app, id: "a2" } });

    await waitFor(() => expect(result.current.data).toEqual(["root.b"]));
    expect(mockFetchRootSpanNames).toHaveBeenCalledTimes(2);
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchRootSpanNames.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRootSpanNamesQuery(app), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

describe("fetchCurrentSession", () => {
  it("returns the user object on success", async () => {
    mockApiClientFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: {
          id: "u1",
          own_team_id: "t1",
          name: "Alice",
          email: "a@b.com",
          avatar_url: "http://x",
          confirmed_at: "now",
          last_sign_in_at: "now",
          created_at: "now",
          updated_at: "now",
        },
      }),
    });

    const session = await fetchCurrentSession();
    expect(session?.user.id).toBe("u1");
    expect(session?.user.email).toBe("a@b.com");
  });

  it("returns null when response is not ok", async () => {
    mockApiClientFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    const session = await fetchCurrentSession();
    expect(session).toBeNull();
  });

  it("returns null when response has no user", async () => {
    mockApiClientFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: null }),
    });

    const session = await fetchCurrentSession();
    expect(session).toBeNull();
  });

  it("returns null when apiClient.fetch throws (e.g. on redirectToLogin)", async () => {
    mockApiClientFetch.mockRejectedValueOnce(new Error("boom"));

    const session = await fetchCurrentSession();
    expect(session).toBeNull();
  });
});

describe("useSessionQuery", () => {
  it("returns the session on success", async () => {
    mockApiClientFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: {
          id: "u1",
          own_team_id: "t1",
          name: "Alice",
          email: "a@b.com",
          avatar_url: "http://x",
          confirmed_at: "now",
          last_sign_in_at: "now",
          created_at: "now",
          updated_at: "now",
        },
      }),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSessionQuery(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.data?.user.id).toBe("u1");
  });

  it("errors when no session is returned", async () => {
    mockApiClientFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSessionQuery(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});

describe("signOut", () => {
  it("DELETEs /auth/logout and triggers redirectToLogin", async () => {
    globalFetchMock.mockResolvedValueOnce({ ok: true });

    await signOut();

    expect(globalFetchMock).toHaveBeenCalledWith(
      "/auth/logout",
      expect.objectContaining({
        method: "DELETE",
        credentials: "include",
      }),
    );
    expect(mockRedirectToLogin).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Errors (unified Crashes + ANRs): one describe per hook, each covering
// the disabled / pending / success / error paths.
// ─────────────────────────────────────────────────────────────────────────

describe("useErrorsOverviewQuery", () => {
  const filteredBy = (filterExpr: string | null) => ({
    appId: "app-1",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-02T00:00:00Z",
    filterExpr,
  });

  it("does not fetch without an app and a date range", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsOverviewQuery(null, 0), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsOverview).not.toHaveBeenCalled();
  });

  it("returns success with data once the fetch resolves", async () => {
    mockFetchErrorsOverview.mockResolvedValueOnce({ results: [{ id: "g1" }] });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsOverviewQuery(filteredBy("error_type:in:crash"), 0),
      { wrapper },
    );

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchErrorsOverview).toHaveBeenCalledWith(
      "app-1",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "error_type:in:crash",
      5,
      0,
    );
    expect((result.current.data as any).results[0].id).toBe("g1");
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchErrorsOverview.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsOverviewQuery(filteredBy(null), 0),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

describe("useBuildsQuery", () => {
  const filteredBy = (filterExpr: string | null) => ({
    appId: "app-1",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-02T00:00:00Z",
    filterExpr,
  });

  it("does not fetch without an app and a date range", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBuildsQuery(null, 0), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchBuilds).not.toHaveBeenCalled();
  });

  it("fetches for the app, range, filter and page, and returns the data", async () => {
    mockFetchBuilds.mockResolvedValueOnce({
      results: [{ id: "b1" }],
      meta: { next: false, previous: false },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBuildsQuery(filteredBy("code-1"), 20),
      {
        wrapper,
      },
    );

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchBuilds).toHaveBeenCalledWith(
      "app-1",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "code-1",
      10,
      20,
    );
    expect((result.current.data as any).results[0].id).toBe("b1");
  });

  it("fetches without a filter when none is given", async () => {
    mockFetchBuilds.mockResolvedValueOnce({
      results: [],
      meta: { next: false, previous: false },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBuildsQuery(filteredBy(null), 0), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mockFetchBuilds).toHaveBeenCalledWith(
      "app-1",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      null,
      10,
      0,
    );
  });

  it("fetches again for another page, and shows the last one meanwhile", async () => {
    mockFetchBuilds
      .mockResolvedValueOnce({
        results: [{ id: "b1" }],
        meta: { next: true, previous: false },
      })
      // The second page stays pending, so the hook stays mid-fetch.
      .mockReturnValueOnce(new Promise(() => {}));

    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ offset }) => useBuildsQuery(filteredBy(null), offset),
      { wrapper, initialProps: { offset: 0 } },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));

    rerender({ offset: 10 });

    await waitFor(() =>
      expect(mockFetchBuilds).toHaveBeenLastCalledWith(
        "app-1",
        "2026-01-01T00:00:00Z",
        "2026-01-02T00:00:00Z",
        null,
        10,
        10,
      ),
    );
    expect(result.current.isFetching).toBe(true);
    expect((result.current.data as any).results[0].id).toBe("b1");
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchBuilds.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBuildsQuery(filteredBy("code-1"), 0),
      {
        wrapper,
      },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

describe("useSpansQuery", () => {
  const filteredBy = (filterExpr: string | null) => ({
    appId: "app-1",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-02T00:00:00Z",
    filterExpr,
  });

  it("does not fetch without an app and a date range", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSpansQuery(null, "root.a", 0), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchSpans).not.toHaveBeenCalled();
  });

  it("does not fetch without a span name", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useSpansQuery(filteredBy(null), null, 0),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchSpans).not.toHaveBeenCalled();
  });

  it("fetches for the span, range, filter and page, and returns the data", async () => {
    mockFetchSpans.mockResolvedValueOnce({
      results: [{ span_id: "s1" }],
      meta: { next: false, previous: false },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useSpansQuery(filteredBy("span_status:in:error"), "root.a", 10),
      { wrapper },
    );

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchSpans).toHaveBeenCalledWith(
      "app-1",
      "root.a",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "span_status:in:error",
      5,
      10,
    );
    expect((result.current.data as any).results[0].span_id).toBe("s1");
  });

  it("fetches without a filter when none is given", async () => {
    mockFetchSpans.mockResolvedValueOnce({
      results: [],
      meta: { next: false, previous: false },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useSpansQuery(filteredBy(null), "root.a", 0),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mockFetchSpans).toHaveBeenCalledWith(
      "app-1",
      "root.a",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      null,
      5,
      0,
    );
  });

  it("fetches again for another page, and shows the last one meanwhile", async () => {
    mockFetchSpans
      .mockResolvedValueOnce({
        results: [{ span_id: "s1" }],
        meta: { next: true, previous: false },
      })
      // The second page stays pending, so the hook stays mid-fetch.
      .mockReturnValueOnce(new Promise(() => {}));

    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ offset }) => useSpansQuery(filteredBy(null), "root.a", offset),
      { wrapper, initialProps: { offset: 0 } },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));

    rerender({ offset: 5 });

    await waitFor(() =>
      expect(mockFetchSpans).toHaveBeenLastCalledWith(
        "app-1",
        "root.a",
        "2026-01-01T00:00:00Z",
        "2026-01-02T00:00:00Z",
        null,
        5,
        5,
      ),
    );
    expect(result.current.isFetching).toBe(true);
    expect((result.current.data as any).results[0].span_id).toBe("s1");
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchSpans.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useSpansQuery(filteredBy(null), "root.a", 0),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

describe("useSpanMetricsPlotQuery", () => {
  const filteredBy = (filterExpr: string | null) => ({
    appId: "app-1",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-02T00:00:00Z",
    filterExpr,
  });

  it("does not fetch without an app and a date range", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useSpanMetricsPlotQuery(null, "root.a"),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchSpanMetricsPlot).not.toHaveBeenCalled();
  });

  it("does not fetch without a span name", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useSpanMetricsPlotQuery(filteredBy(null), null),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchSpanMetricsPlot).not.toHaveBeenCalled();
  });

  it("fetches for the span, range and filter, and returns the raw plot", async () => {
    const rawPlot = [{ id: "v1", data: [{ datetime: "2026-01-01", p50: 1 }] }];
    mockFetchSpanMetricsPlot.mockResolvedValueOnce(rawPlot);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useSpanMetricsPlotQuery(filteredBy("span_status:in:ok"), "root.a"),
      { wrapper },
    );

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchSpanMetricsPlot).toHaveBeenCalledWith(
      "app-1",
      "root.a",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "span_status:in:ok",
    );
    expect(result.current.data).toEqual(rawPlot);
  });

  it("passes a null plot through", async () => {
    mockFetchSpanMetricsPlot.mockResolvedValueOnce(null);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useSpanMetricsPlotQuery(filteredBy(null), "root.a"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toBeNull();
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchSpanMetricsPlot.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useSpanMetricsPlotQuery(filteredBy(null), "root.a"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

describe("useBugReportsOverviewQuery", () => {
  const filteredBy = (filterExpr: string | null) => ({
    appId: "app-1",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-02T00:00:00Z",
    filterExpr,
  });

  it("does not fetch without an app and a date range", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBugReportsOverviewQuery(null, 0), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchBugReportsOverview).not.toHaveBeenCalled();
  });

  it("fetches for the app, range, filter and page, and returns the data", async () => {
    mockFetchBugReportsOverview.mockResolvedValueOnce({
      results: [{ event_id: "br1" }],
      meta: { next: false, previous: false },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useBugReportsOverviewQuery(filteredBy("bug_report_status:in:open"), 10),
      { wrapper },
    );

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchBugReportsOverview).toHaveBeenCalledWith(
      "app-1",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "bug_report_status:in:open",
      5,
      10,
    );
    expect((result.current.data as any).results[0].event_id).toBe("br1");
  });

  it("fetches without a filter when none is given", async () => {
    mockFetchBugReportsOverview.mockResolvedValueOnce({
      results: [],
      meta: { next: false, previous: false },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBugReportsOverviewQuery(filteredBy(null), 0),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mockFetchBugReportsOverview).toHaveBeenCalledWith(
      "app-1",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      null,
      5,
      0,
    );
  });

  it("fetches again for another page, and shows the last one meanwhile", async () => {
    mockFetchBugReportsOverview
      .mockResolvedValueOnce({
        results: [{ event_id: "br1" }],
        meta: { next: true, previous: false },
      })
      // The second page stays pending, so the hook stays mid-fetch.
      .mockReturnValueOnce(new Promise(() => {}));

    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ offset }) => useBugReportsOverviewQuery(filteredBy(null), offset),
      { wrapper, initialProps: { offset: 0 } },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));

    rerender({ offset: 5 });

    await waitFor(() =>
      expect(mockFetchBugReportsOverview).toHaveBeenLastCalledWith(
        "app-1",
        "2026-01-01T00:00:00Z",
        "2026-01-02T00:00:00Z",
        null,
        5,
        5,
      ),
    );
    expect(result.current.isFetching).toBe(true);
    expect((result.current.data as any).results[0].event_id).toBe("br1");
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchBugReportsOverview.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBugReportsOverviewQuery(filteredBy(null), 0),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

describe("useBugReportsOverviewPlotQuery", () => {
  const filteredBy = (filterExpr: string | null) => ({
    appId: "app-1",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-02T00:00:00Z",
    filterExpr,
  });

  it("does not fetch without an app and a date range", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBugReportsOverviewPlotQuery(null), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchBugReportsOverviewPlot).not.toHaveBeenCalled();
  });

  it("fetches for the app, range and filter, and returns the mapped plot", async () => {
    mockFetchBugReportsOverviewPlot.mockResolvedValueOnce([
      { id: "v1", data: [{ datetime: "2026-01-01", instances: 3 }] },
    ]);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useBugReportsOverviewPlotQuery(filteredBy("bug_report_status:in:open")),
      { wrapper },
    );

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchBugReportsOverviewPlot).toHaveBeenCalledWith(
      "app-1",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "bug_report_status:in:open",
    );
    expect(result.current.data).toEqual([
      { id: "v1", data: [{ x: "2026-01-01", y: 3 }] },
    ]);
  });

  it("passes a null plot through", async () => {
    mockFetchBugReportsOverviewPlot.mockResolvedValueOnce(null);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBugReportsOverviewPlotQuery(filteredBy(null)),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toBeNull();
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchBugReportsOverviewPlot.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBugReportsOverviewPlotQuery(filteredBy(null)),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

describe("useErrorsOverviewPlotQuery", () => {
  const filteredBy = (filterExpr: string | null) => ({
    appId: "app-1",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-02T00:00:00Z",
    filterExpr,
  });

  it("does not fetch without an app and a date range", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsOverviewPlotQuery(null), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsOverviewPlot).not.toHaveBeenCalled();
  });

  it("returns mapped data on success", async () => {
    mockFetchErrorsOverviewPlot.mockResolvedValueOnce([
      { id: "android", data: [{ datetime: "x", instances: 1 }] },
    ]);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsOverviewPlotQuery(filteredBy("error_type:in:crash")),
      { wrapper },
    );

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mockFetchErrorsOverviewPlot).toHaveBeenCalledWith(
      "app-1",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "error_type:in:crash",
    );
    expect(result.current.data).toEqual([
      { id: "android", data: [{ x: "x", y: 1 }] },
    ]);
  });

  it("returns null on NoData", async () => {
    mockFetchErrorsOverviewPlot.mockResolvedValueOnce(null);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsOverviewPlotQuery(filteredBy(null)),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toBeNull();
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchErrorsOverviewPlot.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsOverviewPlotQuery(filteredBy(null)),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

describe("useErrorsDetailsQuery", () => {
  const filteredBy = (filterExpr: string | null) => ({
    appId: "app-1",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-02T00:00:00Z",
    filterExpr,
  });

  it("does not fetch without an app and a date range", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDetailsQuery(null, "group-1", 0),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsDetails).not.toHaveBeenCalled();
  });

  it("is disabled when errorGroupId is empty", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDetailsQuery(filteredBy(null), "", 0),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsDetails).not.toHaveBeenCalled();
  });

  it("returns success with data once the fetch resolves", async () => {
    mockFetchErrorsDetails.mockResolvedValueOnce({ results: [{ id: "e1" }] });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useErrorsDetailsQuery(filteredBy("error_type:in:crash"), "group-1", 3),
      { wrapper },
    );

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchErrorsDetails).toHaveBeenCalledWith(
      "app-1",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "error_type:in:crash",
      "group-1",
      1,
      3,
    );
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchErrorsDetails.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDetailsQuery(filteredBy(null), "group-1", 0),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

describe("useErrorsDetailsPlotQuery", () => {
  const filteredBy = (filterExpr: string | null) => ({
    appId: "app-1",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-02T00:00:00Z",
    filterExpr,
  });

  it("does not fetch without an app and a date range", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDetailsPlotQuery(null, "group-1"),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsDetailsPlot).not.toHaveBeenCalled();
  });

  it("is disabled when errorGroupId is empty", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDetailsPlotQuery(filteredBy(null), ""),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsDetailsPlot).not.toHaveBeenCalled();
  });

  it("returns mapped data on success", async () => {
    mockFetchErrorsDetailsPlot.mockResolvedValueOnce([
      { id: "ios", data: [{ datetime: "y", instances: 2 }] },
    ]);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDetailsPlotQuery(filteredBy(null), "group-1"),
      { wrapper },
    );

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mockFetchErrorsDetailsPlot).toHaveBeenCalledWith(
      "app-1",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      null,
      "group-1",
    );
    expect(result.current.data).toEqual([
      { id: "ios", data: [{ x: "y", y: 2 }] },
    ]);
  });

  it("returns null on NoData", async () => {
    mockFetchErrorsDetailsPlot.mockResolvedValueOnce(null);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDetailsPlotQuery(filteredBy(null), "group-1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toBeNull();
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchErrorsDetailsPlot.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDetailsPlotQuery(filteredBy(null), "group-1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

describe("useErrorsDistributionPlotQuery", () => {
  const filteredBy = (filterExpr: string | null) => ({
    appId: "app-1",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-02T00:00:00Z",
    filterExpr,
  });

  it("does not fetch without an app and a date range", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDistributionPlotQuery(null, "group-1"),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsDistributionPlot).not.toHaveBeenCalled();
  });

  it("is disabled when errorGroupId is empty", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDistributionPlotQuery(filteredBy(null), ""),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsDistributionPlot).not.toHaveBeenCalled();
  });

  it("returns parsed distribution data on success", async () => {
    const empty = { values: [], other_count: 0, distinct_count: 0 };
    mockFetchErrorsDistributionPlot.mockResolvedValueOnce({
      app_version: empty,
      os_version: {
        values: [{ value: "android 13", count: 5 }],
        other_count: 2,
        distinct_count: 3,
      },
      country: {
        values: [{ value: "US", count: 7 }],
        other_count: 0,
        distinct_count: 1,
      },
      network_type: empty,
      locale: empty,
      device: empty,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDistributionPlotQuery(filteredBy(null), "group-1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mockFetchErrorsDistributionPlot).toHaveBeenCalledWith(
      "app-1",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      null,
      "group-1",
    );
    expect(result.current.data?.map((d) => d.attribute)).toEqual([
      "app_version",
      "os_version",
      "country",
      "network_type",
      "locale",
      "device",
    ]);
    expect(result.current.data?.[1]).toEqual({
      attribute: "os_version",
      label: "API Level",
      values: [{ label: "Android API Level 13", count: 5 }],
      otherCount: 2,
      distinctCount: 3,
      total: 7,
    });
    expect(result.current.data?.[0]).toMatchObject({
      label: "App Version",
      values: [],
      total: 0,
    });
  });

  it("returns null on NoData", async () => {
    mockFetchErrorsDistributionPlot.mockResolvedValueOnce(null);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDistributionPlotQuery(filteredBy(null), "group-1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toBeNull();
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchErrorsDistributionPlot.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDistributionPlotQuery(filteredBy(null), "group-1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

describe("useErrorsAttributeDistributionPlotQuery", () => {
  const filteredBy = (filterExpr: string | null) => ({
    appId: "app-1",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-02T00:00:00Z",
    filterExpr,
  });

  it("does not fetch until an attribute is selected", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useErrorsAttributeDistributionPlotQuery(
          filteredBy(null),
          "group-1",
          null,
        ),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsAttributeDistributionPlot).not.toHaveBeenCalled();
  });

  it("fetches and parses the selected attribute", async () => {
    mockFetchErrorsAttributeDistributionPlot.mockResolvedValueOnce({
      values: [
        { value: "Google - Pixel 8", count: 5 },
        { value: "", count: 1 },
      ],
      other_count: 0,
      distinct_count: 2,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useErrorsAttributeDistributionPlotQuery(
          filteredBy("network_type:eq:wifi"),
          "group-1",
          "device",
        ),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mockFetchErrorsAttributeDistributionPlot).toHaveBeenCalledWith(
      "app-1",
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "network_type:eq:wifi",
      "group-1",
      "device",
    );
    expect(result.current.data).toEqual({
      attribute: "device",
      label: "Device",
      values: [
        { label: "Google - Pixel 8", count: 5 },
        { label: "Unknown", count: 1 },
      ],
      otherCount: 0,
      distinctCount: 2,
      total: 6,
    });
  });

  it("shows the placeholder while the attribute loads", () => {
    mockFetchErrorsAttributeDistributionPlot.mockReturnValueOnce(
      new Promise(() => {}),
    );
    const placeholder = {
      attribute: "device" as const,
      label: "Device",
      values: [{ label: "Google - Pixel 8", count: 5 }],
      otherCount: 3,
      distinctCount: 4,
      total: 8,
    };

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useErrorsAttributeDistributionPlotQuery(
          filteredBy(null),
          "group-1",
          "device",
          placeholder,
        ),
      { wrapper },
    );

    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toBe(placeholder);
  });
});

describe("useErrorGroupCommonPathQuery", () => {
  it("is disabled when appId is empty", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorGroupCommonPathQuery("", "group-1"),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorGroupCommonPath).not.toHaveBeenCalled();
  });

  it("is disabled when errorGroupId is empty", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorGroupCommonPathQuery("app-1", ""),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorGroupCommonPath).not.toHaveBeenCalled();
  });

  it("is disabled until requested", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorGroupCommonPathQuery("app-1", "group-1", false),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorGroupCommonPath).not.toHaveBeenCalled();
  });

  it("returns success with data", async () => {
    mockFetchErrorGroupCommonPath.mockResolvedValueOnce({
      sessions_analyzed: 7,
      steps: [],
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorGroupCommonPathQuery("app-1", "group-1"),
      { wrapper },
    );

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchErrorGroupCommonPath).toHaveBeenCalledWith(
      "app-1",
      "group-1",
    );
    expect(result.current.data?.sessions_analyzed).toBe(7);
  });

  it("surfaces a failed fetch as a query error", async () => {
    const failure = new ApiError(500, "request failed");
    mockFetchErrorGroupCommonPath.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorGroupCommonPathQuery("app-1", "group-1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(failure);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Funnels
// ─────────────────────────────────────────────────────────────────────────

const funnelParams: FilterParams = {
  appId: "app-1",
  startDate: "2026-01-01T00:00:00Z",
  endDate: "2026-01-02T00:00:00Z",
  filterExpr: null,
};

const funnelA = { id: "f1", name: "Checkout" } as Funnel;
const funnelB = { id: "f2", name: "Onboarding" } as Funnel;

// makeWrapper's client does not retry, so checking that a hook disables retries
// needs a client that does.
function makeRetryingWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 1, retryDelay: 0 } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, client };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// clearMocks keeps mockResolvedValue implementations, so these are reset to
// stop one test's responses answering the next.
beforeEach(() => {
  for (const mock of [
    mockFetchFunnels,
    mockFetchPinnedFunnels,
    mockSetFunnelPinned,
    mockReorderPinnedFunnels,
    mockFetchFunnel,
    mockFetchFunnelEventNames,
    mockFetchFunnelConversion,
    mockFetchFunnelStepErrors,
    mockFetchFunnelStepTraces,
    mockFetchFunnelStepNetwork,
    mockFetchFunnelTrend,
    mockCreateFunnel,
    mockUpdateFunnel,
    mockDeleteFunnel,
  ]) {
    mock.mockReset();
  }
});

describe("funnel queries", () => {
  it.each<[string, () => { fetchStatus: string }, jest.Mock]>([
    [
      "useFunnelsQuery",
      () => useFunnelsQuery(undefined, "", 0),
      mockFetchFunnels,
    ],
    [
      "usePinnedFunnelsQuery",
      () => usePinnedFunnelsQuery(undefined),
      mockFetchPinnedFunnels,
    ],
    [
      "useFunnelEventNamesQuery",
      () => useFunnelEventNamesQuery(undefined, ""),
      mockFetchFunnelEventNames,
    ],
    [
      "useFunnelConversionQuery",
      () => useFunnelConversionQuery(null, "f1"),
      mockFetchFunnelConversion,
    ],
    [
      "useFunnelTrendQuery",
      () => useFunnelTrendQuery(null, "f1", "week", false),
      mockFetchFunnelTrend,
    ],
  ])("%s does not fetch without an app", (_name, useFunnelHook, fetch) => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(useFunnelHook, { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each<[string, () => { fetchStatus: string }, jest.Mock]>([
    [
      "useFunnelConversionQuery",
      () => useFunnelConversionQuery(funnelParams, "f1", false),
      mockFetchFunnelConversion,
    ],
    [
      "useFunnelTrendQuery",
      () => useFunnelTrendQuery(funnelParams, "f1", "week", false, false),
      mockFetchFunnelTrend,
    ],
    [
      "useFunnelCadenceQuery",
      () => useFunnelCadenceQuery(funnelParams, "f1", 4, false),
      mockFetchFunnelCadence,
    ],
    [
      "useFunnelStepErrorsQuery",
      () => useFunnelStepErrorsQuery(funnelParams, "f1", 1, 0, false),
      mockFetchFunnelStepErrors,
    ],
    [
      "useFunnelStepTracesQuery",
      () =>
        useFunnelStepTracesQuery(
          funnelParams,
          "f1",
          1,
          RootSpanMetricsQuantile.p50,
          0,
          false,
        ),
      mockFetchFunnelStepTraces,
    ],
    [
      "useFunnelStepNetworkQuery",
      () =>
        useFunnelStepNetworkQuery(
          funnelParams,
          "f1",
          1,
          RootSpanMetricsQuantile.p50,
          0,
          false,
        ),
      mockFetchFunnelStepNetwork,
    ],
  ])("%s does not fetch while disabled", (_name, useFunnelHook, fetch) => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(useFunnelHook, { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each<
    [string, () => { status: string; data: unknown }, jest.Mock, unknown[]]
  >([
    [
      "useFunnelsQuery",
      () => useFunnelsQuery("app-1", "check", 5),
      mockFetchFunnels,
      ["app-1", "check", FUNNELS_LIMIT, 5],
    ],
    [
      "usePinnedFunnelsQuery",
      () => usePinnedFunnelsQuery("app-1"),
      mockFetchPinnedFunnels,
      ["app-1"],
    ],
    [
      "useFunnelQuery",
      () => useFunnelQuery("app-1", "f1"),
      mockFetchFunnel,
      ["app-1", "f1"],
    ],
    [
      "useFunnelEventNamesQuery",
      () => useFunnelEventNamesQuery("app-1", "cart"),
      mockFetchFunnelEventNames,
      ["app-1", "cart"],
    ],
  ])(
    "%s fetches with its arguments and returns the response",
    async (_name, useFunnelHook, fetch, args) => {
      const response = { results: [funnelA] };
      fetch.mockResolvedValueOnce(response);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(useFunnelHook, { wrapper });

      await waitFor(() => expect(result.current.status).toBe("success"));
      expect(fetch).toHaveBeenCalledWith(...args);
      expect(result.current.data).toBe(response);
    },
  );

  it.each<
    [
      string,
      (offset: number) => {
        status: string;
        data: unknown;
        isFetching: boolean;
      },
      jest.Mock,
    ]
  >([
    [
      "useFunnelsQuery",
      (offset) => useFunnelsQuery("app-1", "", offset),
      mockFetchFunnels,
    ],
    [
      "useFunnelStepErrorsQuery",
      (offset) => useFunnelStepErrorsQuery(funnelParams, "f1", 1, offset),
      mockFetchFunnelStepErrors,
    ],
    [
      "useFunnelStepTracesQuery",
      (offset) =>
        useFunnelStepTracesQuery(
          funnelParams,
          "f1",
          1,
          RootSpanMetricsQuantile.p95,
          offset,
        ),
      mockFetchFunnelStepTraces,
    ],
    [
      "useFunnelStepNetworkQuery",
      (offset) =>
        useFunnelStepNetworkQuery(
          funnelParams,
          "f1",
          1,
          RootSpanMetricsQuantile.p95,
          offset,
        ),
      mockFetchFunnelStepNetwork,
    ],
  ])(
    "%s shows the last page while it fetches another",
    async (_name, useFunnelHook, fetch) => {
      const firstPage = {
        meta: { next: true, previous: false },
        results: [{ id: "first" }],
      };
      fetch
        .mockResolvedValueOnce(firstPage)
        // The second page stays pending, so the hook stays mid-fetch.
        .mockReturnValueOnce(new Promise(() => {}));

      const { wrapper } = makeWrapper();
      const { result, rerender } = renderHook(
        ({ offset }) => useFunnelHook(offset),
        { wrapper, initialProps: { offset: 0 } },
      );
      await waitFor(() => expect(result.current.status).toBe("success"));

      rerender({ offset: 5 });

      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(result.current.isFetching).toBe(true);
      expect(result.current.data).toBe(firstPage);
    },
  );

  it("reuses fresh event names when another step picker mounts", async () => {
    mockFetchFunnelEventNames.mockResolvedValue(["app_open"]);

    const { wrapper } = makeWrapper();
    const first = renderHook(() => useFunnelEventNamesQuery("app-1", ""), {
      wrapper,
    });
    await waitFor(() => expect(first.result.current.status).toBe("success"));

    const second = renderHook(() => useFunnelEventNamesQuery("app-1", ""), {
      wrapper,
    });

    expect(second.result.current.data).toEqual(["app_open"]);
    expect(second.result.current.isFetching).toBe(false);
    expect(mockFetchFunnelEventNames).toHaveBeenCalledTimes(1);
  });

  it("shows the last event names while it fetches a new search", async () => {
    mockFetchFunnelEventNames
      .mockResolvedValueOnce(["app_open", "purchase"])
      // The search results stay pending, so the hook stays mid-fetch.
      .mockReturnValueOnce(new Promise(() => {}));

    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ search }) => useFunnelEventNamesQuery("app-1", search),
      { wrapper, initialProps: { search: "" } },
    );
    await waitFor(() => expect(result.current.status).toBe("success"));

    rerender({ search: "pur" });

    await waitFor(() =>
      expect(mockFetchFunnelEventNames).toHaveBeenLastCalledWith(
        "app-1",
        "pur",
      ),
    );
    expect(result.current.isFetching).toBe(true);
    expect(result.current.data).toEqual(["app_open", "purchase"]);
  });
});

type FunnelResultProps = {
  params: FilterParams;
  funnelId: string;
  step: number;
  quantile: RootSpanMetricsQuantile;
  offset: number;
  period: FunnelTrendPeriod;
  withBuilds: boolean;
  outcome: FunnelStepOutcome;
  weeks: number;
};

const resultProps: FunnelResultProps = {
  params: funnelParams,
  funnelId: "f1",
  step: 1,
  quantile: RootSpanMetricsQuantile.p95,
  offset: 0,
  period: "week",
  withBuilds: true,
  outcome: "dropped",
  weeks: 4,
};

const resultPropChanges: Record<string, Partial<FunnelResultProps>> = {
  funnel: { funnelId: "f2" },
  step: { step: 2 },
  quantile: { quantile: RootSpanMetricsQuantile.p99 },
  page: { offset: FUNNEL_STEP_LIST_LIMIT },
  period: { period: "month" },
  builds: { withBuilds: false },
  outcome: { outcome: "converted" },
  weeks: { weeks: 12 },
  app: { params: { ...funnelParams, appId: "app-2" } },
  "start date": {
    params: { ...funnelParams, startDate: "2025-12-01T00:00:00Z" },
  },
  "end date": { params: { ...funnelParams, endDate: "2026-01-03T00:00:00Z" } },
  "filter expression": {
    params: { ...funnelParams, filterExpr: "os_name:in:[ios]" },
  },
};

const rangeChanges = ["app", "start date", "end date", "filter expression"];

const resultQueries: {
  name: string;
  useResult: (props: FunnelResultProps) => { status: string; error: unknown };
  fetch: jest.Mock;
  fetchArgs: (props: FunnelResultProps) => unknown[];
  refetchesOn: string[];
}[] = [
  {
    name: "useFunnelConversionQuery",
    useResult: (p) => useFunnelConversionQuery(p.params, p.funnelId),
    fetch: mockFetchFunnelConversion,
    fetchArgs: (p) => [
      p.params.appId,
      p.funnelId,
      p.params.startDate,
      p.params.endDate,
      p.params.filterExpr,
    ],
    refetchesOn: ["funnel", ...rangeChanges],
  },
  {
    name: "useFunnelStepErrorsQuery",
    useResult: (p) =>
      useFunnelStepErrorsQuery(p.params, p.funnelId, p.step, p.offset),
    fetch: mockFetchFunnelStepErrors,
    fetchArgs: (p) => [
      p.params.appId,
      p.funnelId,
      p.step,
      p.params.startDate,
      p.params.endDate,
      p.params.filterExpr,
      FUNNEL_STEP_LIST_LIMIT,
      p.offset,
    ],
    refetchesOn: ["funnel", "step", "page", ...rangeChanges],
  },
  ...(
    [
      [
        "useFunnelStepTracesQuery",
        useFunnelStepTracesQuery,
        mockFetchFunnelStepTraces,
      ],
      [
        "useFunnelStepNetworkQuery",
        useFunnelStepNetworkQuery,
        mockFetchFunnelStepNetwork,
      ],
    ] as const
  ).map(([name, useStepQuery, fetch]) => ({
    name,
    useResult: (p: FunnelResultProps) =>
      useStepQuery(p.params, p.funnelId, p.step, p.quantile, p.offset),
    fetch,
    fetchArgs: (p: FunnelResultProps) => [
      p.params.appId,
      p.funnelId,
      p.step,
      p.quantile,
      p.params.startDate,
      p.params.endDate,
      p.params.filterExpr,
      FUNNEL_STEP_LIST_LIMIT,
      p.offset,
    ],
    refetchesOn: ["funnel", "step", "quantile", "page", ...rangeChanges],
  })),
  {
    name: "useFunnelTrendQuery",
    useResult: (p) =>
      useFunnelTrendQuery(p.params, p.funnelId, p.period, p.withBuilds),
    fetch: mockFetchFunnelTrend,
    fetchArgs: (p) => [
      p.params.appId,
      p.funnelId,
      p.period,
      p.params.filterExpr,
      p.withBuilds,
    ],
    refetchesOn: ["funnel", "period", "builds", "app", "filter expression"],
  },
  {
    name: "useFunnelStepSessionsQuery",
    useResult: (p) =>
      useFunnelStepSessionsQuery(
        p.params,
        p.funnelId,
        p.step,
        p.outcome,
        p.offset,
      ),
    fetch: mockFetchFunnelStepSessions,
    fetchArgs: (p) => [
      p.params.appId,
      p.funnelId,
      p.step,
      p.outcome,
      p.params.startDate,
      p.params.endDate,
      p.params.filterExpr,
      FUNNEL_STEP_LIST_LIMIT,
      p.offset,
    ],
    refetchesOn: ["funnel", "step", "outcome", "page", ...rangeChanges],
  },
  {
    name: "useFunnelCadenceQuery",
    useResult: (p) => useFunnelCadenceQuery(p.params, p.funnelId, p.weeks),
    fetch: mockFetchFunnelCadence,
    fetchArgs: (p) => [
      p.params.appId,
      p.funnelId,
      p.weeks,
      p.params.filterExpr,
    ],
    refetchesOn: ["funnel", "weeks", "app", "filter expression"],
  },
];

describe.each(resultQueries)(
  "$name",
  ({ useResult, fetch, fetchArgs, refetchesOn }) => {
    it.each(refetchesOn)(
      "fetches again when the %s changes",
      async (change) => {
        fetch.mockResolvedValue({});

        const { wrapper } = makeWrapper();
        const { result, rerender } = renderHook(useResult, {
          wrapper,
          initialProps: resultProps,
        });
        await waitFor(() => expect(result.current.status).toBe("success"));
        expect(fetch).toHaveBeenCalledWith(...fetchArgs(resultProps));

        const next = { ...resultProps, ...resultPropChanges[change] };
        rerender(next);

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        expect(fetch).toHaveBeenLastCalledWith(...fetchArgs(next));
      },
    );

    it("surfaces a failure without retrying", async () => {
      const failure = new ApiError(500, "request failed");
      fetch.mockRejectedValue(failure);

      const { wrapper } = makeRetryingWrapper();
      const { result } = renderHook(() => useResult(resultProps), { wrapper });

      await waitFor(() => expect(result.current.status).toBe("error"));
      expect(result.current.error).toBe(failure);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  },
);

describe("useFunnelTrendQuery", () => {
  it("does not fetch again when only the date range changes", async () => {
    mockFetchFunnelTrend.mockResolvedValue({
      event_names: [],
      points: [],
      builds: [],
    });

    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ params }: { params: FilterParams }) =>
        useFunnelTrendQuery(params, "f1", "week", false),
      { wrapper, initialProps: { params: funnelParams } },
    );
    await waitFor(() => expect(result.current.status).toBe("success"));

    rerender({
      params: {
        ...funnelParams,
        startDate: "2025-12-01T00:00:00Z",
        endDate: "2026-01-03T00:00:00Z",
      },
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockFetchFunnelTrend).toHaveBeenCalledTimes(1);
  });
});

const listFetches = {
  list: mockFetchFunnels,
  pinned: mockFetchPinnedFunnels,
  funnel: mockFetchFunnel,
};

const resultFetches = Object.fromEntries(
  resultQueries.map(({ name, fetch }) => [name, fetch]),
);

function useFunnelLists(appId: string) {
  return {
    list: useFunnelsQuery(appId, "", 0),
    pinned: usePinnedFunnelsQuery(appId),
    funnel: useFunnelQuery(appId, "f1"),
  };
}

function useFunnelResults() {
  const {
    params,
    funnelId,
    step,
    quantile,
    offset,
    period,
    withBuilds,
    outcome,
    weeks,
  } = resultProps;
  return {
    conversion: useFunnelConversionQuery(params, funnelId),
    stepErrors: useFunnelStepErrorsQuery(params, funnelId, step, offset),
    stepTraces: useFunnelStepTracesQuery(
      params,
      funnelId,
      step,
      quantile,
      offset,
    ),
    stepNetwork: useFunnelStepNetworkQuery(
      params,
      funnelId,
      step,
      quantile,
      offset,
    ),
    trend: useFunnelTrendQuery(params, funnelId, period, withBuilds),
    stepSessions: useFunnelStepSessionsQuery(
      params,
      funnelId,
      step,
      outcome,
      offset,
    ),
    cadence: useFunnelCadenceQuery(params, funnelId, weeks),
  };
}

function stageFunnelViews() {
  for (const fetch of [
    ...Object.values(listFetches),
    ...Object.values(resultFetches),
  ]) {
    fetch.mockResolvedValue({});
  }
}

async function waitForAll(
  readQueries: () => Record<string, { status: string }>,
) {
  await waitFor(() => {
    const statuses = Object.values(readQueries()).map((query) => query.status);
    expect(statuses).toEqual(statuses.map(() => "success"));
  });
}

function clearFetchCounts() {
  for (const fetch of [
    ...Object.values(listFetches),
    ...Object.values(resultFetches),
  ]) {
    fetch.mockClear();
  }
}

function fetchCounts(fetches: Record<string, jest.Mock>, appId: string) {
  return Object.fromEntries(
    Object.entries(fetches).map(([name, fetch]) => [
      name,
      fetch.mock.calls.filter(([calledAppId]) => calledAppId === appId).length,
    ]),
  );
}

const noListFetches = { list: 0, pinned: 0, funnel: 0 };

describe("useSetFunnelPinnedMutation", () => {
  it("pins through the api and refetches the app's funnel lists and funnel, but not its results", async () => {
    stageFunnelViews();
    mockSetFunnelPinned.mockResolvedValueOnce({ ...funnelA, pinned: true });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => ({
        app1: useFunnelLists("app-1"),
        app2: useFunnelLists("app-2"),
        results: useFunnelResults(),
        setPinned: useSetFunnelPinnedMutation(),
      }),
      { wrapper },
    );
    await waitForAll(() => result.current.app1);
    await waitForAll(() => result.current.app2);
    await waitForAll(() => result.current.results);
    clearFetchCounts();

    await act(() =>
      result.current.setPinned.mutateAsync({
        appId: "app-1",
        funnelId: "f1",
        pinned: true,
      }),
    );

    expect(mockSetFunnelPinned).toHaveBeenCalledWith("app-1", "f1", true);
    expect(fetchCounts(listFetches, "app-1")).toEqual({
      list: 1,
      pinned: 1,
      funnel: 1,
    });
    expect(
      Object.values(fetchCounts(resultFetches, "app-1")).every(
        (count) => count === 0,
      ),
    ).toBe(true);
    expect(fetchCounts(listFetches, "app-2")).toEqual(noListFetches);
  });
});

describe("useReorderPinnedFunnelsMutation", () => {
  const pinnedKey = ["funnels", "app-1", "pinned"];

  it("shows the new order before the server answers, sending the ids in order", async () => {
    const response = deferred<PinnedFunnelsResponse>();
    mockReorderPinnedFunnels.mockReturnValueOnce(response.promise);

    const { wrapper, client } = makeWrapper();
    client.setQueryData(pinnedKey, { results: [funnelA, funnelB] });
    const { result } = renderHook(() => useReorderPinnedFunnelsMutation(), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ appId: "app-1", funnels: [funnelB, funnelA] });
    });

    await waitFor(() =>
      expect(client.getQueryData(pinnedKey)).toEqual({
        results: [funnelB, funnelA],
      }),
    );
    expect(mockReorderPinnedFunnels).toHaveBeenCalledWith("app-1", [
      "f2",
      "f1",
    ]);

    await act(async () => {
      response.resolve({ results: [funnelB, funnelA] });
    });
  });

  it("stores the server's list once the reorder succeeds", async () => {
    const saved = { results: [funnelB, { ...funnelA, pin_order: 2 }] };
    mockReorderPinnedFunnels.mockResolvedValueOnce(saved);

    const { wrapper, client } = makeWrapper();
    client.setQueryData(pinnedKey, { results: [funnelA, funnelB] });
    const { result } = renderHook(() => useReorderPinnedFunnelsMutation(), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({
        appId: "app-1",
        funnels: [funnelB, funnelA],
      }),
    );

    expect(client.getQueryData(pinnedKey)).toEqual(saved);
  });

  it("drops a pinned fetch already in flight so it cannot undo the new order", async () => {
    const stale = deferred<PinnedFunnelsResponse>();
    mockFetchPinnedFunnels.mockReturnValueOnce(stale.promise);
    mockReorderPinnedFunnels.mockReturnValueOnce(new Promise(() => {}));

    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(
      () => ({
        pinned: usePinnedFunnelsQuery("app-1"),
        reorder: useReorderPinnedFunnelsMutation(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(mockFetchPinnedFunnels).toHaveBeenCalled());

    act(() => {
      result.current.reorder.mutate({
        appId: "app-1",
        funnels: [funnelB, funnelA],
      });
    });
    await waitFor(() =>
      expect(result.current.pinned.data?.results).toEqual([funnelB, funnelA]),
    );

    await act(async () => {
      stale.resolve({ results: [funnelA, funnelB] });
    });

    expect(client.getQueryData(pinnedKey)).toEqual({
      results: [funnelB, funnelA],
    });
  });

  it("fetches the pinned funnels again when the server rejects the order", async () => {
    mockFetchPinnedFunnels.mockResolvedValue({ results: [funnelA, funnelB] });
    const failure = new ApiError(409, "Pinned funnels have changed");
    mockReorderPinnedFunnels.mockRejectedValueOnce(failure);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => ({
        pinned: usePinnedFunnelsQuery("app-1"),
        reorder: useReorderPinnedFunnelsMutation(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.pinned.status).toBe("success"));

    await act(async () => {
      await expect(
        result.current.reorder.mutateAsync({
          appId: "app-1",
          funnels: [funnelB, funnelA],
        }),
      ).rejects.toBe(failure);
    });

    await waitFor(() =>
      expect(mockFetchPinnedFunnels).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(result.current.pinned.data?.results).toEqual([funnelA, funnelB]),
    );
  });
});

describe("useSaveFunnelMutation", () => {
  const draft = {
    name: "Checkout",
    steps: [{ event_name: "a" }, { event_name: "b" }],
    conversion_window_seconds: 600,
  };

  it("creates a funnel when there is no funnel id", async () => {
    mockCreateFunnel.mockResolvedValueOnce({ id: "f9", ...draft });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaveFunnelMutation(), { wrapper });

    const saved = await act(() =>
      result.current.mutateAsync({ appId: "app-1", funnelId: null, draft }),
    );

    expect(mockCreateFunnel).toHaveBeenCalledWith("app-1", draft);
    expect(mockUpdateFunnel).not.toHaveBeenCalled();
    expect(saved).toEqual({ id: "f9", ...draft });
  });

  it("updates the funnel when there is a funnel id", async () => {
    mockUpdateFunnel.mockResolvedValueOnce({ id: "f1", ...draft });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaveFunnelMutation(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ appId: "app-1", funnelId: "f1", draft }),
    );

    expect(mockUpdateFunnel).toHaveBeenCalledWith("app-1", "f1", draft);
    expect(mockCreateFunnel).not.toHaveBeenCalled();
  });

  it("puts the saved funnel in the cache", async () => {
    const saved = { id: "f1", ...draft };
    mockUpdateFunnel.mockResolvedValueOnce(saved);

    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useSaveFunnelMutation(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ appId: "app-1", funnelId: "f1", draft }),
    );

    expect(client.getQueryData(["funnel", "app-1", "f1"])).toEqual(saved);
  });

  it("refetches the app's funnel lists, the funnel and every funnel result after a save", async () => {
    stageFunnelViews();
    mockUpdateFunnel.mockResolvedValueOnce({ id: "f1", ...draft });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => ({
        app1: useFunnelLists("app-1"),
        app2: useFunnelLists("app-2"),
        results: useFunnelResults(),
        save: useSaveFunnelMutation(),
      }),
      { wrapper },
    );
    await waitForAll(() => result.current.app1);
    await waitForAll(() => result.current.app2);
    await waitForAll(() => result.current.results);
    clearFetchCounts();

    await act(() =>
      result.current.save.mutateAsync({
        appId: "app-1",
        funnelId: "f1",
        draft,
      }),
    );

    expect(fetchCounts(listFetches, "app-1")).toEqual({
      list: 1,
      pinned: 1,
      funnel: 1,
    });
    expect(fetchCounts(resultFetches, "app-1")).toEqual({
      useFunnelConversionQuery: 1,
      useFunnelStepErrorsQuery: 1,
      useFunnelStepTracesQuery: 1,
      useFunnelStepNetworkQuery: 1,
      useFunnelTrendQuery: 1,
      useFunnelStepSessionsQuery: 1,
      useFunnelCadenceQuery: 1,
    });
    expect(fetchCounts(listFetches, "app-2")).toEqual(noListFetches);
  });
});

describe("useDeleteFunnelMutation", () => {
  it("deletes through the api and refetches the app's funnel lists but not the deleted funnel", async () => {
    stageFunnelViews();
    mockDeleteFunnel.mockResolvedValueOnce(undefined);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => ({
        app1: useFunnelLists("app-1"),
        app2: useFunnelLists("app-2"),
        remove: useDeleteFunnelMutation(),
      }),
      { wrapper },
    );
    await waitForAll(() => result.current.app1);
    await waitForAll(() => result.current.app2);
    clearFetchCounts();

    await act(() =>
      result.current.remove.mutateAsync({ appId: "app-1", funnelId: "f1" }),
    );

    expect(mockDeleteFunnel).toHaveBeenCalledWith("app-1", "f1");
    expect(fetchCounts(listFetches, "app-1")).toEqual({
      list: 1,
      pinned: 1,
      funnel: 0,
    });
    expect(fetchCounts(listFetches, "app-2")).toEqual(noListFetches);
  });
});
