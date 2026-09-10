/**
 * Integration tests for the wiring between the Errors overview/detail pages
 * and the server: request paths and parameters, the filter expression
 * carried by the URL, pagination round-trips, and error responses.
 * Rendering details of the rows are covered by the unit tests in
 * __tests__/pages/errors_overview_test.tsx and error_details_test.tsx.
 *
 * Unique to errors:
 *   - the errors filter entity (error_type, version_name, ...)
 *   - the detail route fixes the app from the URL path, not a filter pick
 *   - the overview row link carries the date range forward, not the filter
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
  usePathname: () => "/test-team/errors",
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
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

jest.mock("@nivo/bar", () => ({
  __esModule: true,
  ResponsiveBar: ({ keys }: any) => (
    <div data-testid="nivo-bar-chart">
      {keys?.map((k: string) => (
        <span key={k} data-testid={`bar-key-${k}`}>
          {k}
        </span>
      ))}
    </div>
  ),
}));

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
  makeCrashPlotFixture,
  makeErrorsFilterKeysFixture,
  makeExceptionsOverviewFixture,
  makeExceptionsOverviewPage2Fixture,
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
import ErrorDetailsPage from "@/app/[teamId]/errors/[appId]/[errorGroupId]/[errorGroupName]/page";
import ErrorsOverviewPage from "@/app/[teamId]/errors/page";
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

describe("Errors Overview (MSW integration)", () => {
  function renderPage() {
    return renderWithProviders(
      <ErrorsOverviewPage params={promiseParams({ teamId: "test-team" })} />,
    );
  }

  // Records only the list endpoint; the plot and detail paths share its
  // prefix and stay on the default handlers.
  function recordErrorGroupsRequests() {
    const sent: URL[] = [];
    server.use(
      http.get("*/api/apps/:appId/errorGroups", ({ request }) => {
        const url = new URL(request.url);
        if (
          url.pathname.includes("/plots/") ||
          url.pathname.match(/errorGroups\/[^/]+\//)
        ) {
          return;
        }
        sent.push(url);
        return HttpResponse.json(makeExceptionsOverviewFixture());
      }),
    );
    return sent;
  }

  async function waitForErrors() {
    await waitFor(
      () =>
        expect(screen.getByText("CheckoutActivity.kt: onClick()")).toBeTruthy(),
      { timeout: 5000 },
    );
  }

  describe("opening the page", () => {
    it("lists the errors the server sent under the plot", async () => {
      renderPage();
      await waitForErrors();

      expect(screen.getByText("ProductFragment.kt: onResume()")).toBeTruthy();
      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
    });

    it("asks for the app's error groups over the range it settled on", async () => {
      const sent = recordErrorGroupsRequests();
      renderPage();
      await waitForErrors();

      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(`/api/apps/${appId}/errorGroups`);
      expect(sent[0].searchParams.get("from")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("to")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("timezone")).toBeTruthy();
      expect(sent[0].searchParams.get("limit")).toBe("5");
      expect(sent[0].searchParams.get("offset")).toBe("0");
      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
      expect(sent[0].searchParams.has("type")).toBe(false);
      expect(sent[0].searchParams.has("severity")).toBe(false);
      expect(sent[0].searchParams.has("custom")).toBe(false);
    });

    it("sends the time group in the plot request", async () => {
      const plotUrls: URL[] = [];
      server.use(
        http.get(
          "*/api/apps/:appId/errorGroups/plots/instances",
          ({ request }) => {
            plotUrls.push(new URL(request.url));
            return HttpResponse.json(makeCrashPlotFixture());
          },
        ),
      );
      renderPage();
      await waitForErrors();

      await waitFor(() => expect(plotUrls.length).toBeGreaterThan(0));
      expect(plotUrls[0].pathname).toBe(
        `/api/apps/${appId}/errorGroups/plots/instances`,
      );
      expect(plotUrls[0].searchParams.get("plot_time_group")).toBeTruthy();
      expect(plotUrls[0].searchParams.has("filter_expr")).toBe(false);
    });

    it("records the app and range it settled on in the URL", async () => {
      renderPage();
      await waitForErrors();

      const written = new URLSearchParams(window.location.search);
      expect(written.get("a")).toBe(appId);
      expect(written.get("d")).toBe("Last 6 Hours");
      expect(written.get("po")).toBeNull();
    });

    it("offers the error_type key first, in the groups the server named", async () => {
      const keysUrls: URL[] = [];
      server.use(
        http.get("*/api/apps/:appId/filters/keys", ({ request }) => {
          keysUrls.push(new URL(request.url));
          return HttpResponse.json(makeErrorsFilterKeysFixture());
        }),
      );
      renderPage();
      await waitForErrors();

      fireEvent.click(screen.getByTestId("filter-input"));

      const list = within(await screen.findByRole("dialog"));
      expect(list.getByText("Error")).toBeTruthy();
      expect(list.getByText("Version")).toBeTruthy();
      fireEvent.change(list.getByTestId("filter-key-search"), {
        target: { value: "Error Type" },
      });
      expect(await screen.findByTestId("filter-key-error_type")).toBeTruthy();
      expect(keysUrls[0].searchParams.get("entity")).toBe("errors");
    });
  });

  describe("a link carrying a filter", () => {
    it("filters the errors and the plot by it", async () => {
      mockRouter.setUrl(
        `po=0&filter_expr=${encodeURIComponent("error_type:in:Crash")}`,
      );
      const sent = recordErrorGroupsRequests();
      const plotUrls: URL[] = [];
      server.use(
        http.get(
          "*/api/apps/:appId/errorGroups/plots/instances",
          ({ request }) => {
            plotUrls.push(new URL(request.url));
            return HttpResponse.json(makeCrashPlotFixture());
          },
        ),
      );
      renderPage();
      await waitForErrors();

      expect(sent[0].searchParams.get("filter_expr")).toBe(
        "error_type:in:Crash",
      );
      await waitFor(() => expect(plotUrls.length).toBeGreaterThan(0));
      expect(plotUrls[0].searchParams.get("filter_expr")).toBe(
        "error_type:in:Crash",
      );
    });

    it("draws the error type as a condition a person can edit", async () => {
      mockRouter.setUrl(
        `po=0&filter_expr=${encodeURIComponent("error_type:in:Crash")}`,
      );
      renderPage();
      await waitForErrors();

      const bar = within(screen.getByTestId("filter-bar"));
      expect(await screen.findByText("Error Type")).toBeTruthy();
      expect(bar.getByText("is")).toBeTruthy();
      expect(bar.getByText("Crash")).toBeTruthy();
    });

    it("filters by nothing when it cannot be read", async () => {
      mockRouter.setUrl(
        `po=0&filter_expr=${encodeURIComponent("error_type:in:")}`,
      );
      const sent = recordErrorGroupsRequests();
      renderPage();
      await waitForErrors();

      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
    });
  });

  describe("filtering by a value", () => {
    it("lists the error type values the server names, then filters by the one picked", async () => {
      const values: URL[] = [];
      server.use(
        http.get("*/api/apps/:appId/filters/values", ({ request }) => {
          values.push(new URL(request.url));
          return HttpResponse.json({
            values: [{ text: "Crash" }, { text: "ANR" }],
            truncated: false,
          });
        }),
      );
      const sent = recordErrorGroupsRequests();
      renderPage();
      await waitForErrors();

      fireEvent.click(screen.getByTestId("filter-input"));
      fireEvent.click(await screen.findByTestId("filter-key-error_type"));
      fireEvent.click(await screen.findByTestId("filter-value-Crash"));

      await waitFor(() => expect(sent).toHaveLength(2));
      expect(values[0].searchParams.get("entity")).toBe("errors");
      expect(values[0].searchParams.get("key_name")).toBe("error_type");
      expect(sent[1].searchParams.get("filter_expr")).toBe(
        "error_type:in:Crash",
      );
    });
  });

  describe("pagination", () => {
    it("clicking Next renders page 2 data, Previous returns to page 1", async () => {
      server.use(
        http.get("*/api/apps/:appId/errorGroups", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.match(/errorGroups\/[^/]+\//)
          ) {
            return;
          }
          if (url.searchParams.get("offset") === "5") {
            return HttpResponse.json(makeExceptionsOverviewPage2Fixture());
          }
          return HttpResponse.json(makeExceptionsOverviewFixture());
        }),
      );

      renderPage();
      await waitForErrors();

      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });
      await waitFor(
        () => {
          expect(
            screen.getByText("CartActivity.kt: computeTotal()"),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(screen.queryByText("CheckoutActivity.kt: onClick()")).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByText("Previous").closest("button")!);
      });
      await waitForErrors();
      expect(screen.queryByText("CartActivity.kt: computeTotal()")).toBeNull();

      expect(window.location.search).toContain("po=0");
    });

    it("deep-link with po=5 renders page 2 data", async () => {
      server.use(
        http.get("*/api/apps/:appId/errorGroups", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.match(/errorGroups\/[^/]+\//)
          ) {
            return;
          }
          if (url.searchParams.get("offset") === "5") {
            return HttpResponse.json(makeExceptionsOverviewPage2Fixture());
          }
          return HttpResponse.json(makeExceptionsOverviewFixture());
        }),
      );

      mockRouter.setUrl("po=5");
      renderPage();
      await waitFor(
        () => {
          expect(
            screen.getByText("CartActivity.kt: computeTotal()"),
          ).toBeTruthy();
        },
        { timeout: 8000 },
      );

      expect(screen.queryByText("CheckoutActivity.kt: onClick()")).toBeNull();
    });
  });

  describe("when the server fails", () => {
    it("shows error when the errorGroups API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/errorGroups", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.match(/errorGroups\/[^/]+\//)
          ) {
            return;
          }
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderPage();
      expect(
        await screen.findByText(/Error fetching list of errors/),
      ).toBeTruthy();
    });

    it("shows plot error when the plot API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/errorGroups/plots/instances", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderPage();
      expect(await screen.findByText(/Error fetching plot/)).toBeTruthy();
    });
  });

  describe("a link carrying a row into the detail page", () => {
    it("carries the date range forward in the row href, not the filter", async () => {
      mockRouter.setUrl(
        `d=Last+6+Hours&filter_expr=${encodeURIComponent("error_type:in:Crash")}`,
      );
      renderPage();
      await waitForErrors();

      const link = screen.getByRole("link", {
        name: /CheckoutActivity\.kt: onClick\(\)/i,
      });
      const href = link.getAttribute("href")!;
      expect(href).toContain(`d=${encodeURIComponent("Last 6 Hours")}`);
      expect(href).not.toContain("filter_expr");
    });
  });
});

