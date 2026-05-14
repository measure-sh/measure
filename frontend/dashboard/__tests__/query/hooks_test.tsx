import { beforeEach, describe, expect, it } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";

import {
  AppsApiStatus,
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
  };
});

jest.mock("@/app/api/api_client", () => ({
  apiClient: {
    fetch: jest.fn(),
    redirectToLogin: jest.fn(),
    init: jest.fn(),
  },
}));

import {
  fetchAppsFromServer,
  fetchFiltersFromServer,
  fetchRootSpanNamesFromServer,
} from "@/app/api/api_calls";
import { apiClient } from "@/app/api/api_client";
import {
  fetchCurrentSession,
  signOut,
  useAppsQuery,
  useFilterOptionsQuery,
  useRootSpanNamesQuery,
  useSessionQuery,
} from "@/app/query/hooks";

const mockFetchApps = fetchAppsFromServer as jest.Mock;
const mockFetchFilters = fetchFiltersFromServer as jest.Mock;
const mockFetchRootSpanNames = fetchRootSpanNamesFromServer as jest.Mock;
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
});

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
      () => useFilterOptionsQuery(null, FilterSource.Crashes),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchFilters).not.toHaveBeenCalled();
  });

  it("returns NotOnboarded without hitting the network for never-onboarded apps", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFilterOptionsQuery(notOnboardedApp, FilterSource.Crashes),
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
      () => useFilterOptionsQuery(onboardedApp, FilterSource.Crashes),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockFetchFilters).toHaveBeenCalledWith(
      onboardedApp,
      FilterSource.Crashes,
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
      () => useFilterOptionsQuery(onboardedApp, FilterSource.Crashes),
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
      () => useFilterOptionsQuery(onboardedApp, FilterSource.Crashes),
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
        useFilterOptionsQuery(app, FilterSource.Crashes),
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
      () => useRootSpanNamesQuery(app, FilterSource.Crashes),
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
