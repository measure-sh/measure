import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

// The sidebar reads window.matchMedia through useIsMobile, and jsdom does
// not implement it, so rendering the layout without this stub throws.
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
const mockUsePathname = jest.fn();
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

let mockIsCloud = false;
jest.mock("@/app/utils/env_utils", () => ({
  __esModule: true,
  isCloud: () => mockIsCloud,
}));

jest.mock("@/app/api/api_client", () => ({
  __esModule: true,
  apiClient: { init: jest.fn() },
}));

// The layout resets the filters store before navigating to another team;
// a stub registry is enough since store behavior is not under test here.
const mockFiltersReset = jest.fn();
jest.mock("@/app/stores/provider", () => ({
  __esModule: true,
  useMeasureStoreRegistry: () => ({
    filtersStore: { getState: () => ({ reset: mockFiltersReset }) },
  }),
}));

// The layout drives its rendering off useTeamsQuery's { data, status };
// each test sets the return value directly instead of going through
// react-query and the network.
const mockUseTeamsQuery = jest.fn();
jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useTeamsQuery: () => mockUseTeamsQuery(),
  signOut: jest.fn(),
}));

// Child components with their own test suites are stubbed out so this
// suite only exercises the layout's wiring around them.
jest.mock("@/app/components/app_breadcrumbs", () => ({
  __esModule: true,
  default: () => <div data-testid="breadcrumbs-mock" />,
}));

jest.mock("@/app/components/theme_toggle", () => ({
  __esModule: true,
  ThemeToggle: () => <div data-testid="theme-toggle-mock" />,
}));

jest.mock("@/app/components/usage_threshold_banner", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/app/components/user_avatar", () => ({
  __esModule: true,
  default: () => <div data-testid="user-avatar-mock" />,
}));

jest.mock("@/app/components/team_switcher", () => ({
  __esModule: true,
  default: () => <div data-testid="team-switcher-mock" />,
  TeamsSwitcherStatus: {
    Loading: "loading",
    Success: "success",
    Error: "error",
  },
}));

import DashboardLayout from "@/app/[teamId]/layout";

const teams = [
  { id: "team-001", name: "Test Team" },
  { id: "team-002", name: "Other Team" },
];

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

function layoutJsx() {
  return (
    <TestNotFoundBoundary>
      <DashboardLayout>
        <div data-testid="page-content">Page Content</div>
      </DashboardLayout>
    </TestNotFoundBoundary>
  );
}

function renderLayout() {
  return render(layoutJsx());
}

