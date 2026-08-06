/**
 * Integration tests for the unified Errors pages.
 *
 * Covers page/api wiring only: HTTP failure handling on the overview and
 * detail routes, and how the Type/Severity/Custom filter state serialises
 * into request query params. Rendering behaviour is covered by the unit
 * tests in __tests__/pages and __tests__/components.
 *
 * Real React components, Zustand stores, api_calls URL builders, and
 * apiClient.fetch run as they would in the browser. MSW intercepts at the
 * global fetch boundary and serves fixture data matching the Go struct
 * shapes.
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
import { act, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

// --- jsdom polyfills ---
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}
if (typeof (globalThis as any).PointerEvent === "undefined") {
  (globalThis as any).PointerEvent = class PointerEvent extends Event {
    constructor(type: string, props?: any) {
      super(type, props);
    }
  } as any;
}
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

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

// --- MSW ---
import {
  makeAppFixture,
  makeCrashPlotFixture,
  makeExceptionsOverviewFixture,
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

// --- Store / component imports (after mocks) ---
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
// OVERVIEW ROUTE
// ====================================================================
describe("Errors Overview (MSW integration)", () => {
  it("shows error message when overview fetch fails", async () => {
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

    renderWithProviders(
      <ErrorsOverviewPage params={promiseParams({ teamId: "test-team" })} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText(/Error fetching list of errors/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });
});

// ====================================================================
// DETAIL ROUTE
// ====================================================================
describe("Errors Detail (MSW integration)", () => {
  it("shows error message when events query errors", async () => {
    server.use(
      http.get("*/api/apps/:appId/errorGroups/:groupId/errors", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    renderWithProviders(
      <ErrorDetailsPage
        params={promiseParams({
          teamId: "test-team",
          appId: makeAppFixture().id,
          errorGroupId: "crash-group-001",
          errorGroupName: "test",
        })}
      />,
    );

    await waitFor(
      () => {
        expect(screen.getByText(/Error fetching list of errors/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });
});

// ====================================================================
// FILTER BEHAVIOUR: request params reflect Type/Severity/Custom
// ====================================================================
describe("Errors filter behaviour", () => {
  // Capture every errorGroups request URL so we can inspect query params
  function setupRequestCapture() {
    const errorGroupsRequests: { url: string }[] = [];
    server.use(
      http.get("*/api/apps/:appId/errorGroups", ({ request }) => {
        const url = new URL(request.url);
        // Skip plots and per-group sub-paths
        if (
          url.pathname.includes("/plots/") ||
          url.pathname.match(/errorGroups\/[^/]+\//)
        ) {
          return;
        }
        errorGroupsRequests.push({ url: request.url });
        return HttpResponse.json(makeExceptionsOverviewFixture());
      }),
      http.get("*/api/apps/:appId/errorGroups/plots/instances", () => {
        return HttpResponse.json(makeCrashPlotFixture());
      }),
    );
    return { errorGroupsRequests };
  }

  async function renderAndWaitForData() {
    renderWithProviders(
      <ErrorsOverviewPage params={promiseParams({ teamId: "test-team" })} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText("CheckoutActivity.kt: onClick()")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  it.each([
    {
      name: "default request includes both error and anr in type",
      applyFilters: undefined,
      contains: ["type=error%2Canr"],
      absent: [],
    },
    {
      name: "Type=Error only causes type=error in requests",
      applyFilters: (state: any) => {
        state.setSelectedErrorTypes(["error"]);
      },
      contains: ["type=error"],
      absent: ["type=anr", "type=error%2Canr"],
    },
    {
      name: "Type=ANR only causes type=anr in requests and no severity/custom",
      applyFilters: (state: any) => {
        state.setSelectedErrorTypes(["anr"]);
        // Severity and custom should be cleared in ANR-only mode
        state.setSelectedSeverities([]);
        state.setCustomErrorsOnly(false);
      },
      contains: ["type=anr"],
      absent: ["severity=", "custom="],
    },
    {
      name: "Severity values appear as severity=... in request URL",
      applyFilters: (state: any) => {
        state.setSelectedSeverities(["fatal", "handled"]);
      },
      // severity is comma-separated; URL encoding turns comma to %2C
      contains: ["severity=fatal%2Chandled"],
      absent: [],
    },
    {
      name: "customErrorsOnly=true appears as custom=true in request URL",
      applyFilters: (state: any) => {
        state.setCustomErrorsOnly(true);
      },
      contains: ["custom=true"],
      absent: [],
    },
  ])("$name", async ({ applyFilters, contains, absent }) => {
    const { errorGroupsRequests } = setupRequestCapture();
    await renderAndWaitForData();

    if (applyFilters) {
      errorGroupsRequests.length = 0;
      await act(async () => {
        applyFilters(filtersStore.getState());
      });
      await waitFor(
        () => {
          expect(errorGroupsRequests.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );
    }

    expect(errorGroupsRequests.length).toBeGreaterThan(0);
    const lastUrl = errorGroupsRequests[errorGroupsRequests.length - 1].url;
    for (const fragment of contains) {
      expect(lastUrl).toContain(fragment);
    }
    for (const fragment of absent) {
      expect(lastUrl).not.toContain(fragment);
    }
  });
});
