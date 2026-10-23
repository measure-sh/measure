/**
 * Integration tests for the wiring between the Funnels overview/detail pages
 * and the server: request paths, query parameters and bodies, the state the
 * URL carries, the mutations for pins, order, edits and deletes, and the
 * caches they refresh. How the pages render each state is covered by the
 * component tests in __tests__/components/funnel/.
 *
 * Unique to funnels:
 *   - the overview has no date range or filter, only a name search
 *   - pinned funnels show a card each, with metrics from the weekly trend
 *   - the detail page switches between the conversion funnel over the date
 *     range and a trend over a fixed span, and lists what happens between
 *     two chosen steps
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
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { DateTime } from "luxon";
import { http, HttpResponse } from "msw";

// --- External dependency mocks ---

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}));

const mockRouterPush = mockRouter.pushMock;

jest.mock("next/navigation", () => ({
  ...require("@/__tests__/helpers/mock_router").nextNavigationMock(),
  usePathname: () => "/test-team/funnels",
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

// The chart stubs render a button per point, bar or step for tests to click.
jest.mock("@nivo/line", () => {
  const LineChartStub = ({ data, onClick, axisLeft }: any) => (
    <div data-testid="nivo-line-chart">
      <span>{axisLeft?.legend}</span>
      {data?.map((s: any) => (
        <span key={s.id} data-testid={`chart-series-${s.id}`}>
          {s.data?.map((d: any) => (
            <button
              key={d.index}
              data-testid={`chart-point-${s.id}-${d.index}`}
              onClick={() => onClick?.({ seriesId: s.id, data: d })}
            />
          ))}
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
  ResponsiveBarCanvas: ({ data, onClick }: any) => (
    <div data-testid="nivo-bar-canvas">
      {data?.map((d: any, index: number) => (
        <button
          key={index}
          data-testid={`weekly-bar-${index}`}
          onClick={(event) => onClick?.({ index }, event)}
        >
          {d.conversion}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@nivo/funnel", () => ({
  __esModule: true,
  ResponsiveFunnel: ({ data, onClick }: any) => (
    <div data-testid="nivo-funnel">
      {data?.map((d: any) => (
        <button
          key={d.id}
          data-testid={`funnel-part-${d.id}`}
          onClick={() => onClick?.({ data: d })}
        >
          {d.label}: {d.value}
        </button>
      ))}
    </div>
  ),
}));

// The app picker, step picker and editor are Radix popovers and dialogs,
// which need a resize observer and pointer capture that jsdom does not have.
(globalThis as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = jest.fn();
window.scrollTo = jest.fn();
Element.prototype.hasPointerCapture = jest.fn(() => false);
Element.prototype.setPointerCapture = jest.fn();
Element.prototype.releasePointerCapture = jest.fn();

// --- MSW ---
import {
  makeAppFixture,
  makeFunnelFixture,
  makeFunnelsFixture,
  makeFunnelsPage2Fixture,
  makeFunnelStepNetworkFixture,
  makeFunnelStepTracesFixture,
  makePinnedFunnelsFixture,
  makeSearchToCartFunnelFixture,
  makeSearchToOrderFunnelFixture,
} from "../msw/fixtures";
import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  mockRouterPush.mockClear();
});
afterAll(() => server.close());

// --- Store/component imports ---
import FunnelDetailsPage from "@/app/[teamId]/funnels/[appId]/[funnelId]/page";
import FunnelsPage from "@/app/[teamId]/funnels/page";
import { Toaster } from "@/app/components/toast";
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
const checkout = makeFunnelFixture();
const searchToCart = makeSearchToCartFunnelFixture();
const searchToOrder = makeSearchToOrderFunnelFixture();
const funnelsBase = `/api/apps/${appId}/funnels`;

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
    <QueryClientProvider client={queryClient}>
      {ui}
      <Toaster />
    </QueryClientProvider>,
  );
}

type SentRequest = { url: URL; body: any };

// Records requests to a funnel endpoint, then lets the default handler answer
// unless `respond` returns a response. `path` follows /api/apps/:appId/funnels.
function record(
  method: "get" | "put" | "post" | "patch" | "delete",
  path: string,
  respond?: (sent: SentRequest) => Response | undefined,
) {
  const sent: SentRequest[] = [];
  server.use(
    http[method](
      `*/api/apps/:appId/funnels${path}`,
      async ({ request, params }) => {
        // /funnels/:funnelId also matches the fixed /pinned and /events paths.
        if (params.funnelId === "pinned" || params.funnelId === "events") {
          return;
        }
        const text = await request.clone().text();
        const entry = {
          url: new URL(request.url),
          body: text === "" ? null : JSON.parse(text),
        };
        sent.push(entry);
        return respond?.(entry);
      },
    ),
  );
  return sent;
}

function serverError(message: string) {
  return HttpResponse.json({ error: message }, { status: 500 });
}

function pinnedCardNames() {
  return Array.from(document.querySelectorAll(".bg-card")).map(
    (card) => card.querySelector("p")!.textContent,
  );
}

// Waits long enough for a request the page should not send to arrive.
async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
}

// ====================================================================
// FUNNELS OVERVIEW
// ====================================================================
describe("Funnels Overview (MSW integration)", () => {
  function renderPage() {
    return renderWithProviders(
      <FunnelsPage params={promiseParams({ teamId: "test-team" })} />,
    );
  }

  async function waitForFunnels() {
    await waitFor(
      () => expect(screen.getByText("Search to cart")).toBeTruthy(),
      { timeout: 5000 },
    );
  }

  function table() {
    return within(screen.getByRole("table"));
  }

  function row(name: string) {
    return within(
      table().getByRole("link", { name }).closest("tr") as HTMLElement,
    );
  }

  // A card is the only place outside the table that shows a funnel's name.
  function pinnedCard(name: string) {
    const title = screen
      .getAllByText(name)
      .find((el) => el.closest("table") === null)!;
    return within(title.closest(".bg-card") as HTMLElement);
  }

  // Keeps pin state, so the list and the pinned funnels reflect pins and
  // unpins.
  function servePins(initial: string[]) {
    let pinnedIds = [...initial];
    const all = [checkout, searchToCart, searchToOrder];
    const withPin = (funnel: typeof checkout) => ({
      ...funnel,
      pinned: pinnedIds.includes(funnel.id),
      pin_order: pinnedIds.includes(funnel.id)
        ? pinnedIds.indexOf(funnel.id)
        : null,
    });
    server.use(
      http.get("*/api/apps/:appId/funnels", () =>
        HttpResponse.json({
          meta: { next: false, previous: false },
          results: all.map(withPin),
        }),
      ),
      http.get("*/api/apps/:appId/funnels/pinned", () =>
        HttpResponse.json({
          results: pinnedIds.map((id) =>
            withPin(all.find((funnel) => funnel.id === id)!),
          ),
        }),
      ),
    );
    const pins = record("put", "/:funnelId/pin", ({ url }) => {
      const id = url.pathname.split("/").at(-2)!;
      pinnedIds = [...pinnedIds, id];
      return HttpResponse.json(withPin(all.find((f) => f.id === id)!));
    });
    const unpins = record("delete", "/:funnelId/pin", ({ url }) => {
      const id = url.pathname.split("/").at(-2)!;
      pinnedIds = pinnedIds.filter((pinnedId) => pinnedId !== id);
      return HttpResponse.json(withPin(all.find((f) => f.id === id)!));
    });
    return { pins, unpins };
  }

  describe("opening the page", () => {
    it("lists the funnels the server sent, linked to their pages", async () => {
      renderPage();
      await waitForFunnels();

      const checkoutRow = row("Checkout");
      expect(checkoutRow.getByText("1 day")).toBeTruthy();
      expect(checkoutRow.getByText("test@example.com")).toBeTruthy();
      expect(checkoutRow.getAllByText("order_placed").length).toBeGreaterThan(
        0,
      );

      expect(
        table()
          .getByRole("link", { name: "Search to cart" })
          .getAttribute("href"),
      ).toBe(
        `/test-team/funnels/${appId}/funnel-002?from=funnels_overview_list`,
      );
    });

    it("asks for the app's first page of funnels and its pinned funnels", async () => {
      const lists = record("get", "");
      const pinned = record("get", "/pinned");
      renderPage();
      await waitForFunnels();

      expect(lists).toHaveLength(1);
      expect(lists[0].url.pathname).toBe(funnelsBase);
      expect(lists[0].url.searchParams.get("limit")).toBe("5");
      expect(lists[0].url.searchParams.get("offset")).toBe("0");
      expect(lists[0].url.searchParams.has("search")).toBe(false);
      expect(pinned).toHaveLength(1);
      expect(pinned[0].url.pathname).toBe(`${funnelsBase}/pinned`);
    });

    it("records the app it settled on in the URL", async () => {
      renderPage();
      await waitForFunnels();

      expect(new URLSearchParams(window.location.search).get("a")).toBe(appId);
    });
  });

  describe("pinned funnels", () => {
    it("shows a card per pinned funnel, in the pinned order", async () => {
      renderPage();
      await waitForFunnels();

      expect(pinnedCardNames()).toEqual(["Checkout", "Search to order"]);
      expect(
        pinnedCard("Search to order").getByText("Conversion window: 2 hours"),
      ).toBeTruthy();
      expect(
        screen
          .getAllByRole("link", { name: "Search to order" })[0]
          .getAttribute("href"),
      ).toBe(
        `/test-team/funnels/${appId}/funnel-003?from=funnels_overview_pinned`,
      );
    });

    it("asks for each pinned funnel's weekly trend", async () => {
      const trends = record("get", "/:funnelId/trend");
      renderPage();
      await waitForFunnels();

      await waitFor(() => expect(trends).toHaveLength(2));
      expect(trends.map((sent) => sent.url.pathname).sort()).toEqual([
        `${funnelsBase}/funnel-001/trend`,
        `${funnelsBase}/funnel-003/trend`,
      ]);
      for (const sent of trends) {
        expect(sent.url.searchParams.get("period")).toBe("week");
        expect(sent.url.searchParams.get("timezone")).toBeTruthy();
        expect(sent.url.searchParams.has("filter_expr")).toBe(false);
        expect(sent.url.searchParams.has("from")).toBe(false);
        expect(sent.url.searchParams.has("builds")).toBe(false);
      }
    });

    it("shows each card's conversion from that funnel's own trend", async () => {
      renderPage();
      await waitForFunnels();

      expect(await pinnedCard("Checkout").findByText("5.6%")).toBeTruthy();
      expect(
        await pinnedCard("Search to order").findByText("3.2%"),
      ).toBeTruthy();
    });

    it("opens the funnel over a week when its bar is clicked", async () => {
      renderPage();
      await waitForFunnels();

      const card = pinnedCard("Checkout");
      fireEvent.click(await card.findByTestId("weekly-bar-2"));

      const start = DateTime.fromISO("2026-03-30");
      const params = new URLSearchParams({
        d: "Custom Range",
        sd: start.toISO()!,
        ed: start.plus({ week: 1 }).toISO()!,
      });
      expect(mockRouterPush).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).toHaveBeenCalledWith(
        `/test-team/funnels/${appId}/funnel-001?from=funnels_overview_pinned&${params}`,
      );
    });
  });

  describe("pinning and unpinning", () => {
    it("pins a listed funnel and shows its card", async () => {
      const { pins } = servePins([checkout.id]);
      renderPage();
      await waitForFunnels();

      await act(async () => {
        fireEvent.click(
          row("Search to cart").getByRole("button", { name: "Pin funnel" }),
        );
      });

      await waitFor(() =>
        expect(pinnedCardNames()).toEqual(["Checkout", "Search to cart"]),
      );
      expect(pins).toHaveLength(1);
      expect(pins[0].url.pathname).toBe(`${funnelsBase}/funnel-002/pin`);
      expect(
        row("Search to cart")
          .getByRole("button", { name: "Unpin funnel" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
    });

    it("unpins a funnel from its card and removes the card", async () => {
      const { unpins } = servePins([checkout.id, searchToOrder.id]);
      renderPage();
      await waitForFunnels();
      await waitFor(() =>
        expect(pinnedCardNames()).toEqual(["Checkout", "Search to order"]),
      );

      await act(async () => {
        fireEvent.click(
          pinnedCard("Search to order").getByRole("button", {
            name: "Unpin funnel",
          }),
        );
      });

      await waitFor(() => expect(pinnedCardNames()).toEqual(["Checkout"]));
      expect(unpins).toHaveLength(1);
      expect(unpins[0].url.pathname).toBe(`${funnelsBase}/funnel-003/pin`);
      expect(
        row("Search to order").getByRole("button", { name: "Pin funnel" }),
      ).toBeTruthy();
    });

    it("says why when the server refuses a pin", async () => {
      record("put", "/:funnelId/pin", () =>
        serverError("An app can pin at most 10 funnels"),
      );
      renderPage();
      await waitForFunnels();

      await act(async () => {
        fireEvent.click(
          row("Search to cart").getByRole("button", { name: "Pin funnel" }),
        );
      });

      expect(
        await screen.findByText(
          "Error pinning funnel: An app can pin at most 10 funnels",
        ),
      ).toBeTruthy();
      expect(pinnedCardNames()).toEqual(["Checkout", "Search to order"]);
    });
  });

  describe("reordering pinned funnels", () => {
    async function startReorder() {
      renderPage();
      await waitForFunnels();
      const reorder = await screen.findByRole("button", {
        name: "Reorder pinned funnels",
      });
      await waitFor(() =>
        expect((reorder as HTMLButtonElement).disabled).toBe(false),
      );
      fireEvent.click(reorder);
    }

    it("shows the new order while it saves, then the order the server answers with", async () => {
      let answer!: (response: Response) => void;
      const answered = new Promise<Response>((resolve) => {
        answer = resolve;
      });
      const puts: SentRequest[] = [];
      server.use(
        http.put("*/api/apps/:appId/funnels/pinned", async ({ request }) => {
          puts.push({
            url: new URL(request.url),
            body: await request.json(),
          });
          return answered;
        }),
      );
      await startReorder();

      fireEvent.click(
        screen.getByRole("button", { name: "Move Search to order up" }),
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save order" }));
      });

      await waitFor(() => expect(puts).toHaveLength(1));
      expect(puts[0].url.pathname).toBe(`${funnelsBase}/pinned`);
      expect(puts[0].body).toEqual({
        funnel_ids: ["funnel-003", "funnel-001"],
      });
      expect(screen.queryByRole("button", { name: "Save order" })).toBeNull();
      expect(pinnedCardNames()).toEqual(["Search to order", "Checkout"]);

      // A teammate pinned another funnel before the save reached the server.
      await act(async () => {
        answer(
          HttpResponse.json({
            results: [
              searchToOrder,
              checkout,
              { ...searchToCart, pinned: true },
            ],
          }),
        );
      });

      await waitFor(() =>
        expect(pinnedCardNames()).toEqual([
          "Search to order",
          "Checkout",
          "Search to cart",
        ]),
      );
    });

    it("says a teammate changed the pins and shows the server's order when the save conflicts", async () => {
      record("put", "/pinned", () =>
        HttpResponse.json(
          { error: "Pinned funnels have changed" },
          { status: 409 },
        ),
      );
      const pinnedGets = record("get", "/pinned");
      await startReorder();

      fireEvent.click(
        screen.getByRole("button", { name: "Move Search to order up" }),
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save order" }));
      });

      expect(
        await screen.findByText(
          "A teammate changed the pinned funnels before your order was saved, please try again",
        ),
      ).toBeTruthy();
      await waitFor(() => expect(pinnedGets).toHaveLength(2));
      await waitFor(() =>
        expect(pinnedCardNames()).toEqual(["Checkout", "Search to order"]),
      );
    });
  });

  describe("searching", () => {
    // Matches names case-insensitively, like the server.
    function serveSearch() {
      return record("get", "", ({ url }) => {
        const search = (url.searchParams.get("search") ?? "").toLowerCase();
        return HttpResponse.json({
          meta: { next: false, previous: false },
          results: [checkout, searchToCart, searchToOrder].filter((funnel) =>
            funnel.name.toLowerCase().includes(search),
          ),
        });
      });
    }

    it("asks for the funnels matching what is typed, from the first page", async () => {
      mockRouter.setUrl("po=5");
      const lists = serveSearch();
      renderPage();
      await waitForFunnels();
      expect(lists[0].url.searchParams.get("offset")).toBe("5");

      fireEvent.change(screen.getByPlaceholderText("Search funnels..."), {
        target: { value: "search" },
      });

      await waitFor(() => expect(lists).toHaveLength(2), { timeout: 3000 });
      expect(lists[1].url.searchParams.get("search")).toBe("search");
      expect(lists[1].url.searchParams.get("offset")).toBe("0");
      await waitFor(() =>
        expect(table().queryByRole("link", { name: "Checkout" })).toBeNull(),
      );
      expect(
        table().getByRole("link", { name: "Search to order" }),
      ).toBeTruthy();
      const written = new URLSearchParams(window.location.search);
      expect(written.get("q")).toBe("search");
      expect(written.get("po")).toBe("0");
    });

    it("restores the search a link carries", async () => {
      mockRouter.setUrl("q=search");
      const lists = serveSearch();
      renderPage();
      await waitForFunnels();

      expect(lists[0].url.searchParams.get("search")).toBe("search");
      expect(
        (screen.getByPlaceholderText("Search funnels...") as HTMLInputElement)
          .value,
      ).toBe("search");
    });
  });

  describe("picking another app", () => {
    it("asks for the new app's funnels, pinned funnels and trends from the first page", async () => {
      const secondApp = makeAppFixture({
        id: "c6a4f9b2-7d3e-4a0b-9f8c-2b3c4d5e6f70",
        name: "measure spare",
      });
      server.use(
        http.get("*/api/teams/:teamId/apps", () =>
          HttpResponse.json([makeAppFixture(), secondApp]),
        ),
      );
      const lists = record("get", "");
      const pinned = record("get", "/pinned");
      const trends = record("get", "/:funnelId/trend");
      mockRouter.setUrl("po=5");
      renderPage();
      await waitForFunnels();
      await waitFor(() => expect(trends).toHaveLength(2));

      await act(async () => {
        fireEvent.click(screen.getByText("measure demo").closest("button")!);
      });
      await act(async () => {
        fireEvent.click(await screen.findByText(secondApp.name));
      });

      const secondBase = `/api/apps/${secondApp.id}/funnels`;
      await waitFor(() => expect(lists.at(-1)!.url.pathname).toBe(secondBase));
      expect(lists.at(-1)!.url.searchParams.get("offset")).toBe("0");
      await waitFor(() =>
        expect(pinned.at(-1)!.url.pathname).toBe(`${secondBase}/pinned`),
      );
      await waitFor(() =>
        expect(
          trends
            .slice(2)
            .map((sent) => sent.url.pathname)
            .sort(),
        ).toEqual([
          `${secondBase}/funnel-001/trend`,
          `${secondBase}/funnel-003/trend`,
        ]),
      );
      const written = new URLSearchParams(window.location.search);
      expect(written.get("a")).toBe(secondApp.id);
      expect(written.get("po")).toBe("0");
    });
  });

  describe("pagination", () => {
    function servePages() {
      return record("get", "", ({ url }) =>
        HttpResponse.json(
          url.searchParams.get("offset") === "5"
            ? makeFunnelsPage2Fixture()
            : makeFunnelsFixture(),
        ),
      );
    }

    it("clicking Next asks for the next page, Previous returns to the first", async () => {
      const lists = servePages();
      renderPage();
      await waitForFunnels();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
      });
      expect(await screen.findByText("Log in")).toBeTruthy();
      expect(table().queryByRole("link", { name: "Checkout" })).toBeNull();
      expect(lists.at(-1)!.url.searchParams.get("offset")).toBe("5");
      expect(new URLSearchParams(window.location.search).get("po")).toBe("5");

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Previous" }));
      });
      await waitForFunnels();
      expect(screen.queryByText("Log in")).toBeNull();
      expect(lists.at(-1)!.url.searchParams.get("offset")).toBe("0");
    });

    it("opens the page a link carries and stays on it once the search box settles", async () => {
      mockRouter.setUrl("po=5");
      const lists = servePages();
      renderPage();

      expect(
        await screen.findByText("Log in", {}, { timeout: 5000 }),
      ).toBeTruthy();
      // The search box reports its starting text to the page once its
      // debounce ends, and that must not send the user back to the first page.
      await act(() => new Promise((resolve) => setTimeout(resolve, 800)));

      expect(new URLSearchParams(window.location.search).get("po")).toBe("5");
      expect(
        lists.every((sent) => sent.url.searchParams.get("offset") === "5"),
      ).toBe(true);
    });
  });

  describe("creating a funnel", () => {
    async function pickEvent(index: number, eventName: string) {
      fireEvent.click(
        screen.getAllByRole("button", { name: /Select event/ })[index],
      );
      fireEvent.click(await screen.findByRole("option", { name: eventName }));
    }

    it("sends the new funnel and opens it", async () => {
      const creates = record("post", "");
      const eventNames = record("get", "/events");
      renderPage();
      await waitForFunnels();

      fireEvent.click(screen.getByRole("button", { name: "Create Funnel" }));
      fireEvent.change(await screen.findByLabelText("Name"), {
        target: { value: " Product to order " },
      });
      await pickEvent(0, "product_viewed");
      await pickEvent(0, "order_placed");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Create funnel" }));
      });

      await waitFor(() => expect(creates).toHaveLength(1));
      expect(eventNames[0].url.pathname).toBe(`${funnelsBase}/events`);
      expect(creates[0].url.pathname).toBe(funnelsBase);
      expect(creates[0].body).toEqual({
        name: "Product to order",
        steps: [
          { event_name: "product_viewed" },
          { event_name: "order_placed" },
        ],
        conversion_window_seconds: 86400,
      });
      await waitFor(() =>
        expect(mockRouterPush).toHaveBeenCalledWith(
          `/test-team/funnels/${appId}/funnel-new?from=funnels_overview_created`,
        ),
      );
      expect(
        await screen.findByText("Funnel Product to order has been saved"),
      ).toBeTruthy();
    });
  });

  describe("when the server fails", () => {
    it("says so when the funnels cannot be fetched", async () => {
      record("get", "", () => serverError("boom"));
      renderPage();

      expect(
        await screen.findByText(/Error fetching list of funnels/),
      ).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
    });

    it("says so on the card whose weekly trend cannot be fetched", async () => {
      server.use(
        http.get("*/api/apps/:appId/funnels/:funnelId/trend", ({ params }) =>
          params.funnelId === searchToOrder.id
            ? serverError("boom")
            : undefined,
        ),
      );
      renderPage();
      await waitForFunnels();

      expect(
        await pinnedCard("Search to order").findByText(
          /Error fetching weekly conversion/,
        ),
      ).toBeTruthy();
      expect(await pinnedCard("Checkout").findByText("5.6%")).toBeTruthy();
      expect(
        pinnedCard("Checkout").queryByText(/Error fetching weekly conversion/),
      ).toBeNull();
    });

    it("says so when the team's apps cannot be fetched, and asks for no funnels", async () => {
      const lists = record("get", "");
      server.use(
        http.get("*/api/teams/:teamId/apps", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(await screen.findByText(/Error fetching apps/)).toBeTruthy();
      expect(lists).toHaveLength(0);
      expect(
        screen.queryByRole("button", { name: "Create Funnel" }),
      ).toBeNull();
    });
  });
});

// ====================================================================
// FUNNEL DETAILS
// ====================================================================
describe("Funnel Details (MSW integration)", () => {
  function renderPage(funnelId = checkout.id) {
    return renderWithProviders(
      <FunnelDetailsPage
        params={promiseParams({
          teamId: "test-team",
          appId,
          funnelId,
        })}
      />,
    );
  }

  const conversionSummary = "5.2% converted · 523 of 10K users";

  async function waitForConversion() {
    await waitFor(
      () => expect(screen.getByText(conversionSummary)).toBeTruthy(),
      { timeout: 5000 },
    );
  }

  async function waitForErrorsList() {
    await waitFor(
      () =>
        expect(
          screen.getByText("ProductActivity.kt: onAddToCart()"),
        ).toBeTruthy(),
      { timeout: 5000 },
    );
  }

  // Session replays has its own step picker and pager, so queries for the
  // friction lists' controls look inside the friction section.
  function friction() {
    return within(
      screen.getByText("Friction").closest(".font-body") as HTMLElement,
    );
  }

  function frictionNext() {
    return friction().getByRole("button", {
      name: "Next",
    }) as HTMLButtonElement;
  }

  function stepPicker(from: string, to: string) {
    return friction().getByRole("button", {
      name: new RegExp(`^${from}\\s*→\\s*${to}$`),
    });
  }

  function overallPicker() {
    return friction().getByRole("button", { name: "Overall" });
  }

  describe("opening the page", () => {
    it("shows the funnel the server sent", async () => {
      const funnels = record("get", "/:funnelId");
      renderPage();

      expect(
        await screen.findByText(
          "Conversion window: 1 day",
          {},
          { timeout: 5000 },
        ),
      ).toBeTruthy();
      expect(screen.getByText("Checkout")).toBeTruthy();
      expect(screen.getByText("Created by: test@example.com")).toBeTruthy();
      expect(funnels).toHaveLength(1);
      expect(funnels[0].url.pathname).toBe(`${funnelsBase}/funnel-001`);
    });

    it("asks for the conversion over the range it settled on, and no trend", async () => {
      const conversions = record("get", "/:funnelId/conversion");
      const trends = record("get", "/:funnelId/trend");
      renderPage();
      await waitForConversion();

      expect(conversions).toHaveLength(1);
      const sent = conversions[0].url;
      expect(sent.pathname).toBe(`${funnelsBase}/funnel-001/conversion`);
      expect(sent.searchParams.get("from")).toMatch(/Z$/);
      expect(sent.searchParams.get("to")).toMatch(/Z$/);
      expect(sent.searchParams.get("timezone")).toBeTruthy();
      expect(sent.searchParams.has("filter_expr")).toBe(false);
      expect(trends).toHaveLength(0);

      const written = new URLSearchParams(window.location.search);
      expect(written.get("a")).toBe(appId);
      expect(written.get("d")).toBe("Last 6 Hours");
    });

    it("draws each step with the users that reached it", async () => {
      renderPage();
      await waitForConversion();

      expect(screen.getByTestId("funnel-part-0").textContent).toBe(
        "product_viewed: 10000",
      );
      expect(screen.getByTestId("funnel-part-4").textContent).toBe(
        "order_placed: 523",
      );
    });

    it("asks for what happened across the whole funnel over the same range, fetching each list once it is opened", async () => {
      const conversions = record("get", "/:funnelId/conversion");
      const errors = record("get", "/:funnelId/errors");
      const traces = record("get", "/:funnelId/traces");
      const network = record("get", "/:funnelId/network");
      renderPage();
      await waitForErrorsList();

      expect(overallPicker()).toBeTruthy();
      await settle();
      expect(traces).toHaveLength(0);
      expect(network).toHaveLength(0);

      fireEvent.click(screen.getByRole("button", { name: "Traces" }));
      await waitFor(() => expect(traces).toHaveLength(1));
      fireEvent.click(screen.getByRole("button", { name: "Network" }));
      await waitFor(() => expect(network).toHaveLength(1));

      for (const [list, path] of [
        [errors, "errors"],
        [traces, "traces"],
        [network, "network"],
      ] as const) {
        expect(list).toHaveLength(1);
        const sent = list[0].url;
        expect(sent.pathname).toBe(`${funnelsBase}/funnel-001/${path}`);
        expect(sent.searchParams.has("step")).toBe(false);
        expect(sent.searchParams.get("limit")).toBe("5");
        expect(sent.searchParams.get("offset")).toBe("0");
        expect(sent.searchParams.get("from")).toBe(
          conversions[0].url.searchParams.get("from"),
        );
        expect(sent.searchParams.get("to")).toBe(
          conversions[0].url.searchParams.get("to"),
        );
      }
      expect(errors[0].url.searchParams.has("quantile")).toBe(false);
      expect(traces[0].url.searchParams.get("quantile")).toBe("p50");
      expect(network[0].url.searchParams.get("quantile")).toBe("p50");
    });
  });

  describe("a link carrying a filter", () => {
    const filterExpr = "version_name:in:3.1.0";

    it("filters the conversion, the friction lists and the trend by it", async () => {
      mockRouter.setUrl(`filter_expr=${encodeURIComponent(filterExpr)}`);
      const conversions = record("get", "/:funnelId/conversion");
      const errors = record("get", "/:funnelId/errors");
      const traces = record("get", "/:funnelId/traces");
      const network = record("get", "/:funnelId/network");
      const trends = record("get", "/:funnelId/trend");
      renderPage();
      await waitForErrorsList();
      fireEvent.click(screen.getByRole("button", { name: "Traces" }));
      fireEvent.click(screen.getByRole("button", { name: "Network" }));

      for (const list of [conversions, errors, traces, network]) {
        await waitFor(() => expect(list.length).toBeGreaterThan(0));
        expect(list[0].url.searchParams.get("filter_expr")).toBe(filterExpr);
      }

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Trend" }));
      });

      await waitFor(() => expect(trends).toHaveLength(1));
      expect(trends[0].url.searchParams.get("filter_expr")).toBe(filterExpr);
    });

    it("shows a refused filter's issue in the bar instead of the plot error", async () => {
      mockRouter.setUrl(`filter_expr=${encodeURIComponent(filterExpr)}`);
      record("get", "/:funnelId/conversion", () =>
        HttpResponse.json(
          {
            error: "invalid_filter_expr",
            filter_expr_issues: [
              {
                message: 'Version "3.1.0" was never released',
                span: { start: 15, end: 20 },
              },
            ],
          },
          { status: 400 },
        ),
      );
      renderPage();

      expect(
        (await screen.findByTestId("filter-issue", {}, { timeout: 5000 }))
          .textContent,
      ).toContain('Version "3.1.0" was never released');
      expect(screen.queryByText(/Error fetching plot/)).toBeNull();
    });
  });

  describe("friction lists", () => {
    it("lists the errors the server sent, measured against the conversion and linked to their group", async () => {
      renderPage();
      await waitForErrorsList();

      const crashRow = within(
        screen
          .getByRole("link", { name: "ProductActivity.kt: onAddToCart()" })
          .closest("tr") as HTMLElement,
      );
      expect(
        crashRow.getByText(
          "java.lang.NullPointerException:Attempt to invoke virtual method on null object reference",
        ),
      ).toBeTruthy();
      expect(crashRow.getByText("612")).toBeTruthy();
      expect(crashRow.getByText("443")).toBeTruthy();
      // 38 of the 523 users who placed an order, 405 of the 9,477 who dropped
      // off.
      expect(crashRow.getByText("7.3%")).toBeTruthy();
      expect(crashRow.getByText("4.3%")).toBeTruthy();
      expect(
        screen
          .getByRole("link", { name: "ProductActivity.kt: onAddToCart()" })
          .getAttribute("href"),
      ).toBe(
        `/test-team/errors/${appId}/crash-group-001/${encodeURIComponent("java.lang.NullPointerException@ProductActivity.kt")}?d=Last+6+Hours&from=funnel_details`,
      );
    });

    it("switching lists records the choice and pages the chosen list", async () => {
      const errors = record("get", "/:funnelId/errors");
      renderPage();
      await waitForErrorsList();

      const next = frictionNext;
      await waitFor(() => expect(next().disabled).toBe(false));
      expect(screen.queryByRole("button", { name: "p90" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Traces" }));

      expect(new URLSearchParams(window.location.search).get("fl")).toBe(
        "Traces",
      );
      expect(
        (
          await screen.findByRole("link", { name: "product_detail_load" })
        ).closest(".hidden"),
      ).toBeNull();
      expect(screen.getByRole("button", { name: "p90" })).toBeTruthy();
      // The traces response has no next page, unlike the errors response.
      expect(next().disabled).toBe(true);
      await settle();
      expect(errors).toHaveLength(1);
    });

    it("restores the list a link carries, without asking for the others", async () => {
      mockRouter.setUrl("fl=Network");
      const errors = record("get", "/:funnelId/errors");
      renderPage();

      const endpoint = await screen.findByRole(
        "link",
        { name: "api.example.com/v1/products/*/reviews" },
        { timeout: 5000 },
      );
      expect(endpoint.closest(".hidden")).toBeNull();
      const selected = (name: string) =>
        screen.getByRole("button", { name }).classList.contains("bg-accent");
      expect(selected("Network")).toBe(true);
      expect(selected("Traces")).toBe(false);
      expect(errors).toHaveLength(0);
    });

    it("asks for the next page of errors only", async () => {
      const errors = record("get", "/:funnelId/errors");
      const traces = record("get", "/:funnelId/traces");
      renderPage();
      await waitForErrorsList();
      const next = frictionNext();
      await waitFor(() =>
        expect((next as HTMLButtonElement).disabled).toBe(false),
      );

      await act(async () => {
        fireEvent.click(next);
      });

      await waitFor(() => expect(errors).toHaveLength(2));
      expect(errors[1].url.searchParams.get("offset")).toBe("5");
      expect(errors[1].url.searchParams.has("step")).toBe(false);
      expect(traces).toHaveLength(0);
    });

    it("asks for the traces and network requests at the percentile picked, from their first page", async () => {
      const morePages = (fixture: { results: unknown[] }) =>
        HttpResponse.json({
          ...fixture,
          meta: { next: true, previous: false },
        });
      const errors = record("get", "/:funnelId/errors");
      const traces = record("get", "/:funnelId/traces", () =>
        morePages(makeFunnelStepTracesFixture()),
      );
      const network = record("get", "/:funnelId/network", () =>
        morePages(makeFunnelStepNetworkFixture()),
      );
      mockRouter.setUrl("fl=Traces");
      renderPage();
      await screen.findByRole(
        "link",
        { name: "product_detail_load" },
        { timeout: 5000 },
      );
      const next = frictionNext;
      await waitFor(() => expect(next().disabled).toBe(false));
      await act(async () => {
        fireEvent.click(next());
      });
      await waitFor(() => expect(traces).toHaveLength(2));
      fireEvent.click(screen.getByRole("button", { name: "Network" }));
      await waitFor(() => expect(next().disabled).toBe(false));
      await act(async () => {
        fireEvent.click(next());
      });
      await waitFor(() => expect(network).toHaveLength(2));
      expect(traces[1].url.searchParams.get("offset")).toBe("5");
      expect(network[1].url.searchParams.get("offset")).toBe("5");

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "p90" }));
      });

      await waitFor(() => expect(traces).toHaveLength(3));
      await waitFor(() => expect(network).toHaveLength(3));
      for (const sent of [traces[2], network[2]]) {
        expect(sent.url.searchParams.get("quantile")).toBe("p90");
        expect(sent.url.searchParams.get("offset")).toBe("0");
      }
      expect(errors).toHaveLength(0);
      expect(await screen.findByText("Conversion Duration (p90)")).toBeTruthy();
      expect(screen.getByText("Conversion Latency (p90)")).toBeTruthy();
    });
  });

  describe("choosing a step", () => {
    it("clicking a step in the funnel lists what happened before it, in the list on screen", async () => {
      const errors = record("get", "/:funnelId/errors");
      const traces = record("get", "/:funnelId/traces");
      const network = record("get", "/:funnelId/network");
      renderPage();
      await waitForErrorsList();
      const next = frictionNext();
      await waitFor(() =>
        expect((next as HTMLButtonElement).disabled).toBe(false),
      );
      await act(async () => {
        fireEvent.click(next);
      });
      await waitFor(() => expect(errors).toHaveLength(2));
      expect(errors[1].url.searchParams.get("offset")).toBe("5");

      await act(async () => {
        fireEvent.click(screen.getByTestId("funnel-part-2"));
      });

      await waitFor(() => expect(errors).toHaveLength(3));
      expect(errors[2].url.searchParams.get("step")).toBe("2");
      expect(errors[2].url.searchParams.get("offset")).toBe("0");
      await settle();
      expect(traces).toHaveLength(0);
      expect(network).toHaveLength(0);
      expect(new URLSearchParams(window.location.search).get("fs")).toBe("2");
      expect(stepPicker("added_to_cart", "checkout_started")).toBeTruthy();
    });

    it("picking a step pair lists what happened between them", async () => {
      const errors = record("get", "/:funnelId/errors");
      renderPage();
      await waitForErrorsList();

      fireEvent.click(overallPicker());
      // 39 of the 562 users who submitted a payment placed no order.
      const option = await screen.findByRole("option", {
        name: /payment_submitted.*order_placed.*39 dropped · 6\.9%/,
      });
      await act(async () => {
        fireEvent.click(option);
      });

      await waitFor(() => expect(errors).toHaveLength(2));
      expect(errors[1].url.searchParams.get("step")).toBe("4");
      expect(stepPicker("payment_submitted", "order_placed")).toBeTruthy();
    });

    it("restores the step a link carries", async () => {
      mockRouter.setUrl("fs=4");
      const errors = record("get", "/:funnelId/errors");
      renderPage();
      await waitForErrorsList();

      expect(errors[0].url.searchParams.get("step")).toBe("4");
      expect(stepPicker("payment_submitted", "order_placed")).toBeTruthy();
    });
  });

  describe("the trend view", () => {
    const trendSummary = "4.5% converted · 188 of 4.2K users";

    async function switchToTrend() {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Trend" }));
      });
      await waitFor(() => expect(screen.getByText(trendSummary)).toBeTruthy());
    }

    async function openTrend() {
      renderPage();
      await waitForConversion();
      await switchToTrend();
    }

    it("asks for the weekly trend and draws a line per step pair", async () => {
      const trends = record("get", "/:funnelId/trend");
      await openTrend();

      expect(trends).toHaveLength(1);
      expect(trends[0].url.pathname).toBe(`${funnelsBase}/funnel-001/trend`);
      expect(trends[0].url.searchParams.get("period")).toBe("week");
      expect(trends[0].url.searchParams.get("timezone")).toBeTruthy();
      expect(trends[0].url.searchParams.has("from")).toBe(false);
      expect(trends[0].url.searchParams.has("filter_expr")).toBe(false);
      expect(trends[0].url.searchParams.get("builds")).toBe("true");
      expect(screen.getByText("Trend", { selector: "p" })).toBeTruthy();
      for (const id of ["overall", "step:1", "step:4", "entered"]) {
        expect(screen.getByTestId(`chart-series-${id}`)).toBeTruthy();
      }
      expect(new URLSearchParams(window.location.search).get("fv")).toBe(
        "Trend",
      );
    });

    it("asks for the monthly trend when Monthly is picked", async () => {
      const trends = record("get", "/:funnelId/trend");
      await openTrend();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      await waitFor(() => expect(trends).toHaveLength(2));
      expect(trends[1].url.searchParams.get("period")).toBe("month");
      expect(new URLSearchParams(window.location.search).get("fp")).toBe(
        "month",
      );
    });

    it("selects every step again after leaving the Trend view and coming back", async () => {
      await openTrend();
      fireEvent.click(screen.getByRole("button", { name: "Select Steps" }));
      const option = await screen.findByRole("option", {
        name: /product_viewed → added_to_cart/,
      });
      await act(async () => {
        fireEvent.click(option);
      });
      expect(screen.queryByTestId("chart-series-step:1")).toBeNull();
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Breakdown" }));
      });
      await waitForConversion();
      await switchToTrend();

      expect(screen.getByTestId("chart-series-step:1")).toBeTruthy();
    });

    it("plots the time to convert from the same trend", async () => {
      const trends = record("get", "/:funnelId/trend");
      await openTrend();
      expect(screen.queryByText("Median time")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Time to convert" }));

      expect(await screen.findByText("Median time")).toBeTruthy();
      expect(new URLSearchParams(window.location.search).get("fm")).toBe(
        "Time to convert",
      );
      await settle();
      expect(trends).toHaveLength(1);
    });

    it("restores the view and period a link carries, without asking for the conversion", async () => {
      mockRouter.setUrl("fv=Trend&fp=day");
      const trends = record("get", "/:funnelId/trend");
      const conversions = record("get", "/:funnelId/conversion");
      const errors = record("get", "/:funnelId/errors");
      renderPage();

      expect(
        await screen.findByText(trendSummary, {}, { timeout: 5000 }),
      ).toBeTruthy();
      expect(trends[0].url.searchParams.get("period")).toBe("day");
      expect(conversions).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it("clicking a step pair's point opens that week's funnel at that step", async () => {
      const conversions = record("get", "/:funnelId/conversion");
      const errors = record("get", "/:funnelId/errors");
      await openTrend();

      await act(async () => {
        fireEvent.click(screen.getByTestId("chart-point-step:2-1"));
      });

      const start = DateTime.fromISO("2026-03-23");
      const end = start.plus({ week: 1 });
      await waitFor(() => expect(conversions).toHaveLength(2));
      expect(conversions[1].url.searchParams.get("from")).toBe(
        start.toUTC().toISO(),
      );
      expect(conversions[1].url.searchParams.get("to")).toBe(
        end.toUTC().toISO(),
      );
      await waitFor(() => expect(errors.length).toBeGreaterThan(1));
      const lastErrors = errors.at(-1)!.url.searchParams;
      expect(lastErrors.get("step")).toBe("2");
      expect(lastErrors.get("from")).toBe(start.toUTC().toISO());

      const written = new URLSearchParams(window.location.search);
      expect(written.get("fv")).toBe("Breakdown");
      expect(written.get("fs")).toBe("2");
      expect(written.get("d")).toBe("Custom Range");
      expect(
        await screen.findByText("Breakdown", { selector: "p" }),
      ).toBeTruthy();
      expect(window.scrollTo).toHaveBeenCalledWith({
        top: 0,
        behavior: "instant",
      });
    });
  });

  describe("a conversion that cannot be fetched", () => {
    it("says so and asks for no friction lists when the conversion cannot be fetched", async () => {
      record("get", "/:funnelId/conversion", () => serverError("boom"));
      const errors = record("get", "/:funnelId/errors");
      renderPage();

      expect(
        await screen.findByText(/Error fetching plot/, {}, { timeout: 5000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Error fetching friction/)).toBeTruthy();
      await settle();
      expect(errors).toHaveLength(0);
    });
  });

  describe("a funnel that cannot be fetched", () => {
    it("says so for a funnel the server does not know", async () => {
      const funnels = record("get", "/:funnelId");
      renderPage("funnel-missing");

      expect(
        await screen.findByText(
          "Error fetching funnel, please refresh page to try again",
          {},
          { timeout: 5000 },
        ),
      ).toBeTruthy();
      expect(funnels[0].url.pathname).toBe(`${funnelsBase}/funnel-missing`);
      expect(screen.queryByRole("button", { name: "Edit funnel" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Delete funnel" }),
      ).toBeNull();
      expect(screen.queryByText("Breakdown", { selector: "p" })).toBeNull();
    });
  });

  describe("editing", () => {
    async function openEditor() {
      renderPage();
      await waitForConversion();
      fireEvent.click(screen.getByRole("button", { name: "Edit funnel" }));
      return within(await screen.findByRole("dialog"));
    }

    it("sends the edited funnel, then shows it and keeps the page's URL state", async () => {
      let saved = checkout;
      const updates = record("patch", "/:funnelId", ({ body }) => {
        saved = { ...saved, ...body };
        return HttpResponse.json(saved);
      });
      server.use(
        http.get("*/api/apps/:appId/funnels/:funnelId", ({ params }) =>
          params.funnelId === checkout.id
            ? HttpResponse.json(saved)
            : undefined,
        ),
      );
      const conversions = record("get", "/:funnelId/conversion");
      const editor = await openEditor();
      const url = window.location.pathname + window.location.search;

      fireEvent.change(editor.getByLabelText("Name"), {
        target: { value: "  Checkout v2 " },
      });
      fireEvent.change(editor.getByLabelText("Conversion window"), {
        target: { value: "2" },
      });
      fireEvent.click(
        editor.getAllByRole("button", { name: "Remove step" })[4],
      );
      await act(async () => {
        fireEvent.click(editor.getByRole("button", { name: "Save changes" }));
      });

      await waitFor(() => expect(updates).toHaveLength(1));
      expect(updates[0].url.pathname).toBe(`${funnelsBase}/funnel-001`);
      expect(updates[0].body).toEqual({
        name: "Checkout v2",
        steps: [
          { event_name: "product_viewed" },
          { event_name: "added_to_cart" },
          { event_name: "checkout_started" },
          { event_name: "payment_submitted" },
        ],
        conversion_window_seconds: 172800,
      });
      expect(
        await screen.findByText("Funnel Checkout v2 has been saved"),
      ).toBeTruthy();
      await waitFor(() => expect(screen.queryByLabelText("Name")).toBeNull());
      expect(await screen.findByText("Checkout v2")).toBeTruthy();
      expect(screen.getByText("Conversion window: 2 days")).toBeTruthy();
      expect(window.location.pathname + window.location.search).toBe(url);
      expect(mockRouterPush).not.toHaveBeenCalled();
      await waitFor(() => expect(conversions).toHaveLength(2));
    });
  });

  describe("deleting", () => {
    async function confirmDelete() {
      renderPage();
      await waitForConversion();
      fireEvent.click(screen.getByRole("button", { name: "Delete funnel" }));
      return within(await screen.findByRole("dialog"));
    }

    it("deletes the funnel after confirmation and returns to the funnels", async () => {
      const deletes = record("delete", "/:funnelId");
      const dialog = await confirmDelete();

      await act(async () => {
        fireEvent.click(dialog.getByRole("button", { name: "Delete funnel" }));
      });

      await waitFor(() => expect(deletes).toHaveLength(1));
      expect(deletes[0].url.pathname).toBe(`${funnelsBase}/funnel-001`);
      await waitFor(() =>
        expect(mockRouterPush).toHaveBeenCalledWith("/test-team/funnels"),
      );
      expect(
        await screen.findByText("Funnel Checkout has been deleted"),
      ).toBeTruthy();
    });

    it("makes the funnels list ask the server again, without the deleted funnel", async () => {
      // Cached lists stay fresh indefinitely, so the overview refetches only if the
      // delete invalidated them.
      queryClient.setQueryDefaults(["funnels"], {
        staleTime: Infinity,
        gcTime: Infinity,
      });
      try {
        queryClient.setQueryData(
          ["funnels", appId, "all", "", 0],
          makeFunnelsFixture(),
        );
        queryClient.setQueryData(
          ["funnels", appId, "pinned"],
          makePinnedFunnelsFixture(),
        );
        let deleted = false;
        record("delete", "/:funnelId", () => {
          deleted = true;
          return HttpResponse.json({ ok: true });
        });
        const lists = record("get", "", () =>
          HttpResponse.json(
            makeFunnelsFixture({
              results: makeFunnelsFixture().results.filter(
                (funnel) => !deleted || funnel.id !== checkout.id,
              ),
            }),
          ),
        );
        const pinned = record("get", "/pinned", () =>
          HttpResponse.json({
            results: makePinnedFunnelsFixture().results.filter(
              (funnel) => !deleted || funnel.id !== checkout.id,
            ),
          }),
        );
        const dialog = await confirmDelete();
        await act(async () => {
          fireEvent.click(
            dialog.getByRole("button", { name: "Delete funnel" }),
          );
        });
        await waitFor(() =>
          expect(mockRouterPush).toHaveBeenCalledWith("/test-team/funnels"),
        );
        cleanup();

        renderWithProviders(
          <FunnelsPage params={promiseParams({ teamId: "test-team" })} />,
        );

        await waitFor(() => expect(lists).toHaveLength(1), { timeout: 5000 });
        await waitFor(() => expect(pinned).toHaveLength(1));
        const table = within(await screen.findByRole("table"));
        expect(
          table.getByRole("link", { name: "Search to cart" }),
        ).toBeTruthy();
        expect(table.queryByRole("link", { name: "Checkout" })).toBeNull();
        expect(pinnedCardNames()).toEqual(["Search to order"]);
      } finally {
        queryClient.setQueryDefaults(["funnels"], {});
      }
    });

    it("says why and stays on the funnel when the delete fails", async () => {
      record("delete", "/:funnelId", () =>
        serverError("Failed to delete funnel"),
      );
      const dialog = await confirmDelete();

      await act(async () => {
        fireEvent.click(dialog.getByRole("button", { name: "Delete funnel" }));
      });

      expect(
        await screen.findByText(
          "Error deleting funnel: Failed to delete funnel",
        ),
      ).toBeTruthy();
      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });
});
