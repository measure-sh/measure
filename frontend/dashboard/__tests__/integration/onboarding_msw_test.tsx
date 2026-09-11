import { mockRouter } from "@/__tests__/helpers/mock_router";
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

jest.mock("next/navigation", () => ({
  ...require("@/__tests__/helpers/mock_router").nextNavigationMock(),
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

jest.mock("@nivo/line", () => {
  const LineChartStub = () => <div data-testid="nivo-line-chart" />;
  return {
    __esModule: true,
    ResponsiveLine: LineChartStub,
    ResponsiveLineCanvas: LineChartStub,
  };
});

// --- MSW ---

import { makeAppFixture, makeMetricsFixture } from "../msw/fixtures";
import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// --- Store/component imports ---

import Overview from "@/app/components/overview";
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
  mockRouter.reset();
  window.localStorage.clear();
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <Overview params={{ teamId: "test-team" }} />
    </QueryClientProvider>,
  );
}

// The apps endpoint answers 404 for a team that has no apps.
function noAppsHandler() {
  return http.get("*/api/teams/:teamId/apps", () => {
    return new HttpResponse(null, { status: 404 });
  });
}

function appsListHandler(apps: any[]) {
  return http.get("*/api/teams/:teamId/apps", () => HttpResponse.json(apps));
}

function recordMetrics() {
  const sent: string[] = [];
  server.use(
    http.get("*/api/apps/:appId/metrics", ({ request }) => {
      sent.push(request.url);
      return HttpResponse.json(makeMetricsFixture());
    }),
  );
  return sent;
}

const freshApp = (overrides: Record<string, any>) =>
  makeAppFixture({
    onboarded: false,
    onboarded_at: null,
    ...overrides,
  });

describe("Onboarding (MSW integration)", () => {
  describe("a team with no apps", () => {
    it("puts the wizard on the page at its first step, and asks for no metrics", async () => {
      server.use(noAppsHandler());
      const metrics = recordMetrics();
      renderPage();

      await waitFor(() =>
        expect(screen.getByTestId("onboarding-step-create")).toBeTruthy(),
      );
      expect(screen.getByTestId("onboarding-app-name-input")).toBeTruthy();
      expect(screen.queryByTestId("filter-bar")).toBeNull();
      expect(metrics).toHaveLength(0);
    });

    it("moves to the integration step once the app is created, with that app's key", async () => {
      const created = freshApp({
        id: "app-fresh",
        name: "Fresh App",
        api_key: {
          key: "msr_fresh_key",
          revoked: false,
          created_at: "",
          last_seen: null,
        },
      });
      let exists = false;
      server.use(
        http.get("*/api/teams/:teamId/apps", () =>
          exists
            ? HttpResponse.json([created])
            : new HttpResponse(null, { status: 404 }),
        ),
        http.post("*/api/teams/:teamId/apps", () => {
          exists = true;
          return HttpResponse.json(created);
        }),
      );
      renderPage();

      await waitFor(() =>
        expect(screen.getByTestId("onboarding-step-create")).toBeTruthy(),
      );
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "Fresh App" },
      });
      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });

      const integrate = await screen.findByTestId("onboarding-step-integrate");
      expect(within(integrate).getByTestId("step-2-indicator")).toBeTruthy();
      expect(screen.getByTestId("snippet-manifest").textContent).toContain(
        "msr_fresh_key",
      );
      expect(filtersStore.getState().selectedApp?.id).toBe("app-fresh");
    });
  });

  describe("an app that has not reported an event", () => {
    it("puts the wizard under the app selector, and asks for no metrics", async () => {
      server.use(
        appsListHandler([
          freshApp({
            id: "app-not-onboarded",
            name: "My App",
            api_key: {
              key: "msr_integration_key",
              revoked: false,
              created_at: "",
              last_seen: null,
            },
          }),
        ]),
      );
      const metrics = recordMetrics();
      renderPage();

      await waitFor(() =>
        expect(screen.getByTestId("onboarding-step-integrate")).toBeTruthy(),
      );
      expect(screen.getByRole("button", { name: /My App/ })).toBeTruthy();
      // The snippet carries the real key only once the page has put the app
      // on the filters store, which is where the wizard reads it from.
      expect(screen.getByTestId("snippet-manifest").textContent).toContain(
        "msr_integration_key",
      );
      expect(metrics).toHaveLength(0);
    });
  });

  describe("an app that has reported one", () => {
    it("gets the filters and the page, with no wizard", async () => {
      const metrics = recordMetrics();
      renderPage();

      await waitFor(() => expect(screen.getByText("99.1%")).toBeTruthy(), {
        timeout: 5000,
      });
      expect(screen.getByTestId("filter-bar")).toBeTruthy();
      expect(screen.queryByTestId("onboarding")).toBeNull();
      expect(metrics).toHaveLength(1);
    });
  });
});
