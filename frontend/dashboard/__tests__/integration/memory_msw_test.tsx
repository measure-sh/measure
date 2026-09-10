/**
 * Integration tests for the wiring between the Memory Monitoring page and
 * the server: request paths and parameters, the per-process-state summary
 * cards, Play threshold plumbing, pagination, and filter propagation
 * through the shared sessions FilterBar.
 *
 * Unique to memory:
 *   - the sessions filter entity, reused rather than a bespoke one
 *   - no time bucketing and no process-state scope param — the summary
 *     endpoint returns every state's distribution in one response, and the
 *     page renders one card per state rather than requiring one to be
 *     picked first
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

// Radix popovers/tooltips (FilterBar, the card status-icon tooltip) need
// browser APIs jsdom lacks.
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
  makeMemoryUsageSummaryFixture,
  makeMemoryUsageSummaryWithThresholdFixture,
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
    it("draws the summary cards and the ranked sessions the server sent", async () => {
      renderPage();
      await waitForContent();

      expect(screen.getByText("Dynamic Memory Usage")).toBeTruthy();
      expect(screen.getByText("Highest Memory Sessions")).toBeTruthy();
      expect(screen.getAllByTestId("memory-summary-card")).toHaveLength(2);
      expect(screen.getByText("Foreground")).toBeTruthy();
      expect(screen.getByText("Background")).toBeTruthy();
      expect(screen.getByText("12 sessions")).toBeTruthy();
      expect(screen.getByText("9 sessions")).toBeTruthy();
      expect(screen.getByText("Session ID: mem-sess-002")).toBeTruthy();
      expect(screen.getByText("256 MB")).toBeTruthy();
      expect(screen.getByText("8 GB")).toBeTruthy();
    });

    it("asks for the summary over the range it settled on, with no bucketing or scope params", async () => {
      const sent = record("memory/summary", () =>
        makeMemoryUsageSummaryFixture(),
      );
      renderPage();
      await waitForContent();

      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(`/api/apps/${appId}/memory/summary`);
      expect(sent[0].searchParams.get("os")).toBe("android");
      expect(sent[0].searchParams.get("from")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("to")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("timezone")).toBeTruthy();
      expect(sent[0].searchParams.has("plot_time_group")).toBe(false);
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

    it("shows no status badge on any card when the backend sends no thresholds", async () => {
      renderPage();
      await waitForContent();

      expect(screen.queryByTestId("memory-summary-status-icon")).toBeNull();
    });
  });

  describe("the Play threshold", () => {
    it("draws a status badge per card with a resolved threshold", async () => {
      server.use(
        http.get("*/api/apps/:appId/memory/summary", () =>
          HttpResponse.json(makeMemoryUsageSummaryWithThresholdFixture()),
        ),
      );
      renderPage();
      await waitForContent();

      const badges = await screen.findAllByTestId("memory-summary-status-icon");
      expect(badges).toHaveLength(2);
      expect(
        screen.getByText(/Play threshold \(8 GB, Foreground\)/),
      ).toBeTruthy();
      expect(
        screen.getByText(/Play threshold \(8 GB, Background\)/),
      ).toBeTruthy();
    });
  });

  describe("a link carrying a filter", () => {
    it("filters both the summary and the ranking by it", async () => {
      mockRouter.setUrl(
        `filter_expr=${encodeURIComponent("session_ram_tier:in:8gb")}`,
      );
      const summary = record("memory/summary", () =>
        makeMemoryUsageSummaryFixture(),
      );
      const sessions = record("memory/sessions", () =>
        makeMemorySessionsFixture(),
      );
      renderPage();
      await waitForContent();

      for (const sent of [summary, sessions]) {
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
    it("says so for the summary", async () => {
      server.use(
        http.get("*/api/apps/:appId/memory/summary", () => {
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
    it("says there is no data for the summary and the ranking", async () => {
      server.use(
        http.get("*/api/apps/:appId/memory/summary", () =>
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
