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
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

// --- External dependency mocks ---

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}));

const mockRouterPush = mockRouter.pushMock;

jest.mock("next/navigation", () => ({
  ...require("@/__tests__/helpers/mock_router").nextNavigationMock(),
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

// --- MSW ---
import {
  makeAppFixture,
  makeHealthPlotFixture,
  makeMetricsFixture,
  makeThresholdPrefsFixture,
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
import Overview, { OverviewDemo } from "@/app/components/overview";
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

describe("Overview page (MSW integration)", () => {
  function renderPage() {
    return renderWithProviders(<Overview params={{ teamId: "123" }} />);
  }

  async function waitForData() {
    await waitFor(() => expect(screen.getByText("99.1%")).toBeTruthy(), {
      timeout: 5000,
    });
  }

  describe("opening the page", () => {
    it("draws the plot and the metrics cards the server sent", async () => {
      renderPage();
      await waitForData();

      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
      expect(screen.getByText("App adoption")).toBeTruthy();
      expect(screen.getByText("Crash free sessions")).toBeTruthy();
    });

    it("asks for metrics over the range it settled on", async () => {
      const sent = record("metrics", () => makeMetricsFixture());
      renderPage();
      await waitForData();

      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(`/api/apps/${appId}/metrics`);
      expect(sent[0].searchParams.get("from")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("to")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("timezone")).toBeTruthy();
      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
    });

    it("asks for the health plot with a time group and no filter", async () => {
      const sent = record("health/plots/instances", () =>
        makeHealthPlotFixture(),
      );
      renderPage();
      await waitForData();

      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(
        `/api/apps/${appId}/health/plots/instances`,
      );
      expect(sent[0].searchParams.get("plot_time_group")).toBeTruthy();
      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
    });

    it("asks the keys endpoint for the app_health entity", async () => {
      const sent = record("filters/keys");
      renderPage();
      await waitForData();

      await waitFor(() => expect(sent.length).toBeGreaterThan(0));
      expect(sent[0].searchParams.get("entity")).toBe("app_health");
    });

    it("records the app and range it settled on in the URL", async () => {
      renderPage();
      await waitForData();

      const written = lastWrittenUrl();
      expect(written.get("a")).toBe(appId);
      expect(written.get("d")).toBe("Last 6 Hours");
      expect(written.has("filter_expr")).toBe(false);
    });

    it("asks for the app's threshold prefs", async () => {
      const sent = record("thresholdPrefs", () => makeThresholdPrefsFixture());
      renderPage();
      await waitForData();

      expect(sent).toHaveLength(1);
    });
  });

  describe("a link carrying a filter", () => {
    it("filters the metrics and the plot by it", async () => {
      mockRouter.setUrl(
        `filter_expr=${encodeURIComponent("version_name:in:3.1.0")}`,
      );
      const metrics = record("metrics", () => makeMetricsFixture());
      const plot = record("health/plots/instances", () =>
        makeHealthPlotFixture(),
      );
      renderPage();
      await waitForData();

      expect(metrics[0].searchParams.get("filter_expr")).toBe(
        "version_name:in:3.1.0",
      );
      expect(plot[0].searchParams.get("filter_expr")).toBe(
        "version_name:in:3.1.0",
      );
      expect(lastWrittenUrl().get("filter_expr")).toBe("version_name:in:3.1.0");
    });
  });

  describe("when the server fails", () => {
    it("says so for the plot and shows Error on the cards", async () => {
      server.use(
        http.get("*/api/apps/:appId/health/plots/instances", () => {
          return new HttpResponse(null, { status: 500 });
        }),
        http.get("*/api/apps/:appId/metrics", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(await screen.findByText(/Error fetching plot/)).toBeTruthy();
      expect(screen.getAllByText("Error").length).toBeGreaterThan(0);
    });

    it("shows a refused filter's issue in the bar", async () => {
      mockRouter.setUrl(
        `filter_expr=${encodeURIComponent("version_name:in:3.1.0")}`,
      );
      server.use(
        http.get("*/api/apps/:appId/metrics", () => {
          return HttpResponse.json(
            {
              error: "invalid_filter_expr",
              filter_expr_issues: [
                {
                  message: 'Key "os_name" is not a valid filter',
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
        'Key "os_name" is not a valid filter',
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
    it("says there is no data for the plot", async () => {
      server.use(
        http.get("*/api/apps/:appId/health/plots/instances", () =>
          HttpResponse.json([]),
        ),
      );
      renderPage();
      await waitForData();

      expect(screen.getByText("No Data")).toBeTruthy();
    });
  });
});

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

    renderWithProviders(<OverviewDemo />);

    expect(screen.getByText("App Health")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 200));
    expect(apiCalls.length).toBe(0);
  });
});
