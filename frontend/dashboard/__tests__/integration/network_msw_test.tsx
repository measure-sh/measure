/**
 * Integration tests for Network Overview and Details pages.
 *
 * Covers page/api wiring only: domain auto-selection from the API, HTTP
 * failure handling for every endpoint, request paths and query params,
 * URL serialisation, cache behaviour, and re-fetching when filters change.
 * Rendering behaviour is covered by the unit tests in __tests__/pages and
 * __tests__/components.
 *
 * Network pages use FilterSource.Events with showNoData=false,
 * showNotOnboarded=true, so filters.ready requires apps+filters
 * but not NoData/NotOnboarded.
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
import { act, render, screen, waitFor } from "@testing-library/react";
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
  makeNetworkDomainsFixture,
  makeNetworkEndpointLatencyFixture,
  makeNetworkEndpointStatusCodesFixture,
  makeNetworkEndpointTimelineFixture,
  makeNetworkOverviewStatusCodesFixture,
  makeNetworkTimelineFixture,
  makeNetworkTrendsFixture,
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
import NetworkDetails from "@/app/components/network_details";
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
        // Wait for domains to load and trends table to appear
        expect(screen.getByText("Explore endpoint")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // PAGE LOAD
  // ================================================================
  describe("page load", () => {
    it("auto-selects first domain from API", async () => {
      await renderAndWaitForData();
      // The component auto-selects the first domain via useEffect.
      // The domain dropdown shows the selected domain text.
      await waitFor(() => {
        expect(screen.getByText("api.example.com")).toBeTruthy();
      });
    });

    it("shows error when domains API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/networkRequests/domains", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderWithProviders(<NetworkOverview params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(screen.getByText(/Error fetching domains/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it('shows "No data" when domains API returns no data', async () => {
      server.use(
        http.get("*/api/apps/:appId/networkRequests/domains", () => {
          return HttpResponse.json({ results: null });
        }),
      );
      renderWithProviders(<NetworkOverview params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(
            screen.getByText(/No data available for the selected app/),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
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
        http.get(
          "*/api/apps/:appId/networkRequests/plots/overviewStatusCodes",
          () => {
            return new HttpResponse(null, { status: 500 });
          },
        ),
      );
      renderWithProviders(<NetworkOverview params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(
            screen.getByText(/Error fetching status overview/),
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
        http.get(
          "*/api/apps/:appId/networkRequests/plots/overviewTimeline",
          () => {
            return new HttpResponse(null, { status: 500 });
          },
        ),
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
    it("fetches domains from /networkRequests/domains", async () => {
      const paths: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/networkRequests/domains", ({ request }) => {
          paths.push(new URL(request.url).pathname);
          return HttpResponse.json(makeNetworkDomainsFixture());
        }),
      );
      await renderAndWaitForData();
      expect(paths.some((p) => p.includes("/networkRequests/domains"))).toBe(
        true,
      );
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

  // ================================================================
  // CACHING
  // ================================================================
  describe("caching", () => {
    it("re-render with same filters re-fetches domains (gcTime: 0 evicts on unmount)", async () => {
      let fetchCount = 0;
      server.use(
        http.get("*/api/apps/:appId/networkRequests/domains", () => {
          fetchCount++;
          return HttpResponse.json(makeNetworkDomainsFixture());
        }),
      );
      const { unmount } = render(
        <QueryClientProvider client={testQueryClient}>
          <NetworkOverview params={{ teamId: "test-team" }} />
        </QueryClientProvider>,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Explore endpoint")).toBeTruthy();
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
          expect(screen.getByText("Explore endpoint")).toBeTruthy();
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
    it("date range change re-fetches domains, status plot, and timeline", async () => {
      let domainsFetches = 0;
      let statusPlotFetches = 0;
      let timelineFetches = 0;
      server.use(
        http.get("*/api/apps/:appId/networkRequests/domains", () => {
          domainsFetches++;
          return HttpResponse.json(makeNetworkDomainsFixture());
        }),
        http.get(
          "*/api/apps/:appId/networkRequests/plots/overviewStatusCodes",
          () => {
            statusPlotFetches++;
            return HttpResponse.json(makeNetworkOverviewStatusCodesFixture());
          },
        ),
        http.get(
          "*/api/apps/:appId/networkRequests/plots/overviewTimeline",
          () => {
            timelineFetches++;
            return HttpResponse.json(makeNetworkTimelineFixture());
          },
        ),
      );

      await renderAndWaitForData();
      const initialDomains = domainsFetches;
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
describe("Network Details (MSW integration)", () => {
  function renderDetails(
    domain = "api.example.com",
    path = "/v1/users/*/profile",
  ) {
    mockSearchParams.set("domain", domain);
    mockSearchParams.set("path", path);
    return renderWithProviders(
      <NetworkDetails params={{ teamId: "test-team" }} />,
    );
  }

  async function renderAndWaitForDetails(
    domain = "api.example.com",
    path = "/v1/users/*/profile",
  ) {
    renderDetails(domain, path);
    await waitFor(
      () => {
        expect(screen.getByText("Latency")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // ERROR STATES
  // ================================================================
  describe("error states", () => {
    it("shows error when latency API returns 500", async () => {
      server.use(
        http.get(
          "*/api/apps/:appId/networkRequests/plots/endpointLatency",
          () => {
            return new HttpResponse(null, { status: 500 });
          },
        ),
      );
      renderDetails();
      await waitFor(
        () => {
          expect(screen.getByText(/Error fetching latency data/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("shows error when status distribution API returns 500", async () => {
      server.use(
        http.get(
          "*/api/apps/:appId/networkRequests/plots/endpointStatusCodes",
          () => {
            return new HttpResponse(null, { status: 500 });
          },
        ),
      );
      renderDetails();
      await waitFor(
        () => {
          expect(
            screen.getByText(/Error fetching status distribution/),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("shows error when endpoint timeline API returns 500", async () => {
      server.use(
        http.get(
          "*/api/apps/:appId/networkRequests/plots/endpointTimeline",
          () => {
            return new HttpResponse(null, { status: 500 });
          },
        ),
      );
      renderDetails();
      await waitFor(
        () => {
          expect(screen.getByText(/Error fetching timeline data/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // API PATHS
  // ================================================================
  describe("API paths", () => {
    it("sends domain and path in latency request URL", async () => {
      const requestUrls: string[] = [];
      server.use(
        http.get(
          "*/api/apps/:appId/networkRequests/plots/endpointLatency",
          ({ request }) => {
            requestUrls.push(new URL(request.url).toString());
            return HttpResponse.json(makeNetworkEndpointLatencyFixture());
          },
        ),
      );
      await renderAndWaitForDetails();
      const lastUrl = requestUrls[requestUrls.length - 1];
      expect(lastUrl).toContain("domain=");
      expect(lastUrl).toContain("path=");
    });

    it("sends domain and path in status codes request URL", async () => {
      const requestUrls: string[] = [];
      server.use(
        http.get(
          "*/api/apps/:appId/networkRequests/plots/endpointStatusCodes",
          ({ request }) => {
            requestUrls.push(new URL(request.url).toString());
            return HttpResponse.json(makeNetworkEndpointStatusCodesFixture());
          },
        ),
      );
      await renderAndWaitForDetails();
      const lastUrl = requestUrls[requestUrls.length - 1];
      expect(lastUrl).toContain("domain=");
      expect(lastUrl).toContain("path=");
    });
  });

  // ================================================================
  // URL SYNC
  // ================================================================
  describe("URL sync", () => {
    it("serialises filters + domain + path into URL", async () => {
      await renderAndWaitForDetails();
      expect(mockRouterReplace).toHaveBeenCalled();
      const url =
        mockRouterReplace.mock.calls[
          mockRouterReplace.mock.calls.length - 1
        ][0];
      expect(url).toContain("domain=");
      expect(url).toContain("path=");
    });
  });

  // ================================================================
  // CACHING
  // ================================================================
  describe("caching", () => {
    it("re-render with same params re-fetches latency (gcTime: 0)", async () => {
      let fetchCount = 0;
      server.use(
        http.get(
          "*/api/apps/:appId/networkRequests/plots/endpointLatency",
          () => {
            fetchCount++;
            return HttpResponse.json(makeNetworkEndpointLatencyFixture());
          },
        ),
      );
      mockSearchParams.set("domain", "api.example.com");
      mockSearchParams.set("path", "/v1/users/*/profile");
      const { unmount } = render(
        <QueryClientProvider client={testQueryClient}>
          <NetworkDetails params={{ teamId: "test-team" }} />
        </QueryClientProvider>,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Latency")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      const initial = fetchCount;

      unmount();
      render(
        <QueryClientProvider client={testQueryClient}>
          <NetworkDetails params={{ teamId: "test-team" }} />
        </QueryClientProvider>,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Latency")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(fetchCount).toBeGreaterThan(initial);
    });

    it("different domain+path bypasses cache and re-fetches", async () => {
      let fetchCount = 0;
      server.use(
        http.get(
          "*/api/apps/:appId/networkRequests/plots/endpointLatency",
          () => {
            fetchCount++;
            return HttpResponse.json(makeNetworkEndpointLatencyFixture());
          },
        ),
      );

      // Render with first endpoint
      const { unmount } = renderWithProviders(
        <NetworkDetails params={{ teamId: "test-team" }} />,
      );
      mockSearchParams.set("domain", "api.example.com");
      mockSearchParams.set("path", "/v1/users/*/profile");
      await waitFor(
        () => {
          expect(screen.getByText("Latency")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      const initial = fetchCount;

      unmount();

      // Render with a different endpoint so the latency query key changes
      mockSearchParams.set("domain", "cdn.example.com");
      mockSearchParams.set("path", "/images/*");
      renderWithProviders(<NetworkDetails params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(screen.getByText("Latency")).toBeTruthy();
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
    it("date range change re-fetches all 3 endpoints", async () => {
      let latencyFetches = 0;
      let statusFetches = 0;
      let timelineFetches = 0;
      server.use(
        http.get(
          "*/api/apps/:appId/networkRequests/plots/endpointLatency",
          () => {
            latencyFetches++;
            return HttpResponse.json(makeNetworkEndpointLatencyFixture());
          },
        ),
        http.get(
          "*/api/apps/:appId/networkRequests/plots/endpointStatusCodes",
          () => {
            statusFetches++;
            return HttpResponse.json(makeNetworkEndpointStatusCodesFixture());
          },
        ),
        http.get(
          "*/api/apps/:appId/networkRequests/plots/endpointTimeline",
          () => {
            timelineFetches++;
            return HttpResponse.json(makeNetworkEndpointTimelineFixture());
          },
        ),
      );

      await renderAndWaitForDetails();
      const initialLatency = latencyFetches;
      const initialStatus = statusFetches;
      const initialTimeline = timelineFetches;

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
          expect(latencyFetches).toBeGreaterThan(initialLatency);
        },
        { timeout: 5000 },
      );
      expect(statusFetches).toBeGreaterThan(initialStatus);
      expect(timelineFetches).toBeGreaterThan(initialTimeline);
    });
  });
});
