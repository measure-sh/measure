/**
 * Integration tests for the wiring between the Bug Reports pages and the
 * server: request paths and parameters, filter serialisation into the
 * shortFilters POST and the bug reports GET, pagination round-trips, the
 * status toggle PATCH, and error responses. Rendering details of the
 * overview rows and the detail surface are covered by the unit tests in
 * __tests__/pages/bug_reports_overview_test.tsx and
 * __tests__/components/bug_report_test.tsx.
 *
 * Unique to bug reports:
 *   - bugReportStatus filter (Open/Closed)
 *   - freeText search
 *   - PATCH endpoint for status toggle
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

// --- MSW ---
import {
  makeAppFixture,
  makeBugReportDetailFixture,
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
// BUG REPORTS OVERVIEW
// ====================================================================
describe("Bug Reports Overview (MSW integration)", () => {
  const {
    AppVersion,
    OsVersion,
    BugReportStatus,
  } = require("@/app/api/api_calls");

  async function renderAndWaitForData() {
    renderWithProviders(
      <BugReportsOverview params={promiseParams({ teamId: "test-team" })} />,
    );
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
  // PAGE LOAD
  // ================================================================
  describe("page load", () => {
    it("shows error when overview API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/bugReports", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) return;
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderWithProviders(
        <BugReportsOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(
            screen.getByText(/Error fetching list of bug reports/),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("shows plot error when plot API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/bugReports/plots/instances", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderWithProviders(
        <BugReportsOverview params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText(/Error fetching plot/)).toBeTruthy();
        },
        { timeout: 5000 },
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

      await renderAndWaitForData();
      expect(
        screen.getByText("App crashes when tapping checkout button"),
      ).toBeTruthy();

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
      await waitFor(
        () => {
          expect(
            screen.getByText("App crashes when tapping checkout button"),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
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

      mockSearchParams.set("po", "5");
      renderWithProviders(
        <BugReportsOverview params={promiseParams({ teamId: "test-team" })} />,
      );
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
  // FILTERS — all relevant filter types
  // ================================================================
  describe("filters", () => {
    let shortFilterBodies: any[];
    let requestUrls: string[];

    beforeEach(() => {
      shortFilterBodies = [];
      requestUrls = [];
      server.use(
        http.post("*/api/apps/:appId/shortFilters", async ({ request }) => {
          shortFilterBodies.push(await request.json());
          return HttpResponse.json({
            filter_short_code: `code-${shortFilterBodies.length}`,
          });
        }),
        http.get("*/api/apps/:appId/bugReports", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) return;
          requestUrls.push(url.toString());
          return HttpResponse.json(makeBugReportsOverviewFixture());
        }),
      );
    });

    // Each row applies one filter through the store and states what the page
    // must send to the server: most filters travel as a field in the
    // shortFilters POST body (bodyField/bodyValue), while free text and bug
    // report status go directly as query parameters on the bug reports GET
    // request (urlContains).
    const filterCases: {
      name: string;
      apply: () => void;
      bodyField?: string;
      bodyValue?: unknown;
      urlContains?: string;
    }[] = [
      {
        name: "version change sends versions in shortFilters POST",
        apply: () =>
          filtersStore
            .getState()
            .setSelectedVersions([new AppVersion("3.0.1", "301")]),
        bodyField: "versions",
        bodyValue: ["3.0.1"],
      },
      {
        name: "OS version change sends os_names in shortFilters POST",
        apply: () =>
          filtersStore
            .getState()
            .setSelectedOsVersions([new OsVersion("android", "14")]),
        bodyField: "os_names",
        bodyValue: ["android"],
      },
      {
        name: "country change sends countries in POST",
        apply: () => filtersStore.getState().setSelectedCountries(["DE"]),
        bodyField: "countries",
        bodyValue: ["DE"],
      },
      {
        name: "network provider change sends network_providers in POST",
        apply: () =>
          filtersStore.getState().setSelectedNetworkProviders(["Jio"]),
        bodyField: "network_providers",
        bodyValue: ["Jio"],
      },
      {
        name: "network type change sends network_types in POST",
        apply: () =>
          filtersStore.getState().setSelectedNetworkTypes(["cellular"]),
        bodyField: "network_types",
        bodyValue: ["cellular"],
      },
      {
        name: "network generation change sends network_generations in POST",
        apply: () =>
          filtersStore.getState().setSelectedNetworkGenerations(["5g"]),
        bodyField: "network_generations",
        bodyValue: ["5g"],
      },
      {
        name: "locale change sends locales in POST",
        apply: () => filtersStore.getState().setSelectedLocales(["hi-IN"]),
        bodyField: "locales",
        bodyValue: ["hi-IN"],
      },
      {
        name: "device manufacturer change sends device_manufacturers in POST",
        apply: () =>
          filtersStore.getState().setSelectedDeviceManufacturers(["Samsung"]),
        bodyField: "device_manufacturers",
        bodyValue: ["Samsung"],
      },
      {
        name: "device name change sends device_names in POST",
        apply: () =>
          filtersStore.getState().setSelectedDeviceNames(["Galaxy S24"]),
        bodyField: "device_names",
        bodyValue: ["Galaxy S24"],
      },
      {
        name: "free text change triggers re-fetch with free_text in URL",
        apply: () => filtersStore.getState().setSelectedFreeText("user-123"),
        urlContains: "free_text=",
      },
      {
        name: "bug report status filter sends bug_report_statuses in URL",
        apply: () =>
          filtersStore
            .getState()
            .setSelectedBugReportStatuses([BugReportStatus.Closed]),
        urlContains: "bug_report_statuses=1",
      },
    ];

    it.each(filterCases)(
      "$name",
      async ({ apply, bodyField, bodyValue, urlContains }) => {
        await renderAndWaitForData();
        shortFilterBodies.length = 0;
        requestUrls.length = 0;

        await act(async () => {
          apply();
        });

        if (bodyField !== undefined) {
          await waitFor(
            () => expect(shortFilterBodies.length).toBeGreaterThan(0),
            { timeout: 5000 },
          );
          expect(
            shortFilterBodies[shortFilterBodies.length - 1].filters[bodyField],
          ).toEqual(bodyValue);
        } else {
          await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), {
            timeout: 5000,
          });
          expect(requestUrls[requestUrls.length - 1]).toContain(urlContains!);
        }
      },
    );
  });

  // ================================================================
  // URL SYNC
  // ================================================================
  describe("URL sync", () => {
    it("serialises filters into URL", async () => {
      await renderAndWaitForData();
      expect(mockRouterReplace).toHaveBeenCalled();
      const url =
        mockRouterReplace.mock.calls[
          mockRouterReplace.mock.calls.length - 1
        ][0];
      // The URL should contain serialised filter params (app, dates, etc.)
      expect(url).toContain("a=");
      expect(url).toContain("sd=");
      expect(url).toContain("ed=");
    });
  });

  // ================================================================
  // API PATH VERIFICATION
  // ================================================================
  describe("API paths", () => {
    it("fetches from /bugReports path (not /crashGroups or /anrGroups)", async () => {
      const requestPaths: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/bugReports", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) return;
          requestPaths.push(url.pathname);
          return HttpResponse.json(makeBugReportsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      expect(requestPaths.some((p) => p.includes("/bugReports"))).toBe(true);
      expect(requestPaths.some((p) => p.includes("/crashGroups"))).toBe(false);
    });

    it("plot endpoint uses /bugReports/plots/instances", async () => {
      const plotPaths: string[] = [];
      server.use(
        http.get(
          "*/api/apps/:appId/bugReports/plots/instances",
          ({ request }) => {
            plotPaths.push(new URL(request.url).pathname);
            return HttpResponse.json(makeBugReportsPlotFixture());
          },
        ),
      );

      await renderAndWaitForData();
      expect(
        plotPaths.some((p) => p.includes("/bugReports/plots/instances")),
      ).toBe(true);
    });
  });

  // ================================================================
  // REQUEST URL PARAMS
  // ================================================================
  describe("request URL params", () => {
    it("sends limit=5 and offset in request URL", async () => {
      const requestUrls: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/bugReports", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) return;
          requestUrls.push(url.toString());
          return HttpResponse.json(makeBugReportsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      const lastUrl = requestUrls[requestUrls.length - 1];
      expect(lastUrl).toContain("limit=5");
      expect(lastUrl).toContain("offset=0");
    });

    it("default selection (Open only) sends bug_report_statuses=0 in initial request", async () => {
      const requestUrls: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/bugReports", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) return;
          requestUrls.push(url.toString());
          return HttpResponse.json(makeBugReportsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      // Default bug report status selection is [Open], so initial request should include status 0
      const lastUrl = requestUrls[requestUrls.length - 1];
      expect(lastUrl).toContain("bug_report_statuses=0");
      expect(lastUrl).not.toContain("bug_report_statuses=1");
    });

    it("selecting all statuses omits bug_report_statuses from URL", async () => {
      const requestUrls: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/bugReports", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) return;
          requestUrls.push(url.toString());
          return HttpResponse.json(makeBugReportsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      requestUrls.length = 0;

      await act(async () => {
        filtersStore
          .getState()
          .setSelectedBugReportStatuses([
            BugReportStatus.Open,
            BugReportStatus.Closed,
          ]);
      });

      await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      const lastUrl = requestUrls[requestUrls.length - 1];
      // When all statuses selected, the filter is omitted (all=true → no param)
      expect(lastUrl).not.toContain("bug_report_statuses=");
    });

    it("ud_expression sent in shortFilters POST for user-defined attribute filter", async () => {
      let shortFilterBodies: any[] = [];
      server.use(
        http.post("*/api/apps/:appId/shortFilters", async ({ request }) => {
          shortFilterBodies.push(await request.json());
          return HttpResponse.json({
            filter_short_code: `code-ud-${shortFilterBodies.length}`,
          });
        }),
      );

      await renderAndWaitForData();
      shortFilterBodies.length = 0;

      await act(async () => {
        filtersStore
          .getState()
          .setSelectedUdAttrMatchers([
            { key: "premium", type: "bool", op: "eq", value: true },
          ]);
      });

      await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      const body = shortFilterBodies[shortFilterBodies.length - 1];
      expect(body.filters.ud_expression).toBeDefined();
      const expr = JSON.parse(body.filters.ud_expression);
      expect(expr.and[0].cmp.key).toBe("premium");
      expect(expr.and[0].cmp.op).toBe("eq");
      // Value may be serialized as string "true" or boolean true depending on JSON encoding
      expect(String(expr.and[0].cmp.value)).toBe("true");
    });

    it("request URL contains correct app ID from filters", async () => {
      const requestPaths: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/bugReports", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) return;
          requestPaths.push(url.pathname);
          return HttpResponse.json(makeBugReportsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      expect(requestPaths[requestPaths.length - 1]).toContain(
        `/apps/${makeAppFixture().id}/bugReports`,
      );
    });
  });

  // ================================================================
  // PAGINATION EDGE CASES
  // ================================================================
  describe("pagination edge cases", () => {
    it("offset updates in request URL after nextPage", async () => {
      const requestUrls: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/bugReports", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) return;
          requestUrls.push(url.toString());
          return HttpResponse.json(makeBugReportsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      requestUrls.length = 0;

      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
      });
      await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), {
        timeout: 5000,
      });
      expect(requestUrls[requestUrls.length - 1]).toContain("offset=5");
    });
  });

  // ================================================================
  // PLOT STORE
  // ================================================================
  describe("plot store", () => {
    it("plot re-fetches when filters change", async () => {
      let plotFetchCount = 0;
      server.use(
        http.get("*/api/apps/:appId/bugReports/plots/instances", () => {
          plotFetchCount++;
          return HttpResponse.json(makeBugReportsPlotFixture());
        }),
      );

      await renderAndWaitForData();
      const initialPlotCount = plotFetchCount;

      await act(async () => {
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.1", "301")]);
      });

      await waitFor(
        () => {
          expect(plotFetchCount).toBeGreaterThan(initialPlotCount);
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // CONCURRENT / RE-RENDER
  // ================================================================
  describe("concurrent and re-render", () => {
    it("rapid pagination does not produce duplicate fetches for same offset", async () => {
      let fetchCount = 0;
      server.use(
        http.get("*/api/apps/:appId/bugReports", ({ request }) => {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 4) return;
          fetchCount++;
          return HttpResponse.json(makeBugReportsOverviewFixture());
        }),
      );

      await renderAndWaitForData();
      fetchCount = 0;

      // Rapidly click next then previous — should settle at offset 0
      await act(async () => {
        fireEvent.click(screen.getByText("Next").closest("button")!);
        fireEvent.click(screen.getByText("Previous").closest("button")!);
      });

      // Wait for any fetches to settle
      await new Promise((r) => setTimeout(r, 200));
      // The final offset is 0 (same as initial), so no new fetch should be needed
      // (or at most 1 if the intermediate state triggered one)
      expect(fetchCount).toBeLessThanOrEqual(1);
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
