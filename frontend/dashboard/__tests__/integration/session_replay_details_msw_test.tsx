/**
 * Integration tests for the Session Replay details page.
 *
 * The page's own job is to read the route, fetch that one session and give it
 * to the replay, so that is what these cover: which request goes out, what is
 * shown while it is in flight, what happens when it fails, and what the cache
 * does on the way back. How the replay then draws the session is the player's
 * own business, and is covered by __tests__/components/session_replay_test.tsx.
 */
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
import { render, screen, waitFor } from "@testing-library/react";
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
  usePathname: () => "/test-team/session_replays",
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

// --- MSW ---
import { makeSessionReplayFixture } from "../msw/fixtures";
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
import SessionDetail from "@/app/[teamId]/session_replays/[appId]/[sessionId]/page";
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
  filtersStore.getState().reset();
  for (const key of [...mockSearchParams.keys()]) mockSearchParams.delete(key);
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("Session Replay Details (MSW integration)", () => {
  describe("page load", () => {
    it("shows error state when session API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/sessions/:sessionId", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      renderWithProviders(
        <SessionDetail
          params={promiseParams({
            teamId: "test-team",
            appId: "app-1",
            sessionId: "sess-001",
          })}
        />,
      );
      await waitFor(
        () => {
          expect(
            screen.getByText(/Error fetching session replay/),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("shows cached data instantly on re-mount with same params", async () => {
      server.use(
        http.get("*/api/apps/:appId/sessions/:sessionId", () => {
          return HttpResponse.json(makeSessionReplayFixture());
        }),
      );

      const { unmount } = renderWithProviders(
        <SessionDetail
          params={promiseParams({
            teamId: "test-team",
            appId: "app-1",
            sessionId: "sess-001",
          })}
        />,
      );
      await waitFor(
        () => {
          expect(screen.getByText(/User ID:/)).toBeTruthy();
        },
        { timeout: 5000 },
      );

      unmount();
      renderWithProviders(
        <SessionDetail
          params={promiseParams({
            teamId: "test-team",
            appId: "app-1",
            sessionId: "sess-001",
          })}
        />,
      );
      expect(screen.getByText(/User ID:/)).toBeTruthy();
    });

    it("fetches new data for a different sessionId", async () => {
      let fetchCount = 0;
      server.use(
        http.get("*/api/apps/:appId/sessions/:sessionId", () => {
          fetchCount++;
          return HttpResponse.json(makeSessionReplayFixture());
        }),
      );

      const { unmount } = renderWithProviders(
        <SessionDetail
          params={promiseParams({
            teamId: "test-team",
            appId: "app-1",
            sessionId: "sess-001",
          })}
        />,
      );
      await waitFor(() => expect(fetchCount).toBe(1), { timeout: 5000 });

      unmount();
      renderWithProviders(
        <SessionDetail
          params={promiseParams({
            teamId: "test-team",
            appId: "app-1",
            sessionId: "sess-002",
          })}
        />,
      );
      await waitFor(() => expect(fetchCount).toBe(2), { timeout: 5000 });
    });

    it("filter store state does not interfere with detail page fetch", async () => {
      // Detail page has no filters. Setting filter state shouldn't
      // prevent or alter the session detail fetch.
      filtersStore.getState().setSelectedFreeText("some search text");

      const detailUrls: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/sessions/:sessionId", ({ request }) => {
          detailUrls.push(request.url);
          return HttpResponse.json(makeSessionReplayFixture());
        }),
      );

      renderWithProviders(
        <SessionDetail
          params={promiseParams({
            teamId: "test-team",
            appId: "app-1",
            sessionId: "sess-001",
          })}
        />,
      );
      await waitFor(() => expect(detailUrls.length).toBeGreaterThan(0), {
        timeout: 5000,
      });

      expect(detailUrls[0]).not.toContain("free_text=");
      expect(detailUrls[0]).not.toContain("filter_short_code=");
    });
  });
});
