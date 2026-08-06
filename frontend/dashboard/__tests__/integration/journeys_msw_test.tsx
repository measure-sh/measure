/**
 * Integration tests for the User Journeys page.
 *
 * These cover the wiring between the page, the filters store, and the
 * journey API: refetches on filter and tab changes, request parameters,
 * URL sync, demo mode, and caching. Chart rendering, the exceptions
 * panel, and node search are covered by component unit tests.
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
  usePathname: () => "/test-team/journeys",
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

// Sankey chart needs real DOM layout. Stub with a data-testable div.
jest.mock("@nivo/sankey", () => ({
  __esModule: true,
  ResponsiveSankey: ({ data }: any) => (
    <div data-testid="nivo-sankey">
      {data?.nodes?.map((node: any) => (
        <span
          key={node.id}
          data-testid={`sankey-node-${node.id.split(".").pop()}`}
        >
          {node.id.split(".").pop()}
        </span>
      ))}
    </div>
  ),
}));

// --- MSW ---
import { makeAppFixture, makeJourneyFixture } from "../msw/fixtures";
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

// --- Store imports ---
import UserJourneys from "@/app/components/user_journeys";
import { createFiltersStore } from "@/app/stores/filters_store";
import { createOnboardingStore } from "@/app/stores/onboarding_store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let filtersStore = createFiltersStore();
let onboardingStore = createOnboardingStore();
let testQueryClient: QueryClient;

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
  const { queryClient: singletonClient } = require("@/app/query/query_client");
  singletonClient.clear();
  filtersStore = createFiltersStore();
  onboardingStore = createOnboardingStore();
  testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  filtersStore.getState().reset();
  for (const key of [...mockSearchParams.keys()]) mockSearchParams.delete(key);
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>,
  );
}

// ====================================================================
// PAGE LOAD
// ====================================================================
describe("Journeys page — page load", () => {
  it("shows error when journey API returns 500", async () => {
    server.use(
      http.get("*/api/apps/:appId/journey", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    renderWithProviders(<UserJourneys params={{ teamId: "test-team" }} />);
    await waitFor(
      () => {
        expect(screen.getByText(/Error fetching journey/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });
});

