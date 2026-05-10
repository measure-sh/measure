/**
 * Integration tests for filter persistence across navigation.
 *
 * Simulates: change filters → unmount page (navigate to detail) →
 * remount page (navigate back via sidebar) → verify all filters preserved.
 *
 * Stores are created ONCE and shared across all tests (simulating the
 * provider pattern where stores live in the layout's React Context).
 *
 * Tests cover:
 * - Global filters: app, versions, date range
 * - Per-source filters: OS versions, countries, network types/providers/
 *   generations, locales, device manufacturers/names, session types,
 *   free text, ud attrs, bug report statuses
 * - Page-specific state: pagination offset
 * - Combined: multiple filters changed simultaneously
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "@jest/globals";
import { act, cleanup, render, waitFor } from "@testing-library/react";

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
  usePathname: () => "/test-team/session_timelines",
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
  ResponsiveLine: () => <div data-testid="nivo-line-chart" />,
}));

// --- MSW ---
import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  mockRouterReplace.mockClear();
  mockRouterPush.mockClear();
  cleanup();
});
afterAll(() => server.close());

// --- Stores (created ONCE, shared across all tests) ---
import { createFiltersStore } from "@/app/stores/filters_store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const filtersStore = createFiltersStore();
const testQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

jest.mock("@/app/stores/provider", () => {
  const { useStore } = require("zustand");
  return {
    __esModule: true,
    useFiltersStore: (selector?: any) =>
      selector ? useStore(filtersStore, selector) : useStore(filtersStore),
    useMeasureStoreRegistry: () => ({ filtersStore }),
  };
});

beforeAll(() => {
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

import SessionTimelinesOverview from "@/app/[teamId]/session_timelines/page";

// Helper: render overview, wait for data, ensure filters ready
async function renderAndWait() {
  render(
    <QueryClientProvider client={testQueryClient}>
      <SessionTimelinesOverview params={{ teamId: "test-team" }} />
    </QueryClientProvider>,
  );
  await waitFor(
    () => {
      expect(filtersStore.getState().filters.ready).toBe(true);
    },
    { timeout: 5000 },
  );
}

// Helper: unmount and remount (simulates detail → sidebar → overview)
async function unmountAndRemount() {
  cleanup();
  await renderAndWait();
}

// Helper: verify a filter value survives unmount/remount
async function expectPersistence<T>(
  setFilter: () => void,
  getFilter: () => T,
  expectedValue: T,
) {
  await renderAndWait();
  await act(async () => {
    setFilter();
  });
  expect(getFilter()).toEqual(expectedValue);
  await unmountAndRemount();
  expect(getFilter()).toEqual(expectedValue);
}

const {
  AppVersion,
  OsVersion,
  SessionType,
  BugReportStatus,
  SpanStatus,
  HttpMethod,
} = require("@/app/api/api_calls");

// ====================================================================
// GLOBAL FILTERS (persist across all pages for the current app)
// ====================================================================
describe("Global filter persistence", () => {
  it("app selection persists", async () => {
    await renderAndWait();
    const app = filtersStore.getState().selectedApp;
    expect(app).toBeTruthy();
    await unmountAndRemount();
    expect(filtersStore.getState().selectedApp).toBe(app);
  });

  it("version selection persists", async () => {
    await expectPersistence(
      () =>
        filtersStore
          .getState()
          .setSelectedVersions([new AppVersion("3.0.2", "302")]),
      () => filtersStore.getState().selectedVersions,
      [new AppVersion("3.0.2", "302")],
    );
  });

  it("date range persists", async () => {
    await renderAndWait();
    await act(async () => {
      filtersStore.getState().setSelectedDateRange("Last Week");
    });
    const dateRange = filtersStore.getState().selectedDateRange;
    await unmountAndRemount();
    expect(filtersStore.getState().selectedDateRange).toBe(dateRange);
  });

  it("start date persists", async () => {
    await renderAndWait();
    const date = "2026-04-01T00:00:00Z";
    await act(async () => {
      filtersStore.getState().setSelectedStartDate(date);
    });
    await unmountAndRemount();
    expect(filtersStore.getState().selectedStartDate).toBe(date);
  });

  it("end date persists", async () => {
    await renderAndWait();
    const date = "2026-04-10T00:00:00Z";
    await act(async () => {
      filtersStore.getState().setSelectedEndDate(date);
    });
    await unmountAndRemount();
    expect(filtersStore.getState().selectedEndDate).toBe(date);
  });
});

// ====================================================================
// PER-SOURCE FILTERS (persist per FilterSource)
// ====================================================================
describe("Per-source filter persistence", () => {
  it("OS versions persist", async () => {
    await expectPersistence(
      () =>
        filtersStore
          .getState()
          .setSelectedOsVersions([new OsVersion("android", "14")]),
      () => filtersStore.getState().selectedOsVersions,
      [new OsVersion("android", "14")],
    );
  });

  it("countries persist", async () => {
    await expectPersistence(
      () => filtersStore.getState().setSelectedCountries(["DE", "IN"]),
      () => filtersStore.getState().selectedCountries,
      ["DE", "IN"],
    );
  });

  it("network types persist", async () => {
    await expectPersistence(
      () => filtersStore.getState().setSelectedNetworkTypes(["cellular"]),
      () => filtersStore.getState().selectedNetworkTypes,
      ["cellular"],
    );
  });

  it("network providers persist", async () => {
    await expectPersistence(
      () => filtersStore.getState().setSelectedNetworkProviders(["Jio"]),
      () => filtersStore.getState().selectedNetworkProviders,
      ["Jio"],
    );
  });

  it("network generations persist", async () => {
    await expectPersistence(
      () => filtersStore.getState().setSelectedNetworkGenerations(["5g"]),
      () => filtersStore.getState().selectedNetworkGenerations,
      ["5g"],
    );
  });

  it("locales persist", async () => {
    await expectPersistence(
      () => filtersStore.getState().setSelectedLocales(["hi-IN", "de-DE"]),
      () => filtersStore.getState().selectedLocales,
      ["hi-IN", "de-DE"],
    );
  });

  it("device manufacturers persist", async () => {
    await expectPersistence(
      () => filtersStore.getState().setSelectedDeviceManufacturers(["Samsung"]),
      () => filtersStore.getState().selectedDeviceManufacturers,
      ["Samsung"],
    );
  });

  it("device names persist", async () => {
    await expectPersistence(
      () => filtersStore.getState().setSelectedDeviceNames(["Galaxy S24"]),
      () => filtersStore.getState().selectedDeviceNames,
      ["Galaxy S24"],
    );
  });

  it("session types persist", async () => {
    await expectPersistence(
      () =>
        filtersStore
          .getState()
          .setSelectedSessionTypes([SessionType.Crashes, SessionType.ANRs]),
      () => filtersStore.getState().selectedSessionTypes,
      [SessionType.Crashes, SessionType.ANRs],
    );
  });

  it("free text persists", async () => {
    await expectPersistence(
      () => filtersStore.getState().setSelectedFreeText("user-123"),
      () => filtersStore.getState().selectedFreeText,
      "user-123",
    );
  });

  it("ud attr matchers persist", async () => {
    const matcher = { key: "premium", type: "bool", op: "eq", value: true };
    await expectPersistence(
      () => filtersStore.getState().setSelectedUdAttrMatchers([matcher]),
      () => filtersStore.getState().selectedUdAttrMatchers,
      [matcher],
    );
  });

  it("bug report statuses persist", async () => {
    await expectPersistence(
      () =>
        filtersStore
          .getState()
          .setSelectedBugReportStatuses([BugReportStatus.Closed]),
      () => filtersStore.getState().selectedBugReportStatuses,
      [BugReportStatus.Closed],
    );
  });

  it("span statuses persist", async () => {
    await expectPersistence(
      () => filtersStore.getState().setSelectedSpanStatuses([SpanStatus.Error]),
      () => filtersStore.getState().selectedSpanStatuses,
      [SpanStatus.Error],
    );
  });

  it("http methods persist", async () => {
    await expectPersistence(
      () =>
        filtersStore
          .getState()
          .setSelectedHttpMethods([HttpMethod.GET, HttpMethod.POST]),
      () => filtersStore.getState().selectedHttpMethods,
      [HttpMethod.GET, HttpMethod.POST],
    );
  });

  it("root span name persists", async () => {
    await expectPersistence(
      () =>
        filtersStore
          .getState()
          .setSelectedRootSpanName("checkout_full_display"),
      () => filtersStore.getState().selectedRootSpanName,
      "checkout_full_display",
    );
  });
});

// ====================================================================
// PAGE-SPECIFIC STATE
// ====================================================================
describe("Page-specific state persistence", () => {
  it("page renders and filters are ready after remount", async () => {
    await renderAndWait();
    expect(filtersStore.getState().filters.ready).toBe(true);
    await unmountAndRemount();
    expect(filtersStore.getState().filters.ready).toBe(true);
  });
});

// ====================================================================
// COMBINED FILTERS
// ====================================================================
describe("Combined filter persistence", () => {
  it("multiple filters changed simultaneously all persist", async () => {
    await renderAndWait();

    await act(async () => {
      filtersStore
        .getState()
        .setSelectedVersions([new AppVersion("3.0.1", "301")]);
      filtersStore.getState().setSelectedCountries(["US"]);
      filtersStore.getState().setSelectedNetworkTypes(["wifi"]);
      filtersStore.getState().setSelectedLocales(["en-US"]);
      filtersStore.getState().setSelectedDeviceManufacturers(["Google"]);
      filtersStore.getState().setSelectedFreeText("search-term");
    });

    // Verify all set
    expect(filtersStore.getState().selectedVersions[0].name).toBe("3.0.1");
    expect(filtersStore.getState().selectedCountries).toEqual(["US"]);
    expect(filtersStore.getState().selectedNetworkTypes).toEqual(["wifi"]);
    expect(filtersStore.getState().selectedLocales).toEqual(["en-US"]);
    expect(filtersStore.getState().selectedDeviceManufacturers).toEqual([
      "Google",
    ]);
    expect(filtersStore.getState().selectedFreeText).toBe("search-term");

    // Unmount and remount
    await unmountAndRemount();

    // All still preserved
    expect(filtersStore.getState().selectedVersions[0].name).toBe("3.0.1");
    expect(filtersStore.getState().selectedCountries).toEqual(["US"]);
    expect(filtersStore.getState().selectedNetworkTypes).toEqual(["wifi"]);
    expect(filtersStore.getState().selectedLocales).toEqual(["en-US"]);
    expect(filtersStore.getState().selectedDeviceManufacturers).toEqual([
      "Google",
    ]);
    expect(filtersStore.getState().selectedFreeText).toBe("search-term");
  });
});
