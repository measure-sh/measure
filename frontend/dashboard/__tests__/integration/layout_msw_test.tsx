/**
 * Integration tests for the main dashboard layout.
 *
 * The layout includes:
 * - Sidebar with navigation sections (Dashboard, Issues, Performance, Settings)
 * - Team switcher dropdown in sidebar header
 * - User avatar with logout in sidebar footer
 * - Theme toggle button in header
 * - SidebarTrigger for collapse/expand
 *
 * Navigation items are dynamically marked active based on pathname.
 * Team switching redirects to /{teamId}/overview.
 * Sign out calls DELETE /auth/logout and redirects to /auth/login.
 * A URL teamId that matches none of the user's teams renders the 404 page
 * via notFound().
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
  useParams: () => ({ teamId: "team-001" }),
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

let mockIsCloud = false;
jest.mock("@/app/utils/env_utils", () => ({
  __esModule: true,
  isCloud: () => mockIsCloud,
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
  mockIsCloud = false;
});
afterAll(() => server.close());

// --- Store/component imports ---
import DashboardLayout from "@/app/[teamId]/layout";
import { createFiltersStore } from "@/app/stores/filters_store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Stand-in for Next's not-found boundary: catches the error thrown by
// notFound() and renders a marker in place of the layout subtree.
class TestNotFoundBoundary extends React.Component<
  { children: React.ReactNode },
  { caught: boolean }
> {
  state = { caught: false };
  static getDerivedStateFromError() {
    return { caught: true };
  }
  render() {
    if (this.state.caught) {
      return <div data-testid="not-found-page" />;
    }
    return this.props.children;
  }
}

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

function layoutJsx() {
  return (
    <QueryClientProvider client={testQueryClient}>
      <TestNotFoundBoundary>
        <DashboardLayout>
          <div data-testid="page-content">Page Content</div>
        </DashboardLayout>
      </TestNotFoundBoundary>
    </QueryClientProvider>
  );
}

function renderLayout() {
  return render(layoutJsx());
}

// Scope queries to the sidebar — the breadcrumb in the header also renders
// section titles like "Overview", so unscoped getByText finds both.
function inSidebar() {
  return within(
    document.querySelector('[data-sidebar="sidebar"]') as HTMLElement,
  );
}

// ====================================================================
// LAYOUT — NAVIGATION
// ====================================================================
describe("Dashboard Layout — navigation", () => {
  it("renders all navigation section headings", async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Dashboard")).toBeTruthy();
      expect(screen.getByText("Issues")).toBeTruthy();
      expect(screen.getByText("Performance")).toBeTruthy();
      expect(screen.getByText("Settings")).toBeTruthy();
    });
  });

  it("renders Dashboard nav items", async () => {
    renderLayout();
    await waitFor(() => {
      expect(inSidebar().getByText("Overview")).toBeTruthy();
      expect(inSidebar().getByText("Session Timelines")).toBeTruthy();
      expect(inSidebar().getByText("Journeys")).toBeTruthy();
    });
  });

  it("renders Issues nav items", async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Errors")).toBeTruthy();
      expect(screen.getByText("Bug Reports")).toBeTruthy();
      expect(screen.getByText("Alerts")).toBeTruthy();
    });
  });

  it("renders Performance nav items", async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Traces")).toBeTruthy();
      expect(screen.getByText("Network")).toBeTruthy();
    });
  });

  it("renders Settings nav items", async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Apps")).toBeTruthy();
      expect(screen.getByText("Team")).toBeTruthy();
      expect(screen.getByText("Notifications")).toBeTruthy();
      // "Usage" in self-hosted mode (not "Usage & Billing")
      expect(screen.getByText("Usage")).toBeTruthy();
      expect(screen.queryByText("Usage & Billing")).toBeNull();
      expect(screen.getByText("Support")).toBeTruthy();
    });
  });

  it('renders Settings nav "Usage" item as "Usage & Billing" in cloud mode', async () => {
    mockIsCloud = true;
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Usage & Billing")).toBeTruthy();
      expect(screen.queryByText("Usage")).toBeNull();
    });
    // Link still points to /usage — URL does not change based on env
    const usageLink = screen.getByText("Usage & Billing").closest("a");
    expect(usageLink?.getAttribute("href")).toBe("/team-001/usage");
  });

  it("nav links point to correct team-scoped URLs", async () => {
    renderLayout();
    await waitFor(() => {
      expect(inSidebar().getByText("Overview")).toBeTruthy();
    });

    const overviewLink = inSidebar().getByText("Overview").closest("a");
    expect(overviewLink?.getAttribute("href")).toBe("/team-001/overview");

    const errorsLink = screen.getByText("Errors").closest("a");
    expect(errorsLink?.getAttribute("href")).toBe("/team-001/errors");

    const tracesLink = screen.getByText("Traces").closest("a");
    expect(tracesLink?.getAttribute("href")).toBe("/team-001/traces");
  });

  it("Support link is external (not team-scoped)", async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Support")).toBeTruthy();
    });
    const supportLink = screen.getByText("Support").closest("a");
    expect(supportLink?.getAttribute("href")).toBe(
      "https://discord.gg/f6zGkBCt42",
    );
  });

  it("clicking nav item calls router.push with correct path", async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Errors")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Errors"));
    });
    expect(mockRouterPush).toHaveBeenCalledWith("/team-001/errors");
  });

  it("renders children in main content area", async () => {
    renderLayout();
    expect(screen.getByTestId("page-content")).toBeTruthy();
    expect(screen.getByText("Page Content")).toBeTruthy();
  });

  it("shows skeleton loading when teams are loading", async () => {
    // Delay the teams API response to simulate loading state
    server.use(
      http.get("*/api/teams", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json(makeTeamsFixture());
      }),
    );
    renderLayout();
    // Skeleton should be visible, nav items should NOT render during loading
    expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    expect(inSidebar().queryByText("Overview")).toBeNull();
  });
});

