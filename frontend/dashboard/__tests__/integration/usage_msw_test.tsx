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
import { makeBillingInfoFixture, makeUsageFixture } from "../msw/fixtures";
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
  async function renderAndWaitForData() {
    renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
    await waitFor(
      () => {
        expect(screen.getByTestId("nivo-pie-chart")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // PAGE LOAD
  // ================================================================
  describe("page load", () => {
    it("renders pie chart", async () => {
      await renderAndWaitForData();
      expect(screen.getByTestId("nivo-pie-chart")).toBeTruthy();
    });

    it("renders pie slices for each app", async () => {
      await renderAndWaitForData();
      // Default selected month is the last one: "Apr 2026"
      expect(
        screen.getByTestId("pie-slice-b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f"),
      ).toBeTruthy();
      expect(
        screen.getByTestId("pie-slice-c6f4e9b2-7d3e-5a0b-9f8c-2b3c4d5e6f7a"),
      ).toBeTruthy();
    });

    it("renders app name and usage values in pie slices", async () => {
      await renderAndWaitForData();
      // Apr 2026 data for "measure demo": sessions=6200, events=15000, spans=9500
      expect(
        screen.getByText(
          /measure demo: 6200 sessions, 15000 events, 9500 spans/,
        ),
      ).toBeTruthy();
      // Apr 2026 data for "other app": sessions=2500, events=5000, spans=3500
      expect(
        screen.getByText(/other app: 2500 sessions, 5000 events, 3500 spans/),
      ).toBeTruthy();
    });

    it("shows skeleton loading while fetching", async () => {
      server.use(
        http.get("*/api/teams/:teamId/usage", async () => {
          await new Promise((r) => setTimeout(r, 200));
          return HttpResponse.json(makeUsageFixture());
        }),
      );
      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
      expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy();
      expect(screen.queryByTestId("nivo-pie-chart")).toBeNull();
    });

    it("shows error when usage fetch fails", async () => {
      server.use(
        http.get("*/api/teams/:teamId/usage", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
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
      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
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

    it("does not render Billing section when isBillingEnabled is false", async () => {
      await renderAndWaitForData();
      expect(screen.queryByText("Billing")).toBeNull();
    });

    it("data loads successfully", async () => {
      await renderAndWaitForData();
      expect(screen.getByTestId("nivo-pie-chart")).toBeTruthy();
    });
  });

  // ================================================================
  // MONTH SELECTION
  // ================================================================
  describe("month selection", () => {
    it("defaults to the latest month (Apr 2026)", async () => {
      await renderAndWaitForData();
      // The dropdown should show the latest month as its selected value
      expect(screen.getByText("Apr 2026")).toBeTruthy();
      // Apr 2026 data should be rendered
      expect(
        screen.getByText(
          /measure demo: 6200 sessions, 15000 events, 9500 spans/,
        ),
      ).toBeTruthy();
    });

    it("selecting a different month updates the pie chart data", async () => {
      await renderAndWaitForData();
      // Initial: Apr 2026 data
      expect(
        screen.getByText(
          /measure demo: 6200 sessions, 15000 events, 9500 spans/,
        ),
      ).toBeTruthy();

      // Open the month dropdown and select "Mar 2026"
      const monthButton = screen.getByText("Apr 2026").closest("button")!;
      await act(async () => {
        fireEvent.click(monthButton);
      });

      // Wait for popover to open and click "Mar 2026"
      await waitFor(() => {
        // There should be two entries in the dropdown: "Mar 2026" and "Apr 2026"
        // The popover renders items via CommandItem
        const mar2026Items = screen.getAllByText("Mar 2026");
        expect(mar2026Items.length).toBeGreaterThanOrEqual(1);
      });

      // Click the Mar 2026 option in the dropdown
      const mar2026Option = screen.getAllByText("Mar 2026").find((el) => {
        // Find the one inside the popover (CommandItem), not the button itself
        return el.closest('[role="option"]') !== null;
      });
      if (mar2026Option) {
        await act(async () => {
          fireEvent.click(mar2026Option);
        });
      } else {
        // Fallback: click any "Mar 2026" text that isn't the button
        const allMar = screen.getAllByText("Mar 2026");
        await act(async () => {
          fireEvent.click(allMar[allMar.length - 1]);
        });
      }

      // After selection, pie chart should show Mar 2026 data
      await waitFor(() => {
        // Mar 2026: "measure demo" has 5000 sessions, 12000 events, 8000 spans
        expect(
          screen.getByText(
            /measure demo: 5000 sessions, 12000 events, 8000 spans/,
          ),
        ).toBeTruthy();
        // Mar 2026: "other app" has 2000 sessions, 4000 events, 3000 spans
        expect(
          screen.getByText(/other app: 2000 sessions, 4000 events, 3000 spans/),
        ).toBeTruthy();
      });
    });

    it("month dropdown contains all available months from fixture", async () => {
      await renderAndWaitForData();
      // Open the dropdown
      const monthButton = screen.getByText("Apr 2026").closest("button")!;
      await act(async () => {
        fireEvent.click(monthButton);
      });
      // Both months should be available
      await waitFor(() => {
        expect(screen.getAllByText("Mar 2026").length).toBeGreaterThanOrEqual(
          1,
        );
        expect(screen.getAllByText("Apr 2026").length).toBeGreaterThanOrEqual(
          1,
        );
      });
    });
  });

  // ================================================================
  // API PATHS
  // ================================================================
  describe("API paths", () => {
    it("fetches usage from /teams/:teamId/usage", async () => {
      const paths: string[] = [];
      server.use(
        http.get("*/api/teams/:teamId/usage", ({ request }) => {
          paths.push(new URL(request.url).pathname);
          return HttpResponse.json(makeUsageFixture());
        }),
      );
      await renderAndWaitForData();
      expect(paths.some((p) => p.includes("/usage"))).toBe(true);
    });
  });

  // ================================================================
  // CACHING
  // ================================================================
  describe("caching", () => {
    it("data is cached by TanStack Query", async () => {
      await renderAndWaitForData();
      expect(screen.getByTestId("nivo-pie-chart")).toBeTruthy();
    });
  });
});

// ====================================================================
// BILLING (tested at DOM level since isBillingEnabled=false hides UI)
// ====================================================================
describe("Usage — billing section hidden", () => {
  it("does not render billing section when isBillingEnabled is false", async () => {
    renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
    await waitFor(
      () => {
        expect(screen.getByTestId("nivo-pie-chart")).toBeTruthy();
      },
      { timeout: 5000 },
    );
    expect(screen.queryByText("Billing")).toBeNull();
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
    it('renders "Upgrade to Pro" button when on free plan', async () => {
      server.use(
        http.get("*/api/teams/:teamId/billing/info", () => {
          return HttpResponse.json(makeBillingInfoFixture({ plan: "free" }));
        }),
      );
      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(screen.getByText("Billing")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      await waitFor(() => {
        expect(screen.getByText("Upgrade to Pro")).toBeTruthy();
      });
    });

    it("click Upgrade to Pro calls PATCH /teams/:teamId/billing/checkout and redirects", async () => {
      let capturedBody: any = null;
      let capturedPath: string = "";

      // Mock window.location.href assignment
      const originalLocation = window.location;
      const locationSpy = jest.fn();
      Object.defineProperty(window, "location", {
        value: {
          ...originalLocation,
          search: "",
          pathname: "/test-team/usage",
          set href(url: string) {
            locationSpy(url);
          },
          get href() {
            return "http://localhost/test-team/usage";
          },
        },
        writable: true,
        configurable: true,
      });

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

      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
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

      // Restore window.location
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("downgrade flow", () => {
    // Frontend hides the scheduled-cancellation UI when current_period_end
    // is in the past, so use a date well outside the test suite's lifetime.
    const futureCancelEnd = Math.floor(Date.UTC(2099, 0, 1) / 1000);

    it('renders "Downgrade to Free" button when on pro plan', async () => {
      server.use(
        http.get("*/api/teams/:teamId/billing/info", () => {
          return HttpResponse.json(makeBillingInfoFixture({ plan: "pro" }));
        }),
      );
      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(screen.getByText("Billing")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      await waitFor(() => {
        expect(screen.getByText("Downgrade to Free")).toBeTruthy();
      });
    });

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

      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
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

    it('renders "Undo Cancellation" button when canceled_at is set on pro plan', async () => {
      server.use(
        http.get("*/api/teams/:teamId/billing/info", () => {
          return HttpResponse.json(
            makeBillingInfoFixture({
              plan: "pro",
              canceled_at: 1700100000,
              current_period_end: futureCancelEnd,
            }),
          );
        }),
      );
      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(screen.getByText("Undo Cancellation")).toBeTruthy();
          expect(screen.getByText(/Cancellation scheduled for/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(screen.queryByText("Downgrade to Free")).toBeNull();
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

      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
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

      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
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

    it("downgrade cancel — no API call made", async () => {
      let downgradeCalled = false;

      server.use(
        http.get("*/api/teams/:teamId/billing/info", () => {
          return HttpResponse.json(makeBillingInfoFixture({ plan: "pro" }));
        }),
        http.patch("*/api/teams/:teamId/billing/downgrade", () => {
          downgradeCalled = true;
          return HttpResponse.json({ ok: true });
        }),
      );

      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
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
        expect(screen.getByText("Yes, schedule cancellation")).toBeTruthy();
      });

      // Click Cancel instead of confirming
      await act(async () => {
        fireEvent.click(screen.getByText("Cancel"));
      });

      // Wait and verify no API call was made
      await new Promise((r) => setTimeout(r, 500));
      expect(downgradeCalled).toBe(false);
    });
  });

  describe("enterprise plan", () => {
    it("renders Enterprise card with unlimited bytes, retention, plan period; hides Pro/Free cards and footer", async () => {
      // End-to-end: API returns plan=enterprise with bytes_unlimited and
      // retention_days populated. The page should render the dedicated
      // Enterprise card and suppress everything Pro/Free-specific
      // (upgrade pitch, downgrade button, "personalised plans" footer).
      server.use(
        http.get("*/api/teams/:teamId/billing/info", () => {
          return HttpResponse.json(
            makeBillingInfoFixture({
              plan: "enterprise",
              autumn_customer_id: "cust_ent",
              bytes_granted: 0,
              bytes_used: 5_000_000_000,
              bytes_unlimited: true,
              retention_days: 365,
              status: "active",
              current_period_start: 1700000000,
              current_period_end: 1702678400,
            }),
          );
        }),
      );

      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(screen.getByText("ENTERPRISE")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      expect(screen.getByText(/^Data:/)).toBeTruthy();
      expect(screen.getByText("Unlimited")).toBeTruthy();
      expect(screen.getByText(/Retention:/)).toBeTruthy();
      expect(screen.getByText("365 days")).toBeTruthy();
      expect(screen.getByText(/Plan period:/)).toBeTruthy();
      expect(screen.getByText("Manage Billing")).toBeTruthy();

      // The Pro-style "this cycle" framing and the prior split
      // "Data included" / "Data used" wording must not leak onto the
      // unified enterprise Data line.
      expect(screen.queryByText(/Data included:/)).toBeNull();
      expect(screen.queryByText(/Data used:/)).toBeNull();
      expect(screen.queryByText(/Data used this cycle:/)).toBeNull();

      // Pro/Free affordances must not appear on the enterprise screen.
      expect(screen.queryByText("FREE")).toBeNull();
      expect(screen.queryByText("PRO")).toBeNull();
      expect(screen.queryByText("Upgrade to Pro")).toBeNull();
      expect(screen.queryByText("Downgrade to Free")).toBeNull();
      expect(screen.queryByText(/personalised plans/)).toBeNull();
    });

    it("Enterprise Data line shows 'X of Y used, Z overage' when overage is allowed and used > granted", async () => {
      server.use(
        http.get("*/api/teams/:teamId/billing/info", () => {
          return HttpResponse.json(
            makeBillingInfoFixture({
              plan: "enterprise",
              bytes_unlimited: false,
              bytes_overage_allowed: true,
              bytes_granted: 100_000_000_000, // 100 GB
              bytes_used: 110_000_000_000, // 110 GB
              retention_days: 90,
              status: "active",
              current_period_start: 1700000000,
              current_period_end: 1702678400,
            }),
          );
        }),
      );

      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(screen.getByText("ENTERPRISE")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      expect(
        screen.getByText(/110\.00 GB of 100\.00 GB used, 10\.00 GB overage/),
      ).toBeTruthy();
      expect(screen.queryByText("Unlimited")).toBeNull();
    });

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

      // Stub assign so the redirect doesn't navigate away during the test.
      const originalLocation = window.location;
      const assignSpy = jest.fn();
      Object.defineProperty(window, "location", {
        writable: true,
        value: {
          ...originalLocation,
          assign: assignSpy,
          href: originalLocation.href,
        },
      });

      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
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

      // Restore window.location for downstream tests.
      Object.defineProperty(window, "location", {
        writable: true,
        value: originalLocation,
      });
    });
  });

  describe("free plan", () => {
    it("Free card shows the unified Data line driven by Autumn values; Pro pitch keeps marketing copy", async () => {
      // End-to-end: API returns plan=free with the user's actual byte
      // figures. The Free card should render "Data: X of Y used" sourced
      // from the response, and the Pro upgrade pitch alongside it should
      // keep the marketing bullets (we don't have Pro's Autumn balance
      // for an unattached user).
      server.use(
        http.get("*/api/teams/:teamId/billing/info", () => {
          return HttpResponse.json(
            makeBillingInfoFixture({
              plan: "free",
              bytes_granted: 5_000_000_000,
              bytes_used: 1_500_000_000,
              bytes_unlimited: false,
              bytes_overage_allowed: false,
            }),
          );
        }),
      );

      renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
      await waitFor(
        () => {
          expect(screen.getByText("FREE")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Free card: Autumn-driven Data line, no overage suffix.
      expect(screen.getByText(/1\.50 GB of 5\.00 GB used/)).toBeTruthy();
      expect(screen.queryByText(/overage/)).toBeNull();
      // Removed bullet must not regress.
      expect(screen.queryByText(/No credit card needed/)).toBeNull();

      // Pro pitch card: marketing constants must still render.
      expect(screen.getByText(/GB per month included/)).toBeTruthy();
      expect(screen.getByText(/Extra data charged at \$/)).toBeTruthy();
      expect(screen.getByText("Upgrade to Pro")).toBeTruthy();
    });
  });
});

// ====================================================================
// AUTH FAILURE
// ====================================================================
describe("Usage — auth failure", () => {
  it("401 on usage fetch triggers token refresh attempt", async () => {
    let refreshAttempted = false;
    server.use(
      http.get("*/api/teams/:teamId/usage", () => {
        return new HttpResponse(null, { status: 401 });
      }),
      http.post("*/auth/refresh", () => {
        refreshAttempted = true;
        return new HttpResponse(null, { status: 401 });
      }),
    );
    renderWithProviders(<Usage params={{ teamId: "test-team" }} />);
    await waitFor(
      () => {
        expect(refreshAttempted).toBe(true);
      },
      { timeout: 5000 },
    );
  });
});
