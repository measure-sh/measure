/**
 * Integration tests for Network Overview and Details pages.
 *
 * Covers page/api wiring only: endpoint suggestions, HTTP failure handling
 * for every network endpoint, request paths and query params,
 * URL serialisation, cache behaviour, and re-fetching when filters change.
 * Rendering behaviour is covered by focused page/component tests.
 *
 * Network pages use FilterSource.Events with showNoData=true and
 * showNotOnboarded=true, so filters.ready requires apps+filters and has a
 * dedicated empty state for NoData/NotOnboarded.
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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";

// --- jsdom polyfills ---
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

// --- External dependency mocks ---

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}));

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
const mockSearchParams = new URLSearchParams();
const appFixtureId = "b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f";
jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/test-team/network",
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

jest.mock("@nivo/heatmap", () => ({
  __esModule: true,
  ResponsiveHeatMapCanvas: ({ data }: any) => (
    <div data-testid="nivo-heatmap">{data?.length ?? 0} rows</div>
  ),
}));

// --- MSW ---
import {
  makeNetworkStatusCodesFixture,
  makeNetworkEndpointsFixture,
  makeNetworkTimelineFixture,
  makeNetworkTrendsFixture,
  makeFiltersFixture,
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

// --- Store/component imports ---
import NetworkOverview from "@/app/components/network_overview";
import { createFiltersStore } from "@/app/stores/filters_store";
import { createOnboardingStore } from "@/app/stores/onboarding_store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

beforeEach(() => {
  filtersStore = createFiltersStore();
  onboardingStore = createOnboardingStore();
  testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  filtersStore.getState().reset();
  for (const key of [...mockSearchParams.keys()]) mockSearchParams.delete(key);
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
  // Clear localStorage for recent searches
  try {
    localStorage.clear();
  } catch {}
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>,
  );
}

// ====================================================================
// NETWORK OVERVIEW
// ====================================================================
describe("Network Overview (MSW integration)", () => {
  async function renderAndWaitForData() {
    renderWithProviders(<NetworkOverview params={{ teamId: "test-team" }} />);
    await waitFor(
      () => {
        // Wait for the endpoint ranking to appear
        expect(screen.getByText("Top Endpoints")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // PAGE LOAD
  // ================================================================
  describe("page load", () => {
    it("lists the app's endpoints from the API", async () => {
      await renderAndWaitForData();
      await waitFor(() => {
        expect(screen.getByText("api.example.com/v1/checkout")).toBeTruthy();
      });
    });

    it("shows the shared empty state when the app has no data", async () => {
      server.use(
        http.get("*/api/apps/:appId/filters", () =>
          HttpResponse.json(makeFiltersFixture({ versions: null })),
        ),
      );

      renderWithProviders(<NetworkOverview params={{ teamId: "test-team" }} />);

      await waitFor(() => {
        expect(
          screen.getByText("No data received for this app yet"),
        ).toBeTruthy();
      });
      expect(screen.queryByText("Status Distribution")).toBeNull();
    });
  });

  // ================================================================
  // TRENDS TABLE
  // ================================================================
  describe("trends table", () => {
    it("shows error when trends API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/networkRequests/trends", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderWithProviders(<NetworkOverview params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(screen.getByText(/Error fetching overview/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // STATUS DISTRIBUTION PLOT
  // ================================================================
  describe("status distribution plot", () => {
    it("shows error when status plot API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/networkRequests/plots/statusCodes", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderWithProviders(<NetworkOverview params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(
            screen.getByText(/Error fetching status distribution/),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // TIMELINE PLOT
  // ================================================================
  describe("timeline plot", () => {
    it("shows error when timeline API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/networkRequests/plots/timeline", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderWithProviders(<NetworkOverview params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(
            screen.getByText(/Error fetching requests timeline/),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // URL SYNC
  // ================================================================
  describe("URL sync", () => {
    it("serialises filters into URL", async () => {
      await renderAndWaitForData();
      expect(mockRouterReplace).toHaveBeenCalled();
      const url =
        mockRouterReplace.mock.calls[
          mockRouterReplace.mock.calls.length - 1
        ][0];
      expect(url).toContain("a=");
      expect(url).toContain("sd=");
    });
  });

  // ================================================================
  // API PATHS
  // ================================================================
  describe("API paths", () => {
    it("fetches the endpoint list from /networkRequests/endpoints", async () => {
      const paths: string[] = [];
      server.use(
        http.get(
          "*/api/apps/:appId/networkRequests/endpoints",
          ({ request }) => {
            paths.push(new URL(request.url).pathname);
            return HttpResponse.json(makeNetworkEndpointsFixture());
          },
        ),
      );
      await renderAndWaitForData();
      fireEvent.focus(screen.getByTestId("network-endpoint-search"));
      await waitFor(() => {
        expect(
          paths.some((p) => p.includes("/networkRequests/endpoints")),
        ).toBe(true);
      });
    });

    it("fetches trends from /networkRequests/trends", async () => {
      const paths: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/networkRequests/trends", ({ request }) => {
          paths.push(new URL(request.url).pathname);
          return HttpResponse.json(makeNetworkTrendsFixture());
        }),
      );
      await renderAndWaitForData();
      expect(paths.some((p) => p.includes("/networkRequests/trends"))).toBe(
        true,
      );
    });
  });

  describe("endpoint selection", () => {
    it("opens the selected endpoint's detail route", async () => {
      await renderAndWaitForData();
      fireEvent.focus(screen.getByTestId("network-endpoint-search"));
      await waitFor(() => {
        expect(
          screen.getAllByTestId("network-endpoint-suggestion"),
        ).toHaveLength(3);
      });
      fireEvent.click(screen.getAllByTestId("network-endpoint-suggestion")[0]);
      expect(mockRouterPush).toHaveBeenCalledWith(
        "/test-team/network/details?domain=api.example.com&path=%2Fv1%2Fusers%2F*%2Fprofile&from=search",
      );
    });
  });

  // ================================================================
  // CACHING
  // ================================================================
  describe("caching", () => {
    it("re-render with same filters re-fetches the status plot (gcTime: 0 evicts on unmount)", async () => {
      let fetchCount = 0;
      server.use(
        http.get("*/api/apps/:appId/networkRequests/plots/statusCodes", () => {
          fetchCount++;
          return HttpResponse.json(makeNetworkStatusCodesFixture());
        }),
      );
      const { unmount } = render(
        <QueryClientProvider client={testQueryClient}>
          <NetworkOverview params={{ teamId: "test-team" }} />
        </QueryClientProvider>,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Top Endpoints")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      const initial = fetchCount;

      unmount();
      render(
        <QueryClientProvider client={testQueryClient}>
          <NetworkOverview params={{ teamId: "test-team" }} />
        </QueryClientProvider>,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Top Endpoints")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(fetchCount).toBeGreaterThan(initial);
    });
  });

  // ================================================================
  // FILTER CHANGE RE-FETCH
  // ================================================================
  describe("filter change re-fetch", () => {
    it("date range change re-fetches the status plot and timeline", async () => {
      let statusPlotFetches = 0;
      let timelineFetches = 0;
      server.use(
        http.get("*/api/apps/:appId/networkRequests/plots/statusCodes", () => {
          statusPlotFetches++;
          return HttpResponse.json(makeNetworkStatusCodesFixture());
        }),
        http.get("*/api/apps/:appId/networkRequests/plots/timeline", () => {
          timelineFetches++;
          return HttpResponse.json(makeNetworkTimelineFixture());
        }),
      );

      await renderAndWaitForData();
      const initialStatus = statusPlotFetches;
      const initialTimeline = timelineFetches;

      // Change date range to trigger re-fetch
      const now = new Date();
      await act(async () => {
        filtersStore.getState().setSelectedDateRange("Last Week");
        filtersStore
          .getState()
          .setSelectedStartDate(
            new Date(now.getTime() - 7 * 86400000).toISOString(),
          );
        filtersStore.getState().setSelectedEndDate(now.toISOString());
      });

      await waitFor(
        () => {
          expect(statusPlotFetches).toBeGreaterThan(initialStatus);
        },
        { timeout: 5000 },
      );
      expect(timelineFetches).toBeGreaterThan(initialTimeline);
    });
  });
});

// ====================================================================
// NETWORK DETAILS
// ====================================================================
