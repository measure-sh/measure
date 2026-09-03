/**
 * Integration tests for the wiring between the Bug Reports pages and the
 * server: request paths and parameters, the filter expression carried by
 * the URL, pagination round-trips, the status toggle PATCH, and error
 * responses. Rendering details of the overview rows and the detail surface
 * are covered by the unit tests in
 * __tests__/pages/bug_reports_overview_test.tsx and
 * __tests__/components/bug_report_test.tsx.
 *
 * Unique to bug reports:
 *   - the bug_reports filter entity (bug_report_status, user_id, ...)
 *   - PATCH endpoint for status toggle
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

const mockRouterReplace = mockRouter.replaceMock;
const mockRouterPush = mockRouter.pushMock;

jest.mock("next/navigation", () => ({
  ...require("@/__tests__/helpers/mock_router").nextNavigationMock(),
  usePathname: () => "/test-team/bug_reports",
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
  makeBugReportDetailFixture,
  makeBugReportsFilterKeysFixture,
  makeBugReportsOverviewFixture,
  makeBugReportsPlotFixture,
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
import BugReportsOverview from "@/app/[teamId]/bug_reports/page";
import BugReport from "@/app/components/bug_report";
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
  mockRouter.searchParams = new URLSearchParams();
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// ====================================================================
// BUG REPORTS OVERVIEW
// ====================================================================
describe("Bug Reports Overview (MSW integration)", () => {
  function renderPage() {
    return renderWithProviders(
      <BugReportsOverview params={promiseParams({ teamId: "test-team" })} />,
    );
  }

  function recordBugReportsRequests() {
    const sent: URL[] = [];
    server.use(
      http.get("*/api/apps/:appId/bugReports", ({ request }) => {
        const url = new URL(request.url);
        // Only match the list endpoint, not /bugReports/:id or
        // /bugReports/plots/*.
        const pathParts = url.pathname.split("/").filter(Boolean);
        if (pathParts.length > 4) {
          return;
        }
        sent.push(url);
        return HttpResponse.json(makeBugReportsOverviewFixture());
      }),
    );
    return sent;
  }

  async function waitForBugReports() {
    await waitFor(
      () =>
        expect(
          screen.getByText("App crashes when tapping checkout button"),
        ).toBeTruthy(),
      { timeout: 5000 },
    );
  }

  describe("opening the page", () => {
    it("lists the bug reports the server sent under the plot", async () => {
      renderPage();
      await waitForBugReports();

      expect(screen.getByText("ID: evt-br-001")).toBeTruthy();
      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
    });

    it("asks for the app's bug reports over the range it settled on", async () => {
      const sent = recordBugReportsRequests();
      renderPage();
      await waitForBugReports();

      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(`/api/apps/${appId}/bugReports`);
      const from = sent[0].searchParams.get("from")!;
      const to = sent[0].searchParams.get("to")!;
      expect(from).toMatch(/Z$/);
      expect(to).toMatch(/Z$/);
      expect(sent[0].searchParams.get("timezone")).toBeTruthy();
      expect(sent[0].searchParams.get("limit")).toBe("5");
      expect(sent[0].searchParams.get("offset")).toBe("0");
      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
      expect(sent[0].searchParams.has("filter_short_code")).toBe(false);
      expect(sent[0].searchParams.has("bug_report_statuses")).toBe(false);
      expect(sent[0].searchParams.has("free_text")).toBe(false);
    });

    it("sends the time group in the plot request", async () => {
      const plotUrls: URL[] = [];
      server.use(
        http.get(
          "*/api/apps/:appId/bugReports/plots/instances",
          ({ request }) => {
            plotUrls.push(new URL(request.url));
            return HttpResponse.json(makeBugReportsPlotFixture());
          },
        ),
      );
      renderPage();
      await waitForBugReports();

      await waitFor(() => expect(plotUrls.length).toBeGreaterThan(0));
      expect(plotUrls[0].pathname).toBe(
        `/api/apps/${appId}/bugReports/plots/instances`,
      );
      expect(plotUrls[0].searchParams.get("plot_time_group")).toBeTruthy();
      expect(plotUrls[0].searchParams.has("filter_expr")).toBe(false);
    });

    it("records the app and range it settled on in the URL", async () => {
      renderPage();
      await waitForBugReports();

      const written = new URLSearchParams(
        mockRouterReplace.mock.calls[0][0].slice(1),
      );
      expect(written.get("a")).toBe(appId);
      expect(written.get("d")).toBe("Last 6 Hours");
      expect(written.get("sd")).toBeNull();
      expect(written.get("ed")).toBeNull();
      expect(written.get("po")).toBe("0");
    });

    it("offers the keys the entity has, in the groups the server named", async () => {
      const keysUrls: URL[] = [];
      server.use(
        http.get("*/api/apps/:appId/filters/keys", ({ request }) => {
          keysUrls.push(new URL(request.url));
          return HttpResponse.json(makeBugReportsFilterKeysFixture());
        }),
      );
      renderPage();
      await waitForBugReports();

      fireEvent.click(screen.getByTestId("filter-input"));

      // The list opens on the first group's keys, with the other groups as
      // tabs; a search reaches keys in every group.
      const list = within(await screen.findByRole("dialog"));
      expect(list.getByText("Bug report status")).toBeTruthy();
      expect(list.getByText("Bug Report")).toBeTruthy();
      expect(list.getByText("Version")).toBeTruthy();
      fireEvent.change(list.getByTestId("filter-key-search"), {
        target: { value: "App version" },
      });
      expect(await screen.findByTestId("filter-key-version_name")).toBeTruthy();
      expect(keysUrls[0].searchParams.get("entity")).toBe("bug_reports");
    });
  });

  // ================================================================
  // FILTER EXPRESSION
  // ================================================================
  describe("a link carrying a filter", () => {
    it("filters the bug reports and the plot by it", async () => {
      mockRouter.searchParams = new URLSearchParams(
        `po=0&filter_expr=${encodeURIComponent("bug_report_status:in:open")}`,
      );
      const sent = recordBugReportsRequests();
      const plotUrls: URL[] = [];
      server.use(
        http.get(
          "*/api/apps/:appId/bugReports/plots/instances",
          ({ request }) => {
            plotUrls.push(new URL(request.url));
            return HttpResponse.json(makeBugReportsPlotFixture());
          },
        ),
      );
      renderPage();
      await waitForBugReports();

      expect(sent[0].searchParams.get("filter_expr")).toBe(
        "bug_report_status:in:open",
      );
      await waitFor(() => expect(plotUrls.length).toBeGreaterThan(0));
      expect(plotUrls[0].searchParams.get("filter_expr")).toBe(
        "bug_report_status:in:open",
      );
    });

    it("draws it as a condition a person can edit", async () => {
      mockRouter.searchParams = new URLSearchParams(
        `po=0&filter_expr=${encodeURIComponent("bug_report_status:in:open")}`,
      );
      renderPage();
      await waitForBugReports();

      const bar = within(screen.getByTestId("filter-bar"));
      expect(await screen.findByText("Bug report status")).toBeTruthy();
      expect(bar.getByText("is")).toBeTruthy();
      expect(bar.getByText("open")).toBeTruthy();
    });

    it("filters by nothing when it cannot be read", async () => {
      mockRouter.searchParams = new URLSearchParams(
        `po=0&filter_expr=${encodeURIComponent("bug_report_status:in:")}`,
      );
      const sent = recordBugReportsRequests();
      renderPage();
      await waitForBugReports();

      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
    });
  });

  describe("filtering by a value", () => {
    it("asks the server for the key's values, then filters by the one picked", async () => {
      const values: URL[] = [];
      server.use(
        http.get("*/api/apps/:appId/filters/values", ({ request }) => {
          values.push(new URL(request.url));
          return HttpResponse.json({
            values: [{ text: "open", label: "Open" }, { text: "closed" }],
            truncated: false,
          });
        }),
      );
      const sent = recordBugReportsRequests();
      renderPage();
      await waitForBugReports();

      fireEvent.click(screen.getByTestId("filter-input"));
      fireEvent.change(await screen.findByTestId("filter-key-search"), {
        target: { value: "Bug report status" },
      });
      fireEvent.click(
        await screen.findByTestId("filter-key-bug_report_status"),
      );
      fireEvent.click(await screen.findByText("<values>"));
      fireEvent.click(await screen.findByTestId("filter-value-open"));

      await waitFor(() => expect(sent).toHaveLength(2));
      expect(values[0].searchParams.get("entity")).toBe("bug_reports");
      expect(values[0].searchParams.get("key_name")).toBe("bug_report_status");
      expect(sent[1].searchParams.get("filter_expr")).toBe(
        "bug_report_status:in:open",
      );
    });
  });

  // ================================================================
  // PAGINATION
  // ================================================================
  describe("pagination", () => {
    it("clicking Next renders page 2 data, Previous returns to page 1", async () => {
      const page2Fixture = makeBugReportsOverviewFixture({
        meta: { next: false, previous: true },
        results: [
          {
            ...makeBugReportsOverviewFixture().results[0],
            event_id: "evt-br-page2",
            description: "Page 2 bug report",
            status: 1,
          },
        ],
      });

      server.use(
        http.get("*/api/apps/:appId/bugReports", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) return;
          const offset = url.searchParams.get("offset");
          if (offset === "5") return HttpResponse.json(page2Fixture);
          return HttpResponse.json(makeBugReportsOverviewFixture());
        }),
      );

      renderPage();
      await waitForBugReports();

      // Navigate to page 2
      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });
      await waitFor(
        () => {
          expect(screen.getByText("Page 2 bug report")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(
        screen.queryByText("App crashes when tapping checkout button"),
      ).toBeNull();

      // Navigate back to page 1
      await act(async () => {
        fireEvent.click(screen.getByText("Previous").closest("button")!);
      });
      await waitForBugReports();
      expect(screen.queryByText("Page 2 bug report")).toBeNull();

      // URL reflects page 1
      const url =
        mockRouterReplace.mock.calls[
          mockRouterReplace.mock.calls.length - 1
        ][0];
      expect(url).toContain("po=0");
    });

    it("deep-link with po=5 renders page 2 data", async () => {
      const page2Fixture = makeBugReportsOverviewFixture({
        meta: { next: false, previous: true },
        results: [
          {
            ...makeBugReportsOverviewFixture().results[0],
            event_id: "evt-br-page2",
            description: "Deep-linked page 2 bug report",
          },
        ],
      });

      server.use(
        http.get("*/api/apps/:appId/bugReports", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) return;
          const offset = url.searchParams.get("offset");
          if (offset === "5") return HttpResponse.json(page2Fixture);
          return HttpResponse.json(makeBugReportsOverviewFixture());
        }),
      );

      mockRouter.searchParams = new URLSearchParams("po=5");
      renderPage();
      await waitFor(
        () => {
          expect(
            screen.getByText("Deep-linked page 2 bug report"),
          ).toBeTruthy();
        },
        { timeout: 8000 },
      );

      expect(
        screen.queryByText("App crashes when tapping checkout button"),
      ).toBeNull();
    });
  });

  // ================================================================
  // ERROR STATES
  // ================================================================
  describe("when the server fails", () => {
    it("shows error when overview API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/bugReports", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) return;
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderPage();
      expect(
        await screen.findByText(/Error fetching list of bug reports/),
      ).toBeTruthy();
    });

    it("shows plot error when plot API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/bugReports/plots/instances", () => {
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

  // ================================================================
  // RE-RENDER
  // ================================================================
  describe("re-render", () => {
    it("re-render still shows data", async () => {
      const { unmount } = renderPage();
      await waitForBugReports();

      unmount();
      renderPage();
      await waitForBugReports();
    });
  });
});

