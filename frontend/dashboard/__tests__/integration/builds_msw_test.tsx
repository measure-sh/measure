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
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";

// --- External dependency mocks ---

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}));

const mockRouterReplace = mockRouter.replaceMock;

jest.mock("next/navigation", () => ({
  ...require("@/__tests__/helpers/mock_router").nextNavigationMock(),
  usePathname: () => "/test-team/builds",
}));

jest.mock("next-themes", () => ({
  __esModule: true,
  useTheme: () => ({ theme: "light" }),
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
import {
  makeAppFixture,
  makeBuildsFixture,
  makeFilterValuesFixture,
} from "../msw/fixtures";
import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  mockRouterReplace.mockClear();
});
afterAll(() => server.close());

// --- Store/component imports ---
import Builds from "@/app/[teamId]/builds/page";
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

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <Builds params={promiseParams({ teamId: "test-team" })} />
    </QueryClientProvider>,
  );
}

function recordBuildsRequests() {
  const sent: URL[] = [];
  server.use(
    http.get("*/api/apps/:appId/builds", ({ request }) => {
      sent.push(new URL(request.url));
      return HttpResponse.json(makeBuildsFixture());
    }),
  );
  return sent;
}

async function waitForBuilds() {
  await waitFor(() => expect(screen.getByText("1.0.2 (2)")).toBeTruthy());
}

describe("Builds page (MSW integration)", () => {
  describe("opening the page", () => {
    it("lists the builds the server sent", async () => {
      renderPage();

      await waitForBuilds();
      expect(screen.getByText("proguard")).toBeTruthy();
      expect(screen.getAllByRole("link", { name: "Download" })).toHaveLength(1);
    });

    it("asks for the app's builds over the range it settled on", async () => {
      const sent = recordBuildsRequests();
      renderPage();
      await waitForBuilds();

      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(`/api/apps/${appId}/builds`);
      const from = sent[0].searchParams.get("from")!;
      const to = sent[0].searchParams.get("to")!;
      expect(from).toMatch(/Z$/);
      expect(to).toMatch(/Z$/);
      expect(Date.parse(to) - Date.parse(from)).toBeCloseTo(
        6 * 3600 * 1000,
        -4,
      );
      expect(sent[0].searchParams.get("timezone")).toBeTruthy();
      expect(sent[0].searchParams.get("limit")).toBe("10");
      expect(sent[0].searchParams.get("offset")).toBe("0");
      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
    });

    it("records the app and range it settled on in the URL", async () => {
      renderPage();
      await waitForBuilds();

      const written = new URLSearchParams(
        mockRouterReplace.mock.calls[0][0].slice(1),
      );
      expect(written.get("a")).toBe(appId);
      expect(written.get("d")).toBe("Last 6 Hours");
      expect(written.get("sd")).toBeTruthy();
      expect(written.get("ed")).toBeTruthy();
      expect(written.get("po")).toBe("0");
    });

    it("offers the keys the entity has, in the groups the server named", async () => {
      renderPage();
      await waitForBuilds();

      fireEvent.click(screen.getByTestId("filter-input"));

      // The table has a Build column of its own, so scope this to the list the
      // picker opened.
      const list = within(await screen.findByRole("dialog"));
      expect(list.getByText("App version")).toBeTruthy();
      expect(
        list.getByText("The version the build was uploaded against"),
      ).toBeTruthy();
      expect(list.getByText("Version")).toBeTruthy();
      expect(list.getByText("Build")).toBeTruthy();
    });
  });

  describe("a link carrying a filter", () => {
    beforeEach(() => {
      mockRouter.searchParams = new URLSearchParams(
        `po=0&filter_expr=${encodeURIComponent("mapping_type:in:proguard")}`,
      );
    });

    it("filters by it without asking the server to read it first", async () => {
      const sent = recordBuildsRequests();
      renderPage();
      await waitForBuilds();

      expect(sent[0].searchParams.get("filter_expr")).toBe(
        "mapping_type:in:proguard",
      );
    });

    it("draws it as a condition a person can edit", async () => {
      renderPage();
      await waitForBuilds();

      // "proguard" is also a file type in the table below, so scope this to
      // the bar.
      const bar = within(screen.getByTestId("filter-bar"));
      expect(await screen.findByText("File type")).toBeTruthy();
      expect(bar.getByText("is")).toBeTruthy();
      expect(bar.getByText("proguard")).toBeTruthy();
    });

    it("filters by nothing when it cannot be read", async () => {
      mockRouter.searchParams = new URLSearchParams(
        `po=0&filter_expr=${encodeURIComponent("mapping_type:in:")}`,
      );
      const sent = recordBuildsRequests();
      renderPage();
      await waitForBuilds();

      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
    });
  });

  describe("filtering by a value", () => {
    it("asks the server for the key's values, then filters by the one picked", async () => {
      const values: URL[] = [];
      server.use(
        http.get("*/api/apps/:appId/filters/values", ({ request }) => {
          values.push(new URL(request.url));
          return HttpResponse.json(makeFilterValuesFixture());
        }),
      );
      const sent = recordBuildsRequests();
      renderPage();
      await waitForBuilds();

      fireEvent.click(screen.getByTestId("filter-input"));
      fireEvent.change(await screen.findByTestId("filter-key-search"), {
        target: { value: "File type" },
      });
      fireEvent.click(await screen.findByTestId("filter-key-mapping_type"));
      fireEvent.click(await screen.findByText("<values>"));
      fireEvent.click(await screen.findByTestId("filter-value-dsym"));

      await waitFor(() => expect(sent).toHaveLength(2));
      expect(values[0].searchParams.get("entity")).toBe("builds");
      expect(values[0].searchParams.get("key_name")).toBe("mapping_type");
      expect(sent[1].searchParams.get("filter_expr")).toBe(
        "mapping_type:in:dsym",
      );
    });
  });

  describe("when the server fails", () => {
    it("says so rather than showing an empty list", async () => {
      server.use(
        http.get("*/api/apps/:appId/builds", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(
        await screen.findByText(/Error fetching list of builds/),
      ).toBeTruthy();
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
});
