/**
 * Integration test for the Onboarding flow rendered inside Filters.
 *
 * Verifies the wiring of <Onboarding /> from the empty-state branches of
 * filters.tsx through real Zustand stores, real TanStack Query, and MSW
 * for the network boundary. Covers:
 *   - Zero apps in team → Onboarding Step 1 renders
 *   - Step 1 form submission → app created → flow advances to Step 2
 *   - App exists but not onboarded → Onboarding starts at Step 2
 *   - Polling detects onboarded flag flip and shows success card
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
  usePathname: () => "/test-team/overview",
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

// --- MSW + fixtures ---

import { makeAppFixture } from "../msw/fixtures";
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

// --- Stores ---

import Overview from "@/app/components/overview";
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
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
  filtersStore = createFiltersStore();
  onboardingStore = createOnboardingStore();
  testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
  filtersStore.getState().reset();
  for (const key of [...mockSearchParams.keys()]) {
    mockSearchParams.delete(key);
  }
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>,
  );
}

// --- Common MSW overrides ---

function noAppsHandler() {
  return http.get("*/api/teams/:teamId/apps", () => {
    return new HttpResponse(null, { status: 404 });
  });
}

function appsListHandler(apps: any[]) {
  return http.get("*/api/teams/:teamId/apps", () => {
    return HttpResponse.json(apps);
  });
}

function notOnboardedFiltersHandler() {
  // The filters API returns 200 with versions:null to signal NotOnboarded
  // (the api_calls helper checks selectedApp.onboarded to disambiguate
  // NotOnboarded from NoData). versions:null + selectedApp.onboarded=false
  // → FiltersApiStatus.NotOnboarded.
  return http.get("*/api/apps/:appId/filters", () => {
    return HttpResponse.json({
      versions: null,
      os_versions: null,
      countries: null,
      network_providers: null,
      network_types: null,
      network_generations: null,
      locales: null,
      device_manufacturers: null,
      device_names: null,
      ud_attrs: null,
    });
  });
}

function createAppHandler(returned: any) {
  return http.post("*/api/teams/:teamId/apps", () => {
    return HttpResponse.json(returned);
  });
}

// ============================================================
// Tests
// ============================================================

