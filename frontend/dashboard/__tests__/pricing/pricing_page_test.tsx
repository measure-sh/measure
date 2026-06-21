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

// Imported after the mocks so they take effect (next/jest only applies
// jest.mock to modules imported below the mock calls).
import Pricing from "@/app/pricing/page";
import {
  FREE_GB,
  FREE_RETENTION_DAYS,
  INCLUDED_PRO_GB,
  MINIMUM_PRICE_AFTER_FREE_TIER,
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
      expect(screen.getByText("FREE")).toBeInTheDocument();
      expect(screen.getByText("$0 per month")).toBeInTheDocument();
      expect(screen.getByText(`${FREE_GB} GB per month`)).toBeInTheDocument();
      expect(
        screen.getByText(`${FREE_RETENTION_DAYS} days retention`),
      ).toBeInTheDocument();
    });

    it("renders the pro plan", () => {
      render(<Pricing />);
      expect(screen.getByText("PRO")).toBeInTheDocument();
      expect(
        screen.getByText(`$${MINIMUM_PRICE_AFTER_FREE_TIER} per month`),
      ).toBeInTheDocument();
      expect(
        screen.getByText(`${INCLUDED_PRO_GB} GB per month included`),
      ).toBeInTheDocument();
      expect(
        screen.getByText(`${PRO_RETENTION_DAYS} days retention`),
      ).toBeInTheDocument();
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

    it("reveals advanced settings on demand", () => {
      render(<Pricing />);
      expect(
        screen.queryByRole("textbox", { name: /Average app opens/ }),
      ).not.toBeInTheDocument();

      act(() =>
        fireEvent.click(
          screen.getByRole("button", { name: /Advanced Settings/ }),
        ),
      );

      expect(
        screen.getByRole("textbox", { name: /Average app opens/ }),
      ).toBeInTheDocument();
    });
  });
});