// ====================================================================
// FILTERS — app/version/date (same 3 as overview)
// ====================================================================
describe("Journeys page — filters", () => {
  const { AppVersion } = require("@/app/api/api_calls");

  let journeyRequests: { url: string }[];
  let shortFilterBodies: any[];

  beforeEach(() => {
    journeyRequests = [];
    shortFilterBodies = [];
    server.use(
      http.get("*/api/apps/:appId/journey", ({ request }) => {
        journeyRequests.push({ url: request.url });
        return HttpResponse.json(makeJourneyFixture());
      }),
      http.post("*/api/apps/:appId/shortFilters", async ({ request }) => {
        shortFilterBodies.push(await request.json());
        return HttpResponse.json({
          filter_short_code: `code-${shortFilterBodies.length}`,
        });
      }),
    );
  });

  async function renderAndWaitForChart() {
    renderWithProviders(<UserJourneys params={{ teamId: "test-team" }} />);
    await waitFor(
      () => expect(screen.getByTestId("nivo-sankey")).toBeTruthy(),
      { timeout: 5000 },
    );
  }

  it("version change triggers journey refetch", async () => {
    await renderAndWaitForChart();
    journeyRequests.length = 0;

    await act(async () => {
      filtersStore
        .getState()
        .setSelectedVersions([new AppVersion("3.0.2", "302")]);
    });

    await waitFor(() => expect(journeyRequests.length).toBeGreaterThan(0), {
      timeout: 5000,
    });
  });

  it("version change sends new version in shortFilters POST", async () => {
    await renderAndWaitForChart();
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

  it("date change triggers journey refetch", async () => {
    await renderAndWaitForChart();
    journeyRequests.length = 0;

    await act(async () => {
      const now = new Date();
      filtersStore.getState().setSelectedDateRange("Last Week");
      filtersStore
        .getState()
        .setSelectedStartDate(
          new Date(now.getTime() - 7 * 86400000).toISOString(),
        );
      filtersStore.getState().setSelectedEndDate(now.toISOString());
    });

    await waitFor(() => expect(journeyRequests.length).toBeGreaterThan(0), {
      timeout: 5000,
    });
  });

  it("filter_short_code appears in journey data-fetch URL", async () => {
    server.use(
      http.post("*/api/apps/:appId/shortFilters", () => {
        return HttpResponse.json({ filter_short_code: "journey-code-xyz" });
      }),
    );

    await renderAndWaitForChart();

    await waitFor(
      () => {
        const urlWithCode = journeyRequests.find((r) =>
          r.url.includes("filter_short_code="),
        );
        expect(urlWithCode?.url).toContain(
          "filter_short_code=journey-code-xyz",
        );
      },
      { timeout: 5000 },
    );
  });

  it("journey URL includes from/to/timezone params", async () => {
    await renderAndWaitForChart();

    expect(journeyRequests.length).toBeGreaterThan(0);
    const url = journeyRequests[0].url;
    expect(url).toContain("from=");
    expect(url).toContain("to=");
    expect(url).toContain("timezone=");
  });
});

// ====================================================================
// URL SYNC
// ====================================================================
describe("Journeys page — URL sync", () => {
  it("version change updates URL with version param", async () => {
    const { AppVersion } = require("@/app/api/api_calls");
    renderWithProviders(<UserJourneys params={{ teamId: "test-team" }} />);
    await waitFor(
      () => expect(screen.getByTestId("nivo-sankey")).toBeTruthy(),
      { timeout: 5000 },
    );
    mockRouterReplace.mockClear();

    await act(async () => {
      filtersStore
        .getState()
        .setSelectedVersions([new AppVersion("3.0.1", "301")]);
    });

    await waitFor(
      () => {
        expect(mockRouterReplace).toHaveBeenCalled();
        const url =
          mockRouterReplace.mock.calls[
            mockRouterReplace.mock.calls.length - 1
          ][0];
        expect(url).toContain("v=");
      },
      { timeout: 5000 },
    );
  });
});

// ====================================================================
// DEMO MODE
// ====================================================================
describe("Journeys page — demo mode", () => {
  it("renders without API calls", async () => {
    const apiCalls: string[] = [];
    server.use(
      http.get("*", ({ request }) => {
        apiCalls.push(request.url);
        return HttpResponse.json({});
      }),
      http.post("*", ({ request }) => {
        apiCalls.push(request.url);
        return HttpResponse.json({});
      }),
    );

    renderWithProviders(<UserJourneys demo={true} />);
    expect(screen.getByText("User Journeys")).toBeTruthy();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    expect(apiCalls.length).toBe(0);
  });
});

// ====================================================================
// STORE CACHE
// ====================================================================
describe("Journeys page — caching", () => {
  it("re-mount still shows data", async () => {
    const { unmount } = renderWithProviders(
      <UserJourneys params={{ teamId: "test-team" }} />,
    );
    await waitFor(
      () => expect(screen.getByTestId("nivo-sankey")).toBeTruthy(),
      { timeout: 5000 },
    );

    unmount();
    renderWithProviders(<UserJourneys params={{ teamId: "test-team" }} />);
    await waitFor(
      () => expect(screen.getByTestId("nivo-sankey")).toBeTruthy(),
      { timeout: 5000 },
    );
  });

  it("Paths→Exceptions→Paths: each switch refetches (single-value cache)", async () => {
    // The journey store uses a single cachedFetchKey (not a map),
    // so switching back to Paths after Exceptions is a cache MISS
    // because the Exceptions fetch overwrote the cached key.
    // This pins the current behavior.
    let fetchCount = 0;
    server.use(
      http.get("*/api/apps/:appId/journey", () => {
        fetchCount++;
        return HttpResponse.json(makeJourneyFixture());
      }),
    );

    renderWithProviders(<UserJourneys params={{ teamId: "test-team" }} />);
    await waitFor(
      () => expect(screen.getByTestId("nivo-sankey")).toBeTruthy(),
      { timeout: 5000 },
    );
    expect(fetchCount).toBe(1); // Initial Paths

    await act(async () => {
      fireEvent.click(screen.getByText("Exceptions"));
    });
    await waitFor(() => expect(fetchCount).toBe(2), { timeout: 5000 }); // Exceptions

    await act(async () => {
      fireEvent.click(screen.getByText("Paths"));
    });
    await waitFor(() => expect(fetchCount).toBe(3), { timeout: 5000 }); // Paths again (cache miss)
  });
});

// ====================================================================
// DIFFERENT DATA PER APP
// ====================================================================
describe("Journeys page — different journey data per app", () => {
  it("switching app renders different nodes", async () => {
    const app1 = makeAppFixture({ id: "app-1", name: "Alpha" });
    const app2 = makeAppFixture({ id: "app-2", name: "Beta" });

    server.use(
      http.get("*/api/teams/:teamId/apps", () => {
        return HttpResponse.json([app1, app2]);
      }),
      http.get("*/api/apps/:appId/journey", ({ params }) => {
        if (params.appId === "app-2") {
          return HttpResponse.json({
            nodes: [
              { id: "com.beta.ScreenA", issues: { crashes: [], anrs: [] } },
              { id: "com.beta.ScreenB", issues: { crashes: [], anrs: [] } },
            ],
            links: [
              {
                source: "com.beta.ScreenA",
                target: "com.beta.ScreenB",
                value: 100,
              },
            ],
            totalIssues: 0,
          });
        }
        return HttpResponse.json(makeJourneyFixture());
      }),
    );

    renderWithProviders(<UserJourneys params={{ teamId: "test-team" }} />);
    await waitFor(
      () => expect(screen.getByTestId("nivo-sankey")).toBeTruthy(),
      { timeout: 5000 },
    );

    // App 1 has 4 nodes
    expect(screen.getByTestId("sankey-node-MainActivity")).toBeTruthy();

    // Switch to app 2
    await act(async () => {
      filtersStore.getState().setSelectedApp(app2 as any);
    });

    await waitFor(
      () => {
        // App 2 has different nodes
        expect(screen.getByTestId("sankey-node-ScreenA")).toBeTruthy();
        expect(screen.getByTestId("sankey-node-ScreenB")).toBeTruthy();
      },
      { timeout: 5000 },
    );

    // App 1 nodes should be gone
    expect(screen.queryByTestId("sankey-node-MainActivity")).toBeNull();
  });
});

// ====================================================================
// DATE CHANGE does NOT fire shortFilters POST
// ====================================================================
describe("Journeys page — date change and shortFilters", () => {
  it("date change does NOT fire a new shortFilters POST", async () => {
    const shortFilterBodies: any[] = [];
    server.use(
      http.post("*/api/apps/:appId/shortFilters", async ({ request }) => {
        shortFilterBodies.push(await request.json());
        return HttpResponse.json({
          filter_short_code: `code-${shortFilterBodies.length}`,
        });
      }),
    );

    renderWithProviders(<UserJourneys params={{ teamId: "test-team" }} />);
    await waitFor(
      () => expect(screen.getByTestId("nivo-sankey")).toBeTruthy(),
      { timeout: 5000 },
    );

    const postsBefore = shortFilterBodies.length;

    await act(async () => {
      const now = new Date();
      filtersStore.getState().setSelectedDateRange("Last Month");
      filtersStore
        .getState()
        .setSelectedStartDate(
          new Date(now.getTime() - 30 * 86400000).toISOString(),
        );
      filtersStore.getState().setSelectedEndDate(now.toISOString());
    });

    // Wait for journey refetch to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(shortFilterBodies.length).toBe(postsBefore);
  });
});
