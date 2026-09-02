/**
 * Integration tests for the User Journeys page.
 *
 * These cover the wiring between the page, the FilterBar and the journey
 * API: the request the page sends for what the bar settled on, the filter
 * expression a link carries, the plot type in the URL, and the error and
 * empty states. Chart rendering, the exceptions panel and node search are
 * covered by the component unit tests.
 */
import { mockRouter } from "@/__tests__/helpers/mock_router";
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

const mockRouterReplace = mockRouter.replaceMock;
const mockRouterPush = mockRouter.pushMock;

jest.mock("next/navigation", () => ({
  ...require("@/__tests__/helpers/mock_router").nextNavigationMock(),
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

// The filter pickers are Radix popovers, which need a resize observer and
// pointer capture that jsdom does not have.
(globalThis as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = jest.fn();
Element.prototype.hasPointerCapture = jest.fn(() => false);
Element.prototype.setPointerCapture = jest.fn();
Element.prototype.releasePointerCapture = jest.fn();

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

// --- Store/component imports ---
import UserJourneysPage from "@/app/[teamId]/journeys/page";
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

const appId = makeAppFixture().id;

beforeEach(() => {
  filtersStore = createFiltersStore();
  onboardingStore = createOnboardingStore();
  queryClient.clear();
  mockRouter.searchParams = new URLSearchParams();
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("Journeys page (MSW integration)", () => {
  function renderPage() {
    return renderWithProviders(
      <UserJourneysPage params={promiseParams({ teamId: "test-team" })} />,
    );
  }

  function recordJourneyRequests() {
    const sent: URL[] = [];
    server.use(
      http.get("*/api/apps/:appId/journey", ({ request }) => {
        sent.push(new URL(request.url));
        return HttpResponse.json(makeJourneyFixture());
      }),
    );
    return sent;
  }

  function recordKeysRequests() {
    const sent: URL[] = [];
    server.use(
      http.get("*/api/apps/:appId/filters/keys", ({ request }) => {
        sent.push(new URL(request.url));
        return;
      }),
    );
    return sent;
  }

  async function waitForChart() {
    await waitFor(
      () => expect(screen.getByTestId("nivo-sankey")).toBeTruthy(),
      { timeout: 5000 },
    );
  }

  const lastWrittenUrl = () =>
    new URLSearchParams(
      mockRouterReplace.mock.calls[
        mockRouterReplace.mock.calls.length - 1
      ][0].slice(1),
    );

  describe("opening the page", () => {
    it("draws the journey the server sent", async () => {
      renderPage();
      await waitForChart();

      expect(screen.getByTestId("sankey-node-MainActivity")).toBeTruthy();
      expect(screen.getByTestId("sankey-node-CartActivity")).toBeTruthy();
    });

    it("asks for the journey over the range it settled on", async () => {
      const sent = recordJourneyRequests();
      renderPage();
      await waitForChart();

      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(`/api/apps/${appId}/journey`);
      expect(sent[0].searchParams.get("from")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("to")).toMatch(/Z$/);
      expect(sent[0].searchParams.get("timezone")).toBeTruthy();
      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
      expect(sent[0].searchParams.has("bigraph")).toBe(false);
      expect(sent[0].searchParams.has("versions")).toBe(false);
      expect(sent[0].searchParams.has("filter_short_code")).toBe(false);
    });

    it("asks the keys endpoint for the journeys entity", async () => {
      const sent = recordKeysRequests();
      renderPage();
      await waitForChart();

      await waitFor(() => expect(sent.length).toBeGreaterThan(0));
      expect(sent[0].searchParams.get("entity")).toBe("journeys");
    });

    it("records the app and range it settled on in the URL, with no offset", async () => {
      renderPage();
      await waitForChart();

      const written = new URLSearchParams(
        mockRouterReplace.mock.calls[0][0].slice(1),
      );
      expect(written.get("a")).toBe(appId);
      expect(written.get("d")).toBe("Last 6 Hours");
      expect(written.get("sd")).toBeTruthy();
      expect(written.get("ed")).toBeTruthy();
      expect(written.has("po")).toBe(false);
      expect(written.has("jt")).toBe(false);
    });

    it("shows the tabs and the search input with the chart", async () => {
      renderPage();
      await waitForChart();

      expect(screen.getByRole("button", { name: "Paths" }).className).toContain(
        "bg-accent",
      );
      expect(screen.getByRole("button", { name: "Exceptions" })).toBeTruthy();
      expect(screen.getByPlaceholderText("Search nodes...")).toBeTruthy();
    });
  });

  describe("a link carrying a filter", () => {
    it("filters the journey by it", async () => {
      mockRouter.searchParams = new URLSearchParams(
        `filter_expr=${encodeURIComponent("version_name:in:3.1.0")}`,
      );
      const sent = recordJourneyRequests();
      renderPage();
      await waitForChart();

      expect(sent[0].searchParams.get("filter_expr")).toBe(
        "version_name:in:3.1.0",
      );
      expect(lastWrittenUrl().get("filter_expr")).toBe("version_name:in:3.1.0");
    });
  });

  describe("the plot type", () => {
    it("opens on the plot a link names and keeps it in the URL", async () => {
      mockRouter.searchParams = new URLSearchParams("jt=Exceptions");
      renderPage();
      await waitForChart();

      expect(
        screen.getByRole("button", { name: "Exceptions" }).className,
      ).toContain("bg-accent");
      expect(lastWrittenUrl().get("jt")).toBe("Exceptions");
      expect(lastWrittenUrl().get("a")).toBe(appId);
    });

    it("a tab click writes the plot type into the URL without refetching", async () => {
      const sent = recordJourneyRequests();
      renderPage();
      await waitForChart();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Exceptions" }));
      });

      expect(
        screen.getByRole("button", { name: "Exceptions" }).className,
      ).toContain("bg-accent");
      const written = lastWrittenUrl();
      expect(written.get("jt")).toBe("Exceptions");
      expect(written.get("a")).toBe(appId);
      expect(written.get("d")).toBe("Last 6 Hours");
      expect(screen.getByTestId("sankey-node-MainActivity")).toBeTruthy();

      await act(async () => {
        await new Promise((r) => setTimeout(r, 200));
      });
      expect(sent).toHaveLength(1);
    });
  });

  describe("when the server answers with nothing", () => {
    it("says there is no journey data", async () => {
      server.use(
        http.get("*/api/apps/:appId/journey", () => {
          return HttpResponse.json({ nodes: [], links: [], totalIssues: 0 });
        }),
      );
      renderPage();

      expect(await screen.findByText("No journey data")).toBeTruthy();
      expect(screen.queryByTestId("nivo-sankey")).toBeNull();
    });
  });

  describe("when the server fails", () => {
    it("shows the error message", async () => {
      server.use(
        http.get("*/api/apps/:appId/journey", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(await screen.findByText(/Error fetching journey/)).toBeTruthy();
      expect(screen.queryByTestId("nivo-sankey")).toBeNull();
    });

    it("shows a refused filter's issue in the bar, not the error message", async () => {
      mockRouter.searchParams = new URLSearchParams(
        `filter_expr=${encodeURIComponent("version_name:in:3.1.0")}`,
      );
      server.use(
        http.get("*/api/apps/:appId/journey", () => {
          return HttpResponse.json(
            {
              error: "invalid_filter_expr",
              filter_expr_issues: [
                {
                  message: 'Key "version_name" has no value "3.1.0"',
                  span: { start: 0, end: 21 },
                },
              ],
            },
            { status: 400 },
          );
        }),
      );
      renderPage();

      expect((await screen.findByTestId("filter-issue")).textContent).toContain(
        'Key "version_name" has no value "3.1.0"',
      );
      expect(screen.queryByText(/Error fetching journey/)).toBeNull();
    });

    it("says so when the team's apps cannot be fetched", async () => {
      server.use(
        http.get("*/api/teams/:teamId/apps", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(await screen.findByText(/Error fetching apps/)).toBeTruthy();
    });
  });

  describe("re-render", () => {
    it("re-render still shows data", async () => {
      const { unmount } = renderPage();
      await waitForChart();

      unmount();
      renderPage();
      await waitForChart();
    });
  });
});
