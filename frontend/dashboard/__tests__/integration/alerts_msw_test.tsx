/**
 * Wiring between the Alerts page and the server: request parameters, the
 * app and date controls, pagination and error responses. Row rendering is
 * covered by the unit tests.
 */
import { mockRouter } from "@/__tests__/helpers/mock_router";
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

const mockRouterPush = mockRouter.pushMock;

jest.mock("next/navigation", () => ({
  ...require("@/__tests__/helpers/mock_router").nextNavigationMock(),
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

// Radix popovers need a resize observer and pointer capture jsdom lacks.
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
import { makeAlertsOverviewFixture, makeAppFixture } from "../msw/fixtures";
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
import AlertsOverview from "@/app/[teamId]/alerts/page";
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
const secondApp = makeAppFixture({
  id: "c6a4f9b2-7d3e-4a0b-9f8c-2b3c4d5e6f70",
  name: "measure spare",
});

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

describe("Alerts Overview (MSW integration)", () => {
  const firstAlert =
    "Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity";

  function renderPage() {
    return renderWithProviders(
      <AlertsOverview params={promiseParams({ teamId: "test-team" })} />,
    );
  }

  function recordAlertsRequests(page2?: any) {
    const sent: URL[] = [];
    server.use(
      http.get("*/api/apps/:appId/alerts", ({ request }) => {
        const url = new URL(request.url);
        sent.push(url);
        if (page2 && url.searchParams.get("offset") === "5") {
          return HttpResponse.json(page2);
        }
        return HttpResponse.json(makeAlertsOverviewFixture());
      }),
    );
    return sent;
  }

  async function waitForAlerts() {
    await waitFor(() => expect(screen.getByText(firstAlert)).toBeTruthy(), {
      timeout: 5000,
    });
  }

  describe("opening the page", () => {
    it("lists the alerts the server sent", async () => {
      renderPage();
      await waitForAlerts();

      expect(screen.getByText("ID: alert-001")).toBeTruthy();
    });

    it("asks for the app's alerts over the range it settled on", async () => {
      const sent = recordAlertsRequests();
      renderPage();
      await waitForAlerts();

      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(`/api/apps/${appId}/alerts`);
      expect(sent[0].searchParams.get("from")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("to")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("timezone")).toBeTruthy();
      expect(sent[0].searchParams.get("limit")).toBe("5");
      expect(sent[0].searchParams.get("offset")).toBe("0");
      expect(sent[0].searchParams.has("filter_short_code")).toBe(false);
      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
    });

    it("offers the app and the date range, and nothing else to filter by", async () => {
      renderPage();
      await waitForAlerts();

      expect(screen.getByText("measure demo")).toBeTruthy();
      expect(screen.getByText("Last 6 Hours")).toBeTruthy();
      expect(screen.queryByTestId("filter-bar")).toBeNull();
      expect(screen.queryByText("App versions")).toBeNull();
      expect(screen.queryByText("OS versions")).toBeNull();
      expect(screen.queryByText("Countries")).toBeNull();
    });

    it("records the app and range it settled on in the URL", async () => {
      renderPage();
      await waitForAlerts();

      const written = new URLSearchParams(window.location.search);
      expect(written.get("a")).toBe(appId);
      expect(written.get("d")).toBe("Last 6 Hours");
      expect(written.get("sd")).toBeNull();
      expect(written.get("ed")).toBeNull();
    });
  });

  describe("pagination", () => {
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

    it("clicking Next renders page 2 data, Previous returns to page 1", async () => {
      recordAlertsRequests(page2Fixture);
      renderPage();
      await waitForAlerts();

      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });
      await waitFor(
        () =>
          expect(
            screen.getByText("Page 2 alert: OutOfMemoryError spike"),
          ).toBeTruthy(),
        { timeout: 5000 },
      );
      expect(screen.queryByText(firstAlert)).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByText("Previous").closest("button")!);
      });
      await waitForAlerts();
      expect(
        screen.queryByText("Page 2 alert: OutOfMemoryError spike"),
      ).toBeNull();
      expect(window.location.search).toContain("po=0");
    });

    it("deep-link with po=5 renders page 2 data", async () => {
      recordAlertsRequests(page2Fixture);
      mockRouter.setUrl("po=5");
      renderPage();

      await waitFor(
        () =>
          expect(
            screen.getByText("Page 2 alert: OutOfMemoryError spike"),
          ).toBeTruthy(),
        { timeout: 8000 },
      );
      expect(screen.queryByText(firstAlert)).toBeNull();
    });

    it("goes back to the first page when another app is picked", async () => {
      server.use(
        http.get("*/api/teams/:teamId/apps", () =>
          HttpResponse.json([makeAppFixture(), secondApp]),
        ),
      );
      const sent = recordAlertsRequests(page2Fixture);
      mockRouter.setUrl("po=5");
      renderPage();
      await waitFor(
        () =>
          expect(
            screen.getByText("Page 2 alert: OutOfMemoryError spike"),
          ).toBeTruthy(),
        { timeout: 8000 },
      );

      await act(async () => {
        fireEvent.click(screen.getByText("measure demo").closest("button")!);
      });
      await act(async () => {
        fireEvent.click(await screen.findByText(secondApp.name));
      });

      await waitFor(
        () =>
          expect(sent[sent.length - 1].pathname).toBe(
            `/api/apps/${secondApp.id}/alerts`,
          ),
        { timeout: 5000 },
      );
      expect(sent[sent.length - 1].searchParams.get("offset")).toBe("0");
      expect(new URLSearchParams(window.location.search).get("po")).toBe("0");
    });
  });

  describe("when the server fails", () => {
    it("shows error when the alerts API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/alerts", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderPage();
      expect(
        await screen.findByText(/Error fetching list of alerts/),
      ).toBeTruthy();
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
});
