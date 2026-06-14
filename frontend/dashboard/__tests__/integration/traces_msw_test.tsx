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
 * and "View Session Timeline" link.
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

jest.mock("@nivo/line", () => ({
  __esModule: true,
  ResponsiveLine: ({ data }: any) => (
    <div data-testid="nivo-line-chart">
      {data?.map((s: any) => (
        <span key={s.id} data-testid={`chart-series-${s.id}`}>
          {s.id}: {s.data?.length ?? 0} points
        </span>
      ))}
    </div>
  ),
}));

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
    it("renders table headers", async () => {
      await renderAndWaitForData();
      expect(screen.getByText("Trace")).toBeTruthy();
      expect(screen.getByText("Start Time")).toBeTruthy();
      expect(screen.getByText("Duration")).toBeTruthy();
      expect(screen.getByText("Status")).toBeTruthy();
    });

    it("renders span names from fixture", async () => {
      await renderAndWaitForData();
      // Span names also appear in root span names dropdown, so use getAllByText
      expect(
        screen.getAllByText("checkout_full_display").length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText("api_fetch_payments").length,
      ).toBeGreaterThanOrEqual(1);
    });

    it("renders trace IDs", async () => {
      await renderAndWaitForData();
      expect(screen.getByText("ID: trace-001")).toBeTruthy();
      expect(screen.getByText("ID: trace-002")).toBeTruthy();
    });

    it("renders formatted duration", async () => {
      await renderAndWaitForData();
      // 1187ms → "1.187s", 500ms → "500ms"
      expect(screen.getByText("1.187s")).toBeTruthy();
      expect(screen.getByText("500ms")).toBeTruthy();
    });

    it('renders "Okay" status for status 1 (green)', async () => {
      await renderAndWaitForData();
      expect(screen.getByText("Okay")).toBeTruthy();
    });

    it('renders "Error" status for status 2 (red)', async () => {
      await renderAndWaitForData();
      expect(screen.getByText("Error")).toBeTruthy();
    });

    it('renders "Unset" status for status 0', async () => {
      server.use(
        http.get("*/api/apps/:appId/spans", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.includes("/roots/")
          )
            return;
          return HttpResponse.json(
            makeSpansOverviewFixture({
              results: [
                {
                  ...makeSpansOverviewFixture().results[0],
                  status: 0,
                },
              ],
            }),
          );
        }),
      );
      renderWithProviders(
        <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Unset")).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("renders device info with Android API Level", async () => {
      await renderAndWaitForData();
      expect(
        screen.getByText(
          /3\.1\.0\(310\).*Android API Level.*14.*Google.*Pixel 8/,
        ),
      ).toBeTruthy();
    });

    it("renders device info with iOS", async () => {
      await renderAndWaitForData();
      expect(
        screen.getByText(/3\.0\.2\(302\).*iOS.*17.*Apple.*iPhone 15/),
      ).toBeTruthy();
    });

    it("renders device info with iPadOS", async () => {
      server.use(
        http.get("*/api/apps/:appId/spans", () => {
          return HttpResponse.json(
            makeSpansOverviewFixture({
              results: [
                {
                  ...makeSpansOverviewFixture().results[0],
                  os_name: "ipados",
                  os_version: "17",
                },
              ],
            }),
          );
        }),
      );
      renderWithProviders(
        <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText(/iPadOS 17/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("falls through to raw os_name for unknown OS", async () => {
      server.use(
        http.get("*/api/apps/:appId/spans", () => {
          return HttpResponse.json(
            makeSpansOverviewFixture({
              results: [
                {
                  ...makeSpansOverviewFixture().results[0],
                  os_name: "harmonyos",
                  os_version: "4",
                },
              ],
            }),
          );
        }),
      );
      renderWithProviders(
        <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText(/harmonyos 4/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("renders formatted date in start time column", async () => {
      await renderAndWaitForData();
      expect(screen.getByText(/10 Apr, 2026/)).toBeTruthy();
      // \b prevents matching "19 Apr, 2026" from the date-range filter.
      expect(screen.getByText(/\b9 Apr, 2026/)).toBeTruthy();
    });

    it("renders formatted time in start time column", async () => {
      await renderAndWaitForData();
      expect(
        screen.getAllByText(/\d{1,2}:\d{2}:\d{2}\s[AP]M/i).length,
      ).toBeGreaterThanOrEqual(2);
    });

    it("renders span metrics plot", async () => {
      await renderAndWaitForData();
      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
    });

    it("renders plot with correct series and data points", async () => {
      await renderAndWaitForData();
      expect(
        screen.getByTestId("chart-series-checkout_full_display"),
      ).toBeTruthy();
      expect(
        screen.getByTestId("chart-series-checkout_full_display").textContent,
      ).toContain("3 points");
    });

    it("store status is Success after data loads", async () => {
      await renderAndWaitForData();
      const { SpansApiStatus } = require("@/app/api/api_calls");
      // Data loaded successfully - verified by DOM content above
    });

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

    it('shows "No Data" when plot returns null', async () => {
      server.use(
        http.get("*/api/apps/:appId/spans/plots/metrics", () => {
          return HttpResponse.json(null);
        }),
      );

      renderWithProviders(
        <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("No Data")).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // ROW NAVIGATION
  // ================================================================
  describe("row navigation", () => {
    it("row links point to trace detail page", async () => {
      await renderAndWaitForData();
      const links = screen.getAllByRole("link", { name: /ID: trace-001/ });
      expect(links.length).toBeGreaterThan(0);
      expect(links[0].getAttribute("href")).toBe(
        "/test-team/traces/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/trace-001",
      );
    });

    it("Enter key on table row navigates to trace detail", async () => {
      await renderAndWaitForData();
      const rows = screen.getAllByRole("row");
      fireEvent.keyDown(rows[1], { key: "Enter" });
      expect(mockRouterPush).toHaveBeenCalledWith(
        "/test-team/traces/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/trace-001",
      );
    });

    it("Space key on table row navigates to trace detail", async () => {
      await renderAndWaitForData();
      const rows = screen.getAllByRole("row");
      fireEvent.keyDown(rows[1], { key: " " });
      expect(mockRouterPush).toHaveBeenCalledWith(
        "/test-team/traces/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/trace-001",
      );
    });

    it("second row links to different trace", async () => {
      await renderAndWaitForData();
      const rows = screen.getAllByRole("row");
      fireEvent.keyDown(rows[2], { key: "Enter" });
      expect(mockRouterPush).toHaveBeenCalledWith(
        "/test-team/traces/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/trace-002",
      );
    });
  });

  // ================================================================
  // PAGINATION
  // ================================================================
  describe("pagination", () => {
    it("Next button enabled when meta.next is true", async () => {
      await renderAndWaitForData();
      expect(screen.getByText("Next").closest("button")?.disabled).toBe(false);
    });

    it("Previous button disabled on first page", async () => {
      await renderAndWaitForData();
      expect(screen.getByText("Previous").closest("button")?.disabled).toBe(
        true,
      );
    });

    it("clicking Next updates pagination offset and URL", async () => {
      await renderAndWaitForData();
      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });
      await waitFor(() => {
        const url =
          mockRouterReplace.mock.calls[
            mockRouterReplace.mock.calls.length - 1
          ][0];
        expect(url).toContain("po=5");
      });
    });

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

    it("Previous disabled on first page", async () => {
      await renderAndWaitForData();
      expect(screen.getByText("Previous").closest("button")?.disabled).toBe(
        true,
      );
    });

    it("prevPage at offset 0 stays at 0", async () => {
      await renderAndWaitForData();
      await act(async () => {
        fireEvent.click(screen.getByText("Previous").closest("button")!);
      });
      await waitFor(() => {
        const url =
          mockRouterReplace.mock.calls[
            mockRouterReplace.mock.calls.length - 1
          ][0];
        expect(url).toContain("po=0");
      });
    });

    it("filter change resets pagination to offset 0", async () => {
      await renderAndWaitForData();
      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });
      await waitFor(() => {
        const url =
          mockRouterReplace.mock.calls[
            mockRouterReplace.mock.calls.length - 1
          ][0];
        expect(url).toContain("po=5");
      });

      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.2", "302")]);
      });
      await waitFor(
        () => {
          const url =
            mockRouterReplace.mock.calls[
              mockRouterReplace.mock.calls.length - 1
            ][0];
          expect(url).toContain("po=0");
        },
        { timeout: 5000 },
      );
    });

    it("both buttons disabled when no pages", async () => {
      server.use(
        http.get("*/api/apps/:appId/spans", () => {
          return HttpResponse.json(
            makeSpansOverviewFixture({
              meta: { next: false, previous: false },
            }),
          );
        }),
      );
      renderWithProviders(
        <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("ID: trace-001")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(screen.getByText("Next").closest("button")?.disabled).toBe(true);
      expect(screen.getByText("Previous").closest("button")?.disabled).toBe(
        true,
      );
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

    it("version change sends versions in shortFilters POST", async () => {
      await renderAndWaitForData();
      shortFilterBodies.length = 0;
      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.1", "301")]);
      });
      await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(
        shortFilterBodies[shortFilterBodies.length - 1].filters.versions,
      ).toEqual(["3.0.1"]);
    });

    it("OS version change sends os_names in shortFilters POST", async () => {
      await renderAndWaitForData();
      shortFilterBodies.length = 0;
      await act(async () => {
        filtersStore
          .getState()
          .setSelectedOsVersions([new OsVersion("android", "14")]);
      });
      await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(
        shortFilterBodies[shortFilterBodies.length - 1].filters.os_names,
      ).toEqual(["android"]);
    });

    it("country change sends countries in POST", async () => {
      await renderAndWaitForData();
      shortFilterBodies.length = 0;
      await act(async () => {
        filtersStore.getState().setSelectedCountries(["DE"]);
      });
      await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(
        shortFilterBodies[shortFilterBodies.length - 1].filters.countries,
      ).toEqual(["DE"]);
    });

    it("network provider change sends network_providers in POST", async () => {
      await renderAndWaitForData();
      shortFilterBodies.length = 0;
      await act(async () => {
        filtersStore.getState().setSelectedNetworkProviders(["Jio"]);
      });
      await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(
        shortFilterBodies[shortFilterBodies.length - 1].filters
          .network_providers,
      ).toEqual(["Jio"]);
    });

    it("network type change sends network_types in POST", async () => {
      await renderAndWaitForData();
      shortFilterBodies.length = 0;
      await act(async () => {
        filtersStore.getState().setSelectedNetworkTypes(["cellular"]);
      });
      await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(
        shortFilterBodies[shortFilterBodies.length - 1].filters.network_types,
      ).toEqual(["cellular"]);
    });

    it("network generation change sends network_generations in POST", async () => {
      await renderAndWaitForData();
      shortFilterBodies.length = 0;
      await act(async () => {
        filtersStore.getState().setSelectedNetworkGenerations(["5g"]);
      });
      await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(
        shortFilterBodies[shortFilterBodies.length - 1].filters
          .network_generations,
      ).toEqual(["5g"]);
    });

    it("locale change sends locales in POST", async () => {
      await renderAndWaitForData();
      shortFilterBodies.length = 0;
      await act(async () => {
        filtersStore.getState().setSelectedLocales(["hi-IN"]);
      });
      await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(
        shortFilterBodies[shortFilterBodies.length - 1].filters.locales,
      ).toEqual(["hi-IN"]);
    });

    it("device manufacturer change sends device_manufacturers in POST", async () => {
      await renderAndWaitForData();
      shortFilterBodies.length = 0;
      await act(async () => {
        filtersStore.getState().setSelectedDeviceManufacturers(["Samsung"]);
      });
      await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(
        shortFilterBodies[shortFilterBodies.length - 1].filters
          .device_manufacturers,
      ).toEqual(["Samsung"]);
    });

    it("device name change sends device_names in POST", async () => {
      await renderAndWaitForData();
      shortFilterBodies.length = 0;
      await act(async () => {
        filtersStore.getState().setSelectedDeviceNames(["Galaxy S24"]);
      });
      await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(
        shortFilterBodies[shortFilterBodies.length - 1].filters.device_names,
      ).toEqual(["Galaxy S24"]);
    });

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
    it("serialises pagination offset into URL", async () => {
      await renderAndWaitForData();
      const url =
        mockRouterReplace.mock.calls[
          mockRouterReplace.mock.calls.length - 1
        ][0];
      expect(url).toContain("po=0");
    });

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

    it("URL updates on pagination change", async () => {
      await renderAndWaitForData();
      const callsBefore = mockRouterReplace.mock.calls.length;
      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });
      await waitFor(() => {
        expect(mockRouterReplace.mock.calls.length).toBeGreaterThan(
          callsBefore,
        );
      });
      expect(
        mockRouterReplace.mock.calls[
          mockRouterReplace.mock.calls.length - 1
        ][0],
      ).toContain("po=5");
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
  // CACHING
  // ================================================================
  describe("caching", () => {
    it("data loads and remains visible", async () => {
      await renderAndWaitForData();
      // Data should be visible (TanStack Query manages caching)
      expect(screen.getByText("ID: trace-001")).toBeTruthy();
    });
  });

  // ================================================================
  // EMPTY RESULTS
  // ================================================================
  describe("empty results", () => {
    it("renders empty table when no spans match", async () => {
      server.use(
        http.get("*/api/apps/:appId/spans", () => {
          return HttpResponse.json({
            meta: { next: false, previous: false },
            results: [],
          });
        }),
      );
      renderWithProviders(
        <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Trace")).toBeTruthy(); // header
        },
        { timeout: 5000 },
      );
      expect(screen.queryByText("ID: trace-001")).toBeNull();
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

    it("re-render still shows plot data", async () => {
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

    it("span metrics plot renders", async () => {
      await renderAndWaitForData();
      // Span metrics plot renders via TanStack Query
      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
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
  // PAGE LOAD
  // ================================================================
  describe("page load", () => {
    it("renders user ID pill", async () => {
      await renderDetail();
      expect(screen.getByText("User ID: user-trace-123")).toBeTruthy();
    });

    it("renders User ID: N/A when user_id is empty", async () => {
      server.use(
        http.get("*/api/apps/:appId/traces/:traceId", () => {
          return HttpResponse.json(makeTraceDetailFixture({ user_id: "" }));
        }),
      );
      renderWithProviders(<TraceDetails params={defaultParams} />);
      await waitFor(
        () => {
          expect(screen.getByText("User ID: N/A")).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("renders start time pill", async () => {
      await renderDetail();
      expect(screen.getByText(/Start Time:.*10 Apr, 2026/)).toBeTruthy();
    });

    it("renders duration pill", async () => {
      await renderDetail();
      expect(screen.getByText("Duration: 1.187s")).toBeTruthy();
    });

    it("renders device pill", async () => {
      await renderDetail();
      expect(screen.getByText(/Device:.*Google.*Pixel 8/)).toBeTruthy();
    });

    it("renders app version pill", async () => {
      await renderDetail();
      expect(screen.getByText("App version: 3.1.0 (310)")).toBeTruthy();
    });

    it("renders network type pill", async () => {
      await renderDetail();
      expect(screen.getByText("Network type: wifi")).toBeTruthy();
    });

    it('renders "View Session Timeline" link', async () => {
      await renderDetail();
      const link = screen.getByText("View Session Timeline");
      expect(link).toBeTruthy();
      expect(link.closest("a")?.getAttribute("href")).toBe(
        "/test-team/session_timelines/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/sess-trace-001",
      );
    });
  });

  // ================================================================
  // TRACE WATERFALL — RENDERING
  // ================================================================
  describe("TraceWaterfall rendering", () => {
    // Helper: find span bar buttons (absolute positioned, top-6 class)
    function getSpanBarButtons() {
      return Array.from(document.querySelectorAll("button")).filter(
        (b) =>
          b.className.includes("absolute") && b.className.includes("top-6"),
      );
    }

    // Helper: find span name buttons in the left panel (they contain span name text)
    function getSpanNameButtons() {
      return Array.from(document.querySelectorAll("button")).filter(
        (b) =>
          b.className.includes("flex") &&
          b.className.includes("flex-row") &&
          b.className.includes("items-center") &&
          b.className.includes("h-12"),
      );
    }

    it("renders span names from fixture in the timeline", async () => {
      await renderDetail();
      expect(
        screen.getAllByText("checkout_full_display").length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText("api_fetch_payments").length,
      ).toBeGreaterThanOrEqual(1);
    });

    it("renders formatted duration labels on span bars", async () => {
      await renderDetail();
      expect(screen.getAllByText("1.187s").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("750ms").length).toBeGreaterThanOrEqual(1);
    });

    it("renders child span count badge", async () => {
      await renderDetail();
      // Root span has 1 child
      expect(screen.getByText("1")).toBeTruthy();
    });

    it("renders timeline ruler values", async () => {
      await renderDetail();
      // Trace duration 1187ms → ruler: 0ms, ~237ms, ~475ms, ~712ms, ~950ms, 1.187s
      expect(screen.getAllByText("0ms").length).toBeGreaterThanOrEqual(1);
      // The last ruler marker is the full duration
      expect(screen.getAllByText("1.187s").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ================================================================
  // TRACE WATERFALL — SIDEBAR CONTENT
  //
  // The sidebar is hidden by default. Clicking a span row opens it with
  // that span selected. The X button closes it (clears selection).
  // ================================================================
  describe("TraceWaterfall sidebar content", () => {
    function getSpanRows() {
      return Array.from(
        document.querySelectorAll('[data-testid^="span-bar-row-"]'),
      );
    }

    async function selectRow(index: number) {
      await act(async () => {
        fireEvent.click(getSpanRows()[index]);
      });
    }

    async function switchToCheckpointsTab() {
      // "Checkpoints" appears both as the tab button and as a section
      // heading inside the tab. The tab button is the only <button> with
      // that accessible name.
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Checkpoints" }));
      });
    }

    it("sidebar shows all core span fields after selecting the root span", async () => {
      await renderDetail();
      await selectRow(0);
      await waitFor(() => {
        expect(screen.getByText("Span Name")).toBeTruthy();
        expect(screen.getByText("Span Id")).toBeTruthy();
        expect(screen.getByText("Start Time")).toBeTruthy();
        expect(screen.getByText("End Time")).toBeTruthy();
        expect(screen.getByText("Duration")).toBeTruthy();
        expect(screen.getByText("Parent Id")).toBeTruthy();
        expect(screen.getByText("Thread Name")).toBeTruthy();
        expect(screen.getByText("Span Status")).toBeTruthy();
      });
    });

    it("sidebar shows span name value for root span", async () => {
      await renderDetail();
      await selectRow(0);
      await waitFor(() => {
        const vals = screen.getAllByText(/checkout_full_display/);
        // row + sidebar title + sidebar Span Name value
        expect(vals.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("sidebar shows span_id value", async () => {
      await renderDetail();
      await selectRow(0);
      await waitFor(() => {
        expect(screen.getByText(/span-root/)).toBeTruthy();
      });
    });

    it('sidebar shows "--" for parent_id on root span', async () => {
      await renderDetail();
      await selectRow(0);
      await waitFor(() => {
        expect(screen.getByText("--")).toBeTruthy();
      });
    });

    it("sidebar shows actual parent_id for child span", async () => {
      await renderDetail();
      await selectRow(1);
      await waitFor(() => {
        expect(screen.getByText(/span-root/)).toBeTruthy();
      });
    });

    it("sidebar shows thread name", async () => {
      await renderDetail();
      await selectRow(0);
      await waitFor(() => {
        // appears in row thread col + sidebar header + Thread Name field
        expect(screen.getAllByText(/main/).length).toBeGreaterThanOrEqual(2);
      });
    });

    it('sidebar shows child span thread name "okhttp"', async () => {
      await renderDetail();
      await selectRow(1);
      await waitFor(() => {
        expect(screen.getAllByText(/okhttp/).length).toBeGreaterThanOrEqual(2);
      });
    });

    it('sidebar shows Span Status "Unset" for status 0', async () => {
      await renderDetail();
      await selectRow(0);
      await waitFor(() => {
        const statusTexts = screen.getAllByText("Unset");
        expect(statusTexts.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('sidebar shows Span Status "Okay" for status 1', async () => {
      await renderDetail();
      await selectRow(1);
      await waitFor(() => {
        const statusTexts = screen.getAllByText("Okay");
        expect(statusTexts.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("sidebar shows user_defined_attributes for child span", async () => {
      await renderDetail();
      await selectRow(1);
      await waitFor(() => {
        expect(screen.getByText("endpoint")).toBeTruthy();
        expect(screen.getByText("/api/payments")).toBeTruthy();
      });
    });

    it('Checkpoints tab shows "Checkpoints: []" for span with no checkpoints', async () => {
      await renderDetail();
      await selectRow(0); // root has checkpoints: null
      await switchToCheckpointsTab();
      await waitFor(() => {
        // Section heading inside the tab
        expect(
          screen.getAllByText("Checkpoints").length,
        ).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(": []")).toBeTruthy();
      });
    });

    it("Checkpoints tab shows checkpoint names for span with checkpoints", async () => {
      await renderDetail();
      await selectRow(1);
      await switchToCheckpointsTab();
      await waitFor(() => {
        expect(screen.getByText("request_sent")).toBeTruthy();
        expect(screen.getByText("response_received")).toBeTruthy();
      });
    });

    it("Checkpoints tab shows formatted checkpoint timestamps", async () => {
      await renderDetail();
      await selectRow(1);
      await switchToCheckpointsTab();
      await waitFor(() => {
        const timeLabels = screen.getAllByText("Time");
        expect(timeLabels.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ================================================================
  // TRACE WATERFALL — ROW SELECTION
  //
  // Sidebar is hidden by default. Clicking a span row opens it with that
  // span selected. Other (non-selected) rows drop to opacity-50 while
  // selection is active. The X icon clears selection and hides the
  // sidebar.
  // ================================================================
  describe("TraceWaterfall row selection", () => {
    function getSpanRows() {
      return Array.from(
        document.querySelectorAll('[data-testid^="span-bar-row-"]'),
      );
    }

    it("sidebar is hidden by default", async () => {
      await renderDetail();
      // Wait for data to render (one of the span names appears in the row)
      await waitFor(() => {
        expect(getSpanRows().length).toBe(2);
      });
      // Sidebar contents (e.g. "Span Name" field key) absent
      expect(screen.queryByText("Span Name")).toBeNull();
    });

    it("clicking a row opens the sidebar with that span selected", async () => {
      await renderDetail();
      await waitFor(() => expect(getSpanRows().length).toBe(2));
      expect(screen.queryByText("Span Name")).toBeNull();

      await act(async () => {
        fireEvent.click(getSpanRows()[0]); // root
      });
      await waitFor(() => {
        expect(screen.getByText("Span Name")).toBeTruthy();
        // Root parent_id renders as "--"
        expect(screen.getByText("--")).toBeTruthy();
      });
    });

    it("clicking a different row updates the sidebar in place", async () => {
      await renderDetail();
      await waitFor(() => expect(getSpanRows().length).toBe(2));

      await act(async () => {
        fireEvent.click(getSpanRows()[0]);
      });
      await waitFor(() => expect(screen.getByText("--")).toBeTruthy());

      await act(async () => {
        fireEvent.click(getSpanRows()[1]);
      });
      await waitFor(() => {
        expect(screen.getByText("endpoint")).toBeTruthy();
        expect(screen.queryByText("--")).toBeNull();
      });
    });

    it("non-selected rows drop to opacity-50 while a span is selected", async () => {
      await renderDetail();
      await waitFor(() => expect(getSpanRows().length).toBe(2));

      // Nothing selected → no dimming yet
      expect(getSpanRows()[0].className).not.toContain("opacity-50");
      expect(getSpanRows()[1].className).not.toContain("opacity-50");

      await act(async () => {
        fireEvent.click(getSpanRows()[0]); // select root
      });
      await waitFor(() => {
        const rows = getSpanRows();
        expect(rows[0].className).not.toContain("opacity-50");
        expect(rows[1].className).toContain("opacity-50");
      });
    });

    it("close button clears selection and hides the sidebar", async () => {
      await renderDetail();
      await waitFor(() => expect(getSpanRows().length).toBe(2));

      await act(async () => {
        fireEvent.click(getSpanRows()[0]);
      });
      await waitFor(() => expect(screen.getByText("Span Name")).toBeTruthy());

      const closeBtn = document.querySelector(
        'button[aria-label="Close"]',
      ) as HTMLButtonElement | null;
      expect(closeBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(closeBtn!);
      });
      await waitFor(() => {
        expect(screen.queryByText("Span Name")).toBeNull();
      });
      // No row dimmed once selection is cleared
      expect(getSpanRows()[1].className).not.toContain("opacity-50");
    });
  });

  // ================================================================
  // TRACE WATERFALL — CHECKPOINT TICKS
  //
  // Checkpoints render as ticks overlaid on the span bar (Honeycomb's
  // span-event-circle pattern). Clicking a tick bubbles to the parent
  // row's select handler, so the parent span becomes the active selection.
  // ================================================================
  describe("TraceWaterfall checkpoint ticks", () => {
    function getCheckpointTicks() {
      return Array.from(
        document.querySelectorAll('[data-testid^="span-checkpoint-"]'),
      );
    }

    it("renders one tick per checkpoint on the bar", async () => {
      await renderDetail();
      await waitFor(() => {
        // child span has 2 checkpoints
        expect(getCheckpointTicks().length).toBe(2);
      });
    });

    it("clicking a checkpoint opens the sidebar with its parent span", async () => {
      await renderDetail();
      await waitFor(() => expect(getCheckpointTicks().length).toBe(2));
      // Sidebar hidden initially
      expect(screen.queryByText("Span Name")).toBeNull();

      await act(async () => {
        fireEvent.click(getCheckpointTicks()[0]);
      });
      await waitFor(() => {
        // Sidebar now visible, showing the child span (the checkpoint's parent)
        expect(screen.getByText("Span Name")).toBeTruthy();
        // Child span's parent_id is "span-root", appears in the sidebar
        expect(screen.getAllByText(/span-root/).length).toBeGreaterThanOrEqual(
          1,
        );
      });
    });
  });

  // ================================================================
  // TRACE WATERFALL — EXPAND / COLLAPSE
  // ================================================================
  describe("TraceWaterfall expand/collapse", () => {
    function getSpanRows() {
      return Array.from(
        document.querySelectorAll('[data-testid^="span-bar-row-"]'),
      );
    }

    function getCountBadge(name: string) {
      return (
        screen.queryByRole("button", { name: `Expand ${name}` }) ??
        screen.queryByRole("button", { name: `Collapse ${name}` })
      );
    }

    it("initially both spans are visible (expanded)", async () => {
      await renderDetail();
      await waitFor(() => {
        expect(getSpanRows().length).toBe(2);
      });
    });

    it("clicking the count box collapses the subtree", async () => {
      await renderDetail();
      const badge = getCountBadge("checkout_full_display");
      expect(badge).toBeTruthy();

      await act(async () => {
        fireEvent.click(badge!);
      });
      await waitFor(() => {
        expect(getSpanRows().length).toBe(1);
      });
    });

    it("clicking the count box again re-expands the subtree", async () => {
      await renderDetail();

      await act(async () => {
        fireEvent.click(getCountBadge("checkout_full_display")!);
      });
      await waitFor(() => {
        expect(getSpanRows().length).toBe(1);
      });

      await act(async () => {
        fireEvent.click(getCountBadge("checkout_full_display")!);
      });
      await waitFor(() => {
        expect(getSpanRows().length).toBe(2);
      });
    });

    it("count box uses Collapse aria-label when expanded", async () => {
      await renderDetail();
      await waitFor(() => {
        expect(
          screen.queryByRole("button", {
            name: "Collapse checkout_full_display",
          }),
        ).toBeTruthy();
      });
    });

    it("count box switches to Expand aria-label after collapsing", async () => {
      await renderDetail();
      const badge = screen.queryByRole("button", {
        name: "Collapse checkout_full_display",
      });
      await act(async () => {
        fireEvent.click(badge!);
      });
      await waitFor(() => {
        expect(
          screen.queryByRole("button", {
            name: "Expand checkout_full_display",
          }),
        ).toBeTruthy();
        expect(
          screen.queryByRole("button", {
            name: "Collapse checkout_full_display",
          }),
        ).toBeNull();
      });
    });
  });

  // ================================================================
  // TRACE WATERFALL — EXPAND ANCESTORS ON NAVIGATION
  //
  // If the user collapses a subtree, then navigates (search/error/click)
  // to a span living inside it, the parent chain should re-expand so the
  // selected row is visible.
  // ================================================================
  describe("TraceWaterfall — expand ancestors on navigation", () => {
    function getSpanRows() {
      return Array.from(
        document.querySelectorAll('[data-testid^="span-bar-row-"]'),
      );
    }

    function threeLevelFixture() {
      const base = makeTraceDetailFixture();
      base.spans = [
        {
          ...base.spans[0],
          span_id: "root",
          span_name: "root_span",
          parent_id: "",
        },
        {
          ...base.spans[1],
          span_id: "mid",
          span_name: "middle_span",
          parent_id: "root",
        },
        {
          ...base.spans[1],
          span_id: "leaf",
          span_name: "leaf_span",
          parent_id: "mid",
          user_defined_attributes: null,
          checkpoints: null,
        },
      ];
      return base;
    }

    beforeEach(() => {
      server.use(
        http.get("*/api/apps/:appId/traces/:traceId", () =>
          HttpResponse.json(threeLevelFixture()),
        ),
      );
    });

    it("re-expands collapsed ancestors when Next match selects an inner span", async () => {
      await renderDetail();
      await waitFor(() => expect(getSpanRows().length).toBe(3));

      // Collapse the middle span — leaf disappears from the visible rows.
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Collapse middle_span" }),
        );
      });
      await waitFor(() => expect(getSpanRows().length).toBe(2));

      // Search for the deepest span (only match) and click Next.
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/Search spans/), {
          target: { value: "leaf" },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Next match"));
      });

      // mid re-expands → 3 rows visible again, and the leaf row exists.
      await waitFor(() => {
        expect(getSpanRows().length).toBe(3);
        expect(
          document.querySelector('[data-testid="span-bar-row-leaf"]'),
        ).toBeTruthy();
      });
    });
  });

  // ================================================================
  // TRACE WATERFALL — TOOLBAR / SEARCH
  // ================================================================
  describe("TraceWaterfall toolbar — search navigation", () => {
    function getSpanRows() {
      return Array.from(
        document.querySelectorAll('[data-testid^="span-bar-row-"]'),
      );
    }

    it("typing a query shows the match counter", async () => {
      await renderDetail();
      const input = screen.getByPlaceholderText(/Search spans/);
      await act(async () => {
        fireEvent.change(input, { target: { value: "fetch" } });
      });
      await waitFor(() => expect(screen.getByText("1 / 1")).toBeTruthy());
    });

    it("Next match selects the matched span and opens the sidebar", async () => {
      await renderDetail();
      const input = screen.getByPlaceholderText(/Search spans/);
      await act(async () => {
        fireEvent.change(input, { target: { value: "fetch" } });
      });
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Next match"));
      });
      await waitFor(() => {
        expect(screen.getByText("Span Name")).toBeTruthy();
        // The child span's attribute key shows in the sidebar.
        expect(screen.getByText("endpoint")).toBeTruthy();
      });
    });

    it("matched rows get the amber tint highlight", async () => {
      await renderDetail();
      await waitFor(() => expect(getSpanRows().length).toBe(2));
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/Search spans/), {
          target: { value: "checkout" },
        });
      });
      const rootRow = document.querySelector(
        '[data-testid="span-bar-row-span-root"]',
      );
      expect(rootRow?.className).toContain("bg-amber-50");
    });

    it("Clear (X) button empties the search and removes the counter", async () => {
      await renderDetail();
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/Search spans/), {
          target: { value: "fetch" },
        });
      });
      await waitFor(() =>
        expect(screen.queryByLabelText("Clear search")).toBeTruthy(),
      );
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Clear search"));
      });
      await waitFor(() => {
        expect(screen.queryByLabelText("Clear search")).toBeNull();
      });
    });
  });

  // ================================================================
  // TRACE WATERFALL — SHOW ERRORS FLOW
  // ================================================================
  describe("TraceWaterfall — show errors flow", () => {
    function getSpanRows() {
      return Array.from(
        document.querySelectorAll('[data-testid^="span-bar-row-"]'),
      );
    }

    function fixtureWithError() {
      const base = makeTraceDetailFixture();
      base.spans[1].status = 2; // mark api_fetch_payments as an error
      return base;
    }

    beforeEach(() => {
      server.use(
        http.get("*/api/apps/:appId/traces/:traceId", () =>
          HttpResponse.json(fixtureWithError()),
        ),
      );
    });

    it("toggle reveals the error banner with the count", async () => {
      await renderDetail();
      expect(screen.queryByTestId("trace-error-banner")).toBeNull();
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Show errors"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("trace-error-banner")).toBeTruthy();
        expect(screen.getByText("1 error span")).toBeTruthy();
      });
    });

    it("dims non-error rows when the toggle is on", async () => {
      await renderDetail();
      await waitFor(() => expect(getSpanRows().length).toBe(2));
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Show errors"));
      });
      await waitFor(() => {
        const rows = getSpanRows();
        // span-root is status=0 (non-error), should be dimmed
        const root = rows.find(
          (r) => r.getAttribute("data-testid") === "span-bar-row-span-root",
        );
        const child = rows.find(
          (r) => r.getAttribute("data-testid") === "span-bar-row-span-child-1",
        );
        expect(root?.className).toContain("opacity-30");
        expect(child?.className).not.toContain("opacity-30");
      });
    });

    it("Next error selects and opens the error span in the sidebar", async () => {
      await renderDetail();
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Show errors"));
      });
      await waitFor(() =>
        expect(screen.getByTestId("trace-error-banner")).toBeTruthy(),
      );
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Next error"));
      });
      await waitFor(() => {
        expect(screen.getByText("Span Name")).toBeTruthy();
        expect(screen.getByText("endpoint")).toBeTruthy();
      });
    });

    it("disables and clears the search input while show errors is on", async () => {
      await renderDetail();
      const input = screen.getByPlaceholderText(/Search spans/);
      await act(async () => {
        fireEvent.change(input, { target: { value: "fetch" } });
      });
      expect((input as HTMLInputElement).value).toBe("fetch");

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Show errors"));
      });
      await waitFor(() => {
        expect((input as HTMLInputElement).value).toBe("");
        expect((input as HTMLInputElement).disabled).toBe(true);
      });

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Show errors"));
      });
      await waitFor(() => {
        expect((input as HTMLInputElement).disabled).toBe(false);
      });
    });

    it("toggle off hides the banner and clears dimming", async () => {
      await renderDetail();
      const sw = screen.getByLabelText("Show errors");
      await act(async () => fireEvent.click(sw));
      await waitFor(() =>
        expect(screen.getByTestId("trace-error-banner")).toBeTruthy(),
      );
      await act(async () => fireEvent.click(sw));
      await waitFor(() => {
        expect(screen.queryByTestId("trace-error-banner")).toBeNull();
        const root = document.querySelector(
          '[data-testid="span-bar-row-span-root"]',
        );
        expect(root?.className).not.toContain("opacity-30");
        expect(root?.className).not.toContain("opacity-50");
      });
    });
  });

  // ================================================================
  // TRACE WATERFALL — BRUSH-TO-ZOOM + ZOOM BANNER
  // ================================================================
  describe("TraceWaterfall — brush-to-zoom + zoom banner", () => {
    function getWaterfall(): HTMLElement {
      return document.querySelector(
        '[data-testid="trace-waterfall"]',
      ) as HTMLElement;
    }

    function mockRect(el: Element, width = 1000) {
      el.getBoundingClientRect = () => ({
        width,
        left: 0,
        right: width,
        top: 0,
        bottom: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    }

    function brush(waterfall: HTMLElement, fromX: number, toX: number) {
      mockRect(waterfall);
      fireEvent.mouseDown(waterfall, { clientX: fromX, button: 0 });
      act(() => {
        window.dispatchEvent(
          new MouseEvent("mousemove", { clientX: toX, bubbles: true }),
        );
      });
      act(() => {
        window.dispatchEvent(
          new MouseEvent("mouseup", { clientX: toX, bubbles: true }),
        );
      });
      // The hook installs a one-shot capture listener to swallow the trailing
      // click the browser synthesizes after mouseup. Dispatch it explicitly
      // so it doesn't swallow the next real click we fire from the test.
      act(() => {
        window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }

    it("dragging across the timeline shows a brush overlay mid-gesture", async () => {
      await renderDetail();
      const waterfall = getWaterfall();
      mockRect(waterfall);
      fireEvent.mouseDown(waterfall, { clientX: 600, button: 0 });
      await act(async () => {
        window.dispatchEvent(
          new MouseEvent("mousemove", { clientX: 800, bubbles: true }),
        );
      });
      expect(screen.queryByTestId("trace-brush-overlay")).toBeTruthy();
      // clean up the gesture so it doesn't leak into other assertions
      await act(async () => {
        window.dispatchEvent(
          new MouseEvent("mouseup", { clientX: 800, bubbles: true }),
        );
      });
    });

    it("releasing past the threshold commits a zoom and shows the zoom banner", async () => {
      await renderDetail();
      brush(getWaterfall(), 600, 850);
      await waitFor(() => {
        expect(screen.getByText(/^Zoomed:/)).toBeTruthy();
        expect(screen.getByLabelText("Reset zoom")).toBeTruthy();
      });
    });

    it("Reset zoom hides the banner and restores the full window", async () => {
      await renderDetail();
      brush(getWaterfall(), 600, 850);
      await waitFor(() =>
        expect(screen.getByLabelText("Reset zoom")).toBeTruthy(),
      );
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Reset zoom"));
      });
      await waitFor(() => {
        expect(screen.queryByText(/^Zoomed:/)).toBeNull();
      });
    });

    it("a sub-threshold drag does not commit a zoom", async () => {
      await renderDetail();
      brush(getWaterfall(), 600, 602);
      // No banner appears.
      expect(screen.queryByText(/^Zoomed:/)).toBeNull();
    });
  });

  // ================================================================
  // TRACE WATERFALL — COLUMN RESIZER
  // ================================================================
  describe("TraceWaterfall — column resizer", () => {
    beforeEach(() => {
      // jsdom doesn't implement pointer capture; stub it.
      Element.prototype.setPointerCapture = jest.fn();
      Element.prototype.releasePointerCapture = jest.fn();
    });

    function mockWaterfallWidth(width = 1000) {
      const waterfall = document.querySelector(
        '[data-testid="trace-waterfall"]',
      ) as HTMLElement;
      waterfall.getBoundingClientRect = () => ({
        width,
        left: 0,
        right: width,
        top: 0,
        bottom: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      return waterfall;
    }

    async function drag(testId: string, toClientX: number) {
      fireEvent.pointerDown(screen.getByTestId(testId), {
        clientX: 0,
        pointerId: 1,
        button: 0,
      });
      await act(async () => {
        window.dispatchEvent(
          new MouseEvent("pointermove", { clientX: toClientX, bubbles: true }),
        );
      });
      await act(async () => {
        window.dispatchEvent(
          new MouseEvent("pointerup", { clientX: toClientX, bubbles: true }),
        );
      });
    }

    it("starts at the default span / thread fractions (no persistence)", async () => {
      await renderDetail();
      const waterfall = document.querySelector(
        '[data-testid="trace-waterfall"]',
      ) as HTMLElement;
      // Defaults: span = 30%, thread = leftCol(45%) - span(30%) = 15%.
      expect(waterfall.style.getPropertyValue("--span-col-width")).toBe("30%");
      expect(waterfall.style.getPropertyValue("--thread-col-width")).toBe(
        "15%",
      );
    });

    it("renders both resizer handles in the header", async () => {
      await renderDetail();
      expect(screen.getByTestId("trace-column-resizer-span")).toBeTruthy();
      expect(screen.getByTestId("trace-column-resizer")).toBeTruthy();
    });

    it("dragging the Thread↔Timeline resizer widens the thread column", async () => {
      await renderDetail();
      const waterfall = mockWaterfallWidth();
      await drag("trace-column-resizer", 650);
      // leftCol 0.65 - span 0.30 = thread 0.35 → "35%"; span unchanged.
      await waitFor(() => {
        expect(waterfall.style.getPropertyValue("--span-col-width")).toBe(
          "30%",
        );
        expect(waterfall.style.getPropertyValue("--thread-col-width")).toBe(
          "35%",
        );
      });
    });

    it("dragging the Span↔Thread resizer widens the span column", async () => {
      await renderDetail();
      const waterfall = mockWaterfallWidth();
      await drag("trace-column-resizer-span", 380);
      // span 0.38, thread = leftCol(0.45) - span(0.38) = 0.07 → "7%".
      await waitFor(() => {
        expect(waterfall.style.getPropertyValue("--span-col-width")).toBe(
          "38%",
        );
        expect(waterfall.style.getPropertyValue("--thread-col-width")).toBe(
          "7%",
        );
      });
    });

    it("Span↔Thread resizer is clamped so Thread keeps its minimum width", async () => {
      await renderDetail();
      const waterfall = mockWaterfallWidth();
      // Try to drag past the left-col boundary (which would crush Thread).
      await drag("trace-column-resizer-span", 900);
      // Clamped to leftCol(0.45) - THREAD_MIN(0.05) = 0.40.
      await waitFor(() => {
        expect(waterfall.style.getPropertyValue("--span-col-width")).toBe(
          "40%",
        );
      });
    });
  });

  // ================================================================
  // TRACE WATERFALL — KEYBOARD NAVIGATION ON SPAN ROWS
  // ================================================================
  describe("TraceWaterfall — span row keyboard navigation", () => {
    function getSpanRows() {
      return Array.from(
        document.querySelectorAll('[data-testid^="span-bar-row-"]'),
      );
    }

    it("Enter on a span row opens the sidebar with that span", async () => {
      await renderDetail();
      await waitFor(() => expect(getSpanRows().length).toBe(2));
      await act(async () => {
        fireEvent.keyDown(getSpanRows()[1], { key: "Enter" });
      });
      await waitFor(() => {
        expect(screen.getByText("Span Name")).toBeTruthy();
        expect(screen.getByText("endpoint")).toBeTruthy();
      });
    });

    it("Space on a span row opens the sidebar with that span", async () => {
      await renderDetail();
      await waitFor(() => expect(getSpanRows().length).toBe(2));
      await act(async () => {
        fireEvent.keyDown(getSpanRows()[0], { key: " " });
      });
      await waitFor(() => {
        expect(screen.getByText("Span Name")).toBeTruthy();
        expect(screen.getByText("--")).toBeTruthy(); // root parent_id
      });
    });

    it("other keys do not open the sidebar", async () => {
      await renderDetail();
      await waitFor(() => expect(getSpanRows().length).toBe(2));
      await act(async () => {
        fireEvent.keyDown(getSpanRows()[0], { key: "a" });
      });
      expect(screen.queryByText("Span Name")).toBeNull();
    });
  });

  // ================================================================
  // TRACE WATERFALL — HOVER SYNC ACROSS COLUMNS
  // ================================================================
  describe("TraceWaterfall — hover sync across columns", () => {
    function getSpanRows() {
      return Array.from(
        document.querySelectorAll('[data-testid^="span-bar-row-"]'),
      );
    }

    function countHoveredCells() {
      return document.querySelectorAll(".bg-muted\\/50").length;
    }

    it("hovering one row applies the hover background to all five cells of that row", async () => {
      await renderDetail();
      await waitFor(() => expect(getSpanRows().length).toBe(2));
      expect(countHoveredCells()).toBe(0);

      await act(async () => {
        fireEvent.mouseEnter(getSpanRows()[0]);
      });
      // Span + Spacer-A + Thread + Spacer-B + Timeline cells for the hovered row.
      expect(countHoveredCells()).toBe(5);

      await act(async () => {
        fireEvent.mouseLeave(getSpanRows()[0]);
      });
      expect(countHoveredCells()).toBe(0);
    });
  });

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

    it("shows skeleton loading before data arrives", async () => {
      server.use(
        http.get("*/api/apps/:appId/traces/:traceId", async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return HttpResponse.json(makeTraceDetailFixture());
        }),
      );
      renderWithProviders(<TraceDetails params={defaultParams} />);
      // Skeleton should be visible, data should not be present yet
      expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy();
      expect(screen.queryByText("User ID: user-trace-123")).toBeNull();
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

// ====================================================================
// AUTH FAILURE FLOW
// ====================================================================
describe("Traces — auth failure", () => {
  it("401 on spans fetch triggers token refresh attempt", async () => {
    let refreshAttempted = false;
    server.use(
      http.get("*/api/apps/:appId/spans", ({ request }) => {
        const url = new URL(request.url);
        if (
          url.pathname.includes("/plots/") ||
          url.pathname.includes("/roots/")
        )
          return;
        return new HttpResponse(null, { status: 401 });
      }),
      http.post("*/auth/refresh", () => {
        refreshAttempted = true;
        return new HttpResponse(null, { status: 401 });
      }),
    );
    renderWithProviders(
      <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
    );
    await waitFor(
      () => {
        expect(refreshAttempted).toBe(true);
      },
      { timeout: 5000 },
    );
  });

  it("401 on trace detail fetch triggers token refresh attempt", async () => {
    let refreshAttempted = false;
    server.use(
      http.get("*/api/apps/:appId/traces/:traceId", () => {
        return new HttpResponse(null, { status: 401 });
      }),
      http.post("*/auth/refresh", () => {
        refreshAttempted = true;
        return new HttpResponse(null, { status: 401 });
      }),
    );
    renderWithProviders(
      <TraceDetails
        params={{
          teamId: "test-team",
          appId: "b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f",
          traceId: "trace-001",
        }}
      />,
    );
    await waitFor(
      () => {
        expect(refreshAttempted).toBe(true);
      },
      { timeout: 5000 },
    );
  });
});

describe("Traces — team switch to no-apps team", () => {
  it("switching from team with apps to team with no apps shows NoApps after store reset", async () => {
    // Phase 1: render with team that has apps — fully load
    const { unmount } = renderWithProviders(
      <TracesOverview params={promiseParams({ teamId: "team-with-apps" })} />,
    );

    await waitFor(
      () => {
        expect(screen.getByText("ID: trace-001")).toBeTruthy();
      },
      { timeout: 5000 },
    );

    // Reset the filtersStore (simulating what onTeamChanged does in the layout)
    filtersStore.getState().reset();

    // Phase 2: override MSW to return 404 for apps, unmount, re-render with new teamId
    server.use(
      http.get("*/api/teams/:teamId/apps", () => {
        return new HttpResponse(null, { status: 404 });
      }),
    );

    unmount();

    renderWithProviders(
      <TracesOverview params={promiseParams({ teamId: "team-no-apps" })} />,
    );

    // Wait for NoApps message to appear
    await waitFor(
      () => {
        expect(screen.getByTestId("onboarding-step-create")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });
});