describe("Errors Detail (MSW integration)", () => {
  function renderPage() {
    return renderWithProviders(
      <ErrorDetailsPage
        params={promiseParams({
          teamId: "test-team",
          appId,
          errorGroupId: "crash-group-001",
          errorGroupName: "test",
        })}
      />,
    );
  }

  async function waitForDetails() {
    await waitFor(
      () => expect(screen.getByText(/Id: instance-001/)).toBeTruthy(),
      { timeout: 5000 },
    );
  }

  it("renders with the filter bar fixed to the route's app", async () => {
    renderPage();
    await waitForDetails();

    expect(screen.getByTestId("filter-bar")).toBeTruthy();
  });

  it("asks for the group's errors, scoped to that app", async () => {
    const sent: URL[] = [];
    server.use(
      http.get(
        "*/api/apps/:appId/errorGroups/:groupId/errors",
        ({ request }) => {
          sent.push(new URL(request.url));
          return HttpResponse.json({
            meta: { next: false, previous: false },
            results: [],
          });
        },
      ),
    );
    renderPage();
    await waitFor(() => expect(sent.length).toBeGreaterThan(0));

    expect(sent[0].pathname).toBe(
      `/api/apps/${appId}/errorGroups/crash-group-001/errors`,
    );
    expect(sent[0].searchParams.get("limit")).toBe("1");
    expect(sent[0].searchParams.get("offset")).toBe("0");
  });

  it("shows error message when the events query errors", async () => {
    server.use(
      http.get("*/api/apps/:appId/errorGroups/:groupId/errors", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    renderPage();
    expect(
      await screen.findByText(/Error fetching list of errors/),
    ).toBeTruthy();
  });

  it("steps the pagination offset by one instance at a time", async () => {
    const sent: URL[] = [];
    server.use(
      http.get(
        "*/api/apps/:appId/errorGroups/:groupId/errors",
        ({ request }) => {
          sent.push(new URL(request.url));
          return HttpResponse.json({
            meta: { previous: false, next: true },
            results: [
              {
                id: "instance-001",
                session_id: "sess-crash-001",
                timestamp: "2026-04-10T10:30:00Z",
                type: "java.lang.NullPointerException",
                attribute: { app_version: "3.1.0", app_build: "310" },
                exception: { title: "t", stacktrace: "s", message: "m" },
                anr: null,
                severity: "fatal",
                num_code: null,
                code: "",
                meta: null,
                attachments: [],
                threads: [],
              },
            ],
          });
        },
      ),
    );
    renderPage();
    await waitForDetails();

    await act(async () => {
      fireEvent.click(screen.getByText("Next").closest("button")!);
    });
    await waitFor(() =>
      expect(sent[sent.length - 1].searchParams.get("offset")).toBe("1"),
    );
  });
});