// ====================================================================
// BUG REPORT DETAIL
// ====================================================================
describe("Bug Report Detail (MSW integration)", () => {
  const defaultParams = {
    teamId: "test-team",
    appId: "b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f",
    bugReportId: "evt-br-001",
  };

  async function renderDetail(params = defaultParams) {
    renderWithProviders(<BugReport params={params} />);
    await waitFor(
      () => {
        expect(
          screen.getByText("App crashes when tapping checkout button"),
        ).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // STATUS TOGGLE
  // ================================================================
  describe("status toggle", () => {
    it("clicking Close sends PATCH with status 1", async () => {
      let patchBody: any = null;
      server.use(
        http.patch(
          "*/api/apps/:appId/bugReports/:bugReportId",
          async ({ request }) => {
            patchBody = await request.json();
            return HttpResponse.json({ ok: true });
          },
        ),
      );

      await renderDetail();
      await act(async () => {
        fireEvent.click(screen.getByText("Close Bug Report"));
      });

      await waitFor(
        () => {
          expect(patchBody).toEqual({ status: 1 });
        },
        { timeout: 5000 },
      );
    });

    it("clicking Re-Open sends PATCH with status 0", async () => {
      let patchBody: any = null;
      server.use(
        http.get("*/api/apps/:appId/bugReports/:bugReportId", () => {
          return HttpResponse.json(makeBugReportDetailFixture({ status: 1 }));
        }),
        http.patch(
          "*/api/apps/:appId/bugReports/:bugReportId",
          async ({ request }) => {
            patchBody = await request.json();
            return HttpResponse.json({ ok: true });
          },
        ),
      );

      renderWithProviders(<BugReport params={defaultParams} />);
      await waitFor(
        () => {
          expect(screen.getByText("Re-Open Bug Report")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Re-Open Bug Report"));
      });

      await waitFor(
        () => {
          expect(patchBody).toEqual({ status: 0 });
        },
        { timeout: 5000 },
      );
    });

    it("status updates in UI after successful toggle", async () => {
      // After successful PATCH, TanStack Query invalidates and re-fetches.
      // Set up MSW to return status 1 (Closed) on re-fetch after PATCH.
      let patched = false;
      server.use(
        http.get("*/api/apps/:appId/bugReports/:bugReportId", () => {
          return HttpResponse.json(
            makeBugReportDetailFixture(patched ? { status: 1 } : {}),
          );
        }),
        http.patch("*/api/apps/:appId/bugReports/:bugReportId", () => {
          patched = true;
          return HttpResponse.json({ ok: true });
        }),
      );

      await renderDetail();
      expect(screen.getByText("Open")).toBeTruthy();
      expect(screen.getByText("Close Bug Report")).toBeTruthy();

      await act(async () => {
        fireEvent.click(screen.getByText("Close Bug Report"));
      });

      await waitFor(
        () => {
          expect(screen.getByText("Closed")).toBeTruthy();
          expect(screen.getByText("Re-Open Bug Report")).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("toggle fails (PATCH 500) — button re-enables so user can retry", async () => {
      let patchCallCount = 0;
      server.use(
        http.patch("*/api/apps/:appId/bugReports/:bugReportId", () => {
          patchCallCount++;
          return HttpResponse.json({ error: "server error" }, { status: 500 });
        }),
      );

      await renderDetail();
      const button = screen.getByText("Close Bug Report").closest("button")!;
      expect(button.disabled).toBe(false);

      // First attempt — click toggle
      await act(async () => {
        fireEvent.click(button);
      });

      // Wait for the error to be processed
      await waitFor(
        () => {
          expect(patchCallCount).toBe(1);
        },
        { timeout: 5000 },
      );

      // Button should be re-enabled after error so user can retry
      await waitFor(
        () => {
          expect(button.disabled).toBe(false);
        },
        { timeout: 5000 },
      );

      // Status should remain Open
      expect(screen.getByText("Open")).toBeTruthy();
      expect(screen.getByText("Close Bug Report")).toBeTruthy();

      // Second attempt — user retries
      await act(async () => {
        fireEvent.click(button);
      });

      await waitFor(
        () => {
          expect(patchCallCount).toBe(2);
        },
        { timeout: 5000 },
      );

      // Button should still be re-enabled
      await waitFor(
        () => {
          expect(button.disabled).toBe(false);
        },
        { timeout: 5000 },
      );
    });

    it("PATCH request hits correct URL path", async () => {
      let patchPath = "";
      server.use(
        http.patch(
          "*/api/apps/:appId/bugReports/:bugReportId",
          ({ request }) => {
            patchPath = new URL(request.url).pathname;
            return HttpResponse.json({ ok: true });
          },
        ),
      );

      await renderDetail();
      await act(async () => {
        fireEvent.click(screen.getByText("Close Bug Report"));
      });

      await waitFor(
        () => {
          expect(patchPath).toContain("/bugReports/evt-br-001");
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // ERROR STATES
  // ================================================================
  describe("error states", () => {
    it("shows error message when detail API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/bugReports/:bugReportId", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderWithProviders(<BugReport params={defaultParams} />);
      await waitFor(
        () => {
          expect(screen.getByText(/Error fetching bug report/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // API PATH VERIFICATION
  // ================================================================
  describe("API paths", () => {
    it("fetches detail from /bugReports/:bugReportId", async () => {
      let detailPath = "";
      server.use(
        http.get("*/api/apps/:appId/bugReports/:bugReportId", ({ request }) => {
          detailPath = new URL(request.url).pathname;
          return HttpResponse.json(makeBugReportDetailFixture());
        }),
      );

      await renderDetail();
      expect(detailPath).toContain(
        "/apps/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/bugReports/evt-br-001",
      );
    });
  });
});
