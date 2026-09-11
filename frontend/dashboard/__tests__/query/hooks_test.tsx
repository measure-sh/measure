import { beforeEach, describe, expect, it } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
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
    fetchErrorGroupCommonPathFromServer: jest.fn(),
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
  fetchAppsFromServer,
  fetchBugReportsOverviewFromServer,
  fetchBugReportsOverviewPlotFromServer,
  fetchBuildsFromServer,
  fetchErrorGroupCommonPathFromServer,
  fetchErrorsDetailsFromServer,
  fetchErrorsDetailsPlotFromServer,
  fetchErrorsDistributionPlotFromServer,
  fetchErrorsOverviewFromServer,
  fetchErrorsOverviewPlotFromServer,
  fetchFilterKeys,
  fetchRootSpanNamesFromServer,
  fetchSpanMetricsPlotFromServer,
  fetchSpansFromServer,
} from "@/app/api/api_calls";
import { apiClient } from "@/app/api/api_client";
import {
  fetchCurrentSession,
  signOut,
  useAppsQuery,
  useBugReportsOverviewPlotQuery,
  useBugReportsOverviewQuery,
  useBuildsQuery,
  useErrorGroupCommonPathQuery,
  useErrorsDetailsPlotQuery,
  useErrorsDetailsQuery,
  useErrorsDistributionPlotQuery,
  useErrorsOverviewPlotQuery,
  useErrorsOverviewQuery,
  useFilterKeysQuery,
  useRootSpanNamesQuery,
  useSessionQuery,
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
const mockFetchErrorGroupCommonPath =
  fetchErrorGroupCommonPathFromServer as jest.Mock;
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
      // The second page never arrives, so the hook stays mid-fetch.
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
      // The second page never arrives, so the hook stays mid-fetch.
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
      // The second page never arrives, so the hook stays mid-fetch.
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
    mockFetchErrorsDistributionPlot.mockResolvedValueOnce({
      os_version: { "android 13": 5 },
      country: { US: 3 },
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
    expect(result.current.data).toMatchObject({
      plot: expect.any(Array),
      plotKeys: expect.any(Array),
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