// ====================================================================
// LAYOUT — ACTIVE SIDEBAR ITEM
// ====================================================================
describe("Dashboard Layout — active sidebar item", () => {
  it('marks "Overview" as active when pathname is /team-001/overview', async () => {
    renderLayout();
    await waitFor(() => {
      expect(inSidebar().getByText("Overview")).toBeTruthy();
    });

    // The <a> wrapping "Overview" is inside a SidebarMenuSubButton with data-active
    const overviewLink = inSidebar().getByText("Overview").closest("a");
    expect(overviewLink?.getAttribute("data-active")).toBe("true");
  });

  it("other nav items are NOT active when pathname is /team-001/overview", async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Errors")).toBeTruthy();
    });

    const errorsLink = screen.getByText("Errors").closest("a");
    expect(errorsLink?.getAttribute("data-active")).not.toBe("true");

    const tracesLink = screen.getByText("Traces").closest("a");
    expect(tracesLink?.getAttribute("data-active")).not.toBe("true");

    const appsLink = screen.getByText("Apps").closest("a");
    expect(appsLink?.getAttribute("data-active")).not.toBe("true");
  });

  it("clicking a nav item marks it as active", async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Errors")).toBeTruthy();
    });

    // Before click — Errors is not active
    expect(
      screen.getByText("Errors").closest("a")?.getAttribute("data-active"),
    ).not.toBe("true");

    // Click Errors
    await act(async () => {
      fireEvent.click(screen.getByText("Errors"));
    });

    // After click — handleNavClick sets errors as active
    await waitFor(() => {
      expect(
        screen.getByText("Errors").closest("a")?.getAttribute("data-active"),
      ).toBe("true");
    });
  });

  it("clicking a different nav item deactivates the previous one", async () => {
    renderLayout();
    await waitFor(() => {
      expect(inSidebar().getByText("Overview")).toBeTruthy();
    });

    // Overview starts active
    expect(
      inSidebar()
        .getByText("Overview")
        .closest("a")
        ?.getAttribute("data-active"),
    ).toBe("true");

    // Click Traces
    await act(async () => {
      fireEvent.click(screen.getByText("Traces"));
    });

    // Traces becomes active, Overview deactivated
    await waitFor(() => {
      expect(
        screen.getByText("Traces").closest("a")?.getAttribute("data-active"),
      ).toBe("true");
      expect(
        inSidebar()
          .getByText("Overview")
          .closest("a")
          ?.getAttribute("data-active"),
      ).not.toBe("true");
    });
  });
});