beforeEach(() => {
  mockUsePathname.mockReturnValue("/team-001/overview");
  mockUseTeamsQuery.mockReturnValue({ data: teams, status: "success" });
  mockIsCloud = false;
  // The 404 tests render into the error boundary; React logs the caught
  // error to console.error, which would otherwise clutter the output.
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("Dashboard Layout — navigation", () => {
  it("renders all navigation section headings", () => {
    renderLayout();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Issues")).toBeInTheDocument();
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders Dashboard nav items", () => {
    renderLayout();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Session Replays")).toBeInTheDocument();
    expect(screen.getByText("Journeys")).toBeInTheDocument();
  });

  it("renders Issues nav items", () => {
    renderLayout();
    expect(screen.getByText("Errors")).toBeInTheDocument();
    expect(screen.getByText("Bug Reports")).toBeInTheDocument();
    expect(screen.getByText("Alerts")).toBeInTheDocument();
  });

  it("renders Performance nav items", () => {
    renderLayout();
    expect(screen.getByText("Traces")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
  });

  it("renders Settings nav items", () => {
    renderLayout();
    expect(screen.getByText("Apps")).toBeInTheDocument();
    expect(screen.getByText("Builds")).toBeInTheDocument();
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    // Self-hosted mode shows "Usage", not "Usage & Billing"
    expect(screen.getByText("Usage")).toBeInTheDocument();
    expect(screen.queryByText("Usage & Billing")).not.toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
  });

  it('renders Settings nav "Usage" item as "Usage & Billing" in cloud mode', () => {
    mockIsCloud = true;
    renderLayout();
    expect(screen.getByText("Usage & Billing")).toBeInTheDocument();
    expect(screen.queryByText("Usage")).not.toBeInTheDocument();
    // The link still points to /usage; only the label depends on the env
    const usageLink = screen.getByText("Usage & Billing").closest("a");
    expect(usageLink?.getAttribute("href")).toBe("/team-001/usage");
  });

  it("nav links point to correct team-scoped URLs", () => {
    renderLayout();
    const overviewLink = screen.getByText("Overview").closest("a");
    expect(overviewLink?.getAttribute("href")).toBe("/team-001/overview");

    const errorsLink = screen.getByText("Errors").closest("a");
    expect(errorsLink?.getAttribute("href")).toBe("/team-001/errors");

    const tracesLink = screen.getByText("Traces").closest("a");
    expect(tracesLink?.getAttribute("href")).toBe("/team-001/traces");
  });

  it("Support link is external (not team-scoped)", () => {
    renderLayout();
    const supportLink = screen.getByText("Support").closest("a");
    expect(supportLink?.getAttribute("href")).toBe(
      "https://discord.gg/f6zGkBCt42",
    );
  });

  it("clicking nav item calls router.push with correct path", () => {
    renderLayout();
    fireEvent.click(screen.getByText("Errors"));
    expect(mockRouterPush).toHaveBeenCalledWith("/team-001/errors");
  });

  it("renders children in main content area", () => {
    renderLayout();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.getByText("Page Content")).toBeInTheDocument();
  });

  it("shows skeleton loading when teams are loading", () => {
    mockUseTeamsQuery.mockReturnValue({ data: undefined, status: "pending" });
    renderLayout();
    expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
  });
});

describe("Dashboard Layout — active sidebar item", () => {
  it('marks "Overview" as active when pathname is /team-001/overview', () => {
    renderLayout();
    const overviewLink = screen.getByText("Overview").closest("a");
    expect(overviewLink?.getAttribute("data-active")).toBe("true");
  });

  it("other nav items are NOT active when pathname is /team-001/overview", () => {
    renderLayout();
    const errorsLink = screen.getByText("Errors").closest("a");
    expect(errorsLink?.getAttribute("data-active")).not.toBe("true");

    const tracesLink = screen.getByText("Traces").closest("a");
    expect(tracesLink?.getAttribute("data-active")).not.toBe("true");

    const appsLink = screen.getByText("Apps").closest("a");
    expect(appsLink?.getAttribute("data-active")).not.toBe("true");
  });

  it("clicking a nav item marks it as active", async () => {
    renderLayout();
    expect(
      screen.getByText("Errors").closest("a")?.getAttribute("data-active"),
    ).not.toBe("true");

    fireEvent.click(screen.getByText("Errors"));

    await waitFor(() => {
      expect(
        screen.getByText("Errors").closest("a")?.getAttribute("data-active"),
      ).toBe("true");
    });
  });

  it("clicking a different nav item deactivates the previous one", async () => {
    renderLayout();
    expect(
      screen.getByText("Overview").closest("a")?.getAttribute("data-active"),
    ).toBe("true");

    fireEvent.click(screen.getByText("Traces"));

    await waitFor(() => {
      expect(
        screen.getByText("Traces").closest("a")?.getAttribute("data-active"),
      ).toBe("true");
      expect(
        screen.getByText("Overview").closest("a")?.getAttribute("data-active"),
      ).not.toBe("true");
    });
  });
});

describe("Dashboard Layout — team switching", () => {
  it("after team switch, nav links point to the new team", async () => {
    const { rerender } = renderLayout();
    expect(
      screen.getByText("Overview").closest("a")?.getAttribute("href"),
    ).toBe("/team-001/overview");

    // Simulate team switch navigation completing (pathname changes)
    mockUsePathname.mockReturnValue("/team-002/overview");
    rerender(layoutJsx());

    await waitFor(() => {
      expect(
        screen.getByText("Overview").closest("a")?.getAttribute("href"),
      ).toBe("/team-002/overview");
      expect(
        screen.getByText("Errors").closest("a")?.getAttribute("href"),
      ).toBe("/team-002/errors");
      expect(
        screen.getByText("Traces").closest("a")?.getAttribute("href"),
      ).toBe("/team-002/traces");
    });
  });

  it("after team switch, clicking a nav item navigates within the new team", async () => {
    const { rerender } = renderLayout();

    mockUsePathname.mockReturnValue("/team-002/overview");
    rerender(layoutJsx());

    await waitFor(() => {
      expect(
        screen.getByText("Overview").closest("a")?.getAttribute("href"),
      ).toBe("/team-002/overview");
    });

    fireEvent.click(screen.getByText("Errors"));
    expect(mockRouterPush).toHaveBeenCalledWith("/team-002/errors");
  });

  it("switching back to original team updates nav links again", async () => {
    const { rerender } = renderLayout();

    mockUsePathname.mockReturnValue("/team-002/overview");
    rerender(layoutJsx());

    await waitFor(() => {
      expect(
        screen.getByText("Overview").closest("a")?.getAttribute("href"),
      ).toBe("/team-002/overview");
    });

    mockUsePathname.mockReturnValue("/team-001/overview");
    rerender(layoutJsx());

    await waitFor(() => {
      expect(
        screen.getByText("Overview").closest("a")?.getAttribute("href"),
      ).toBe("/team-001/overview");
    });
  });
});

describe("Dashboard Layout — unknown team in URL", () => {
  it("renders the 404 page when the URL names a team the user is not a member of", () => {
    mockUsePathname.mockReturnValue("/team-999/team");
    renderLayout();
    expect(mockNotFound).toHaveBeenCalled();
    expect(screen.getByTestId("not-found-page")).toBeInTheDocument();
    // The layout subtree, including the page, is replaced by the boundary
    expect(screen.queryByTestId("page-content")).not.toBeInTheDocument();
  });

  it("renders the 404 page for a malformed team id", () => {
    mockUsePathname.mockReturnValue("/not-a-valid-id/overview");
    renderLayout();
    expect(screen.getByTestId("not-found-page")).toBeInTheDocument();
  });

  it("404s when client navigation moves from a valid team to an unknown one", async () => {
    const { rerender } = renderLayout();
    expect(screen.getByText("Overview")).toBeInTheDocument();

    // Same shape as the Slack OAuth error redirect: an in-app landing on
    // /{teamId}/team for a team outside the user's teams list
    mockUsePathname.mockReturnValue("/team-999/team");
    await act(async () => {
      rerender(layoutJsx());
    });

    await waitFor(() => {
      expect(screen.getByTestId("not-found-page")).toBeInTheDocument();
    });
  });

  it("does not 404 for a team the user is a member of", () => {
    renderLayout();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(screen.queryByTestId("not-found-page")).not.toBeInTheDocument();
  });
});

describe("Dashboard Layout — header", () => {
  it("renders sidebar trigger button", () => {
    renderLayout();
    const trigger = screen.getByRole("button", { name: /toggle sidebar/i });
    expect(trigger).toBeInTheDocument();
  });
});
