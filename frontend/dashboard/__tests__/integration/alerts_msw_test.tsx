/**
 * Integration tests for Alerts Overview page.
 *
 * The alerts page is a list-only page (no detail page, no plot) with
 * minimal filters (app selector + date range only). Each alert row
 * links to an external URL (crash/ANR detail page) via the `url` field
 * from the API.
 *
 * Tests cover the page/API wiring: error propagation, the real Filters
 * configuration, pagination round-trips and deep-links, URL
 * serialisation, and the request URL parameters sent to the alerts API.
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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  usePathname: () => "/test-team/alerts",
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

// --- MSW ---
import { makeAlertsOverviewFixture, makeAppFixture } from "../msw/fixtures";
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
import AlertsOverview from "@/app/[teamId]/alerts/page";
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
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>,
  );
}

// ====================================================================
// ALERTS OVERVIEW
// ====================================================================
describe("Alerts Overview (MSW integration)", () => {
  async function renderAndWaitForData() {
    renderWithProviders(
      <AlertsOverview params={promiseParams({ teamId: "test-team" })} />,
    );
    await waitFor(
      () => {
        expect(
          screen.getByText(
            "Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity",
          ),
        ).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // PAGE LOAD
  // ================================================================
  describe("page load", () => {
    it("shows error when API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/alerts", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderWithProviders(
        <AlertsOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(
            screen.getByText(/Error fetching list of alerts/),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("only shows app selector and date range filters", async () => {
      await renderAndWaitForData();
      // App selector and date range are shown
      expect(screen.getByText("measure demo")).toBeTruthy();
      expect(screen.getByText("Last 6 Hours")).toBeTruthy();
      // Other filters should NOT be present
      expect(screen.queryByText("App versions")).toBeNull();
      expect(screen.queryByText("OS versions")).toBeNull();
      expect(screen.queryByText("Countries")).toBeNull();
    });
  });

  // ================================================================
  // PAGINATION
  // ================================================================
  describe("pagination", () => {
    it("clicking Next renders page 2 data, Previous returns to page 1", async () => {
      const page2Fixture = makeAlertsOverviewFixture({
        meta: { next: false, previous: true },
        results: [
          {
            id: "alert-page2",
            team_id: "a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6",
            app_id: "b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f",
            entity_id: "crash-group-page2",
            type: "crash_spike",
            message: "Page 2 alert: OutOfMemoryError spike",
            url: "/test-team/errors/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/crash-group-page2",
            created_at: "2026-04-08T12:00:00Z",
            updated_at: "2026-04-08T12:00:00Z",
          },
        ],
      });

      server.use(
        http.get("*/api/apps/:appId/alerts", ({ request }) => {
          const url = new URL(request.url);
          const offset = url.searchParams.get("offset");
          if (offset === "5") return HttpResponse.json(page2Fixture);
          return HttpResponse.json(makeAlertsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      expect(
        screen.getByText(
          "Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity",
        ),
      ).toBeTruthy();

      // Navigate to page 2
      const nextBtn = screen.getByText("Next").closest("button")!;
      await act(async () => {
        fireEvent.click(nextBtn);
      });
      await waitFor(
        () => {
          expect(
            screen.getByText("Page 2 alert: OutOfMemoryError spike"),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(
        screen.queryByText(
          "Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity",
        ),
      ).toBeNull();

      // Navigate back to page 1
      const prevBtn = screen.getByText("Previous").closest("button")!;
      await act(async () => {
        fireEvent.click(prevBtn);
      });
      await waitFor(
        () => {
          expect(
            screen.getByText(
              "Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity",
            ),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(
        screen.queryByText("Page 2 alert: OutOfMemoryError spike"),
      ).toBeNull();

      // URL reflects page 1
      const url =
        mockRouterReplace.mock.calls[
          mockRouterReplace.mock.calls.length - 1
        ][0];
      expect(url).toContain("po=0");
    });

    it("deep-link with po=5 renders page 2 data", async () => {
      const page2Fixture = makeAlertsOverviewFixture({
        meta: { next: false, previous: true },
        results: [
          {
            id: "alert-page2",
            team_id: "a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6",
            app_id: "b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f",
            entity_id: "crash-group-page2",
            type: "crash_spike",
            message: "Deep-linked page 2 alert",
            url: "/test-team/errors/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/crash-group-page2",
            created_at: "2026-04-08T12:00:00Z",
            updated_at: "2026-04-08T12:00:00Z",
          },
        ],
      });

      server.use(
        http.get("*/api/apps/:appId/alerts", ({ request }) => {
          const url = new URL(request.url);
          const offset = url.searchParams.get("offset");
          if (offset === "5") return HttpResponse.json(page2Fixture);
          return HttpResponse.json(makeAlertsOverviewFixture());
        }),
      );

      mockSearchParams.set("po", "5");
      renderWithProviders(
        <AlertsOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Deep-linked page 2 alert")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      expect(
        screen.queryByText(
          "Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity",
        ),
      ).toBeNull();
    });
  });

  // ================================================================
  // URL SYNC
  // ================================================================
  describe("URL sync", () => {
    it("serialises app and date filters into URL", async () => {
      await renderAndWaitForData();
      expect(mockRouterReplace).toHaveBeenCalled();
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
        http.get("*/api/apps/:appId/alerts", ({ request }) => {
          requestUrls.push(new URL(request.url).toString());
          return HttpResponse.json(makeAlertsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      const lastUrl = requestUrls[requestUrls.length - 1];
      expect(lastUrl).toContain("limit=5");
      expect(lastUrl).toContain("offset=0");
    });

    it("sends from and to date params", async () => {
      const requestUrls: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/alerts", ({ request }) => {
          requestUrls.push(new URL(request.url).toString());
          return HttpResponse.json(makeAlertsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      const lastUrl = requestUrls[requestUrls.length - 1];
      expect(lastUrl).toContain("from=");
      expect(lastUrl).toContain("to=");
      expect(lastUrl).toContain("timezone=");
    });

    it("request URL contains correct app ID from filters", async () => {
      const requestPaths: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/alerts", ({ request }) => {
          requestPaths.push(new URL(request.url).pathname);
          return HttpResponse.json(makeAlertsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      expect(requestPaths[requestPaths.length - 1]).toContain(
        `/apps/${makeAppFixture().id}/alerts`,
      );
    });

    it("offset updates in request URL after nextPage", async () => {
      const requestUrls: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/alerts", ({ request }) => {
          requestUrls.push(new URL(request.url).toString());
          return HttpResponse.json(makeAlertsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      requestUrls.length = 0;

      const nextBtn = screen.getByText("Next").closest("button")!;
      await act(async () => {
        fireEvent.click(nextBtn);
      });
      await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(requestUrls[requestUrls.length - 1]).toContain("offset=5");
    });
  });

  // ================================================================
  // API PATH VERIFICATION
  // ================================================================
  describe("API paths", () => {
    it("fetches from /alerts path", async () => {
      const requestPaths: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/alerts", ({ request }) => {
          requestPaths.push(new URL(request.url).pathname);
          return HttpResponse.json(makeAlertsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      expect(requestPaths.some((p) => p.includes("/alerts"))).toBe(true);
    });
  });
});