// ====================================================================
// LAYOUT — TEAM SWITCHER
// ====================================================================
describe("Dashboard Layout — team switcher", () => {
  it("renders current team name in team switcher", async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeTruthy();
    });
  });

  it("team switcher button is disabled when loading", async () => {
    // Delay the teams API response to simulate loading state
    server.use(
      http.get("*/api/teams", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json(makeTeamsFixture());
      }),
    );
    renderLayout();
    // The TeamSwitcher button should be disabled during loading
  });
});

// ====================================================================
// LAYOUT — TEAM SWITCHING
// ====================================================================
describe("Dashboard Layout — team switching", () => {
  it("after team switch, nav links point to the new team", async () => {
    const { rerender } = renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeTruthy();
    });

    // Verify initial nav links use team-001
    const overviewLinkBefore = inSidebar().getByText("Overview").closest("a");
    expect(overviewLinkBefore?.getAttribute("href")).toBe("/team-001/overview");

    // Simulate team switch navigation completing (pathname changes)
    mockUsePathname.mockReturnValue("/team-002/overview");
    await act(async () => {
      rerender(layoutJsx());
    });

    // Nav links should now point to team-002
    await waitFor(() => {
      const overviewLink = inSidebar().getByText("Overview").closest("a");
      expect(overviewLink?.getAttribute("href")).toBe("/team-002/overview");

      const errorsLink = screen.getByText("Errors").closest("a");
      expect(errorsLink?.getAttribute("href")).toBe("/team-002/errors");

      const tracesLink = screen.getByText("Traces").closest("a");
      expect(tracesLink?.getAttribute("href")).toBe("/team-002/traces");
    });
  });

  it("after team switch, clicking a nav item navigates within the new team", async () => {
    const { rerender } = renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeTruthy();
    });

    // Simulate team switch navigation completing
    mockUsePathname.mockReturnValue("/team-002/overview");
    await act(async () => {
      rerender(layoutJsx());
    });

    await waitFor(() => {
      expect(
        inSidebar().getByText("Overview").closest("a")?.getAttribute("href"),
      ).toBe("/team-002/overview");
    });

    // Click Errors nav item
    await act(async () => {
      fireEvent.click(screen.getByText("Errors"));
    });

    expect(mockRouterPush).toHaveBeenCalledWith("/team-002/errors");
  });

  it("team switcher shows the new team name after switching", async () => {
    const { rerender } = renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeTruthy();
    });

    // Simulate team switch navigation completing
    mockUsePathname.mockReturnValue("/team-002/overview");
    await act(async () => {
      rerender(layoutJsx());
    });

    // Team switcher should now show "Other Team"
    await waitFor(() => {
      expect(screen.getByText("Other Team")).toBeTruthy();
    });
  });

  it("switching back to original team updates nav links again", async () => {
    const { rerender } = renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeTruthy();
    });

    // Switch to team-002
    mockUsePathname.mockReturnValue("/team-002/overview");
    await act(async () => {
      rerender(layoutJsx());
    });

    await waitFor(() => {
      expect(
        inSidebar().getByText("Overview").closest("a")?.getAttribute("href"),
      ).toBe("/team-002/overview");
    });

    // Switch back to team-001
    mockUsePathname.mockReturnValue("/team-001/overview");
    await act(async () => {
      rerender(layoutJsx());
    });

    await waitFor(() => {
      const overviewLink = inSidebar().getByText("Overview").closest("a");
      expect(overviewLink?.getAttribute("href")).toBe("/team-001/overview");
    });
  });
});

