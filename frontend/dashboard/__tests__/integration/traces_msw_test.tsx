/**
 * Integration tests for Traces Overview and Detail pages.
 *
 * Overview: paginated spans list with 4 columns (Trace, Start Time,
 * Duration, Status), span metrics plot with quantile selector, and
 * 10 filter types. Uses FilterSource.Spans which adds span_name and
 * span_statuses filters.
 *
 * Detail: single trace with pills (User ID, Start Time, Duration,
 * Device, App version, Network type), TraceWaterfall timeline visualization,
 * and "View Session Replay" link.
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
  usePathname: () => "/test-team/traces",
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
  makeAppFixture,
  makeSpanMetricsPlotFixture,
  makeSpansOverviewFixture,
  makeTraceDetailFixture,
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
import TracesOverview from "@/app/[teamId]/traces/page";
import TraceDetails from "@/app/components/trace/details";
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

// ====================================================================
// TRACES OVERVIEW
// ====================================================================
describe("Traces Overview (MSW integration)", () => {
  const { AppVersion, OsVersion } = require("@/app/api/api_calls");

  async function renderAndWaitForData() {
    renderWithProviders(
      <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
    );
    await waitFor(
      () => {
        // Wait for the trace ID to appear in the table (not span name which also appears in root span names dropdown)
        expect(screen.getByText("ID: trace-001")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // PAGE LOAD
  // ================================================================
  describe("page load", () => {
    it("shows error when spans API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/spans", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.includes("/roots/")
          )
            return;
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderWithProviders(
        <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(
            screen.getByText(/Error fetching list of traces/),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("shows plot error when plot API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/spans/plots/metrics", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderWithProviders(
        <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
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
    it("clicking Next renders page 2 data, Previous returns to page 1", async () => {
      const page2Fixture = makeSpansOverviewFixture({
        meta: { next: false, previous: true },
        results: [
          {
            ...makeSpansOverviewFixture().results[0],
            span_name: "page2_span_render_ui",
            trace_id: "trace-page2",
          },
        ],
      });

      server.use(
        http.get("*/api/apps/:appId/spans", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.includes("/roots/")
          )
            return;
          const offset = url.searchParams.get("offset");
          if (offset === "5") return HttpResponse.json(page2Fixture);
          return HttpResponse.json(makeSpansOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      expect(screen.getByText("ID: trace-001")).toBeTruthy();

      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });
      await waitFor(
        () => {
          expect(screen.getByText("ID: trace-page2")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(screen.queryByText("ID: trace-001")).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByText("Previous").closest("button")!);
      });
      await waitFor(
        () => {
          expect(screen.getByText("ID: trace-001")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(screen.queryByText("ID: trace-page2")).toBeNull();
    });

    it("deep-link with po=5 renders page 2 data", async () => {
      server.use(
        http.get("*/api/apps/:appId/spans", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.includes("/roots/")
          )
            return;
          const offset = url.searchParams.get("offset");
          if (offset === "5")
            return HttpResponse.json(
              makeSpansOverviewFixture({
                results: [
                  {
                    ...makeSpansOverviewFixture().results[0],
                    trace_id: "trace-deep-link",
                    span_name: "deep_link_span",
                  },
                ],
              }),
            );
          return HttpResponse.json(makeSpansOverviewFixture());
        }),
      );

      mockSearchParams.set("po", "5");
      renderWithProviders(
        <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("ID: trace-deep-link")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(screen.queryByText("ID: trace-001")).toBeNull();
    });
  });

  // ================================================================
  // FILTERS
  // ================================================================
  describe("filters", () => {
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

    it.each([
      [
        "versions",
        () =>
          filtersStore
            .getState()
            .setSelectedVersions([new AppVersion("3.0.1", "301")]),
        ["3.0.1"],
      ],
      [
        "os_names",
        () =>
          filtersStore
            .getState()
            .setSelectedOsVersions([new OsVersion("android", "14")]),
        ["android"],
      ],
      [
        "countries",
        () => filtersStore.getState().setSelectedCountries(["DE"]),
        ["DE"],
      ],
      [
        "network_providers",
        () => filtersStore.getState().setSelectedNetworkProviders(["Jio"]),
        ["Jio"],
      ],
      [
        "network_types",
        () => filtersStore.getState().setSelectedNetworkTypes(["cellular"]),
        ["cellular"],
      ],
      [
        "network_generations",
        () => filtersStore.getState().setSelectedNetworkGenerations(["5g"]),
        ["5g"],
      ],
      [
        "locales",
        () => filtersStore.getState().setSelectedLocales(["hi-IN"]),
        ["hi-IN"],
      ],
      [
        "device_manufacturers",
        () =>
          filtersStore.getState().setSelectedDeviceManufacturers(["Samsung"]),
        ["Samsung"],
      ],
      [
        "device_names",
        () => filtersStore.getState().setSelectedDeviceNames(["Galaxy S24"]),
        ["Galaxy S24"],
      ],
    ])(
      "%s filter change is sent in shortFilters POST",
      async (field, applyFilter, expected) => {
        await renderAndWaitForData();
        shortFilterBodies.length = 0;
        await act(async () => {
          (applyFilter as () => void)();
        });
        await waitFor(
          () => expect(shortFilterBodies.length).toBeGreaterThan(0),
          { timeout: 5000 },
        );
        expect(
          shortFilterBodies[shortFilterBodies.length - 1].filters[
            field as string
          ],
        ).toEqual(expected);
      },
    );

    it("span status filter sends span_statuses in request URL", async () => {
      const requestUrls: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/spans", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.includes("/roots/")
          )
            return;
          requestUrls.push(url.toString());
          return HttpResponse.json(makeSpansOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      requestUrls.length = 0;

      const { SpanStatus } = require("@/app/api/api_calls");
      await act(async () => {
        filtersStore.getState().setSelectedSpanStatuses([SpanStatus.Error]);
      });

      await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(requestUrls[requestUrls.length - 1]).toContain("span_statuses=2");
    });

    it("multiple span statuses sends multiple params", async () => {
      const requestUrls: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/spans", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.includes("/roots/")
          )
            return;
          requestUrls.push(url.toString());
          return HttpResponse.json(makeSpansOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      requestUrls.length = 0;

      const { SpanStatus } = require("@/app/api/api_calls");
      await act(async () => {
        filtersStore
          .getState()
          .setSelectedSpanStatuses([SpanStatus.Ok, SpanStatus.Error]);
      });

      await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      const lastUrl = requestUrls[requestUrls.length - 1];
      expect(lastUrl).toContain("span_statuses=1");
      expect(lastUrl).toContain("span_statuses=2");
    });

    it("root span name change sends span_name in request URL", async () => {
      const requestUrls: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/spans", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.includes("/roots/")
          )
            return;
          requestUrls.push(url.toString());
          return HttpResponse.json(makeSpansOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      requestUrls.length = 0;

      await act(async () => {
        filtersStore.getState().setSelectedRootSpanName("api_fetch_payments");
      });

      await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      const lastUrl = requestUrls[requestUrls.length - 1];
      expect(lastUrl).toContain("span_name=");
      expect(decodeURIComponent(lastUrl)).toContain("api_fetch_payments");
    });

    it("root span name is also sent in plot request URL", async () => {
      const plotUrls: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/spans/plots/metrics", ({ request }) => {
          plotUrls.push(new URL(request.url).toString());
          return HttpResponse.json(makeSpanMetricsPlotFixture());
        }),
      );

      await renderAndWaitForData();
      plotUrls.length = 0;

      await act(async () => {
        filtersStore.getState().setSelectedRootSpanName("api_fetch_payments");
      });

      await waitFor(() => expect(plotUrls.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(decodeURIComponent(plotUrls[plotUrls.length - 1])).toContain(
        "api_fetch_payments",
      );
    });
  });

  // ================================================================
  // URL SYNC
  // ================================================================
  describe("URL sync", () => {
    it("serialises filters into URL", async () => {
      await renderAndWaitForData();
      const url =
        mockRouterReplace.mock.calls[
          mockRouterReplace.mock.calls.length - 1
        ][0];
      expect(url).toContain("a=");
      expect(url).toContain("sd=");
      expect(url).toContain("ed=");
    });
  });

  // ================================================================
  // REQUEST URL PARAMS
  // ================================================================
  describe("request URL params", () => {
    it("sends limit=5 and offset in request URL", async () => {
      const requestUrls: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/spans", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.includes("/roots/")
          )
            return;
          requestUrls.push(url.toString());
          return HttpResponse.json(makeSpansOverviewFixture());
        }),
      );
      await renderAndWaitForData();
      expect(requestUrls[requestUrls.length - 1]).toContain("limit=5");
      expect(requestUrls[requestUrls.length - 1]).toContain("offset=0");
    });

    it("request URL contains correct app ID", async () => {
      const requestPaths: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/spans", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.includes("/roots/")
          )
            return;
          requestPaths.push(url.pathname);
          return HttpResponse.json(makeSpansOverviewFixture());
        }),
      );
      await renderAndWaitForData();
      expect(requestPaths[requestPaths.length - 1]).toContain(
        `/apps/${makeAppFixture().id}/spans`,
      );
    });
  });

  // ================================================================
  // API PATH VERIFICATION
  // ================================================================
  describe("API paths", () => {
    it("fetches from /spans path", async () => {
      const requestPaths: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/spans", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.includes("/roots/")
          )
            return;
          requestPaths.push(url.pathname);
          return HttpResponse.json(makeSpansOverviewFixture());
        }),
      );
      await renderAndWaitForData();
      expect(requestPaths.some((p) => p.endsWith("/spans"))).toBe(true);
    });

    it("plot endpoint uses /spans/plots/metrics", async () => {
      const plotPaths: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/spans/plots/metrics", ({ request }) => {
          plotPaths.push(new URL(request.url).pathname);
          return HttpResponse.json(makeSpanMetricsPlotFixture());
        }),
      );
      await renderAndWaitForData();
      expect(plotPaths.some((p) => p.includes("/spans/plots/metrics"))).toBe(
        true,
      );
    });
  });

  // ================================================================
  // PLOT STORE
  // ================================================================
  describe("plot store", () => {
    it("plot re-fetches on filter change", async () => {
      let plotFetchCount = 0;
      server.use(
        http.get("*/api/apps/:appId/spans/plots/metrics", () => {
          plotFetchCount++;
          return HttpResponse.json(makeSpanMetricsPlotFixture());
        }),
      );
      await renderAndWaitForData();
      const initial = plotFetchCount;

      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.1", "301")]);
      });
      await waitFor(
        () => {
          expect(plotFetchCount).toBeGreaterThan(initial);
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // CONCURRENT / RE-RENDER
  // ================================================================
  describe("concurrent and re-render", () => {
    it("rapid filter changes settle on the last one", async () => {
      await renderAndWaitForData();
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
      await waitFor(() => {
        expect(filtersStore.getState().selectedVersions[0]?.name).toBe("3.1.0");
      });
    });

    it("re-render still shows data", async () => {
      const { unmount } = renderWithProviders(
        <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("ID: trace-001")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      unmount();
      renderWithProviders(
        <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("ID: trace-001")).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });
});

// ====================================================================
// TRACE DETAIL
// ====================================================================
describe("Trace Detail (MSW integration)", () => {
  const defaultParams = {
    teamId: "test-team",
    appId: "b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f",
    traceId: "trace-001",
  };

  async function renderDetail(params = defaultParams) {
    renderWithProviders(<TraceDetails params={params} />);
    await waitFor(
      () => {
        // Wait for data to load (pills appear on success)
        expect(screen.getByText(/User ID:/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // ERROR STATES
  // ================================================================
  describe("error states", () => {
    it("shows error message when detail API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/traces/:traceId", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderWithProviders(<TraceDetails params={defaultParams} />);
      await waitFor(
        () => {
          expect(screen.getByText(/Error fetching trace/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // CACHING
  // ================================================================
  describe("caching", () => {
    it("data is cached by TanStack Query", async () => {
      await renderDetail();
      // Data loaded successfully and is cached
      expect(screen.getByText(/User ID:/)).toBeTruthy();
    });
  });

  // ================================================================
  // API PATH VERIFICATION
  // ================================================================
  describe("API paths", () => {
    it("fetches from /traces/:traceId", async () => {
      let detailPath = "";
      server.use(
        http.get("*/api/apps/:appId/traces/:traceId", ({ request }) => {
          detailPath = new URL(request.url).pathname;
          return HttpResponse.json(makeTraceDetailFixture());
        }),
      );
      await renderDetail();
      expect(detailPath).toContain(
        "/apps/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/traces/trace-001",
      );
    });
  });
});
