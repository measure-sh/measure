/**
 * Integration tests for the User Journeys page.
 *
 * These cover the wiring between the page, the FilterBar and the journey
 * API: the request the page sends for what the bar settled on, the filter
 * expression a link carries, the list requests a selected node or link
 * sends, and the error and empty states. The graph's layout, highlighting
 * and panning are covered by the component unit tests.
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

// The filter pickers, which are Radix popovers, and the journey graph need a
// resize observer and pointer capture, which jsdom lacks.
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

beforeAll(() => server.listen({ onUnhandledFrame: "warn" }));
afterEach(() => {
  server.resetHandlers();
  mockRouterPush.mockClear();
});
afterAll(() => server.close());

// --- Store/component imports ---
import JourneysPage from "@/app/[teamId]/journeys/page";
import { layOut, linkPath } from "@/app/components/journey/graph_layout";
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
  mockRouter.reset();
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
      <JourneysPage params={promiseParams({ teamId: "test-team" })} />,
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

  function recordListRequests() {
    const sent: URL[] = [];
    server.use(
      http.get("*/api/apps/:appId/journey/:list", ({ request }) => {
        sent.push(new URL(request.url));
        return;
      }),
    );
    return sent;
  }

  async function waitForChart() {
    await screen.findByText("MainActivity", {}, { timeout: 5000 });
  }

  const nodeGroup = (shortName: string) =>
    screen
      .getAllByText(shortName)
      .find((el) => el.tagName === "text")!
      .closest("g")!;

  // Each link draws a visible path and then a wider, invisible one that takes
  // the pointer, both along the curve the layout gives the link.
  function linkHitPath(source: string, target: string) {
    const { boxes } = layOut(makeJourneyFixture() as any);
    const d = linkPath(boxes.get(source)!, boxes.get(target)!);
    return document.querySelectorAll(`path[d="${d}"]`)[1];
  }

  const lastWrittenUrl = () => new URLSearchParams(window.location.search);

  describe("opening the page", () => {
    it("draws the journey the server sent", async () => {
      renderPage();
      await waitForChart();

      expect(screen.getByText("ProductListActivity")).toBeTruthy();
      expect(screen.getByText("search_submitted")).toBeTruthy();
      expect(screen.getByText("CartActivity")).toBeTruthy();
      expect(nodeGroup("Fatal error")).toBeTruthy();
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
      expect(sent[0].searchParams.has("versions")).toBe(false);
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

      const written = new URLSearchParams(window.location.search);
      expect(written.get("a")).toBe(appId);
      expect(written.get("d")).toBe("Last 6 Hours");
      expect(written.get("sd")).toBeNull();
      expect(written.get("ed")).toBeNull();
      expect(written.has("po")).toBe(false);
    });

    it("fetches no lists until something is selected", async () => {
      const sent = recordListRequests();
      renderPage();
      await waitForChart();

      await act(async () => {
        await new Promise((r) => setTimeout(r, 200));
      });
      expect(sent).toHaveLength(0);
    });
  });

  describe("a link carrying a filter", () => {
    it("filters the journey by it", async () => {
      mockRouter.setUrl(
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

  describe("selecting", () => {
    it("lists the errors at a clicked node and the traces once that tab opens", async () => {
      const sent = recordListRequests();
      renderPage();
      await waitForChart();

      await act(async () => {
        fireEvent.click(nodeGroup("ProductListActivity"));
      });

      expect(
        await screen.findByRole("link", {
          name: "ProductActivity.kt: onAddToCart()",
        }),
      ).toBeTruthy();
      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(`/api/apps/${appId}/journey/errors`);
      expect(sent[0].searchParams.get("node")).toBe(
        "sh.measure.demo.ProductListActivity",
      );
      expect(sent[0].searchParams.get("limit")).toBe("5");
      expect(sent[0].searchParams.get("offset")).toBe("0");

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Traces" }));
      });

      expect(
        await screen.findByRole("link", { name: "product_list_load" }),
      ).toBeTruthy();
      const traces = sent.find((url) => url.pathname.endsWith("/traces"))!;
      expect(traces.searchParams.get("node")).toBe(
        "sh.measure.demo.ProductListActivity",
      );
      expect(traces.searchParams.get("quantile")).toBe("p50");
    });

    it("lists the errors along a clicked link", async () => {
      const sent = recordListRequests();
      renderPage();
      await waitForChart();

      await act(async () => {
        fireEvent.click(
          linkHitPath("sh.measure.demo.ProductListActivity", "fatal"),
        );
      });

      expect(
        await screen.findByText(
          "Errors, traces, network requests and session replays between ProductListActivity and the fatal error.",
        ),
      ).toBeTruthy();
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0].searchParams.get("source")).toBe(
        "sh.measure.demo.ProductListActivity",
      );
      expect(sent[0].searchParams.get("target")).toBe("fatal");
      expect(sent[0].searchParams.has("node")).toBe(false);
    });

    it("writes the selection to the URL", async () => {
      renderPage();
      await waitForChart();

      await act(async () => {
        fireEvent.click(nodeGroup("CartActivity"));
      });

      expect(
        await screen.findByText(
          "Errors, traces, network requests and session replays between CartActivity and all immediate next steps.",
        ),
      ).toBeTruthy();
      expect(new URLSearchParams(window.location.search).get("jn")).toBe(
        "sh.measure.demo.CartActivity",
      );
    });

    it("restores a selection, its list, quantile and page from the URL", async () => {
      mockRouter.setUrl(
        "jn=sh.measure.demo.CartActivity&jl=Traces&jq=p95&jot=5",
      );
      const sent = recordListRequests();
      renderPage();
      await waitForChart();

      expect(
        await screen.findByText(
          "Errors, traces, network requests and session replays between CartActivity and all immediate next steps.",
        ),
      ).toBeTruthy();
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0].pathname).toMatch(/\/journey\/traces$/);
      expect(sent[0].searchParams.get("node")).toBe(
        "sh.measure.demo.CartActivity",
      );
      expect(sent[0].searchParams.get("quantile")).toBe("p95");
      expect(sent[0].searchParams.get("offset")).toBe("5");
    });

    it("ignores a selection in the URL that the journey doesn't have and removes it", async () => {
      mockRouter.setUrl("jn=sh.measure.demo.MissingActivity");
      const sent = recordListRequests();
      renderPage();
      await waitForChart();

      await act(async () => {
        await new Promise((r) => setTimeout(r, 200));
      });
      expect(sent).toHaveLength(0);
      expect(screen.queryByText(/Errors, traces, network requests/)).toBeNull();
      expect(new URLSearchParams(window.location.search).has("jn")).toBe(false);
    });
  });

  describe("when the server answers with nothing", () => {
    it("says there is no journey data", async () => {
      server.use(
        http.get("*/api/apps/:appId/journey", () => {
          return HttpResponse.json({ nodes: [], links: [] });
        }),
      );
      renderPage();

      expect(await screen.findByText("No journeys found")).toBeTruthy();
      expect(screen.queryByText("MainActivity")).toBeNull();
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
      expect(screen.queryByText("MainActivity")).toBeNull();
    });

    it("shows the server's message when the journey is over the query limits", async () => {
      server.use(
        http.get("*/api/apps/:appId/journey", () =>
          HttpResponse.json(
            {
              error:
                "This query is larger than the current processing limits allow. Try a shorter date range or narrower filters, or run it again later.",
            },
            { status: 422 },
          ),
        ),
      );
      renderPage();

      expect(
        await screen.findByText(
          "This query is larger than the current processing limits allow. Try a shorter date range or narrower filters, or run it again later.",
        ),
      ).toBeTruthy();
      expect(screen.queryByText(/Error fetching journey/)).toBeNull();
    });

    it("shows a refused filter's issue in the bar, not the error message", async () => {
      mockRouter.setUrl(
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