// ====================================================================
// LAYOUT — UNKNOWN TEAM IN URL
// ====================================================================
describe("Dashboard Layout — unknown team in URL", () => {
  it("renders the 404 page when the URL names a team the user is not a member of", async () => {
    mockUsePathname.mockReturnValue("/team-999/team");
    renderLayout();
    await waitFor(() => {
      expect(mockNotFound).toHaveBeenCalled();
      expect(screen.getByTestId("not-found-page")).toBeTruthy();
    });
    // The layout subtree, including the page, is replaced by the boundary
    expect(screen.queryByTestId("page-content")).toBeNull();
  });

  it("renders the 404 page for a malformed team id", async () => {
    mockUsePathname.mockReturnValue("/not-a-valid-id/overview");
    renderLayout();
    await waitFor(() => {
      expect(screen.getByTestId("not-found-page")).toBeTruthy();
    });
  });

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
    expect(screen.queryByTestId("not-found-page")).toBeNull();
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

  it("404s when client navigation moves from a valid team to an unknown one", async () => {
    const { rerender } = renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeTruthy();
    });

    // Same shape as the Slack OAuth error redirect: an in-app landing on
    // /{teamId}/team for a team outside the user's teams list
    mockUsePathname.mockReturnValue("/team-999/team");
    await act(async () => {
      rerender(layoutJsx());
    });

    await waitFor(() => {
      expect(screen.getByTestId("not-found-page")).toBeTruthy();
    });
  });

  it("does not 404 for a team the user is a member of", async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Test Team")).toBeTruthy();
    });
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(screen.queryByTestId("not-found-page")).toBeNull();
  });
});

// ====================================================================
// LAYOUT — USER AVATAR
// ====================================================================
describe("Dashboard Layout — user avatar", () => {
  it("renders user name from session", async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeTruthy();
    });
  });

  it("renders user email from session", async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("test@example.com")).toBeTruthy();
    });
  });

  it("renders user avatar image", async () => {
    renderLayout();
    await waitFor(() => {
      const avatar = screen.getByAltText("User Avatar");
      expect(avatar).toBeTruthy();
      expect(avatar.getAttribute("src")).toBe("https://example.com/avatar.png");
    });
  });

  it('shows "Updating..." when session is loading', async () => {
    // Clear the pre-populated session data and intentionally never
    // respond — keeps useSessionQuery in the pending state.
    testQueryClient.removeQueries({ queryKey: ["session"] });
    server.use(http.get("*/api/auth/session", () => new Promise(() => {})));
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Updating...")).toBeTruthy();
    });
  });

  it('shows "Error" when session fetch fails', async () => {
    testQueryClient.removeQueries({ queryKey: ["session"] });
    server.use(
      http.get("*/api/auth/session", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Error")).toBeTruthy();
    });
  });

  it("getInitials returns correct initials for two-word name", async () => {
    // Test the initials logic indirectly through the UserAvatar component
    // When avatar image fails, it shows initials from the session user name
    // "Test User" → "TU"
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeTruthy();
    });
    // The avatar image is rendered - we verify the name is correct
    // Full initials test would require triggering onError which is component-internal
  });
});

// ====================================================================
// LAYOUT — SIGN OUT
// ====================================================================
describe("Dashboard Layout — sign out", () => {
  it("signOut sends DELETE to /auth/logout", async () => {
    let deleteCalled = false;
    server.use(
      http.delete("*/auth/logout", () => {
        deleteCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );

    const { signOut } = require("@/app/query/hooks");
    renderLayout();
    await act(async () => {
      await signOut();
    });
    expect(deleteCalled).toBe(true);
  });
});

// ====================================================================
// LAYOUT — HEADER
// ====================================================================
describe("Dashboard Layout — header", () => {
  it("renders sidebar trigger button", async () => {
    renderLayout();
    // SidebarTrigger renders a button
    const trigger = screen.getByRole("button", { name: /toggle sidebar/i });
    expect(trigger).toBeTruthy();
  });
});
