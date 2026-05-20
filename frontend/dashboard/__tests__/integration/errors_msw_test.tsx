/**
 * Integration tests for the unified Errors pages.
 *
 * Overview route: lists error groups, renders the overview plot, supports
 * the Errors / ANRs filter pills, severity, and custom flags.
 * Detail route: per-group events list with details plot, distribution plot,
 * and common-path UI.
 *
 * Real React components, Zustand stores, api_calls URL builders, and
 * apiClient.fetch run as they would in the browser. MSW intercepts at the
 * global fetch boundary and serves fixture data matching the Go struct
 * shapes.
 */
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
  makeExceptionInstanceFixture,
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
  async function renderAndWaitForData() {
    renderWithProviders(
      <ErrorsOverviewPage params={{ teamId: "test-team" }} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText("CheckoutActivity.kt: onClick()")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  it("lists error groups from /apps/:id/errorGroups", async () => {
    await renderAndWaitForData();
    expect(screen.getByText("CheckoutActivity.kt: onClick()")).toBeTruthy();
    expect(screen.getByText("ProductFragment.kt: onResume()")).toBeTruthy();
    expect(
      screen.getByText(
        /java\.lang\.NullPointerException:.*null object reference/,
      ),
    ).toBeTruthy();
  });

  it("renders table headers", async () => {
    await renderAndWaitForData();
    expect(screen.getByText("Error")).toBeTruthy();
    expect(screen.getByText("Instances")).toBeTruthy();
    expect(screen.getByText("Percentage contribution")).toBeTruthy();
  });

  it("renders count and percentage_contribution from fixture", async () => {
    await renderAndWaitForData();
    expect(screen.getByText("1523")).toBeTruthy();
    expect(screen.getByText("45.2%")).toBeTruthy();
  });

  it("renders overview plot from /apps/:id/errorGroups/plots/instances", async () => {
    await renderAndWaitForData();
    expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
    // The crash-plot fixture id is "3.1.0"
    expect(screen.getByTestId("chart-series-3.1.0")).toBeTruthy();
  });

  it("row link points to /<teamId>/errors/<appId>/<groupId>/<encoded name>", async () => {
    await renderAndWaitForData();
    const links = screen.getAllByRole("link", {
      name: /CheckoutActivity\.kt: onClick\(\)/,
    });
    expect(links.length).toBeGreaterThan(0);
    const href = links[0].getAttribute("href") ?? "";
    expect(href).toContain("/test-team/errors/");
    // Encoded "type@file_name" → java.lang.NullPointerException@CheckoutActivity.kt
    expect(href).toContain(
      encodeURIComponent("java.lang.NullPointerException@CheckoutActivity.kt"),
    );
  });

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
      <ErrorsOverviewPage params={{ teamId: "test-team" }} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText(/Error fetching list of errors/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });

  it("renders empty result set without error groups", async () => {
    server.use(
      http.get("*/api/apps/:appId/errorGroups", ({ request }) => {
        const url = new URL(request.url);
        if (
          url.pathname.includes("/plots/") ||
          url.pathname.match(/errorGroups\/[^/]+\//)
        ) {
          return;
        }
        return HttpResponse.json({
          meta: { next: false, previous: false },
          results: [],
        });
      }),
    );

    renderWithProviders(
      <ErrorsOverviewPage params={{ teamId: "test-team" }} />,
    );
    await waitFor(
      () => {
        // Headers still render
        expect(screen.getByText("Error")).toBeTruthy();
      },
      { timeout: 5000 },
    );
    expect(screen.queryByText("CheckoutActivity.kt: onClick()")).toBeNull();
  });
});

