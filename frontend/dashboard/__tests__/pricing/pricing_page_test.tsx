import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

// Radix Slider (inside the calculator) measures its track via ResizeObserver.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

// Analytics is fire-and-forget; stub it so PricingViewed / CTA links don't run it.
jest.mock("@/app/utils/analytics/track", () => ({ track: jest.fn() }));

// Landing chrome pulls in next/image, theme and the c15t consent stack (which
// imports next server internals jest can't transform) — none of it is under test.
jest.mock("@/app/components/landing_header", () => ({
  __esModule: true,
  default: () => <div data-testid="landing-header" />,
}));
jest.mock("@/app/components/landing_footer", () => ({
  __esModule: true,
  default: () => <div data-testid="landing-footer" />,
}));
// The CTA calls /auth/status through TanStack Query, and these tests render
// without a QueryClientProvider.
jest.mock("@/app/components/get_started_link", () => ({
  __esModule: true,
  default: () => <a href="/auth/login">Get Started</a>,
}));

// Imported after the mocks so they take effect (next/jest only applies
// jest.mock to modules imported below the mock calls).
import Pricing from "@/app/pricing/page";
import {
  FREE_GB,
  FREE_RETENTION_DAYS,
  INCLUDED_PRO_GB,
  MINIMUM_PRICE_AFTER_FREE_TIER,
  PRICE_PER_GB_MONTH,
  PRO_RETENTION_DAYS,
} from "@/app/utils/pricing_constants";

const dailyUsers = () =>
  screen.getByRole("textbox", { name: "Daily app users" }) as HTMLInputElement;

describe("Pricing page", () => {
  describe("marketing content", () => {
    it("renders the heading and landing chrome", () => {
      render(<Pricing />);
      expect(
        screen.getByRole("heading", { level: 1, name: "Pricing" }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("landing-header")).toBeInTheDocument();
      expect(screen.getByTestId("landing-footer")).toBeInTheDocument();
    });

    it("renders the free plan", () => {
      render(<Pricing />);
      const plan = screen.getByRole("heading", { name: "Free" }).parentElement!;
      expect(plan).toHaveTextContent("$0 per month");
      expect(plan).toHaveTextContent(`${FREE_GB} GB of data`);
      expect(plan).toHaveTextContent(`${FREE_RETENTION_DAYS} days retention`);
    });

    it("renders the pro plan", () => {
      render(<Pricing />);
      const plan = screen.getByRole("heading", { name: "Pro" }).parentElement!;
      expect(plan).toHaveTextContent(
        `$${MINIMUM_PRICE_AFTER_FREE_TIER} per month`,
      );
      expect(plan).toHaveTextContent(
        `${INCLUDED_PRO_GB} GB of data, then $${PRICE_PER_GB_MONTH.toFixed(2)} per GB`,
      );
      expect(plan).toHaveTextContent(`${PRO_RETENTION_DAYS} days retention`);
    });

    it("renders the differentiators", () => {
      render(<Pricing />);
      expect(screen.getByText("No Seat Limits")).toBeInTheDocument();
      expect(screen.getByText("No Artificial Bundles")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Adaptive Capture" }),
      ).toHaveAttribute("href", "/product/adaptive-capture");
    });
  });

  describe("cost estimator", () => {
    it("renders the calculator", () => {
      render(<Pricing />);
      expect(
        screen.getByText("Estimate Your Monthly Cost"),
      ).toBeInTheDocument();
      expect(dailyUsers()).toBeInTheDocument();
    });

    it("starts on the free tier for low usage", () => {
      render(<Pricing />);
      expect(screen.getByText("Free Tier")).toBeInTheDocument();
      expect(
        screen.queryByText(/Estimated monthly cost/),
      ).not.toBeInTheDocument();
    });

    it("shows a paid estimate once usage grows", () => {
      render(<Pricing />);
      act(() =>
        fireEvent.change(dailyUsers(), { target: { value: "10000000" } }),
      );
      expect(screen.getByText(/Estimated monthly cost/)).toBeInTheDocument();
      expect(screen.queryByText("Free Tier")).not.toBeInTheDocument();
    });

    it("charges the minimum price when usage is above the free tier but costs less", () => {
      render(<Pricing />);
      // At the default settings this is above the free tier and costs less than the minimum.
      act(() => fireEvent.change(dailyUsers(), { target: { value: "50000" } }));
      expect(
        screen.getByText(/Estimated monthly cost/).nextElementSibling,
      ).toHaveTextContent(`$${MINIMUM_PRICE_AFTER_FREE_TIER}`);
    });

    // At the default settings, 1,000 users opening the app 3 times a day.
    it.each([
      ["App opens per user per day", "6", "Session tracking events", "180K"],
      ["Session length", "20", "Journey events", "1.8K"],
      ["Session length", "20", "Session replay events", "540K"],
      [
        "Sessions with an error",
        "1",
        "Error, ANR, App Hang & Bug report events",
        "900",
      ],
      ["Trace sampling rate", "1", "Performance spans", "9K"],
      ["Spans per session", "20", "Performance spans", "18"],
      ["Launch metrics sampling rate", "1", "Launch time events", "900"],
      ["User journey sampling rate", "1", "Journey events", "45K"],
      ["HTTP sampling rate", "1", "HTTP events", "18K"],
      ["Requests per session", "40", "HTTP events", "360"],
    ])(
      "updates the estimate when %s changes",
      (inputLabel, value, resultLabel, expected) => {
        render(<Pricing />);
        act(() =>
          fireEvent.click(
            screen.getByRole("button", { name: /Advanced Settings/ }),
          ),
        );
        act(() =>
          fireEvent.change(screen.getByRole("textbox", { name: inputLabel }), {
            target: { value },
          }),
        );
        expect(
          screen.getByText(`${resultLabel} per month:`).nextElementSibling,
        ).toHaveTextContent(expected);
      },
    );

    it("reveals advanced settings on demand", () => {
      render(<Pricing />);
      expect(
        screen.queryByRole("textbox", { name: /App opens per user per day/ }),
      ).not.toBeInTheDocument();

      act(() =>
        fireEvent.click(
          screen.getByRole("button", { name: /Advanced Settings/ }),
        ),
      );

      expect(
        screen.getByRole("textbox", { name: /App opens per user per day/ }),
      ).toBeInTheDocument();
    });
  });
});
