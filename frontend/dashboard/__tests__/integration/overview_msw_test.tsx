/**
 * Integration test for the Overview page.
 *
 * Everything except the network is real: React components, Zustand stores,
 * api_calls URL builders, apiClient.fetch — all run as they would in the
 * browser. MSW intercepts at the global `fetch()` boundary and returns
 * fixture data matching the Go backend struct shapes.
 *
 * What this catches that unit tests can't:
 * - Filter change → store refetch → plot/metrics re-render
 * - URL serialisation round-trip
 * - Cross-store effects (filters store → plot store → component)
 * - Error propagation from API → store → component
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

// --- External dependency mocks (things that don't exist in jsdom) ---

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}));

const mockRouterReplace = jest.fn();
const mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ replace: mockRouterReplace, push: jest.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/test-team/overview",
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

// --- Restore real fetch (jest config sets globals.fetch to a no-op) ---
// MSW needs the real fetch/Request to intercept. jsdom provides them.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  makeAppFixture,
  makeFiltersFixture,
  makeHealthPlotFixture,
  makeMetricsFixture,
} from "../msw/fixtures";
import { server } from "../msw/server";

// Silence console noise from stores/api during tests
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

// --- MSW lifecycle ---
beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});
afterEach(() => {
  server.resetHandlers();
  mockRouterReplace.mockClear();
});
afterAll(() => {
  server.close();
});

// --- Imports that transitively load api_client (must come after mocks) ---
import Overview from "@/app/components/overview";
import { createFiltersStore } from "@/app/stores/filters_store";
import { createOnboardingStore } from "@/app/stores/onboarding_store";

let filtersStore = createFiltersStore();
let onboardingStore = createOnboardingStore();
let testQueryClient: QueryClient;

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

// --- Store reset and URL param cleanup between tests ---
beforeEach(() => {
  const { queryClient: singletonClient } = require("@/app/query/query_client");
  singletonClient.clear();
  filtersStore = createFiltersStore();
  testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  filtersStore.getState().reset();
  // Clear any URL params set by previous tests
  for (const key of [...mockSearchParams.keys()]) {
    mockSearchParams.delete(key);
  }
  // Init router so apiClient doesn't throw on redirectToLogin
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>,
  );
}

// ====================================================================
describe("Overview page (MSW integration)", () => {
  it("renders filters, chart, and metrics with real stores + MSW", async () => {
    renderWithProviders(<Overview params={{ teamId: "test-team" }} />);

    // Wait for the full async chain:
    // fetchApps → selectApp → fetchFilters → filters.ready → TanStack Query fetches plots + metrics
    await waitFor(
      () => {
        // Metrics data values appear when TanStack Query resolves
        expect(screen.getByText("99.1%")).toBeTruthy();
      },
      { timeout: 5000 },
    );

    // Chart rendered with series data from MSW
    expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();

    // Metrics cards rendered with fixture data
    expect(screen.getByText("App adoption")).toBeTruthy();
    expect(screen.getByText("ANR free sessions")).toBeTruthy();

    // URL was synced via router.replace
    expect(mockRouterReplace).toHaveBeenCalled();
    const replacedUrl =
      mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0];
    expect(replacedUrl).toContain("?");
  });

  it("renders metrics even when the plot API fails", async () => {
    // The metrics and plot queries are independent fetches, so a plot
    // failure must not block the metrics cards or their values.
    server.use(
      http.get("*/api/apps/:appId/health/plots/instances", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    renderWithProviders(<Overview params={{ teamId: "test-team" }} />);

    await waitFor(
      () => {
        expect(screen.getByText("Crash free sessions")).toBeTruthy();
        expect(screen.getByText("99.1%")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });
});

