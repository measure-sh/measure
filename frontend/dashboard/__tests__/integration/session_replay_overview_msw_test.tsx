/**
 * Integration tests for the wiring between the Session Replay overview page
 * and the server: request paths and parameters, the filter expression carried
 * by the URL, pagination round-trips, and error responses. Rendering details
 * of the rows are covered by the unit tests in
 * __tests__/pages/session_replay_overview_test.tsx. The detail page a session
 * opens into has its own suite.
 *
 * Unique to sessions:
 *   - the sessions filter entity (events, lifecycle, version_name, ...)
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
  within,
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
  usePathname: () => "/test-team/session_replays",
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

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
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

// The filter pickers are Radix popovers, which need a resize observer and
// pointer capture that jsdom does not have.
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
  makeSessionPlotFixture,
  makeSessionReplayOverviewFixture,
  makeSessionReplayOverviewPage2Fixture,
  makeSessionsFilterKeysFixture,
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
import SessionReplayOverview from "@/app/[teamId]/session_replays/page";
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

describe("Session Replay Overview (MSW integration)", () => {
  function renderPage() {
    return renderWithProviders(
      <SessionReplayOverview params={promiseParams({ teamId: "test-team" })} />,
    );
  }

  // The list endpoint shares its path prefix with /sessions/:sessionId and
  // /sessions/plots/*, so anything deeper than four segments is left to the
  // default handlers.
  function recordSessionsRequests() {
    const sent: URL[] = [];
    server.use(
      http.get("*/api/apps/:appId/sessions", ({ request }) => {
        const url = new URL(request.url);
        const pathParts = url.pathname.split("/").filter(Boolean);
        if (pathParts.length > 4) {
          return;
        }
        sent.push(url);
        return HttpResponse.json(makeSessionReplayOverviewFixture());
      }),
    );
    return sent;
  }

  async function waitForSessions() {
    await waitFor(
      () => expect(screen.getByText("Session ID: sess-001")).toBeTruthy(),
      { timeout: 5000 },
    );
  }

  describe("opening the page", () => {
    it("lists the sessions the server sent under the plot", async () => {
      renderPage();
      await waitForSessions();

      expect(screen.getByText("Session ID: sess-002")).toBeTruthy();
      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
    });

    it("asks for the app's sessions over the range it settled on", async () => {
      const sent = recordSessionsRequests();
      renderPage();
      await waitForSessions();

      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(`/api/apps/${appId}/sessions`);
      expect(sent[0].searchParams.get("from")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("to")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("timezone")).toBeTruthy();
      expect(sent[0].searchParams.get("limit")).toBe("5");
      expect(sent[0].searchParams.get("offset")).toBe("0");
      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
      expect(sent[0].searchParams.has("free_text")).toBe(false);
      expect(sent[0].searchParams.has("type")).toBe(false);
    });

    it("sends the time group in the plot request", async () => {
      const plotUrls: URL[] = [];
      server.use(
        http.get(
          "*/api/apps/:appId/sessions/plots/instances",
          ({ request }) => {
            plotUrls.push(new URL(request.url));
            return HttpResponse.json(makeSessionPlotFixture());
          },
        ),
      );
      renderPage();
      await waitForSessions();

      await waitFor(() => expect(plotUrls.length).toBeGreaterThan(0));
      expect(plotUrls[0].pathname).toBe(
        `/api/apps/${appId}/sessions/plots/instances`,
      );
      expect(plotUrls[0].searchParams.get("plot_time_group")).toBeTruthy();
      expect(plotUrls[0].searchParams.has("filter_expr")).toBe(false);
    });

    it("records the app and range it settled on in the URL", async () => {
      renderPage();
      await waitForSessions();

      const written = new URLSearchParams(window.location.search);
      expect(written.get("a")).toBe(appId);
      expect(written.get("d")).toBe("Last 6 Hours");
      expect(written.get("sd")).toBeNull();
      expect(written.get("ed")).toBeNull();
      expect(written.get("po")).toBeNull();
    });

    it("offers the keys the entity has, in the groups the server named", async () => {
      const keysUrls: URL[] = [];
      server.use(
        http.get("*/api/apps/:appId/filters/keys", ({ request }) => {
          keysUrls.push(new URL(request.url));
          return HttpResponse.json(makeSessionsFilterKeysFixture());
        }),
      );
      renderPage();
      await waitForSessions();

      fireEvent.click(screen.getByTestId("filter-input"));

      // The list opens on the first group's keys, with the other groups as
      // tabs; a search reaches keys in every group.
      const list = within(await screen.findByRole("dialog"));
      expect(list.getByText("Events")).toBeTruthy();
      expect(list.getByText("Session")).toBeTruthy();
      expect(list.getByText("Version")).toBeTruthy();
      fireEvent.change(list.getByTestId("filter-key-search"), {
        target: { value: "App version" },
      });
      expect(await screen.findByTestId("filter-key-version_name")).toBeTruthy();
      expect(keysUrls[0].searchParams.get("entity")).toBe("sessions");
    });
  });

  describe("a link carrying a filter", () => {
    it("filters the sessions and the plot by it", async () => {
      mockRouter.setUrl(
        `po=0&filter_expr=${encodeURIComponent("session_events:in:fatal_error")}`,
      );
      const sent = recordSessionsRequests();
      const plotUrls: URL[] = [];
      server.use(
        http.get(
          "*/api/apps/:appId/sessions/plots/instances",
          ({ request }) => {
            plotUrls.push(new URL(request.url));
            return HttpResponse.json(makeSessionPlotFixture());
          },
        ),
      );
      renderPage();
      await waitForSessions();

      expect(sent[0].searchParams.get("filter_expr")).toBe(
        "session_events:in:fatal_error",
      );
      await waitFor(() => expect(plotUrls.length).toBeGreaterThan(0));
      expect(plotUrls[0].searchParams.get("filter_expr")).toBe(
        "session_events:in:fatal_error",
      );
    });

    it("draws the lifecycle key as a condition a person can edit", async () => {
      mockRouter.setUrl(
        `po=0&filter_expr=${encodeURIComponent("session_foreground_background:in:foreground")}`,
      );
      const sent = recordSessionsRequests();
      renderPage();
      await waitForSessions();

      expect(sent[0].searchParams.get("filter_expr")).toBe(
        "session_foreground_background:in:foreground",
      );
      const bar = within(screen.getByTestId("filter-bar"));
      expect(await screen.findByText("Foreground/Background")).toBeTruthy();
      expect(bar.getByText("is")).toBeTruthy();
      expect(bar.getByText("foreground")).toBeTruthy();
    });

    it("draws it as a condition a person can edit", async () => {
      mockRouter.setUrl(
        `po=0&filter_expr=${encodeURIComponent("session_events:in:fatal_error")}`,
      );
      renderPage();
      await waitForSessions();

      const bar = within(screen.getByTestId("filter-bar"));
      expect(await screen.findByText("Events")).toBeTruthy();
      expect(bar.getByText("is")).toBeTruthy();
      expect(bar.getByText("fatal_error")).toBeTruthy();
    });

    it("draws a text-only key as a condition a person can edit", async () => {
      mockRouter.setUrl(
        `po=0&filter_expr=${encodeURIComponent("session_log:contains:timeout")}`,
      );
      const sent = recordSessionsRequests();
      renderPage();
      await waitForSessions();

      expect(sent[0].searchParams.get("filter_expr")).toBe(
        "session_log:contains:timeout",
      );
      const bar = within(screen.getByTestId("filter-bar"));
      expect(await screen.findByText("Log")).toBeTruthy();
      expect(bar.getByText("contains")).toBeTruthy();
      expect(bar.getByText("timeout")).toBeTruthy();
    });

    it("filters by nothing when it cannot be read", async () => {
      mockRouter.setUrl(
        `po=0&filter_expr=${encodeURIComponent("session_events:in:")}`,
      );
      const sent = recordSessionsRequests();
      renderPage();
      await waitForSessions();

      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
    });
  });

  describe("filtering by a value", () => {
    it("lists the event kinds the server names, then filters by the one picked", async () => {
      const values: URL[] = [];
      server.use(
        http.get("*/api/apps/:appId/filters/values", ({ request }) => {
          values.push(new URL(request.url));
          return HttpResponse.json({
            values: [{ text: "fatal_error" }, { text: "anr" }],
            truncated: false,
          });
        }),
      );
      const sent = recordSessionsRequests();
      renderPage();
      await waitForSessions();

      fireEvent.click(screen.getByTestId("filter-input"));
      fireEvent.change(await screen.findByTestId("filter-key-search"), {
        target: { value: "Events" },
      });
      fireEvent.click(await screen.findByTestId("filter-key-session_events"));
      fireEvent.click(await screen.findByTestId("filter-value-anr"));

      await waitFor(() => expect(sent).toHaveLength(2));
      expect(values[0].searchParams.get("entity")).toBe("sessions");
      expect(values[0].searchParams.get("key_name")).toBe("session_events");
      expect(sent[1].searchParams.get("filter_expr")).toBe(
        "session_events:in:anr",
      );
    });

    it("lists the lifecycle values the server names, then filters by the one picked", async () => {
      server.use(
        http.get("*/api/apps/:appId/filters/values", () => {
          return HttpResponse.json({
            values: [{ text: "foreground" }, { text: "background" }],
            truncated: false,
          });
        }),
      );
      const sent = recordSessionsRequests();
      renderPage();
      await waitForSessions();

      fireEvent.click(screen.getByTestId("filter-input"));
      fireEvent.change(await screen.findByTestId("filter-key-search"), {
        target: { value: "Foreground/Background" },
      });
      fireEvent.click(
        await screen.findByTestId("filter-key-session_foreground_background"),
      );
      fireEvent.click(await screen.findByTestId("filter-value-background"));

      await waitFor(() => expect(sent).toHaveLength(2));
      expect(sent[1].searchParams.get("filter_expr")).toBe(
        "session_foreground_background:in:background",
      );
    });

    it("asks the server for a sampled key's values, then filters by the one picked", async () => {
      const values: URL[] = [];
      server.use(
        http.get("*/api/apps/:appId/filters/values", ({ request }) => {
          values.push(new URL(request.url));
          return HttpResponse.json({
            values: [{ text: "user-123" }, { text: "user-456" }],
            truncated: false,
          });
        }),
      );
      const sent = recordSessionsRequests();
      renderPage();
      await waitForSessions();

      fireEvent.click(screen.getByTestId("filter-input"));
      fireEvent.change(await screen.findByTestId("filter-key-search"), {
        target: { value: "User ID" },
      });
      fireEvent.click(await screen.findByTestId("filter-key-user_id"));
      fireEvent.click(await screen.findByTestId("filter-value-user-123"));

      await waitFor(() => expect(sent).toHaveLength(2));
      expect(values[0].searchParams.get("entity")).toBe("sessions");
      expect(values[0].searchParams.get("key_name")).toBe("user_id");
      expect(sent[1].searchParams.get("filter_expr")).toBe(
        "user_id:in:user-123",
      );
    });
  });

  describe("pagination", () => {
    it("clicking Next renders page 2 data, Previous returns to page 1", async () => {
      server.use(
        http.get("*/api/apps/:appId/sessions", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) {
            return;
          }
          if (url.searchParams.get("offset") === "5") {
            return HttpResponse.json(makeSessionReplayOverviewPage2Fixture());
          }
          return HttpResponse.json(makeSessionReplayOverviewFixture());
        }),
      );

      renderPage();
      await waitForSessions();

      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });
      await waitFor(
        () => {
          expect(screen.getByText("Session ID: sess-006")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(screen.queryByText("Session ID: sess-001")).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByText("Previous").closest("button")!);
      });
      await waitForSessions();
      expect(screen.queryByText("Session ID: sess-006")).toBeNull();

      expect(window.location.search).toContain("po=0");
    });

    it("deep-link with po=5 renders page 2 data", async () => {
      server.use(
        http.get("*/api/apps/:appId/sessions", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) {
            return;
          }
          if (url.searchParams.get("offset") === "5") {
            return HttpResponse.json(makeSessionReplayOverviewPage2Fixture());
          }
          return HttpResponse.json(makeSessionReplayOverviewFixture());
        }),
      );

      mockRouter.setUrl("po=5");
      renderPage();
      await waitFor(
        () => {
          expect(screen.getByText("Session ID: sess-006")).toBeTruthy();
        },
        { timeout: 8000 },
      );

      expect(screen.queryByText("Session ID: sess-001")).toBeNull();
    });
  });

  describe("when the server fails", () => {
    it("shows error when the sessions API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/sessions", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) {
            return;
          }
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderPage();
      expect(
        await screen.findByText(/Error fetching list of sessions/),
      ).toBeTruthy();
    });

    it("shows plot error when the plot API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/sessions/plots/instances", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderPage();
      expect(await screen.findByText(/Error fetching plot/)).toBeTruthy();
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

  describe("re-render", () => {
    it("re-render still shows data", async () => {
      const { unmount } = renderPage();
      await waitForSessions();

      unmount();
      renderPage();
      await waitForSessions();
    });
  });
});
