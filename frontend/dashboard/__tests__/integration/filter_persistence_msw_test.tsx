/**
 * Integration tests for filter persistence across navigation.
 *
 * Only app, dateRange, startDate, and endDate are preserved across page
 * navigation. Every other selection resets on remount via applyFilterOptions.
 *
 * Custom date ranges keep their explicit start/end. Dynamic date ranges
 * (e.g. "Last Year") get re-anchored to now() on remount so we never
 * render stale data.
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

import { createFiltersStore } from "@/app/stores/filters_store";
import { createOnboardingStore } from "@/app/stores/onboarding_store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const filtersStore = createFiltersStore();
const onboardingStore = createOnboardingStore();
const testQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

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

beforeAll(() => {
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

import SessionTimelinesOverview from "@/app/[teamId]/session_timelines/page";

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

async function unmountAndRemount() {
  cleanup();
  await renderAndWait();
}

const { AppVersion, OsVersion } = require("@/app/api/api_calls");

describe("Filter persistence across page navigation", () => {
  describe("Preserved across nav", () => {
    it("selectedApp persists", async () => {
      await renderAndWait();
      const app = filtersStore.getState().selectedApp;
      expect(app).toBeTruthy();
      await unmountAndRemount();
      expect(filtersStore.getState().selectedApp).toBe(app);
    });

    it("selectedDateRange persists", async () => {
      await renderAndWait();
      await act(async () => {
        filtersStore.getState().setSelectedDateRange("Last Week");
      });
      await unmountAndRemount();
      expect(filtersStore.getState().selectedDateRange).toBe("Last Week");
    });

    it("Custom date range keeps explicit startDate and endDate", async () => {
      await renderAndWait();
      const start = "2026-04-01T00:00:00.000Z";
      const end = "2026-04-10T00:00:00.000Z";
      await act(async () => {
        filtersStore.getState().setSelectedDateRange("Custom Range");
        filtersStore.getState().setSelectedStartDate(start);
        filtersStore.getState().setSelectedEndDate(end);
      });
      await unmountAndRemount();
      expect(filtersStore.getState().selectedStartDate).toBe(start);
      expect(filtersStore.getState().selectedEndDate).toBe(end);
    });

    it("Dynamic date range (Last Year) re-anchors startDate/endDate to now() on remount", async () => {
      await renderAndWait();
      // Seed stale dates to prove they get replaced.
      await act(async () => {
        filtersStore.getState().setSelectedDateRange("Last Year");
        filtersStore
          .getState()
          .setSelectedStartDate("2020-01-01T00:00:00.000Z");
        filtersStore.getState().setSelectedEndDate("2020-01-02T00:00:00.000Z");
      });
      await unmountAndRemount();
      const end = new Date(filtersStore.getState().selectedEndDate);
      expect(end.getFullYear()).toBeGreaterThan(2024);
      const diffMs = Math.abs(end.getTime() - Date.now());
      expect(diffMs).toBeLessThan(60 * 1000);
    });
  });

  describe("Reset on every nav (via applyFilterOptions)", () => {
    const cases: Array<{
      name: string;
      change: () => void;
      read: () => unknown;
      defaultMatches: (v: any) => boolean;
    }> = [
      {
        name: "selectedVersions",
        change: () =>
          filtersStore
            .getState()
            .setSelectedVersions([new AppVersion("3.0.2", "302")]),
        read: () => filtersStore.getState().selectedVersions,
        // After remount the default reverts to the first version of the
        // newly-loaded options list — definitely not the one we picked.
        defaultMatches: (v: any) =>
          Array.isArray(v) && !v.some((x: any) => x.code === "302"),
      },
      {
        name: "selectedOsVersions",
        change: () =>
          filtersStore
            .getState()
            .setSelectedOsVersions([new OsVersion("android", "99")]),
        read: () => filtersStore.getState().selectedOsVersions,
        defaultMatches: (v: any) =>
          Array.isArray(v) && !v.some((x: any) => x.version === "99"),
      },
      {
        name: "selectedCountries",
        change: () =>
          filtersStore.getState().setSelectedCountries(["Atlantis"]),
        read: () => filtersStore.getState().selectedCountries,
        defaultMatches: (v: any) => Array.isArray(v) && !v.includes("Atlantis"),
      },
      {
        name: "selectedFreeText",
        change: () =>
          filtersStore.getState().setSelectedFreeText("looking for crashes"),
        read: () => filtersStore.getState().selectedFreeText,
        defaultMatches: (v: any) => v === "",
      },
      {
        name: "selectedNetworkTypes",
        change: () =>
          filtersStore.getState().setSelectedNetworkTypes(["FiberOptic"]),
        read: () => filtersStore.getState().selectedNetworkTypes,
        defaultMatches: (v: any) =>
          Array.isArray(v) && !v.includes("FiberOptic"),
      },
    ];

    for (const { name, change, read, defaultMatches } of cases) {
      it(`${name} resets on remount`, async () => {
        await renderAndWait();
        await act(async () => {
          change();
        });
        await unmountAndRemount();
        expect(defaultMatches(read())).toBe(true);
      });
    }
  });
});