// ====================================================================
// DETAIL ROUTE
// ====================================================================
describe("Errors Detail (MSW integration)", () => {
  async function renderDetailAndWait() {
    renderWithProviders(
      <ErrorDetailsPage
        params={{
          teamId: "test-team",
          appId: makeAppFixture().id,
          errorGroupId: "crash-group-001",
          errorGroupName: encodeURIComponent("java.lang.NullPointerException"),
        }}
      />,
    );
    await waitFor(
      () => {
        expect(screen.getByText(/Id: instance-001/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  it("renders details plot, distribution plot, and common path", async () => {
    await renderDetailAndWait();
    // 1 line chart for details plot
    expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
    // Bar chart for distribution plot
    expect(screen.getByTestId("nivo-bar-chart")).toBeTruthy();
    // Common path "Common Path" heading
    expect(screen.getAllByText(/Common Path/).length).toBeGreaterThanOrEqual(1);
  });

  it("fetches events from /apps/:id/errorGroups/:id/errors and renders details", async () => {
    await renderDetailAndWait();
    expect(screen.getByText(/Id: instance-001/)).toBeTruthy();
    expect(screen.getByText(/App version: 3\.1\.0/)).toBeTruthy();
    expect(screen.getByText(/Device: GooglePixel 8/)).toBeTruthy();
    expect(screen.getByText(/Network type: wifi/)).toBeTruthy();
  });

  it("renders View Session Timeline link to the right session", async () => {
    await renderDetailAndWait();
    const link = screen.getByText("View Session Timeline").closest("a")!;
    expect(link.getAttribute("href")).toBe(
      `/test-team/session_timelines/${makeAppFixture().id}/sess-crash-001`,
    );
  });

  it("renders common path step descriptions from fixture", async () => {
    await renderDetailAndWait();
    // Fixture's first 3 steps all have confidence >= 80% (95, 92, 85)
    expect(screen.getByText("App launched")).toBeTruthy();
    expect(screen.getByText("MainActivity.onCreate")).toBeTruthy();
    expect(screen.getByText("CheckoutActivity.onClick")).toBeTruthy();
  });

  it("renders distribution plot keys from fixture", async () => {
    await renderDetailAndWait();
    // The mock bar chart renders one element per key; verify a few present
    expect(screen.getByTestId("bar-key-Google")).toBeTruthy();
    expect(screen.getByTestId("bar-key-Samsung")).toBeTruthy();
  });

  it("shows error message when events query errors", async () => {
    server.use(
      http.get("*/api/apps/:appId/errorGroups/:groupId/errors", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    renderWithProviders(
      <ErrorDetailsPage
        params={{
          teamId: "test-team",
          appId: makeAppFixture().id,
          errorGroupId: "crash-group-001",
          errorGroupName: "test",
        }}
      />,
    );

    await waitFor(
      () => {
        expect(screen.getByText(/Error fetching list of errors/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });

  it("renders ANR stack trace when event is an ANR", async () => {
    server.use(
      http.get("*/api/apps/:appId/errorGroups/:groupId/errors", () => {
        return HttpResponse.json(
          makeExceptionInstanceFixture({ variant: "anr" }),
        );
      }),
    );

    renderWithProviders(
      <ErrorDetailsPage
        params={{
          teamId: "test-team",
          appId: makeAppFixture().id,
          errorGroupId: "anr-group-001",
          errorGroupName: "test",
        }}
      />,
    );

    await waitFor(
      () => {
        expect(screen.getByText(/Id: instance-001/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
    // The ANR stacktrace text should be present in the rendered DOM
    expect(
      screen.getAllByText(/ANR in sh\.measure\.demo/).length,
    ).toBeGreaterThanOrEqual(1);
  });
});

// ====================================================================
// FILTER BEHAVIOUR — request params reflect Type/Severity/Custom
// ====================================================================
describe("Errors filter behaviour", () => {
  // Capture every errorGroups request URL so we can inspect query params
  function setupRequestCapture() {
    const errorGroupsRequests: { url: string }[] = [];
    const errorGroupsPlotRequests: { url: string }[] = [];
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
      http.get(
        "*/api/apps/:appId/errorGroups/plots/instances",
        ({ request }) => {
          errorGroupsPlotRequests.push({ url: request.url });
          return HttpResponse.json(makeCrashPlotFixture());
        },
      ),
    );
    return { errorGroupsRequests, errorGroupsPlotRequests };
  }

  async function renderAndWaitForData() {
    renderWithProviders(
      <ErrorsOverviewPage params={{ teamId: "test-team" }} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText("CheckoutActivity.kt: onClick()")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  it("default request includes both error and anr in type", async () => {
    const { errorGroupsRequests } = setupRequestCapture();
    await renderAndWaitForData();
    expect(errorGroupsRequests.length).toBeGreaterThan(0);
    const lastUrl = errorGroupsRequests[errorGroupsRequests.length - 1].url;
    expect(lastUrl).toContain("type=error%2Canr");
  });

  it("Type=Error only causes type=error in requests", async () => {
    const { errorGroupsRequests, errorGroupsPlotRequests } =
      setupRequestCapture();
    await renderAndWaitForData();
    errorGroupsRequests.length = 0;
    errorGroupsPlotRequests.length = 0;

    await act(async () => {
      filtersStore.getState().setSelectedErrorTypes(["error"]);
    });

    await waitFor(
      () => {
        expect(errorGroupsRequests.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    const lastUrl = errorGroupsRequests[errorGroupsRequests.length - 1].url;
    expect(lastUrl).toContain("type=error");
    expect(lastUrl).not.toContain("type=anr");
    expect(lastUrl).not.toContain("type=error%2Canr");
  });

  it("Type=ANR only causes type=anr in requests and no severity/custom", async () => {
    const { errorGroupsRequests } = setupRequestCapture();
    await renderAndWaitForData();
    errorGroupsRequests.length = 0;

    await act(async () => {
      filtersStore.getState().setSelectedErrorTypes(["anr"]);
      // Severity and custom should be cleared in ANR-only mode
      filtersStore.getState().setSelectedSeverities([]);
      filtersStore.getState().setCustomErrorsOnly(false);
    });

    await waitFor(
      () => {
        expect(errorGroupsRequests.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    const lastUrl = errorGroupsRequests[errorGroupsRequests.length - 1].url;
    expect(lastUrl).toContain("type=anr");
    expect(lastUrl).not.toContain("severity=");
    expect(lastUrl).not.toContain("custom=");
  });

  it("Severity values appear as severity=... in request URL", async () => {
    const { errorGroupsRequests } = setupRequestCapture();
    await renderAndWaitForData();
    errorGroupsRequests.length = 0;

    await act(async () => {
      filtersStore.getState().setSelectedSeverities(["fatal", "handled"]);
    });

    await waitFor(
      () => {
        expect(errorGroupsRequests.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    const lastUrl = errorGroupsRequests[errorGroupsRequests.length - 1].url;
    // severity is comma-separated; URL encoding turns comma to %2C
    expect(lastUrl).toContain("severity=fatal%2Chandled");
  });

  it("customErrorsOnly=true appears as custom=true in request URL", async () => {
    const { errorGroupsRequests } = setupRequestCapture();
    await renderAndWaitForData();
    errorGroupsRequests.length = 0;

    await act(async () => {
      filtersStore.getState().setCustomErrorsOnly(true);
    });

    await waitFor(
      () => {
        expect(errorGroupsRequests.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    const lastUrl = errorGroupsRequests[errorGroupsRequests.length - 1].url;
    expect(lastUrl).toContain("custom=true");
  });
});

// ====================================================================
// PILLS — Errors / ANRs labels and clear behaviour
// ====================================================================
describe("Errors filter pills", () => {
  async function renderAndWaitForData() {
    renderWithProviders(
      <ErrorsOverviewPage params={{ teamId: "test-team" }} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText("CheckoutActivity.kt: onClick()")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  it("renders ANRs pill when ANR is in selected types", async () => {
    await renderAndWaitForData();
    // Default state already has both "error" and "anr" → both pills visible
    expect(screen.getByText("ANRs")).toBeTruthy();
  });

  it('renders Errors pill labelled simply "Errors" when no severity/custom', async () => {
    await renderAndWaitForData();
    expect(screen.getByText("Errors")).toBeTruthy();
  });

  it("Errors pill folds Custom + severity into concatenated label", async () => {
    await renderAndWaitForData();
    await act(async () => {
      filtersStore.getState().setSelectedSeverities(["fatal", "handled"]);
      filtersStore.getState().setCustomErrorsOnly(true);
    });

    await waitFor(
      () => {
        // Order is: Custom first, then severities (Fatal, Handled)
        expect(
          screen.getByText("Errors - Custom, Fatal, Handled"),
        ).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });

  it("clicking ANRs pill X removes 'anr' from selected types", async () => {
    await renderAndWaitForData();
    // The X button is rendered with aria-label="Clear ANRs"
    const clearButton = screen.getByRole("button", { name: "Clear ANRs" });

    await act(async () => {
      fireEvent.click(clearButton);
    });

    await waitFor(
      () => {
        expect(filtersStore.getState().selectedErrorTypes).not.toContain("anr");
      },
      { timeout: 5000 },
    );
    // Errors should still be selected
    expect(filtersStore.getState().selectedErrorTypes).toContain("error");
  });

  it("clicking Errors pill X removes 'error' and clears severity + custom", async () => {
    await renderAndWaitForData();

    // Seed severities and custom so we can verify they get cleared
    await act(async () => {
      filtersStore.getState().setSelectedSeverities(["fatal"]);
      filtersStore.getState().setCustomErrorsOnly(true);
    });
    await waitFor(() => {
      expect(filtersStore.getState().selectedSeverities).toEqual(["fatal"]);
    });

    // The errors pill's aria-label is split on ":" — for "Errors - Custom, Fatal"
    // it has no colon, so the full label appears in aria-label.
    const clearButton = screen.getByRole("button", {
      name: /^Clear Errors - /,
    });

    await act(async () => {
      fireEvent.click(clearButton);
    });

    await waitFor(
      () => {
        const state = filtersStore.getState();
        expect(state.selectedErrorTypes).not.toContain("error");
        expect(state.selectedSeverities).toEqual([]);
        expect(state.customErrorsOnly).toBe(false);
      },
      { timeout: 5000 },
    );
  });
});
