import { beforeEach, describe, expect, it } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";

import {
  AppsApiStatus,
  ErrorGroupCommonPathApiStatus,
  ErrorsDetailsApiStatus,
  ErrorsDetailsPlotApiStatus,
  ErrorsDistributionPlotApiStatus,
  ErrorsOverviewApiStatus,
  ErrorsOverviewPlotApiStatus,
  FiltersApiStatus,
  FilterSource,
  RootSpanNamesApiStatus,
} from "@/app/api/api_calls";

jest.mock("@/app/api/api_calls", () => {
  const actual = jest.requireActual("@/app/api/api_calls");
  return {
    ...actual,
    fetchAppsFromServer: jest.fn(),
    fetchFiltersFromServer: jest.fn(),
    fetchRootSpanNamesFromServer: jest.fn(),
    fetchErrorsOverviewFromServer: jest.fn(),
    fetchErrorsOverviewPlotFromServer: jest.fn(),
    fetchErrorsDetailsFromServer: jest.fn(),
    fetchErrorsDetailsPlotFromServer: jest.fn(),
    fetchErrorsDistributionPlotFromServer: jest.fn(),
    fetchErrorGroupCommonPathFromServer: jest.fn(),
  };
});

// useErrorsOverviewQuery + siblings read `filters` from useFiltersStore. Stub
// the provider's hook so each test can stage the filters slice it wants the
// hook under test to see.
let mockFiltersState: any = { ready: false, app: null };
jest.mock("@/app/stores/provider", () => ({
  __esModule: true,
  useFiltersStore: (selector?: any) =>
    selector
      ? selector({ filters: mockFiltersState })
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
  fetchErrorGroupCommonPathFromServer,
  fetchErrorsDetailsFromServer,
  fetchErrorsDetailsPlotFromServer,
  fetchErrorsDistributionPlotFromServer,
  fetchErrorsOverviewFromServer,
  fetchErrorsOverviewPlotFromServer,
  fetchFiltersFromServer,
  fetchRootSpanNamesFromServer,
} from "@/app/api/api_calls";
import { apiClient } from "@/app/api/api_client";
import {
  fetchCurrentSession,
  signOut,
  useAppsQuery,
  useErrorGroupCommonPathQuery,
  useErrorsDetailsPlotQuery,
  useErrorsDetailsQuery,
  useErrorsDistributionPlotQuery,
  useErrorsOverviewPlotQuery,
  useErrorsOverviewQuery,
  useFilterOptionsQuery,
  useRootSpanNamesQuery,
  useSessionQuery,
} from "@/app/query/hooks";

const mockFetchApps = fetchAppsFromServer as jest.Mock;
const mockFetchFilters = fetchFiltersFromServer as jest.Mock;
const mockFetchRootSpanNames = fetchRootSpanNamesFromServer as jest.Mock;
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

function readyFilters() {
  return {
    ready: true,
    app: { id: "app-1", onboarded: true },
    serialisedFilters: "v=0",
  };
}

describe("useAppsQuery", () => {
  it("does not fetch when teamId is undefined", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAppsQuery(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchApps).not.toHaveBeenCalled();
  });

  it("returns parsed result on Success", async () => {
    mockFetchApps.mockResolvedValueOnce({
      status: AppsApiStatus.Success,
      data: [{ id: "a1", name: "App 1" }],
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAppsQuery("team-1"), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.data).toEqual({
      status: AppsApiStatus.Success,
      data: [{ id: "a1", name: "App 1" }],
    });
    expect(mockFetchApps).toHaveBeenCalledWith("team-1");
  });

  it("passes through NoApps status", async () => {
    mockFetchApps.mockResolvedValueOnce({
      status: AppsApiStatus.NoApps,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAppsQuery("team-1"), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.data).toEqual({
      status: AppsApiStatus.NoApps,
      data: [],
    });
  });

  it("throws on Error status", async () => {
    mockFetchApps.mockResolvedValueOnce({
      status: AppsApiStatus.Error,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAppsQuery("team-1"), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect((result.current.error as Error).message).toMatch(
      /Failed to fetch apps/,
    );
  });
});

describe("useFilterOptionsQuery", () => {
  const onboardedApp = { id: "a1", name: "App 1", onboarded: true } as any;
  const notOnboardedApp = { id: "a2", name: "App 2", onboarded: false } as any;

  it("does not fetch when app is null", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFilterOptionsQuery(null, FilterSource.Errors),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchFilters).not.toHaveBeenCalled();
  });

  it("returns NotOnboarded without hitting the network for never-onboarded apps", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFilterOptionsQuery(notOnboardedApp, FilterSource.Errors),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.data).toEqual({
      status: FiltersApiStatus.NotOnboarded,
      data: null,
    });
    expect(mockFetchFilters).not.toHaveBeenCalled();
  });

  it("fetches and parses on Success when app is onboarded", async () => {
    mockFetchFilters.mockResolvedValueOnce({
      status: FiltersApiStatus.Success,
      data: {
        versions: [{ name: "1.0", code: "100" }],
        os_versions: [{ name: "android", version: "13" }],
        countries: ["US"],
        network_providers: ["Verizon"],
        network_types: ["wifi"],
        network_generations: ["4G"],
        locales: ["en-US"],
        device_manufacturers: ["Pixel"],
        device_names: ["Pixel 8"],
        ud_attrs: null,
      },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFilterOptionsQuery(onboardedApp, FilterSource.Errors),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchFilters).toHaveBeenCalledWith(
      onboardedApp,
      FilterSource.Errors,
    );
    expect(result.current.data?.status).toBe(FiltersApiStatus.Success);
    expect(result.current.data?.data?.countries).toEqual(["US"]);
    expect(result.current.data?.data?.versions).toHaveLength(1);
    expect(result.current.data?.data?.osVersions).toHaveLength(1);
  });

  it("passes through NoData status", async () => {
    mockFetchFilters.mockResolvedValueOnce({
      status: FiltersApiStatus.NoData,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFilterOptionsQuery(onboardedApp, FilterSource.Errors),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual({
      status: FiltersApiStatus.NoData,
      data: null,
    });
  });

  it("throws on Error status", async () => {
    mockFetchFilters.mockResolvedValueOnce({
      status: FiltersApiStatus.Error,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFilterOptionsQuery(onboardedApp, FilterSource.Errors),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("refetches when the onboarded flag flips", async () => {
    mockFetchFilters.mockResolvedValueOnce({
      status: FiltersApiStatus.Success,
      data: {
        versions: [{ name: "1.0", code: "100" }],
        os_versions: null,
        countries: null,
        network_providers: null,
        network_types: null,
        network_generations: null,
        locales: null,
        device_manufacturers: null,
        device_names: null,
        ud_attrs: null,
      },
    });

    const { wrapper } = makeWrapper();
    const { rerender, result } = renderHook(
      ({ app }: { app: any }) =>
        useFilterOptionsQuery(app, FilterSource.Errors),
      {
        wrapper,
        initialProps: { app: notOnboardedApp },
      },
    );

    await waitFor(() =>
      expect(result.current.data?.status).toBe(FiltersApiStatus.NotOnboarded),
    );
    expect(mockFetchFilters).not.toHaveBeenCalled();

    rerender({ app: onboardedApp });

    await waitFor(() =>
      expect(result.current.data?.status).toBe(FiltersApiStatus.Success),
    );
    expect(mockFetchFilters).toHaveBeenCalledTimes(1);
  });
});

describe("useRootSpanNamesQuery", () => {
  const app = { id: "a1", name: "App 1", onboarded: true } as any;

  it("is disabled when filterSource is not Spans", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useRootSpanNamesQuery(app, FilterSource.Errors),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchRootSpanNames).not.toHaveBeenCalled();
  });

  it("fetches when filterSource is Spans and returns the parsed results", async () => {
    mockFetchRootSpanNames.mockResolvedValueOnce({
      status: RootSpanNamesApiStatus.Success,
      data: { results: ["root.a", "root.b"] },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useRootSpanNamesQuery(app, FilterSource.Spans),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.data).toEqual({
      status: RootSpanNamesApiStatus.Success,
      data: ["root.a", "root.b"],
    });
  });

  it("throws on Error status", async () => {
    mockFetchRootSpanNames.mockResolvedValueOnce({
      status: RootSpanNamesApiStatus.Error,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useRootSpanNamesQuery(app, FilterSource.Spans),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
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
  it("is disabled when filters.ready is false", () => {
    mockFiltersState = { ready: false };
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsOverviewQuery(0), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsOverview).not.toHaveBeenCalled();
  });

  it("returns success with data once the fetch resolves", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsOverview.mockResolvedValueOnce({
      status: ErrorsOverviewApiStatus.Success,
      data: { results: [{ id: "g1" }] },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsOverviewQuery(0), { wrapper });

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchErrorsOverview).toHaveBeenCalledWith(
      mockFiltersState,
      5,
      0,
    );
    expect((result.current.data as any).results[0].id).toBe("g1");
  });

  it("throws on Error status", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsOverview.mockResolvedValueOnce({
      status: ErrorsOverviewApiStatus.Error,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsOverviewQuery(0), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect((result.current.error as Error).message).toMatch(
      /Failed to fetch errors overview/,
    );
  });
});

describe("useErrorsOverviewPlotQuery", () => {
  it("is disabled when filters.ready is false", () => {
    mockFiltersState = { ready: false };
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsOverviewPlotQuery(), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsOverviewPlot).not.toHaveBeenCalled();
  });

  it("returns mapped data on success", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsOverviewPlot.mockResolvedValueOnce({
      status: ErrorsOverviewPlotApiStatus.Success,
      data: [{ id: "android", data: [{ datetime: "x", instances: 1 }] }],
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsOverviewPlotQuery(), {
      wrapper,
    });

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual([
      { id: "android", data: [{ x: "x", y: 1 }] },
    ]);
  });

  it("returns null on NoData", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsOverviewPlot.mockResolvedValueOnce({
      status: ErrorsOverviewPlotApiStatus.NoData,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsOverviewPlotQuery(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toBeNull();
  });

  it("throws on Error", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsOverviewPlot.mockResolvedValueOnce({
      status: ErrorsOverviewPlotApiStatus.Error,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsOverviewPlotQuery(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});

describe("useErrorsDetailsQuery", () => {
  it("is disabled when filters.ready is false", () => {
    mockFiltersState = { ready: false };
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsDetailsQuery("group-1", 0), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsDetails).not.toHaveBeenCalled();
  });

  it("is disabled when errorGroupId is empty", () => {
    mockFiltersState = readyFilters();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsDetailsQuery("", 0), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsDetails).not.toHaveBeenCalled();
  });

  it("returns success with data once the fetch resolves", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsDetails.mockResolvedValueOnce({
      status: ErrorsDetailsApiStatus.Success,
      data: { results: [{ id: "e1" }] },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsDetailsQuery("group-1", 3), {
      wrapper,
    });

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchErrorsDetails).toHaveBeenCalledWith(
      "group-1",
      3,
      mockFiltersState,
      1,
    );
  });

  it("throws on Error status", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsDetails.mockResolvedValueOnce({
      status: ErrorsDetailsApiStatus.Error,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsDetailsQuery("group-1", 0), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});

describe("useErrorsDetailsPlotQuery", () => {
  it("is disabled when filters.ready is false", () => {
    mockFiltersState = { ready: false };
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsDetailsPlotQuery("group-1"), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsDetailsPlot).not.toHaveBeenCalled();
  });

  it("is disabled when errorGroupId is empty", () => {
    mockFiltersState = readyFilters();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsDetailsPlotQuery(""), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsDetailsPlot).not.toHaveBeenCalled();
  });

  it("returns mapped data on success", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsDetailsPlot.mockResolvedValueOnce({
      status: ErrorsDetailsPlotApiStatus.Success,
      data: [{ id: "ios", data: [{ datetime: "y", instances: 2 }] }],
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsDetailsPlotQuery("group-1"), {
      wrapper,
    });

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual([
      { id: "ios", data: [{ x: "y", y: 2 }] },
    ]);
  });

  it("returns null on NoData", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsDetailsPlot.mockResolvedValueOnce({
      status: ErrorsDetailsPlotApiStatus.NoData,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsDetailsPlotQuery("group-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toBeNull();
  });

  it("throws on Error", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsDetailsPlot.mockResolvedValueOnce({
      status: ErrorsDetailsPlotApiStatus.Error,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsDetailsPlotQuery("group-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});

describe("useErrorsDistributionPlotQuery", () => {
  it("is disabled when filters.ready is false", () => {
    mockFiltersState = { ready: false };
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDistributionPlotQuery("group-1"),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsDistributionPlot).not.toHaveBeenCalled();
  });

  it("is disabled when errorGroupId is empty", () => {
    mockFiltersState = readyFilters();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorsDistributionPlotQuery(""), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorsDistributionPlot).not.toHaveBeenCalled();
  });

  it("returns parsed distribution data on success", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsDistributionPlot.mockResolvedValueOnce({
      status: ErrorsDistributionPlotApiStatus.Success,
      data: {
        os_version: { "android 13": 5 },
        country: { US: 3 },
      },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDistributionPlotQuery("group-1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toMatchObject({
      plot: expect.any(Array),
      plotKeys: expect.any(Array),
    });
  });

  it("returns null on NoData", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsDistributionPlot.mockResolvedValueOnce({
      status: ErrorsDistributionPlotApiStatus.NoData,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDistributionPlotQuery("group-1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toBeNull();
  });

  it("throws on Error", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorsDistributionPlot.mockResolvedValueOnce({
      status: ErrorsDistributionPlotApiStatus.Error,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorsDistributionPlotQuery("group-1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});

describe("useErrorGroupCommonPathQuery", () => {
  it("is disabled when filters.app is missing", () => {
    mockFiltersState = { ready: true, app: null };
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorGroupCommonPathQuery("group-1"),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorGroupCommonPath).not.toHaveBeenCalled();
  });

  it("is disabled when errorGroupId is empty", () => {
    mockFiltersState = readyFilters();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useErrorGroupCommonPathQuery(""), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchErrorGroupCommonPath).not.toHaveBeenCalled();
  });

  it("returns success with data", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorGroupCommonPath.mockResolvedValueOnce({
      status: ErrorGroupCommonPathApiStatus.Success,
      data: { sessions_analyzed: 7, steps: [] },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorGroupCommonPathQuery("group-1"),
      { wrapper },
    );

    expect(result.current.status).toBe("pending");
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchErrorGroupCommonPath).toHaveBeenCalledWith(
      "group-1",
      mockFiltersState,
    );
    expect(result.current.data?.sessions_analyzed).toBe(7);
  });

  it("throws on Error", async () => {
    mockFiltersState = readyFilters();
    mockFetchErrorGroupCommonPath.mockResolvedValueOnce({
      status: ErrorGroupCommonPathApiStatus.Error,
      data: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useErrorGroupCommonPathQuery("group-1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});
