/**
 * Integration tests for Usage page.
 *
 * The page has two sections:
 * 1. Usage: month selector dropdown + pie chart showing sessions/events/spans
 *    per app. Always rendered.
 * 2. Billing: plan cards (Free/Pro), upgrade/downgrade buttons, subscription
 *    details, free plan progress bar. Only rendered when isBillingEnabled()
 *    returns true (env var NEXT_PUBLIC_BILLING_ENABLED=true).
 *
 * In tests, isBillingEnabled() returns false by default, so billing section
 * is NOT rendered. Billing store actions are tested directly.
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

// Stripe checkout and billing-portal redirects go through the navigation
// module because jsdom's window.location can't be stubbed; mock it to
// observe the redirect URLs and keep tests from navigating away.
const mockNavigateTo = jest.fn();
jest.mock("@/app/utils/navigation", () => ({
  navigateTo: (...args: any[]) => mockNavigateTo(...args),
  reloadPage: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/test-team/usage",
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

// Controllable mock for isBillingEnabled — defaults to false
const mockIsBillingEnabled = jest.fn(() => false);
jest.mock("@/app/utils/feature_flag_utils", () => ({
  __esModule: true,
  isBillingEnabled: () => mockIsBillingEnabled(),
}));

jest.mock("@nivo/pie", () => ({
  __esModule: true,
  ResponsivePie: ({ data, layers }: any) => (
    <div data-testid="nivo-pie-chart">
      {data?.map((d: any) => (
        <span key={d.id} data-testid={`pie-slice-${d.id}`}>
          {d.label}: {d.value} sessions, {d.events} events, {d.spans} spans
        </span>
      ))}
    </div>
  ),
}));

// --- MSW ---
import { makeBillingInfoFixture } from "../msw/fixtures";
import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// --- Store/component imports ---
import Usage from "@/app/[teamId]/usage/page";
import { queryClient } from "@/app/query/query_client";
import { QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/app/stores/provider", () => {
  const actual = jest.requireActual("@/app/stores/provider");
  return {
    ...actual,
  };
});

beforeEach(() => {
  queryClient.clear();
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// ====================================================================
// USAGE PAGE
// ====================================================================
describe("Usage Page (MSW integration)", () => {
  // ================================================================
  // PAGE LOAD
  // ================================================================
  describe("page load", () => {
    it("shows error when usage fetch fails", async () => {
      server.use(
        http.get("*/api/teams/:teamId/usage", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderWithProviders(
        <Usage params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText(/Error fetching usage data/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("shows the empty usage state when usage returns 404 (no onboarding push)", async () => {
      server.use(
        http.get("*/api/teams/:teamId/usage", () => {
          return new HttpResponse(null, { status: 404 });
        }),
      );
      renderWithProviders(
        <Usage params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(
            screen.getByText("No data yet. Send your first event!"),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(screen.queryByText(/don't have any apps yet/)).toBeNull();
    });
  });
});

// ====================================================================
// BILLING ENABLED — UPGRADE & DOWNGRADE MUTATIONS
// ====================================================================
describe("Usage — billing enabled", () => {
  beforeEach(() => {
    mockIsBillingEnabled.mockReturnValue(true);
  });

  afterEach(() => {
    mockIsBillingEnabled.mockReturnValue(false);
  });

  describe("upgrade flow", () => {
    it("click Upgrade to Pro calls PATCH /teams/:teamId/billing/checkout and redirects", async () => {
      let capturedBody: any = null;
      let capturedPath: string = "";

      const locationSpy = mockNavigateTo;
      locationSpy.mockClear();

      server.use(
        http.get("*/api/teams/:teamId/billing/info", () => {
          return HttpResponse.json(makeBillingInfoFixture({ plan: "free" }));
        }),
        http.patch(
          "*/api/teams/:teamId/billing/checkout",
          async ({ request }) => {
            capturedBody = await request.json();
            capturedPath = new URL(request.url).pathname;
            return HttpResponse.json({
              checkout_url: "https://checkout.stripe.com/test-session",
            });
          },
        ),
      );

      renderWithProviders(
        <Usage params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Upgrade to Pro")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Click Upgrade
      const upgradeBtn = screen.getByText("Upgrade to Pro").closest("button")!;
      await act(async () => {
        fireEvent.click(upgradeBtn);
      });

      // Verify API was called with correct payload
      await waitFor(
        () => {
          expect(capturedBody).toBeTruthy();
          expect(capturedBody.success_url).toContain("success=true");
          expect(capturedPath).toContain("/teams/test-team/billing/checkout");
        },
        { timeout: 5000 },
      );

      // Verify redirect to Stripe checkout URL
      await waitFor(
        () => {
          expect(locationSpy).toHaveBeenCalledWith(
            "https://checkout.stripe.com/test-session",
          );
        },
        { timeout: 5000 },
      );
    });
  });

  describe("downgrade flow", () => {
    // Frontend hides the scheduled-cancellation UI when current_period_end
    // is in the past, so use a date well outside the test suite's lifetime.
    const futureCancelEnd = Math.floor(Date.UTC(2099, 0, 1) / 1000);

    it("click Downgrade to Free, confirm dialog, calls PATCH /teams/:teamId/billing/downgrade", async () => {
      let downgradeCalled = false;
      let capturedPath: string = "";
      let billingPlan = "pro";

      server.use(
        http.get("*/api/teams/:teamId/billing/info", () => {
          return HttpResponse.json(
            makeBillingInfoFixture({ plan: billingPlan }),
          );
        }),
        http.patch(
          "*/api/teams/:teamId/billing/downgrade",
          async ({ request }) => {
            downgradeCalled = true;
            capturedPath = new URL(request.url).pathname;
            billingPlan = "free";
            return HttpResponse.json({ ok: true });
          },
        ),
      );

      renderWithProviders(
        <Usage params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Downgrade to Free")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Click Downgrade button
      const downgradeBtn = screen
        .getByText("Downgrade to Free")
        .closest("button")!;
      await act(async () => {
        fireEvent.click(downgradeBtn);
      });

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(
          screen.getByText(/Are you sure you want to downgrade/),
        ).toBeTruthy();
        expect(screen.getByText("Yes, schedule cancellation")).toBeTruthy();
      });

      // Confirm the downgrade
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, schedule cancellation"));
      });

      // Verify API was called
      await waitFor(
        () => {
          expect(downgradeCalled).toBe(true);
          expect(capturedPath).toContain("/teams/test-team/billing/downgrade");
        },
        { timeout: 5000 },
      );
    });

    it("click Undo Cancellation calls PATCH /teams/:teamId/billing/undo-downgrade", async () => {
      let undoCalled = false;
      let capturedPath = "";
      let canceledAt = 1700100000;

      server.use(
        http.get("*/api/teams/:teamId/billing/info", () => {
          return HttpResponse.json(
            makeBillingInfoFixture({
              plan: "pro",
              canceled_at: canceledAt,
              current_period_end: futureCancelEnd,
            }),
          );
        }),
        http.patch(
          "*/api/teams/:teamId/billing/undo-downgrade",
          ({ request }) => {
            undoCalled = true;
            capturedPath = new URL(request.url).pathname;
            canceledAt = 0;
            return HttpResponse.json({ ok: true });
          },
        ),
      );

      renderWithProviders(
        <Usage params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Undo Cancellation")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      await act(async () => {
        fireEvent.click(
          screen.getByText("Undo Cancellation").closest("button")!,
        );
      });

      await waitFor(
        () => {
          expect(undoCalled).toBe(true);
          expect(capturedPath).toContain(
            "/teams/test-team/billing/undo-downgrade",
          );
        },
        { timeout: 5000 },
      );
    });

    it("UI flips Pro → Free when refetch returns the new plan", async () => {
      // Simulates the webhook-driven transition at expiry: server starts
      // returning Free, invalidate the billingInfo query, refetch lands.
      // The Pro card (Manage Billing / Downgrade) should give way to the
      // Free card (Upgrade to Pro).
      let billingPlan = "pro";
      server.use(
        http.get("*/api/teams/:teamId/billing/info", () => {
          return HttpResponse.json(
            makeBillingInfoFixture({ plan: billingPlan }),
          );
        }),
      );

      renderWithProviders(
        <Usage params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Downgrade to Free")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      billingPlan = "free";
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ["billingInfo"] });
      });

      await waitFor(
        () => {
          expect(screen.getByText("Upgrade to Pro")).toBeTruthy();
          expect(screen.queryByText("Downgrade to Free")).toBeNull();
          expect(screen.queryByText("Manage Billing")).toBeNull();
        },
        { timeout: 5000 },
      );
    });
  });

  describe("enterprise plan", () => {
    it("clicking Manage Billing on enterprise opens the customer portal", async () => {
      let portalCalled = false;
      server.use(
        http.get("*/api/teams/:teamId/billing/info", () => {
          return HttpResponse.json(
            makeBillingInfoFixture({
              plan: "enterprise",
              bytes_unlimited: true,
              retention_days: 365,
            }),
          );
        }),
        http.post("*/api/teams/:teamId/billing/portal", () => {
          portalCalled = true;
          return HttpResponse.json({
            url: "https://portal.example.com/session/xyz",
          });
        }),
      );

      // The redirect goes through the mocked navigation module, so the
      // test observes it without navigating away.
      mockNavigateTo.mockClear();

      renderWithProviders(
        <Usage params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Manage Billing")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Manage Billing").closest("button")!);
      });

      await waitFor(
        () => {
          expect(portalCalled).toBe(true);
        },
        { timeout: 5000 },
      );
    });
  });
});
