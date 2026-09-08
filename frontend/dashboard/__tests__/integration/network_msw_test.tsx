import { mockRouter } from "@/__tests__/helpers/mock_router";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

// --- External dependency mocks ---

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}));

const mockRouterPush = mockRouter.pushMock;

jest.mock("next/navigation", () => ({
  ...require("@/__tests__/helpers/mock_router").nextNavigationMock(),
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

// Radix popovers and cmdk need browser APIs jsdom lacks.
(globalThis as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = jest.fn();
Element.prototype.hasPointerCapture = jest.fn(() => false);
Element.prototype.setPointerCapture = jest.fn();
Element.prototype.releasePointerCapture = jest.fn();

// --- MSW ---
import {
  makeAppFixture,
  makeNetworkEndpointLatencyFixture,
  makeNetworkEndpointsFixture,
  makeNetworkStatusCodesFixture,
  makeNetworkTimelineFixture,
  makeNetworkTrendsFixture,
} from "../msw/fixtures";
import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  mockRouterPush.mockClear();
});
afterAll(() => server.close());

// --- Store/component imports ---
import NetworkDetails from "@/app/components/network_details";
import NetworkOverview from "@/app/components/network_overview";
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

const appId = makeAppFixture().id;

beforeEach(() => {
  filtersStore = createFiltersStore();
  onboardingStore = createOnboardingStore();
  queryClient.clear();
  mockRouter.reset();
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
  localStorage.clear();
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function record(path: string, respond?: () => any) {
  const sent: URL[] = [];
  server.use(
    http.get(`*/api/apps/:appId/${path}`, ({ request }) => {
      sent.push(new URL(request.url));
      return respond === undefined ? undefined : HttpResponse.json(respond());
    }),
  );
  return sent;
}

const lastWrittenUrl = () => new URLSearchParams(window.location.search);

describe("Network overview (MSW integration)", () => {
  function renderPage() {
    return renderWithProviders(<NetworkOverview params={{ teamId: "123" }} />);
  }

  async function waitForPlots() {
    await waitFor(
      () => expect(screen.getByTestId("nivo-heatmap")).toBeTruthy(),
      {
        timeout: 5000,
      },
    );
  }

  describe("opening the page", () => {
    it("draws the plots and the ranking the server sent", async () => {
      renderPage();
      await waitForPlots();

      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
      expect(screen.getByText("Top Endpoints")).toBeTruthy();
      expect(screen.getByText("api.example.com/v1/checkout")).toBeTruthy();
    });

    it("asks for every endpoint over the range it settled on", async () => {
      const sent = record("networkRequests/plots/statusCodes", () =>
        makeNetworkStatusCodesFixture(),
      );
      renderPage();
      await waitForPlots();

      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(
        `/api/apps/${appId}/networkRequests/plots/statusCodes`,
      );
      expect(sent[0].searchParams.get("from")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("to")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("timezone")).toBeTruthy();
      expect(sent[0].searchParams.get("plot_time_group")).toBe("minutes");
      expect(sent[0].searchParams.get("domain")).toBe("");
      expect(sent[0].searchParams.get("path")).toBe("");
      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
      expect(sent[0].searchParams.has("http_methods")).toBe(false);
      expect(sent[0].searchParams.has("filter_short_code")).toBe(false);
    });

    it("asks for the ranking with a limit and no time group", async () => {
      const sent = record("networkRequests/trends", () =>
        makeNetworkTrendsFixture(),
      );
      renderPage();
      await waitForPlots();

      expect(sent[0].searchParams.get("trends_limit")).toBe("10");
      expect(sent[0].searchParams.has("plot_time_group")).toBe(false);
    });

    it("asks the keys endpoint for the network entity", async () => {
      const sent = record("filters/keys");
      renderPage();
      await waitForPlots();

      await waitFor(() => expect(sent.length).toBeGreaterThan(0));
      expect(sent[0].searchParams.get("entity")).toBe("network");
    });

    it("records the app and range it settled on in the URL, with no offset", async () => {
      renderPage();
      await waitForPlots();

      const written = lastWrittenUrl();
      expect(written.get("a")).toBe(appId);
      expect(written.get("d")).toBe("Last 6 Hours");
      expect(written.has("po")).toBe(false);
      expect(written.has("hm")).toBe(false);
    });
  });

  describe("a link carrying a filter", () => {
    it("filters every request by it", async () => {
      mockRouter.setUrl(
        `filter_expr=${encodeURIComponent("http_method:in:get")}`,
      );
      const statusCodes = record("networkRequests/plots/statusCodes", () =>
        makeNetworkStatusCodesFixture(),
      );
      const timeline = record("networkRequests/plots/timeline", () =>
        makeNetworkTimelineFixture(),
      );
      const trends = record("networkRequests/trends", () =>
        makeNetworkTrendsFixture(),
      );
      renderPage();
      await waitForPlots();

      for (const sent of [statusCodes, timeline, trends]) {
        expect(sent[0].searchParams.get("filter_expr")).toBe(
          "http_method:in:get",
        );
      }
      expect(lastWrittenUrl().get("filter_expr")).toBe("http_method:in:get");
    });
  });

  describe("the endpoint search", () => {
    it("opens the endpoint it is given, keeping the filter in the URL", async () => {
      mockRouter.setUrl(
        `filter_expr=${encodeURIComponent("http_method:in:get")}`,
      );
      const sent = record("networkRequests/endpoints", () =>
        makeNetworkEndpointsFixture(),
      );
      renderPage();
      await waitForPlots();

      fireEvent.focus(screen.getByTestId("network-endpoint-search"));
      await waitFor(() =>
        expect(
          screen.getAllByTestId("network-endpoint-suggestion"),
        ).toHaveLength(3),
      );
      expect(sent[0].searchParams.get("filter_expr")).toBe(
        "http_method:in:get",
      );

      fireEvent.click(screen.getAllByTestId("network-endpoint-suggestion")[0]);
      const opened = new URL(
        mockRouterPush.mock.calls.at(-1)![0] as string,
        "http://localhost",
      );
      expect(opened.pathname).toBe("/123/network/details");
      expect(Object.fromEntries(opened.searchParams)).toEqual({
        a: appId,
        d: "Last 6 Hours",
        filter_expr: "http_method:in:get",
        domain: "api.example.com",
        path: "/v1/users/*/profile",
        from: "search",
      });
    });
  });

  describe("when the server fails", () => {
    it("says so for each plot", async () => {
      server.use(
        http.get("*/api/apps/:appId/networkRequests/plots/statusCodes", () => {
          return new HttpResponse(null, { status: 500 });
        }),
        http.get("*/api/apps/:appId/networkRequests/plots/timeline", () => {
          return new HttpResponse(null, { status: 500 });
        }),
        http.get("*/api/apps/:appId/networkRequests/trends", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(
        await screen.findByText(/Error fetching status distribution/),
      ).toBeTruthy();
      expect(screen.getByText(/Error fetching requests timeline/)).toBeTruthy();
      expect(screen.getByText(/Error fetching overview/)).toBeTruthy();
    });

    it("shows a refused filter's issue in the bar, not the error message", async () => {
      mockRouter.setUrl(
        `filter_expr=${encodeURIComponent("http_method:in:get")}`,
      );
      server.use(
        http.get("*/api/apps/:appId/networkRequests/plots/statusCodes", () => {
          return HttpResponse.json(
            {
              error: "invalid_filter_expr",
              filter_expr_issues: [
                {
                  message: 'Key "http_method" has no value "get"',
                  span: { start: 0, end: 18 },
                },
              ],
            },
            { status: 400 },
          );
        }),
      );
      renderPage();

      expect((await screen.findByTestId("filter-issue")).textContent).toContain(
        'Key "http_method" has no value "get"',
      );
    });

    it("says so when the team's apps cannot be fetched", async () => {
      server.use(
        http.get("*/api/teams/:teamId/apps", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(await screen.findByText(/Error fetching apps/)).toBeTruthy();
    });
  });

  describe("when the server answers with nothing", () => {
    it("says there is no data for the filter", async () => {
      server.use(
        http.get("*/api/apps/:appId/networkRequests/plots/statusCodes", () =>
          HttpResponse.json([]),
        ),
        http.get("*/api/apps/:appId/networkRequests/plots/timeline", () =>
          HttpResponse.json({ interval: 5, points: [] }),
        ),
      );
      renderPage();

      await waitFor(() =>
        expect(
          screen.getAllByText("No data available for the selected filters")
            .length,
        ).toBeGreaterThan(0),
      );
      expect(screen.queryByTestId("nivo-heatmap")).toBeNull();
    });
  });
});

describe("Network details (MSW integration)", () => {
  const endpoint = "domain=api.example.com&path=%2Fv1%2Fusers";

  function renderPage() {
    return renderWithProviders(<NetworkDetails params={{ teamId: "123" }} />);
  }

  async function waitForPlots() {
    await waitFor(
      () => expect(screen.getByTestId("nivo-heatmap")).toBeTruthy(),
      { timeout: 5000 },
    );
  }

  beforeEach(() => {
    mockRouter.setUrl(`?${endpoint}`);
  });

  it("asks every plot for the endpoint the URL names", async () => {
    mockRouter.setUrl(
      `?${endpoint}&filter_expr=${encodeURIComponent("http_method:in:get")}`,
    );
    const latency = record("networkRequests/plots/latency", () =>
      makeNetworkEndpointLatencyFixture(),
    );
    const timeline = record("networkRequests/plots/timeline", () =>
      makeNetworkTimelineFixture(),
    );
    renderPage();
    await waitForPlots();

    for (const sent of [latency, timeline]) {
      expect(sent[0].searchParams.get("domain")).toBe("api.example.com");
      expect(sent[0].searchParams.get("path")).toBe("/v1/users");
      expect(sent[0].searchParams.get("filter_expr")).toBe(
        "http_method:in:get",
      );
    }
    expect(latency[0].searchParams.get("plot_time_group")).toBe("minutes");
    expect(timeline[0].searchParams.has("plot_time_group")).toBe(false);
  });

  it("keeps the endpoint in the URL beside what it settled on", async () => {
    renderPage();
    await waitForPlots();

    const written = lastWrittenUrl();
    expect(written.get("domain")).toBe("api.example.com");
    expect(written.get("path")).toBe("/v1/users");
    expect(written.get("a")).toBe(appId);
    expect(written.get("d")).toBe("Last 6 Hours");
  });

  it("draws the latency, status code and timeline plots", async () => {
    renderPage();
    await waitForPlots();

    expect(screen.getByText("Latency")).toBeTruthy();
    expect(screen.getByText("Status Codes")).toBeTruthy();
    expect(screen.getAllByTestId("nivo-line-chart")).toHaveLength(2);
  });
});
