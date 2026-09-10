/**
 * Integration tests for the wiring between the Memory Monitoring page and
 * the server: request paths and parameters, the multi-series trend chart,
 * Play threshold plumbing, pagination, and filter propagation through the
 * shared sessions FilterBar.
 *
 * Unique to memory:
 *   - the sessions filter entity, reused rather than a bespoke one
 *   - no process-state filter/param — the trend endpoint returns every
 *     state's series in one response, and the chart draws all of them
 *     simultaneously rather than requiring one to be picked first
 *   - the Play threshold, computed server-side and only ever displayed,
 *     never recomputed client-side (backend/libs/measure/memory_thresholds.go
 *     owns the ambiguity rules — see its tests for that coverage)
 */
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

const mockRouterPush = mockRouter.pushMock;

jest.mock("next/navigation", () => ({
  ...require("@/__tests__/helpers/mock_router").nextNavigationMock(),
  usePathname: () => "/test-team/memory",
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

// Exposes whether MemoryUsagePlot decided to include the threshold layer
// (memory_usage_plot.tsx's `layers` array carries a function only when a
// threshold resolves) without needing to render real canvas pixels.
jest.mock("@nivo/line", () => {
  const LineChartStub = ({ data, layers }: any) => (
    <div
      data-testid="nivo-line-chart"
      data-has-threshold={
        Array.isArray(layers) &&
        layers.some((l: any) => typeof l === "function")
      }
    >
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

// Radix popovers/tooltips (FilterBar) need browser APIs jsdom lacks.
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
  makeMemorySessionsFixture,
  makeMemorySessionsPage2Fixture,
  makeMemoryUsagePlotFixture,
  makeMemoryUsagePlotWithThresholdFixture,
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
import MemoryMonitoring from "@/app/components/memory_monitoring";
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

describe("Memory Monitoring (MSW integration)", () => {
  function renderPage() {
    return renderWithProviders(
      <MemoryMonitoring params={{ teamId: "test-team" }} />,
    );
  }

  async function waitForContent() {
    await waitFor(
      () => expect(screen.getByText("Session ID: mem-sess-001")).toBeTruthy(),
      { timeout: 5000 },
    );
  }

  describe("opening the page", () => {
    it("draws the trend and the ranked sessions the server sent", async () => {
      renderPage();
      await waitForContent();

      expect(screen.getByText("Dynamic Memory Usage Trend")).toBeTruthy();
      expect(screen.getByText("Highest Memory Sessions")).toBeTruthy();
      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
      expect(screen.getByTestId("chart-series-foreground")).toBeTruthy();
      expect(screen.getByTestId("chart-series-background")).toBeTruthy();
      expect(screen.getByText("Foreground")).toBeTruthy();
      expect(screen.getByText("Background")).toBeTruthy();
      expect(screen.getByText("Session ID: mem-sess-002")).toBeTruthy();
      expect(screen.getByText("256 MB")).toBeTruthy();
      expect(screen.getByText("8 GB")).toBeTruthy();
    });

    it("asks for the trend over the range it settled on, with no process-state param", async () => {
      const sent = record("memory/plots/usage", () =>
        makeMemoryUsagePlotFixture(),
      );
      renderPage();
      await waitForContent();

      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(`/api/apps/${appId}/memory/plots/usage`);
      expect(sent[0].searchParams.get("os")).toBe("android");
      expect(sent[0].searchParams.get("from")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("to")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("timezone")).toBeTruthy();
      expect(sent[0].searchParams.get("plot_time_group")).toBeTruthy();
      expect(sent[0].searchParams.has("scope")).toBe(false);
      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
    });

    it("asks for the ranking with the first page's limit and offset", async () => {
      const sent = record("memory/sessions", () => makeMemorySessionsFixture());
      renderPage();
      await waitForContent();

      expect(sent[0].searchParams.get("os")).toBe("android");
      expect(sent[0].searchParams.get("limit")).toBe("5");
      expect(sent[0].searchParams.get("offset")).toBe("0");
    });

    it("shows no threshold line when the backend sends none", async () => {
      renderPage();
      await waitForContent();

      expect(
        screen
          .getByTestId("nivo-line-chart")
          .getAttribute("data-has-threshold"),
      ).toBe("false");
    });
  });

  describe("the Play threshold", () => {
    it("draws it when the backend sends one", async () => {
      server.use(
        http.get("*/api/apps/:appId/memory/plots/usage", () =>
          HttpResponse.json(makeMemoryUsagePlotWithThresholdFixture()),
        ),
      );
      renderPage();
      await waitForContent();

      await waitFor(() =>
        expect(
          screen
            .getByTestId("nivo-line-chart")
            .getAttribute("data-has-threshold"),
        ).toBe("true"),
      );
    });
  });

  describe("a link carrying a filter", () => {
    it("filters both the trend and the ranking by it", async () => {
      mockRouter.setUrl(
        `filter_expr=${encodeURIComponent("session_ram_tier:in:8gb")}`,
      );
      const plot = record("memory/plots/usage", () =>
        makeMemoryUsagePlotFixture(),
      );
      const sessions = record("memory/sessions", () =>
        makeMemorySessionsFixture(),
      );
      renderPage();
      await waitForContent();

      for (const sent of [plot, sessions]) {
        expect(sent[0].searchParams.get("filter_expr")).toBe(
          "session_ram_tier:in:8gb",
        );
      }
      expect(lastWrittenUrl().get("filter_expr")).toBe(
        "session_ram_tier:in:8gb",
      );
    });
  });

  describe("the platform toggle", () => {
    it("is hidden for a single-platform app, and android is sent", async () => {
      renderPage();
      await waitForContent();

      expect(screen.queryByText("iOS")).toBeNull();
    });
  });

  describe("pagination", () => {
    it("clicking Next renders page 2, Previous returns to page 1", async () => {
      server.use(
        http.get("*/api/apps/:appId/memory/sessions", ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get("offset") === "5") {
            return HttpResponse.json(makeMemorySessionsPage2Fixture());
          }
          return HttpResponse.json(makeMemorySessionsFixture());
        }),
      );
      renderPage();
      await waitForContent();

      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });
      await waitFor(() =>
        expect(screen.getByText("Session ID: mem-sess-006")).toBeTruthy(),
      );
      expect(screen.queryByText("Session ID: mem-sess-001")).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByText("Previous").closest("button")!);
      });
      await waitForContent();
      expect(screen.queryByText("Session ID: mem-sess-006")).toBeNull();
    });
  });

  describe("when the server fails", () => {
    it("says so for the trend", async () => {
      server.use(
        http.get("*/api/apps/:appId/memory/plots/usage", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(
        await screen.findByText(/Error fetching memory usage/),
      ).toBeTruthy();
    });

    it("says so for the ranking", async () => {
      server.use(
        http.get("*/api/apps/:appId/memory/sessions", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(await screen.findByText(/Error fetching sessions/)).toBeTruthy();
    });
  });

  describe("when the server answers with nothing", () => {
    it("says there is no data for the trend and the ranking", async () => {
      server.use(
        http.get("*/api/apps/:appId/memory/plots/usage", () =>
          HttpResponse.json({ results: [] }),
        ),
        http.get("*/api/apps/:appId/memory/sessions", () =>
          HttpResponse.json({
            results: [],
            meta: { next: false, previous: false },
          }),
        ),
      );
      renderPage();

      expect(await screen.findByText("No Data")).toBeTruthy();
      expect(
        screen.getByText("No data available for the selected filters"),
      ).toBeTruthy();
    });
  });
});