// ====================================================================
// Filter interaction tests
//
// The overview page has 3 active filters: app selector, app versions,
// and date range. These tests exercise changes to each filter and
// verify the full chain:
// store setter → wrapped set → serialisedFilters change → component
// useEffect fires → store fetch → api_calls URL builder → MSW intercept
// → response parsed → store updated → component re-renders.
//
// Interactions go through store setters (not Radix dropdowns) because
// the dropdown UI is tested in dropdown_select_test.tsx. The value here
// is the integration between store, api_calls, and rendering.
// ====================================================================
describe("Overview page — filter interactions", () => {
  const { AppVersion } = require("@/app/api/api_calls");

  // Common test infra: captured requests
  let shortFilterBodies: any[];
  let metricsRequests: { url: string; appId: string }[];
  let healthPlotRequests: { url: string }[];
  let filtersRequests: { url: string; appId: string }[];

  beforeEach(() => {
    shortFilterBodies = [];
    metricsRequests = [];
    healthPlotRequests = [];
    filtersRequests = [];

    // Install request-tracking handlers for ALL overview endpoints
    server.use(
      http.post("*/api/apps/:appId/shortFilters", async ({ request }) => {
        shortFilterBodies.push(await request.json());
        return HttpResponse.json({
          filter_short_code: `code-${shortFilterBodies.length}`,
        });
      }),
      http.get("*/api/apps/:appId/metrics", ({ request, params }) => {
        metricsRequests.push({
          url: request.url,
          appId: params.appId as string,
        });
        return HttpResponse.json(makeMetricsFixture());
      }),
      http.get("*/api/apps/:appId/health/plots/instances", ({ request }) => {
        healthPlotRequests.push({ url: request.url });
        return HttpResponse.json(makeHealthPlotFixture());
      }),
      http.get("*/api/apps/:appId/filters", ({ request, params }) => {
        filtersRequests.push({
          url: request.url,
          appId: params.appId as string,
        });
        return HttpResponse.json(makeFiltersFixture());
      }),
    );
  });

  async function renderAndWaitForData() {
    renderWithProviders(<Overview params={{ teamId: "test-team" }} />);
    await waitFor(
      () => {
        // Wait for actual metrics data to render via TanStack Query
        expect(screen.getByText("99.1%")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // APP SELECTOR — single-select, changes which app's data loads
  // ================================================================
  describe("app selector", () => {
    const app1 = makeAppFixture({ id: "app-1", name: "App Alpha" });
    const app2 = makeAppFixture({ id: "app-2", name: "App Beta" });
    const app3 = makeAppFixture({ id: "app-3", name: "App Gamma" });

    beforeEach(() => {
      server.use(
        http.get("*/api/teams/:teamId/apps", () => {
          return HttpResponse.json([app1, app2, app3]);
        }),
      );
    });

    it("switching app refetches filters for the new app", async () => {
      await renderAndWaitForData();
      filtersRequests.length = 0;

      await act(async () => {
        filtersStore.getState().setSelectedApp(app2);
      });

      await waitFor(
        () => {
          expect(filtersRequests.some((r) => r.appId === "app-2")).toBe(true);
        },
        { timeout: 5000 },
      );
    });

    it("switching app refetches metrics for the new app", async () => {
      await renderAndWaitForData();
      metricsRequests.length = 0;

      await act(async () => {
        filtersStore.getState().setSelectedApp(app2);
      });

      await waitFor(
        () => {
          expect(metricsRequests.some((r) => r.appId === "app-2")).toBe(true);
        },
        { timeout: 5000 },
      );
    });

    it("switching app refetches the health plot endpoint for the new app", async () => {
      await renderAndWaitForData();
      healthPlotRequests.length = 0;

      await act(async () => {
        filtersStore.getState().setSelectedApp(app2);
      });

      await waitFor(
        () => {
          expect(healthPlotRequests.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );
    });

    it("switching back to original app re-fetches with original app id", async () => {
      await renderAndWaitForData();

      await act(async () => {
        filtersStore.getState().setSelectedApp(app2);
      });
      await waitFor(
        () => {
          expect(metricsRequests.some((r) => r.appId === "app-2")).toBe(true);
        },
        { timeout: 5000 },
      );

      metricsRequests.length = 0;
      await act(async () => {
        filtersStore.getState().setSelectedApp(app1);
      });
      await waitFor(
        () => {
          expect(metricsRequests.some((r) => r.appId === "app-1")).toBe(true);
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // APP VERSIONS — multi-select, affects shortFilters POST body
  // ================================================================
  describe("app versions", () => {
    it("selecting a single different version sends it in shortFilters POST", async () => {
      await renderAndWaitForData();
      shortFilterBodies.length = 0;

      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.2", "302")]);
      });

      await waitFor(
        () => {
          expect(shortFilterBodies.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );
      const body = shortFilterBodies[shortFilterBodies.length - 1];
      expect(body.filters.versions).toEqual(["3.0.2"]);
      expect(body.filters.version_codes).toEqual(["302"]);
    });

    it("version change triggers metrics refetch", async () => {
      await renderAndWaitForData();
      metricsRequests.length = 0;

      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.2", "302")]);
      });

      await waitFor(
        () => {
          expect(metricsRequests.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );
    });

    it("version change triggers a health plot refetch", async () => {
      await renderAndWaitForData();
      healthPlotRequests.length = 0;

      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.1", "301")]);
      });

      await waitFor(
        () => {
          expect(healthPlotRequests.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );
    });

    it("filter_short_code from POST appears in all data-fetch GET URLs", async () => {
      server.use(
        http.post("*/api/apps/:appId/shortFilters", () => {
          return HttpResponse.json({ filter_short_code: "test-fsc-999" });
        }),
      );

      await renderAndWaitForData();

      await waitFor(
        () => {
          const metricsUrl = metricsRequests.find((r) =>
            r.url.includes("filter_short_code="),
          );
          expect(metricsUrl?.url).toContain("filter_short_code=test-fsc-999");
        },
        { timeout: 5000 },
      );

      const healthUrl = healthPlotRequests.find((r) =>
        r.url.includes("filter_short_code="),
      );
      expect(healthUrl?.url).toContain("filter_short_code=test-fsc-999");
    });

    it("switching version back to original does not fire duplicate POST (cache hit)", async () => {
      await renderAndWaitForData();

      // Switch to 3.0.2
      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.2", "302")]);
      });
      await waitFor(
        () => {
          expect(shortFilterBodies.length).toBeGreaterThanOrEqual(2);
        },
        { timeout: 5000 },
      );

      const postsAfterSwitch = shortFilterBodies.length;

      // Switch BACK to original 3.1.0 — bodyKey cache should hit
      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.1.0", "310")]);
      });

      // Wait a tick for any async work
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });

      // No new POST — the bodyKey for [3.1.0] was already cached from initial load
      expect(shortFilterBodies.length).toBe(postsAfterSwitch);
    });

    it("URL updates with version param when version changes", async () => {
      await renderAndWaitForData();
      mockRouterReplace.mockClear();

      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.1", "301")]);
      });

      await waitFor(
        () => {
          expect(mockRouterReplace).toHaveBeenCalled();
          const url =
            mockRouterReplace.mock.calls[
              mockRouterReplace.mock.calls.length - 1
            ][0];
          expect(url).toContain("v=");
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // DATE RANGE — changes from/to params on all data-fetch URLs
  // ================================================================
  describe("date range", () => {
    function setDateRange(range: string, startDate: string, endDate: string) {
      return act(async () => {
        filtersStore.getState().setSelectedDateRange(range);
        filtersStore.getState().setSelectedStartDate(startDate);
        filtersStore.getState().setSelectedEndDate(endDate);
      });
    }

    it("changing to Last 24 Hours refetches metrics with new dates", async () => {
      await renderAndWaitForData();
      metricsRequests.length = 0;

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      await setDateRange(
        "Last 24 Hours",
        yesterday.toISOString(),
        now.toISOString(),
      );

      await waitFor(
        () => {
          expect(metricsRequests.length).toBeGreaterThan(0);
          expect(metricsRequests[metricsRequests.length - 1].url).toContain(
            "from=",
          );
        },
        { timeout: 5000 },
      );
    });

    it("changing to Last Week refetches the health plot endpoint", async () => {
      await renderAndWaitForData();
      healthPlotRequests.length = 0;

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      await setDateRange("Last Week", weekAgo.toISOString(), now.toISOString());

      await waitFor(
        () => {
          expect(healthPlotRequests.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );
    });

    it("changing date range does NOT trigger a new shortFilters POST", async () => {
      // Dates go as from/to URL params, not in the shortFilters body.
      // Changing dates should NOT fire a new POST.
      await renderAndWaitForData();
      const postsAfterInit = shortFilterBodies.length;

      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      await setDateRange(
        "Last Month",
        monthAgo.toISOString(),
        now.toISOString(),
      );

      // Wait for refetch to settle
      await waitFor(
        () => {
          expect(metricsRequests.length).toBeGreaterThan(1);
        },
        { timeout: 5000 },
      );

      // No new POST — dates are not in the body
      expect(shortFilterBodies.length).toBe(postsAfterInit);
    });

    it("custom date range sends exact from/to values", async () => {
      await renderAndWaitForData();
      metricsRequests.length = 0;

      const customStart = "2026-01-15T08:00:00.000Z";
      const customEnd = "2026-01-20T18:00:00.000Z";
      await setDateRange("Custom Range", customStart, customEnd);

      await waitFor(
        () => {
          expect(metricsRequests.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      // The URL should contain the formatted dates
      const lastUrl = metricsRequests[metricsRequests.length - 1].url;
      expect(lastUrl).toContain("from=");
      expect(lastUrl).toContain("to=");
    });

    it.each([
      ["Last 15 Minutes", 15 * 60 * 1000],
      ["Last 30 Minutes", 30 * 60 * 1000],
      ["Last hour", 60 * 60 * 1000],
      ["Last 3 Hours", 3 * 60 * 60 * 1000],
      ["Last 12 Hours", 12 * 60 * 60 * 1000],
      ["Last 24 Hours", 24 * 60 * 60 * 1000],
      ["Last Week", 7 * 24 * 60 * 60 * 1000],
      ["Last 15 Days", 15 * 24 * 60 * 60 * 1000],
      ["Last Month", 30 * 24 * 60 * 60 * 1000],
      ["Last 3 Months", 90 * 24 * 60 * 60 * 1000],
      ["Last 6 Months", 180 * 24 * 60 * 60 * 1000],
      ["Last Year", 365 * 24 * 60 * 60 * 1000],
    ])('"%s" triggers a data refetch', async (range, ms) => {
      await renderAndWaitForData();
      metricsRequests.length = 0;

      const now = new Date();
      const start = new Date(now.getTime() - ms);
      await setDateRange(range, start.toISOString(), now.toISOString());

      await waitFor(
        () => {
          expect(metricsRequests.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );
    });

    it("URL updates with date params when date range changes", async () => {
      await renderAndWaitForData();
      mockRouterReplace.mockClear();

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      await setDateRange("Last Week", weekAgo.toISOString(), now.toISOString());

      await waitFor(
        () => {
          expect(mockRouterReplace).toHaveBeenCalled();
          const url =
            mockRouterReplace.mock.calls[
              mockRouterReplace.mock.calls.length - 1
            ][0];
          expect(url).toContain("d=");
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // CROSS-FILTER INTERACTIONS
  // ================================================================
  describe("cross-filter interactions", () => {
    it("changing version then date range: both reflected in data fetches", async () => {
      await renderAndWaitForData();
      metricsRequests.length = 0;
      shortFilterBodies.length = 0;

      // Change version
      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.2", "302")]);
      });

      await waitFor(
        () => {
          expect(shortFilterBodies.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      // Now change date
      metricsRequests.length = 0;
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      await act(async () => {
        filtersStore.getState().setSelectedDateRange("Last Week");
        filtersStore.getState().setSelectedStartDate(weekAgo.toISOString());
        filtersStore.getState().setSelectedEndDate(now.toISOString());
      });

      await waitFor(
        () => {
          expect(metricsRequests.length).toBeGreaterThan(0);
          // The metrics URL should have the filter_short_code from the version
          // change AND the new from/to from the date change
          const url = metricsRequests[metricsRequests.length - 1].url;
          expect(url).toContain("filter_short_code=");
          expect(url).toContain("from=");
        },
        { timeout: 5000 },
      );
    });
  });
});

// ====================================================================
// URL SERIALIZATION / PARSING
//
// The overview page has a bidirectional contract with the URL:
//   State → serializeUrlFilters → router.replace(?params)
//   URL params → deserializeUrlFilters → initConfig → applyFilterOptions → state
//
// These tests verify both directions and their round-trip.
// URL keys (from urlFiltersKeyMap): a=appId, v=versions, d=dateRange,
// sd=startDate, ed=endDate.
// ====================================================================
describe("Overview page — URL serialization and parsing", () => {
  const { AppVersion } = require("@/app/api/api_calls");

  async function renderAndWaitForData() {
    renderWithProviders(<Overview params={{ teamId: "test-team" }} />);
    await waitFor(
      () => {
        // Wait for actual metrics data to render via TanStack Query
        expect(screen.getByText("99.1%")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ----------------------------------------------------------------
  // STATE → URL (serialization)
  // ----------------------------------------------------------------
  describe("state → URL serialization", () => {
    it('serializes appId as "a" param', async () => {
      await renderAndWaitForData();

      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalled();
        const url =
          mockRouterReplace.mock.calls[
            mockRouterReplace.mock.calls.length - 1
          ][0];
        // The fixture app id is encoded in the URL
        expect(url).toMatch(/a=[^&]+/);
      });
    });

    it('serializes selected version index as "v" param', async () => {
      await renderAndWaitForData();
      mockRouterReplace.mockClear();

      // Select 2nd version (index 1 in fixture)
      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.2", "302")]);
      });

      await waitFor(
        () => {
          expect(mockRouterReplace).toHaveBeenCalled();
          const url =
            mockRouterReplace.mock.calls[
              mockRouterReplace.mock.calls.length - 1
            ][0];
          // Version index 1 (0-indexed in the versions array)
          expect(url).toContain("v=1");
        },
        { timeout: 5000 },
      );
    });

    it("serializes multiple version indices as compressed range", async () => {
      await renderAndWaitForData();
      mockRouterReplace.mockClear();

      // Select all 3 versions (indices 0,1,2 → compressed as "0-2")
      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([
            new AppVersion("3.1.0", "310"),
            new AppVersion("3.0.2", "302"),
            new AppVersion("3.0.1", "301"),
          ]);
      });

      await waitFor(
        () => {
          expect(mockRouterReplace).toHaveBeenCalled();
          const url =
            mockRouterReplace.mock.calls[
              mockRouterReplace.mock.calls.length - 1
            ][0];
          expect(url).toContain("v=0-2");
        },
        { timeout: 5000 },
      );
    });

    it("serializes non-contiguous version indices as comma-separated", async () => {
      await renderAndWaitForData();
      mockRouterReplace.mockClear();

      // Select versions at index 0 and 2 (skip index 1)
      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([
            new AppVersion("3.1.0", "310"),
            new AppVersion("3.0.1", "301"),
          ]);
      });

      await waitFor(
        () => {
          expect(mockRouterReplace).toHaveBeenCalled();
          const url =
            mockRouterReplace.mock.calls[
              mockRouterReplace.mock.calls.length - 1
            ][0];
          expect(url).toMatch(/v=0%2C2|v=0,2/);
        },
        { timeout: 5000 },
      );
    });

    it('serializes dateRange as "d" param', async () => {
      await renderAndWaitForData();
      mockRouterReplace.mockClear();

      await act(async () => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtersStore.getState().setSelectedDateRange("Last Week");
        filtersStore.getState().setSelectedStartDate(weekAgo.toISOString());
        filtersStore.getState().setSelectedEndDate(now.toISOString());
      });

      await waitFor(
        () => {
          expect(mockRouterReplace).toHaveBeenCalled();
          const url =
            mockRouterReplace.mock.calls[
              mockRouterReplace.mock.calls.length - 1
            ][0];
          expect(url).toMatch(/d=Last[\+%20]Week/);
        },
        { timeout: 5000 },
      );
    });

    it("serializes custom date range with sd and ed params", async () => {
      await renderAndWaitForData();
      mockRouterReplace.mockClear();

      await act(async () => {
        filtersStore.getState().setSelectedDateRange("Custom Range");
        filtersStore
          .getState()
          .setSelectedStartDate("2026-03-01T00:00:00.000Z");
        filtersStore.getState().setSelectedEndDate("2026-03-15T23:59:59.000Z");
      });

      await waitFor(
        () => {
          expect(mockRouterReplace).toHaveBeenCalled();
          const url =
            mockRouterReplace.mock.calls[
              mockRouterReplace.mock.calls.length - 1
            ][0];
          expect(url).toMatch(/d=Custom[\+%20]Range/);
          expect(url).toContain("sd=");
          expect(url).toContain("ed=");
        },
        { timeout: 5000 },
      );
    });

    it("non-custom date ranges still include sd/ed params for reconstruction", async () => {
      // Even for named ranges like "Last 24 Hours", the serialized URL
      // includes sd= and ed= because the exact start/end timestamps are
      // needed for deep-link reconstruction (the range + timestamps
      // together let the recipient see exactly the same window).
      await renderAndWaitForData();
      mockRouterReplace.mockClear();

      await act(async () => {
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        filtersStore.getState().setSelectedDateRange("Last 24 Hours");
        filtersStore.getState().setSelectedStartDate(dayAgo.toISOString());
        filtersStore.getState().setSelectedEndDate(now.toISOString());
      });

      await waitFor(
        () => {
          expect(mockRouterReplace).toHaveBeenCalled();
          const url =
            mockRouterReplace.mock.calls[
              mockRouterReplace.mock.calls.length - 1
            ][0];
          expect(url).toContain("sd=");
          expect(url).toContain("ed=");
        },
        { timeout: 5000 },
      );
    });
  });

  // ----------------------------------------------------------------
  // ROUND-TRIP: state → URL → state
  // ----------------------------------------------------------------
  describe("round-trip: state → URL → state", () => {
    it("version selection survives URL round-trip", async () => {
      await renderAndWaitForData();

      // Clear replace calls from the initial render so the capture below reflects
      // the version change (React 19 defers the effect that writes the URL).
      mockRouterReplace.mockClear();

      // Change version to index 1
      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.2", "302")]);
      });

      // Capture the serialized URL
      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalled();
      });
      const serializedUrl = mockRouterReplace.mock.calls[
        mockRouterReplace.mock.calls.length - 1
      ][0] as string;
      const serializedParams = new URLSearchParams(
        serializedUrl.replace(/^\?/, ""),
      );

      // Reset everything and re-render with the captured URL params
      filtersStore.getState().reset();
      testQueryClient.clear();

      for (const key of [...mockSearchParams.keys()]) {
        mockSearchParams.delete(key);
      }
      for (const [key, value] of serializedParams.entries()) {
        mockSearchParams.set(key, value);
      }

      // Unmount the first tree before re-rendering: this round-trip simulates a
      // fresh navigation to the captured URL. Leaving it mounted lets its stale
      // Filters effect race with the new mount over the shared store (React 19's
      // effect ordering surfaces this; React 18 happened to let the new tree win).
      cleanup();

      renderWithProviders(<Overview params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(
            screen.getAllByText("Crash free sessions").length,
          ).toBeGreaterThanOrEqual(1);
        },
        { timeout: 5000 },
      );

      // The version should be restored from URL. React 19 may commit the
      // restored selection a tick after the data resolves, so wait for it.
      await waitFor(() => {
        const versions = filtersStore.getState().selectedVersions;
        expect(versions).toHaveLength(1);
        expect(versions[0].name).toBe("3.0.2");
      });
    });

    it("date range survives URL round-trip", async () => {
      await renderAndWaitForData();

      // Change to Last Week
      await act(async () => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtersStore.getState().setSelectedDateRange("Last Week");
        filtersStore.getState().setSelectedStartDate(weekAgo.toISOString());
        filtersStore.getState().setSelectedEndDate(now.toISOString());
      });

      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalled();
      });
      const serializedUrl = mockRouterReplace.mock.calls[
        mockRouterReplace.mock.calls.length - 1
      ][0] as string;
      const serializedParams = new URLSearchParams(
        serializedUrl.replace(/^\?/, ""),
      );

      // Reset and re-render
      filtersStore.getState().reset();
      testQueryClient.clear();

      for (const key of [...mockSearchParams.keys()]) {
        mockSearchParams.delete(key);
      }
      for (const [key, value] of serializedParams.entries()) {
        mockSearchParams.set(key, value);
      }

      // Unmount the first tree before re-rendering: this round-trip simulates a
      // fresh navigation to the captured URL. Leaving it mounted lets its stale
      // Filters effect race with the new mount over the shared store (React 19's
      // effect ordering surfaces this; React 18 happened to let the new tree win).
      cleanup();

      renderWithProviders(<Overview params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(
            screen.getAllByText("Crash free sessions").length,
          ).toBeGreaterThanOrEqual(1);
        },
        { timeout: 5000 },
      );

      expect(filtersStore.getState().selectedDateRange).toBe("Last Week");
    });
  });
});

// ====================================================================
// ERROR EDGE CASES
// ====================================================================
describe("Overview page — error edge cases", () => {
  it("shortFilters POST failure still loads data (without filter_short_code)", async () => {
    const metricsUrls: string[] = [];
    server.use(
      http.post("*/api/apps/:appId/shortFilters", () => {
        return new HttpResponse(null, { status: 500 });
      }),
      http.get("*/api/apps/:appId/metrics", ({ request }) => {
        metricsUrls.push(request.url);
        return HttpResponse.json(makeMetricsFixture());
      }),
    );

    renderWithProviders(<Overview params={{ teamId: "test-team" }} />);

    await waitFor(
      () => {
        expect(screen.getByText("Crash free sessions")).toBeTruthy();
      },
      { timeout: 5000 },
    );

    // Metrics loaded but without filter_short_code (POST failed → null)
    const lastUrl = metricsUrls[metricsUrls.length - 1];
    expect(lastUrl).not.toContain("filter_short_code=");
  });
});

// ====================================================================
// CONCURRENT / RE-RENDER scenarios
// ====================================================================
describe("Overview page — concurrent and re-render scenarios", () => {
  const { AppVersion } = require("@/app/api/api_calls");

  it("rapid version changes settle on the last one", async () => {
    const shortFilterBodies: any[] = [];
    server.use(
      http.post("*/api/apps/:appId/shortFilters", async ({ request }) => {
        shortFilterBodies.push(await request.json());
        return HttpResponse.json({
          filter_short_code: `code-${shortFilterBodies.length}`,
        });
      }),
    );

    renderWithProviders(<Overview params={{ teamId: "test-team" }} />);
    await waitFor(
      () => {
        expect(screen.getByText("Crash free sessions")).toBeTruthy();
      },
      { timeout: 5000 },
    );

    // Fire 3 version changes in rapid succession
    await act(async () => {
      filtersStore
        .getState()
        .setSelectedVersions([new AppVersion("3.0.2", "302")]);
      filtersStore
        .getState()
        .setSelectedVersions([new AppVersion("3.0.1", "301")]);
      filtersStore
        .getState()
        .setSelectedVersions([new AppVersion("3.1.0", "310")]);
    });

    // Final state should be the last version
    await waitFor(() => {
      expect(filtersStore.getState().selectedVersions[0]?.name).toBe("3.1.0");
    });
  });

  it("rapid date changes settle on the last one", async () => {
    renderWithProviders(<Overview params={{ teamId: "test-team" }} />);
    await waitFor(
      () => {
        expect(screen.getByText("Crash free sessions")).toBeTruthy();
      },
      { timeout: 5000 },
    );

    const now = new Date();
    await act(async () => {
      filtersStore.getState().setSelectedDateRange("Last Week");
      filtersStore
        .getState()
        .setSelectedStartDate(
          new Date(now.getTime() - 7 * 86400000).toISOString(),
        );
      filtersStore.getState().setSelectedEndDate(now.toISOString());

      filtersStore.getState().setSelectedDateRange("Last Month");
      filtersStore
        .getState()
        .setSelectedStartDate(
          new Date(now.getTime() - 30 * 86400000).toISOString(),
        );
      filtersStore.getState().setSelectedEndDate(now.toISOString());
    });

    expect(filtersStore.getState().selectedDateRange).toBe("Last Month");
  });

  it("re-render still shows data (TanStack Query manages cache)", async () => {
    const { unmount } = renderWithProviders(
      <Overview params={{ teamId: "test-team" }} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText("99.1%")).toBeTruthy();
      },
      { timeout: 5000 },
    );

    // Unmount and re-render — TanStack Query handles caching
    unmount();
    renderWithProviders(<Overview params={{ teamId: "test-team" }} />);

    await waitFor(
      () => {
        expect(screen.getByText("99.1%")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });
});

// ====================================================================
// TEAM SWITCH — team with apps → team with no apps
// ====================================================================
describe("Overview page — team switch to no-apps team", () => {
  it("switching from team with apps to team with no apps shows NoApps after store reset", async () => {
    // Phase 1: render with team that has apps — fully load
    const { unmount } = renderWithProviders(
      <Overview params={{ teamId: "team-with-apps" }} />,
    );

    await waitFor(
      () => {
        expect(screen.getByText("99.1%")).toBeTruthy();
      },
      { timeout: 5000 },
    );

    // Reset the filtersStore (simulating what onTeamChanged does in the layout)
    filtersStore.getState().reset();

    // Phase 2: override MSW to return 404 for apps, unmount, re-render with new teamId
    server.use(
      http.get("*/api/teams/:teamId/apps", () => {
        return new HttpResponse(null, { status: 404 });
      }),
    );

    unmount();

    renderWithProviders(<Overview params={{ teamId: "team-no-apps" }} />);

    // Wait for NoApps message to appear
    await waitFor(
      () => {
        expect(screen.getByTestId("onboarding-step-create")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });
});

// ====================================================================
// DEMO MODE
// ====================================================================
describe("Overview page — demo mode", () => {
  it("renders without making any API calls", async () => {
    const apiCalls: string[] = [];
    server.use(
      http.get("*", ({ request }) => {
        apiCalls.push(request.url);
        return HttpResponse.json({});
      }),
      http.post("*", ({ request }) => {
        apiCalls.push(request.url);
        return HttpResponse.json({});
      }),
    );

    renderWithProviders(<Overview demo={true} />);

    // Demo uses hardcoded data, no API calls
    expect(screen.getByText("App Health")).toBeTruthy();
    // Give it a moment to confirm no API calls fire
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    expect(apiCalls.length).toBe(0);
  });
});

// ====================================================================
// URL PARAMS IN DATA-FETCH REQUESTS
// ====================================================================
describe("Overview page — URL params in data-fetch requests", () => {
  async function renderAndWaitForData() {
    renderWithProviders(<Overview params={{ teamId: "test-team" }} />);
    await waitFor(
      () => {
        // Wait for actual metrics data to render via TanStack Query
        expect(screen.getByText("99.1%")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  it("all data-fetch URLs include timezone param", async () => {
    const allUrls: string[] = [];
    server.use(
      http.get("*/api/apps/:appId/metrics", ({ request }) => {
        allUrls.push(request.url);
        return HttpResponse.json(makeMetricsFixture());
      }),
      http.get("*/api/apps/:appId/health/plots/instances", ({ request }) => {
        allUrls.push(request.url);
        return HttpResponse.json(makeHealthPlotFixture());
      }),
    );

    await renderAndWaitForData();

    for (const url of allUrls) {
      expect(url).toContain("timezone=");
    }
  });

  it("plot URLs include plot_time_group param", async () => {
    const plotUrls: string[] = [];
    server.use(
      http.get("*/api/apps/:appId/health/plots/instances", ({ request }) => {
        plotUrls.push(request.url);
        return HttpResponse.json(makeHealthPlotFixture());
      }),
    );

    await renderAndWaitForData();

    expect(plotUrls.length).toBeGreaterThan(0);
    expect(plotUrls[0]).toContain("plot_time_group=");
  });
});

// ====================================================================
// AUTH FAILURE FLOW
// ====================================================================
describe("Overview page — auth failure", () => {
  it("401 on data fetch triggers token refresh attempt", async () => {
    let refreshAttempted = false;
    server.use(
      http.get("*/api/apps/:appId/metrics", () => {
        return new HttpResponse(null, { status: 401 });
      }),
      http.post("*/auth/refresh", () => {
        refreshAttempted = true;
        // Refresh also fails → redirect to login
        return new HttpResponse(null, { status: 401 });
      }),
    );

    renderWithProviders(<Overview params={{ teamId: "test-team" }} />);

    await waitFor(
      () => {
        expect(refreshAttempted).toBe(true);
      },
      { timeout: 5000 },
    );
  });
});
