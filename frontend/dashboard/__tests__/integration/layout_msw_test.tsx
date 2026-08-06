/**
 * Integration tests for the main dashboard layout's handling of the teams
 * fetch lifecycle. While the teams request is pending the layout renders
 * skeletons, and when it fails the layout shows an error message; in both
 * states the URL teamId cannot be validated yet, so the layout must not
 * call notFound() even when the URL names an unknown team.
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
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

// --- jsdom polyfills ---
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

if (typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// --- External dependency mocks ---

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    reset: jest.fn(),
    capture: jest.fn(),
    init: jest.fn(),
    group: jest.fn(),
  },
}));

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
const mockUsePathname = jest.fn().mockReturnValue("/team-001/overview");
// The real notFound() throws an error that Next's not-found boundary
// catches; the mock throws too so the render aborts the same way.
const mockNotFound = jest.fn(() => {
  throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
});
jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => mockUsePathname(),
  notFound: () => mockNotFound(),
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
  useTheme: () => ({ theme: "light", setTheme: jest.fn() }),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

jest.mock("@/app/utils/env_utils", () => ({
  __esModule: true,
  isCloud: () => false,
}));

// --- MSW ---
import { makeTeamsFixture } from "../msw/fixtures";
import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  mockRouterReplace.mockClear();
  mockRouterPush.mockClear();
  mockNotFound.mockClear();
  mockUsePathname.mockReturnValue("/team-001/overview");
});
afterAll(() => server.close());

// --- Store/component imports ---
import DashboardLayout from "@/app/[teamId]/layout";
import { createFiltersStore } from "@/app/stores/filters_store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

let testQueryClient: QueryClient;
let filtersStore = createFiltersStore();

jest.mock("@/app/stores/provider", () => {
  const { useStore } = require("zustand");
  return {
    __esModule: true,
    useMeasureStoreRegistry: () => ({ filtersStore }),
    useFiltersStore: (selector?: any) =>
      useStore(filtersStore, selector ?? ((s: any) => s)),
  };
});

beforeEach(() => {
  filtersStore = createFiltersStore();
  testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });

  // Pre-populate the session cache so useSessionQuery resolves without
  // hitting /auth/session.
  testQueryClient.setQueryData(["session"], {
    user: {
      id: "user-001",
      own_team_id: "team-001",
      name: "Test User",
      email: "test@example.com",
      avatar_url: "https://example.com/avatar.png",
      confirmed_at: "2026-01-01T00:00:00Z",
      last_sign_in_at: "2026-04-10T12:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-04-10T00:00:00Z",
    },
  });
});

function renderLayout() {
  return render(
    <QueryClientProvider client={testQueryClient}>
      <DashboardLayout>
        <div data-testid="page-content">Page Content</div>
      </DashboardLayout>
    </QueryClientProvider>,
  );
}

describe("Dashboard Layout — unknown team in URL", () => {
  it("does not 404 while teams are still loading", async () => {
    server.use(
      http.get("*/api/teams", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json(makeTeamsFixture());
      }),
    );
    mockUsePathname.mockReturnValue("/team-999/overview");
    renderLayout();
    // Skeletons stay up during the pending state, no premature 404
    expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("does not 404 when the teams fetch fails", async () => {
    server.use(
      http.get("*/api/teams", () => HttpResponse.json({}, { status: 500 })),
    );
    mockUsePathname.mockReturnValue("/team-999/overview");
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText(/Error fetching teams/)).toBeTruthy();
    });
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});
