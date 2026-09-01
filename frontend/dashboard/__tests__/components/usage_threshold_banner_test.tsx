import UsageThresholdBanner from "@/app/components/usage_threshold_banner";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock query hook
let mockBillingInfo: any = undefined;

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useBillingInfoQuery: () => ({
    data: mockBillingInfo,
    status: mockBillingInfo !== undefined ? "success" : "pending",
    error: null,
  }),
}));

jest.mock("@/app/utils/feature_flag_utils", () => ({
  isBillingEnabled: jest.fn(),
}));

jest.mock("next/link", () => {
  return function MockLink({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  };
});

const { isBillingEnabled } = require("@/app/utils/feature_flag_utils");

// Helper: build a billingInfo payload that produces a given usage percentage on Free.
function freeAt(percent: number) {
  const granted = 5_000_000_000;
  return {
    plan: "free",
    bytes_granted: granted,
    bytes_used: granted * (percent / 100),
  };
}

// Helper: build a billingInfo payload that produces a given usage percentage
// on an Enterprise plan with a finite data limit.
function enterpriseAt(percent: number) {
  const granted = 100_000_000_000;
  return {
    plan: "enterprise",
    bytes_granted: granted,
    bytes_used: granted * (percent / 100),
    bytes_unlimited: false,
  };
}

// Helper: build a billingInfo payload for a team holding the free plan
// alongside a plan sold as a one-off purchase whose grant is used up. Autumn
// pools both grants into the bytes figures, so the pooled percentage lands
// wherever the two grants happen to put it while the monthly free grant keeps
// admitting data, which is why the backend reports ingestion_blocked as false
// here.
function purchaseSpentAt(percent: number) {
  const granted = 370_000_000_000;
  return {
    plan: "enterprise",
    bytes_granted: granted,
    bytes_used: granted * (percent / 100),
    bytes_unlimited: false,
    data_purchase_spent: true,
    ingestion_blocked: false,
  };
}

describe("UsageThresholdBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBillingInfo = undefined;
  });

  describe("When billing is disabled", () => {
    it("renders nothing", () => {
      isBillingEnabled.mockReturnValue(false);
      mockBillingInfo = undefined;

      const { container } = render(<UsageThresholdBanner teamId="team-1" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("When usage is below 75%", () => {
    it("renders nothing", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = freeAt(50);

      const { container } = render(<UsageThresholdBanner teamId="team-1" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("When billingInfo is undefined (pending)", () => {
    it("renders nothing gracefully", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = undefined;

      const { container } = render(<UsageThresholdBanner teamId="team-1" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("When the team is on the Pro plan", () => {
    it("renders nothing even at 100% usage (Pro self-manages overages)", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = {
        plan: "pro",
        bytes_granted: 25_000_000_000,
        bytes_used: 25_000_000_000,
      };

      const { container } = render(<UsageThresholdBanner teamId="team-1" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("When the team is on Enterprise with unlimited bytes", () => {
    it("renders nothing even at 100% of the granted bytes", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = {
        plan: "enterprise",
        bytes_granted: 100_000_000_000,
        bytes_used: 100_000_000_000,
        bytes_unlimited: true,
      };

      const { container } = render(<UsageThresholdBanner teamId="team-1" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("When an Enterprise team with a finite limit crosses thresholds", () => {
    it("shows yellow banner with Contact Us mailto at 75%", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = enterpriseAt(80);

      render(<UsageThresholdBanner teamId="team-1" />);

      expect(
        screen.getByText("75% of plan data limit used."),
      ).toBeInTheDocument();

      const banner = screen.getByText(
        "75% of plan data limit used.",
      ).parentElement!;
      expect(banner).toHaveClass("bg-yellow-300");

      const link = screen.getByRole("link", { name: /Contact Us/i });
      expect(link).toHaveAttribute("href", "mailto:hello@measure.sh");
    });

    it("shows orange banner with Contact Us mailto at 90%", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = enterpriseAt(95);

      render(<UsageThresholdBanner teamId="team-1" />);

      expect(
        screen.getByText("90% of plan data limit used."),
      ).toBeInTheDocument();

      const banner = screen.getByText(
        "90% of plan data limit used.",
      ).parentElement!;
      expect(banner).toHaveClass("bg-orange-300");

      const link = screen.getByRole("link", { name: /Contact Us/i });
      expect(link).toHaveAttribute("href", "mailto:hello@measure.sh");
    });

    it("shows red banner with Contact Us mailto at 100%", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = { ...enterpriseAt(100), ingestion_blocked: true };

      render(<UsageThresholdBanner teamId="team-1" />);

      expect(
        screen.getByText(
          "100% of plan data limit used — event ingestion blocked.",
        ),
      ).toBeInTheDocument();

      const banner = screen.getByText(
        "100% of plan data limit used — event ingestion blocked.",
      ).parentElement!;
      expect(banner).toHaveClass("bg-red-300");

      const link = screen.getByRole("link", { name: /Contact Us/i });
      expect(link).toHaveAttribute("href", "mailto:hello@measure.sh");
    });
  });

  describe("When the backend reports ingestion blocked", () => {
    it("takes priority over a spent data purchase", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = { ...purchaseSpentAt(100), ingestion_blocked: true };

      render(<UsageThresholdBanner teamId="team-1" />);

      const message = screen.getByText(
        "100% of plan data limit used — event ingestion blocked.",
      );
      expect(message).toBeInTheDocument();
      expect(message.parentElement!).toHaveClass("bg-red-300");
    });
  });

  describe("When a one-off data purchase is spent", () => {
    it("says usage is limited to free plan limits, with no percentage", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = purchaseSpentAt(98.6);

      render(<UsageThresholdBanner teamId="team-1" />);

      const message = screen.getByText(
        "Your usage is limited to free plan limits.",
      );
      expect(message).toBeInTheDocument();
      expect(message.textContent).not.toMatch(/%/);
      expect(message.parentElement!).toHaveClass("bg-orange-300");

      const link = screen.getByRole("link", { name: /Contact Us/i });
      expect(link).toHaveAttribute("href", "mailto:hello@measure.sh");
    });

    it("still warns when the pooled percentage sits below 75", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = purchaseSpentAt(60);

      render(<UsageThresholdBanner teamId="team-1" />);

      const message = screen.getByText(
        "Your usage is limited to free plan limits.",
      );
      expect(message).toBeInTheDocument();
      expect(message.parentElement!).toHaveClass("bg-orange-300");
    });
  });

  describe("When the pool is at 100% and overage is allowed", () => {
    it("reports the limit is reached without claiming ingestion stopped", () => {
      isBillingEnabled.mockReturnValue(true);
      // Overage keeps data flowing past the limit, so the backend reports
      // ingestion_blocked as false.
      mockBillingInfo = {
        ...enterpriseAt(100),
        bytes_overage_allowed: true,
        ingestion_blocked: false,
      };

      render(<UsageThresholdBanner teamId="team-1" />);

      const message = screen.getByText("100% of plan data limit used.");
      expect(message).toBeInTheDocument();
      expect(message.textContent).not.toMatch(/blocked/);
      expect(message.parentElement!).toHaveClass("bg-red-300");
    });
  });

  describe("When usage is in the 75% bucket", () => {
    it("shows yellow banner with 75% message", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = freeAt(80);

      render(<UsageThresholdBanner teamId="team-1" />);

      expect(screen.getByText("75% of free plan used.")).toBeInTheDocument();

      const banner = screen.getByText("75% of free plan used.").parentElement!;
      expect(banner).toHaveClass("bg-yellow-300");
      expect(banner).toHaveClass("text-primary-foreground");
    });

    it("shows Upgrade to Pro link pointing to usage page", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = freeAt(80);

      render(<UsageThresholdBanner teamId="team-1" />);

      const link = screen.getByRole("link", { name: /Upgrade to Pro/i });
      expect(link).toHaveAttribute("href", "/team-1/usage");
    });
  });

  describe("When usage is in the 90% bucket", () => {
    it("shows orange banner with 90% message", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = freeAt(95);

      render(<UsageThresholdBanner teamId="team-1" />);

      expect(screen.getByText("90% of free plan used.")).toBeInTheDocument();

      const banner = screen.getByText("90% of free plan used.").parentElement!;
      expect(banner).toHaveClass("bg-orange-300");
      expect(banner).toHaveClass("text-primary-foreground");
    });

    it("shows Upgrade to Pro link pointing to usage page", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = freeAt(95);

      render(<UsageThresholdBanner teamId="team-1" />);

      const link = screen.getByRole("link", { name: /Upgrade to Pro/i });
      expect(link).toHaveAttribute("href", "/team-1/usage");
    });
  });

  describe("When usage is at or above 100%", () => {
    it("shows red banner with ingest blocked message", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = { ...freeAt(100), ingestion_blocked: true };

      render(<UsageThresholdBanner teamId="team-1" />);

      expect(
        screen.getByText("100% of free plan used — event ingestion blocked."),
      ).toBeInTheDocument();

      const banner = screen.getByText(
        "100% of free plan used — event ingestion blocked.",
      ).parentElement!;
      expect(banner).toHaveClass("bg-red-300");
      expect(banner).toHaveClass("text-primary-foreground");
    });

    it("shows Upgrade to Pro link pointing to usage page", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = { ...freeAt(100), ingestion_blocked: true };

      render(<UsageThresholdBanner teamId="team-1" />);

      const link = screen.getByRole("link", { name: /Upgrade to Pro/i });
      expect(link).toHaveAttribute("href", "/team-1/usage");
    });
  });

  describe("When teamId changes", () => {
    it("updates the upgrade link href for the new team", () => {
      isBillingEnabled.mockReturnValue(true);
      mockBillingInfo = freeAt(80);

      const { rerender } = render(<UsageThresholdBanner teamId="team-1" />);

      const link1 = screen.getByRole("link", { name: /Upgrade to Pro/i });
      expect(link1).toHaveAttribute("href", "/team-1/usage");

      rerender(<UsageThresholdBanner teamId="team-2" />);

      const link2 = screen.getByRole("link", { name: /Upgrade to Pro/i });
      expect(link2).toHaveAttribute("href", "/team-2/usage");
    });
  });
});