describe("Onboarding (MSW integration)", () => {
  describe("Zero apps in team", () => {
    beforeEach(() => {
      server.use(noAppsHandler());
    });

    it("renders Onboarding Step 1 on a data page", async () => {
      renderWithProviders(<Overview params={{ teamId: "test-team" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("onboarding-step-create")).toBeTruthy();
      });
      expect(screen.getByTestId("onboarding-app-name-input")).toBeTruthy();
    });

    it("does not render the integrate or verify steps initially", async () => {
      renderWithProviders(<Overview params={{ teamId: "test-team" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("onboarding-step-create")).toBeTruthy();
      });
      expect(screen.queryByTestId("onboarding-step-integrate")).toBeNull();
      expect(screen.queryByTestId("onboarding-step-verify")).toBeNull();
    });
  });

  describe("App exists but not onboarded", () => {
    beforeEach(() => {
      server.use(
        appsListHandler([
          makeAppFixture({
            id: "app-not-onboarded",
            name: "My App",
            onboarded: false,
            api_key: {
              key: "msr_integration_key",
              revoked: false,
              created_at: "",
              last_seen: null,
            },
          }),
        ]),
        notOnboardedFiltersHandler(),
      );
    });

    it("renders Onboarding starting at Step 2 (integrate)", async () => {
      renderWithProviders(<Overview params={{ teamId: "test-team" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("onboarding-step-integrate")).toBeTruthy();
      });
      expect(screen.queryByTestId("onboarding-step-create")).toBeNull();
    });

    it("embeds the real API key in the Android manifest snippet", async () => {
      renderWithProviders(<Overview params={{ teamId: "test-team" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("snippet-manifest")).toBeTruthy();
      });
      expect(screen.getByTestId("snippet-manifest").textContent).toContain(
        "msr_integration_key",
      );
    });

    it("selects the app in the filters store so onboarding can read its API key", async () => {
      renderWithProviders(<Overview params={{ teamId: "test-team" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("onboarding-step-integrate")).toBeTruthy();
      });
      // The manifest snippet only renders the real API key when
      // filtersStore.selectedApp has been populated by the fetchApps →
      // selectApp chain. Verifying the key is present proves the chain ran.
      expect(screen.getByTestId("snippet-manifest").textContent).toContain(
        "msr_integration_key",
      );
    });
  });

  describe("Create app from Step 1 advances flow", () => {
    it("creates the app, refreshes the store, and shows Step 2", async () => {
      // Sequence of GET responses: first call returns 404 (no apps),
      // subsequent calls return the newly-created not-onboarded app.
      let appsCallCount = 0;
      const newApp = makeAppFixture({
        id: "app-fresh",
        name: "Fresh App",
        onboarded: false,
        api_key: {
          key: "msr_fresh_key",
          revoked: false,
          created_at: "",
          last_seen: null,
        },
      });

      server.use(
        http.get("*/api/teams/:teamId/apps", () => {
          appsCallCount += 1;
          if (appsCallCount === 1) {
            return new HttpResponse(null, { status: 404 });
          }
          return HttpResponse.json([newApp]);
        }),
        createAppHandler(newApp),
        notOnboardedFiltersHandler(),
      );

      renderWithProviders(<Overview params={{ teamId: "test-team" }} />);

      await waitFor(() => {
        expect(screen.getByTestId("onboarding-step-create")).toBeTruthy();
      });

      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "Fresh App" },
      });

      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("onboarding-step-integrate")).toBeTruthy();
      });

      expect(screen.getByTestId("snippet-manifest").textContent).toContain(
        "msr_fresh_key",
      );
    });
  });

  describe("Polling detects onboarded flip", () => {
    it("advances to verified state when the onboarded flag flips", async () => {
      let appsCallCount = 0;
      const baseApp = {
        id: "app-poll",
        name: "Poll App",
        api_key: {
          key: "msr_poll_key",
          revoked: false,
          created_at: "",
          last_seen: null,
        },
      };

      server.use(
        http.get("*/api/teams/:teamId/apps", () => {
          appsCallCount += 1;
          // Initial fetch + first verify-step poll return not-onboarded.
          // Subsequent polls return onboarded.
          const onboarded = appsCallCount >= 3;
          return HttpResponse.json([makeAppFixture({ ...baseApp, onboarded })]);
        }),
        // The onboarding poller probes /filters after the apps endpoint
        // confirms onboarded. Mirror the flip here so the pipeline appears
        // to catch up at the same poll cycle.
        http.get("*/api/apps/:appId/filters", () => {
          if (appsCallCount >= 3) {
            return HttpResponse.json({
              versions: [{ name: "1.0.0", code: "1" }],
              os_versions: [],
              countries: [],
              network_providers: [],
              network_types: [],
              network_generations: [],
              locales: [],
              device_manufacturers: [],
              device_names: [],
              ud_attrs: null,
            });
          }
          return HttpResponse.json({
            versions: null,
            os_versions: null,
            countries: null,
            network_providers: null,
            network_types: null,
            network_generations: null,
            locales: null,
            device_manufacturers: null,
            device_names: null,
            ud_attrs: null,
          });
        }),
      );

      renderWithProviders(<Overview params={{ teamId: "test-team" }} />);

      // Wait for initial fetch chain to settle using real timers, then
      // switch to fake timers for the polling phase.
      await waitFor(() => {
        expect(screen.getByTestId("onboarding-step-integrate")).toBeTruthy();
      });

      jest.useFakeTimers({ doNotFake: ["queueMicrotask"] });
      try {
        await act(async () => {
          fireEvent.click(screen.getByTestId("onboarding-next-button"));
        });
        await act(async () => {
          await jest.advanceTimersByTimeAsync(0);
        });

        expect(screen.getByTestId("onboarding-waiting")).toBeTruthy();

        // Advance through poll cycles until success card renders.
        // The fake server flips onboarded on the third call.
        await act(async () => {
          await jest.advanceTimersByTimeAsync(3000);
        });
        await act(async () => {
          await jest.advanceTimersByTimeAsync(3000);
        });

        expect(screen.getByTestId("onboarding-success")).toBeTruthy();
        expect(
          screen.getByTestId("onboarding-view-dashboard-button"),
        ).toBeTruthy();
      } finally {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      }
    });
  });
});
