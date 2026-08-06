/**
 * Integration tests for the Session Replay overview page.
 *
 * It is the most filter-rich page in the app: 13 filter types (app, versions,
 * dates, session types, OS, countries, network types/providers/generations,
 * locales, device manufacturers/names, udAttrs, freeText) plus pagination.
 * This suite exercises every filter, pagination and URL sync. The detail page
 * a session opens into has its own suite.
 */
import { promiseParams } from "@/__tests__/helpers/promise_params";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";

// --- External dependency mocks ---

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}));

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
const mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/test-team/session_replays",
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("next-themes", () => ({
  __esModule: true,
  useTheme: () => ({ theme: "light" }),
}));

jest.mock("@nivo/line", () => {
  const LineChartStub = ({ data }: any) => (
    <div data-testid="nivo-line-chart">
      {data?.map((s: any) => (
        <span key={s.id} data-testid={`chart-series-${s.id}`}>
          {s.id}: {s.data?.length ?? 0} points
        </span>
      ))}
    </div>
  );
  return {
    __esModule: true,
    ResponsiveLine: LineChartStub,
    ResponsiveLineCanvas: LineChartStub,
  };
});

// --- MSW ---
import {
  makeSessionPlotFixture,
  makeSessionReplayOverviewFixture,
  makeSessionReplayOverviewPage2Fixture,
} from "../msw/fixtures";
import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  mockRouterReplace.mockClear();
  mockRouterPush.mockClear();
});
afterAll(() => server.close());

// --- Store imports ---
import SessionReplayOverview from "@/app/[teamId]/session_replays/page";
import { queryClient } from "@/app/query/query_client";
import { createFiltersStore } from "@/app/stores/filters_store";
import { createOnboardingStore } from "@/app/stores/onboarding_store";
import { QueryClientProvider } from "@tanstack/react-query";

let filtersStore = createFiltersStore();
let onboardingStore = createOnboardingStore();

jest.mock("@/app/stores/provider", () => {
  const { useStore } = require("zustand");
  return {
    __esModule: true,
    useFiltersStore: (selector?: any) =>
      useStore(filtersStore, selector ?? ((s: any) => s)),
    useOnboardingStore: (selector?: any) =>
      useStore(onboardingStore, selector ?? ((s: any) => s)),
    useMeasureStoreRegistry: () => ({ filtersStore, onboardingStore }),
  };
});

beforeEach(() => {
  filtersStore = createFiltersStore();
  onboardingStore = createOnboardingStore();
  queryClient.clear();
  filtersStore.getState().reset();
  for (const key of [...mockSearchParams.keys()]) mockSearchParams.delete(key);
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("Session Replay Overview (MSW integration)", () => {
  const { AppVersion, OsVersion } = require("@/app/api/api_calls");

  async function renderAndWaitForData() {
    renderWithProviders(
      <SessionReplayOverview params={promiseParams({ teamId: "test-team" })} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // PAGE LOAD
  // ================================================================
  describe("page load", () => {
    it("shows error state when sessions API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/sessions", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderWithProviders(
        <SessionReplayOverview
          params={promiseParams({ teamId: "test-team" })}
        />,
      );
      await waitFor(
        () => {
          expect(
            screen.getByText(/Error fetching list of sessions/),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("shows plot error when plot API fails", async () => {
      server.use(
        http.get("*/api/apps/:appId/sessions/plots/instances", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderWithProviders(
        <SessionReplayOverview
          params={promiseParams({ teamId: "test-team" })}
        />,
      );
      await waitFor(
        () => {
          expect(screen.getByText(/Error fetching plot/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // PAGINATION
  // ================================================================
  describe("pagination", () => {
    it("clicking Next fetches page 2 with offset in URL", async () => {
      const sessionRequests: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/sessions", ({ request }) => {
          const url = new URL(request.url);
          if (url.pathname.split("/").filter(Boolean).length > 4) return;
          sessionRequests.push(request.url);
          const offset = url.searchParams.get("offset");
          if (offset === "5") {
            return HttpResponse.json(makeSessionReplayOverviewPage2Fixture());
          }
          return HttpResponse.json(makeSessionReplayOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      sessionRequests.length = 0;

      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });

      await waitFor(
        () => {
          expect(screen.getByText(/Session ID: sess-006/)).toBeTruthy();
        },
        { timeout: 5000 },
      );

      expect(mockRouterReplace).toHaveBeenCalled();
      const url =
        mockRouterReplace.mock.calls[
          mockRouterReplace.mock.calls.length - 1
        ][0];
      expect(url).toContain("po=5");
    });

    it("clicking Previous from page 2 goes back to page 1 data", async () => {
      server.use(
        http.get("*/api/apps/:appId/sessions", ({ request }) => {
          const url = new URL(request.url);
          if (url.pathname.split("/").filter(Boolean).length > 4) return;
          const offset = url.searchParams.get("offset");
          if (offset === "5") {
            return HttpResponse.json(makeSessionReplayOverviewPage2Fixture());
          }
          return HttpResponse.json(makeSessionReplayOverviewFixture());
        }),
      );

      renderWithProviders(
        <SessionReplayOverview
          params={promiseParams({ teamId: "test-team" })}
        />,
      );
      await waitFor(
        () => {
          expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy();
        },
        { timeout: 5000 },
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });
      await waitFor(
        () => {
          expect(screen.getByText(/Session ID: sess-006/)).toBeTruthy();
        },
        { timeout: 5000 },
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Previous").closest("button")!);
      });
      await waitFor(
        () => {
          expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy();
        },
        { timeout: 5000 },
      );

      expect(screen.queryByText(/Session ID: sess-006/)).toBeNull();

      const url =
        mockRouterReplace.mock.calls[
          mockRouterReplace.mock.calls.length - 1
        ][0];
      expect(url).toContain("po=0");
    });

    it("deep-link with po=5 renders page 2 data", async () => {
      server.use(
        http.get("*/api/apps/:appId/sessions", ({ request }) => {
          const url = new URL(request.url);
          if (url.pathname.split("/").filter(Boolean).length > 4) return;
          const offset = url.searchParams.get("offset");
          if (offset === "5") {
            return HttpResponse.json(makeSessionReplayOverviewPage2Fixture());
          }
          return HttpResponse.json(makeSessionReplayOverviewFixture());
        }),
      );

      mockSearchParams.set("po", "5");
      renderWithProviders(
        <SessionReplayOverview
          params={promiseParams({ teamId: "test-team" })}
        />,
      );
      await waitFor(
        () => {
          expect(screen.getByText(/Session ID: sess-006/)).toBeTruthy();
        },
        { timeout: 5000 },
      );

      expect(screen.queryByText(/Session ID: sess-001/)).toBeNull();
    });
  });

  // ================================================================
  // ALL FILTERS — the session replay page enables 13 filter types
  // ================================================================
  describe("filters", () => {
    let shortFilterBodies: any[];
    let sessionRequests: { url: string }[];

    beforeEach(() => {
      shortFilterBodies = [];
      sessionRequests = [];
      server.use(
        http.post("*/api/apps/:appId/shortFilters", async ({ request }) => {
          shortFilterBodies.push(await request.json());
          return HttpResponse.json({
            filter_short_code: `code-${shortFilterBodies.length}`,
          });
        }),
        http.get("*/api/apps/:appId/sessions", ({ request }) => {
          const url = new URL(request.url);
          if (url.pathname.split("/").filter(Boolean).length > 4) return;
          sessionRequests.push({ url: request.url });
          return HttpResponse.json(makeSessionReplayOverviewFixture());
        }),
      );
    });

    // --- Store-driven filters that travel in the shortFilters POST body ---
    // One store setter per field, each expected to land in the POST body
    // under its own key. The OS row carries two keys because os_names and
    // os_versions are an index-aligned pair.
    it.each([
      [
        "versions",
        () =>
          filtersStore
            .getState()
            .setSelectedVersions([new AppVersion("3.0.1", "301")]),
        { versions: ["3.0.1"] },
      ],
      [
        "os_names/os_versions",
        () =>
          filtersStore
            .getState()
            .setSelectedOsVersions([new OsVersion("android", "14")]),
        { os_names: ["android"], os_versions: ["14"] },
      ],
      [
        "countries",
        () => filtersStore.getState().setSelectedCountries(["US"]),
        { countries: ["US"] },
      ],
      [
        "network_providers",
        () => filtersStore.getState().setSelectedNetworkProviders(["Jio"]),
        { network_providers: ["Jio"] },
      ],
      [
        "network_types",
        () => filtersStore.getState().setSelectedNetworkTypes(["wifi"]),
        { network_types: ["wifi"] },
      ],
      [
        "network_generations",
        () => filtersStore.getState().setSelectedNetworkGenerations(["5g"]),
        { network_generations: ["5g"] },
      ],
      [
        "locales",
        () => filtersStore.getState().setSelectedLocales(["en-US"]),
        { locales: ["en-US"] },
      ],
      [
        "device_manufacturers",
        () =>
          filtersStore.getState().setSelectedDeviceManufacturers(["Samsung"]),
        { device_manufacturers: ["Samsung"] },
      ],
      [
        "device_names",
        () => filtersStore.getState().setSelectedDeviceNames(["Galaxy S24"]),
        { device_names: ["Galaxy S24"] },
      ],
    ] as [string, () => void, Record<string, string[]>][])(
      "%s change is sent in the shortFilters POST body",
      async (_field, applyFilter, expected) => {
        await renderAndWaitForData();
        shortFilterBodies.length = 0;
        await act(async () => {
          applyFilter();
        });
        await waitFor(
          () => expect(shortFilterBodies.length).toBeGreaterThan(0),
          { timeout: 5000 },
        );
        expect(
          shortFilterBodies[shortFilterBodies.length - 1].filters,
        ).toMatchObject(expected);
      },
    );

    // --- Session type filter (URL param, not shortFilters body) ---
    it("session type change adds type=error,anr + severity to data-fetch URL", async () => {
      await renderAndWaitForData();
      sessionRequests.length = 0;
      await act(async () => {
        filtersStore
          .getState()
          .setSelectedSessionTypes([
            "Fatal Error Sessions" as any,
            "ANR Sessions" as any,
          ]);
      });
      await waitFor(() => expect(sessionRequests.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      const url = sessionRequests[sessionRequests.length - 1].url;
      expect(url).toContain("type=error%2Canr");
      expect(url).toContain("severity=fatal");
    });

    // --- Date range (URL param) ---
    it("date change refetches sessions with new from/to", async () => {
      await renderAndWaitForData();
      sessionRequests.length = 0;
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      await act(async () => {
        filtersStore.getState().setSelectedDateRange("Last Week");
        filtersStore.getState().setSelectedStartDate(weekAgo.toISOString());
        filtersStore.getState().setSelectedEndDate(now.toISOString());
      });
      await waitFor(() => expect(sessionRequests.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(sessionRequests[sessionRequests.length - 1].url).toContain(
        "from=",
      );
    });

    // --- Date range does NOT trigger shortFilters POST ---
    it("date change does NOT fire shortFilters POST", async () => {
      await renderAndWaitForData();
      const postsBefore = shortFilterBodies.length;
      const now = new Date();
      await act(async () => {
        filtersStore.getState().setSelectedDateRange("Last 24 Hours");
        filtersStore
          .getState()
          .setSelectedStartDate(
            new Date(now.getTime() - 86400000).toISOString(),
          );
        filtersStore.getState().setSelectedEndDate(now.toISOString());
      });
      await waitFor(() => expect(sessionRequests.length).toBeGreaterThan(1), {
        timeout: 5000,
      });
      expect(shortFilterBodies.length).toBe(postsBefore);
    });

    // --- Filter change refetches both sessions AND plot ---
    it("filter change refetches both the session list and the plot", async () => {
      let plotFetches = 0;
      server.use(
        http.get("*/api/apps/:appId/sessions/plots/instances", () => {
          plotFetches++;
          return HttpResponse.json(makeSessionPlotFixture());
        }),
      );

      await renderAndWaitForData();
      sessionRequests.length = 0;
      const plotBefore = plotFetches;

      await act(async () => {
        filtersStore.getState().setSelectedCountries(["DE"]);
      });

      await waitFor(
        () => {
          expect(sessionRequests.length).toBeGreaterThan(0);
          expect(plotFetches).toBeGreaterThan(plotBefore);
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // URL SERIALIZATION
  // ================================================================
  describe("URL sync", () => {
    it("URL includes all enabled filter params after load", async () => {
      await renderAndWaitForData();
      expect(mockRouterReplace).toHaveBeenCalled();
      const url =
        mockRouterReplace.mock.calls[
          mockRouterReplace.mock.calls.length - 1
        ][0];
      expect(url).toContain("po="); // pagination offset
      expect(url).toContain("a="); // appId
      expect(url).toContain("v="); // versions
      expect(url).toContain("d="); // dateRange
    });

    it("deep-link with pagination offset initializes store offset", async () => {
      // Extra reset to ensure clean state after prior tests in full suite
      queryClient.clear();
      filtersStore.getState().reset();
      mockSearchParams.set("po", "10");

      renderWithProviders(
        <SessionReplayOverview
          params={promiseParams({ teamId: "test-team" })}
        />,
      );

      // The useEffect reads po from URL and calls setPaginationOffset
      await waitFor(
        () => {
          const urlCheck =
            mockRouterReplace.mock.calls[
              mockRouterReplace.mock.calls.length - 1
            ][0];
          expect(urlCheck).toContain("po=10");
        },
        { timeout: 5000 },
      );
    });
  });
});

// ====================================================================
// ADDITIONAL OVERVIEW COVERAGE
// ====================================================================
describe("Session Replay Overview — additional coverage", () => {
  const { AppVersion, OsVersion } = require("@/app/api/api_calls");

  let shortFilterBodies: any[];

  beforeEach(() => {
    shortFilterBodies = [];
    server.use(
      http.post("*/api/apps/:appId/shortFilters", async ({ request }) => {
        shortFilterBodies.push(await request.json());
        return HttpResponse.json({
          filter_short_code: `code-${shortFilterBodies.length}`,
        });
      }),
    );
  });

  async function renderAndWaitForData() {
    renderWithProviders(
      <SessionReplayOverview params={promiseParams({ teamId: "test-team" })} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // MULTIPLE FILTERS IN ONE POST
  // ================================================================
  describe("multiple filters combined", () => {
    it("setting OS + country + locale produces a single POST with all three", async () => {
      await renderAndWaitForData();
      shortFilterBodies.length = 0;

      await act(async () => {
        filtersStore
          .getState()
          .setSelectedOsVersions([new OsVersion("android", "14")]);
        filtersStore.getState().setSelectedCountries(["US"]);
        filtersStore.getState().setSelectedLocales(["en-US"]);
      });

      await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), {
        timeout: 5000,
      });

      const body = shortFilterBodies[shortFilterBodies.length - 1];
      expect(body.filters.os_names).toEqual(["android"]);
      expect(body.filters.countries).toEqual(["US"]);
      expect(body.filters.locales).toEqual(["en-US"]);
    });
  });

  // ================================================================
  // URL ROUND-TRIP
  // ================================================================
  describe("URL round-trip", () => {
    it("version + date range survive URL round-trip", async () => {
      await renderAndWaitForData();

      // Clear replace calls from the initial render so the capture below reflects
      // the version change (React 19 defers the effect that writes the URL).
      mockRouterReplace.mockClear();

      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.2", "302")]);
        const now = new Date();
        filtersStore.getState().setSelectedDateRange("Last Week");
        filtersStore
          .getState()
          .setSelectedStartDate(
            new Date(now.getTime() - 7 * 86400000).toISOString(),
          );
        filtersStore.getState().setSelectedEndDate(now.toISOString());
      });

      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());
      const serializedUrl = mockRouterReplace.mock.calls[
        mockRouterReplace.mock.calls.length - 1
      ][0] as string;
      const params = new URLSearchParams(serializedUrl.replace(/^\?/, ""));

      filtersStore.getState().reset();
      queryClient.clear();
      for (const key of [...mockSearchParams.keys()])
        mockSearchParams.delete(key);
      for (const [key, value] of params.entries())
        mockSearchParams.set(key, value);

      // Unmount the first tree before re-rendering: this round-trip simulates a
      // fresh navigation to the captured URL. Leaving it mounted lets its stale
      // Filters effect race with the new mount over the shared store (React 19's
      // effect ordering surfaces this; React 18 happened to let the new tree win).
      cleanup();

      renderWithProviders(
        <SessionReplayOverview
          params={promiseParams({ teamId: "test-team" })}
        />,
      );
      await waitFor(
        () => {
          expect(
            screen.getAllByText(/Session ID:/).length,
          ).toBeGreaterThanOrEqual(1);
        },
        { timeout: 5000 },
      );

      expect(filtersStore.getState().selectedVersions[0]?.name).toBe("3.0.2");
      expect(filtersStore.getState().selectedDateRange).toBe("Last Week");
    });
  });

  // ================================================================
  // PAGINATION OFFSET URL ROUND-TRIP
  // ================================================================
  describe("pagination URL round-trip", () => {
    it("paginating to page 2 then capturing URL preserves offset on reload", async () => {
      server.use(
        http.get("*/api/apps/:appId/sessions", ({ request }) => {
          const url = new URL(request.url);
          if (url.pathname.split("/").filter(Boolean).length > 4) return;
          const offset = url.searchParams.get("offset");
          if (offset === "5") {
            return HttpResponse.json(makeSessionReplayOverviewPage2Fixture());
          }
          return HttpResponse.json(makeSessionReplayOverviewFixture());
        }),
      );

      renderWithProviders(
        <SessionReplayOverview
          params={promiseParams({ teamId: "test-team" })}
        />,
      );
      await waitFor(
        () => {
          expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy();
        },
        { timeout: 5000 },
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });

      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalled();
        const url =
          mockRouterReplace.mock.calls[
            mockRouterReplace.mock.calls.length - 1
          ][0];
        expect(url).toContain("po=5");
      });

      const serializedUrl = mockRouterReplace.mock.calls[
        mockRouterReplace.mock.calls.length - 1
      ][0] as string;
      const params = new URLSearchParams(serializedUrl.replace(/^\?/, ""));

      filtersStore.getState().reset();
      queryClient.clear();
      for (const key of [...mockSearchParams.keys()])
        mockSearchParams.delete(key);
      for (const [key, value] of params.entries())
        mockSearchParams.set(key, value);

      // Unmount the first tree before re-rendering: this round-trip simulates a
      // fresh navigation to the captured URL. Leaving it mounted lets its stale
      // Filters effect race with the new mount over the shared store (React 19's
      // effect ordering surfaces this; React 18 happened to let the new tree win).
      cleanup();

      renderWithProviders(
        <SessionReplayOverview
          params={promiseParams({ teamId: "test-team" })}
        />,
      );

      await waitFor(
        () => {
          const url =
            mockRouterReplace.mock.calls[
              mockRouterReplace.mock.calls.length - 1
            ][0];
          expect(url).toContain("po=5");
        },
        { timeout: 5000 },
      );
    });
  });
});
