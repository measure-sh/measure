import { ConsentManager, offlineMode } from "@/app/components/consent_manager";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

// Captured so tests can invoke the consent callbacks the provider is handed.
let providerOptions: {
  mode: string;
  scripts?: unknown[];
  callbacks?: {
    onConsentChanged?: (payload: { deniedCategories: string[] }) => void;
  };
} | null = null;

jest.mock("@c15t/nextjs", () => ({
  ConsentManagerProvider: ({
    children,
    options,
  }: {
    children: ReactNode;
    options: {
      mode: string;
      scripts?: unknown[];
      callbacks?: {
        onConsentChanged?: (payload: { deniedCategories: string[] }) => void;
      };
    };
  }) => {
    providerOptions = options;
    return (
      <div
        data-testid="consent-provider"
        data-mode={options.mode}
        data-script-count={options.scripts?.length ?? 0}
      >
        {children}
      </div>
    );
  },
  ConsentBanner: () => <div data-testid="consent-banner" />,
  ConsentDialog: () => <div data-testid="consent-dialog" />,
  // Consumed by ConsentedAttributionCapture, mounted inside the provider.
  useConsentManager: () => ({ has: () => false }),
  policyPackPresets: {
    europeOptIn: () => ({}),
    californiaOptOut: () => ({}),
    quebecOptIn: () => ({}),
    worldNoBanner: () => ({}),
  },
}));

jest.mock("@c15t/scripts/google-tag-manager", () => ({
  googleTagManager: jest.fn((options: { id: string }) => ({
    id: "google-tag-manager",
    gtmId: options.id,
  })),
}));

// Marked so the tests can assert PostHog is wired in only when c15t is active.
jest.mock("@/app/context/posthog", () => ({
  PostHogProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="posthog-provider">{children}</div>
  ),
}));

jest.mock("@/app/utils/env_utils", () => ({
  isCloud: jest.fn(),
}));

// The clear fns are asserted on directly; the capture fns are stubbed because
// the attribution components mounted in both branches call them on mount.
jest.mock("@/app/utils/analytics/utm", () => ({
  clearStoredUTMs: jest.fn(),
  captureUTMsFromURL: jest.fn(),
}));

jest.mock("@/app/utils/analytics/attribution", () => ({
  clearStoredGCLID: jest.fn(),
  captureGCLIDFromURL: jest.fn(),
}));

import { clearStoredGCLID } from "@/app/utils/analytics/attribution";
import { clearStoredUTMs } from "@/app/utils/analytics/utm";
import { isCloud } from "@/app/utils/env_utils";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_C15T_BACKEND_URL;
  delete process.env.NEXT_PUBLIC_GTM_ID;
});

// `offlineMode` is a compile-time const in consent_manager.tsx. The suite runs
// against whichever value is committed (normally false); the offline path is
// covered on its own branch so the suite stays green if a developer flips it
// on locally to test the banner.
if (offlineMode) {
  describe("ConsentManager in offline mode", () => {
    it("initialises c15t offline and wires up the banner and PostHog", () => {
      (isCloud as jest.Mock).mockReturnValue(false);

      render(
        <ConsentManager>
          <div data-testid="child" />
        </ConsentManager>,
      );

      expect(screen.getByTestId("consent-provider")).toHaveAttribute(
        "data-mode",
        "offline",
      );
      expect(screen.getByTestId("consent-banner")).toBeInTheDocument();
      expect(screen.getByTestId("consent-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("posthog-provider")).toBeInTheDocument();
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
  });
} else {
  describe("ConsentManager in cloud mode with a backend URL", () => {
    beforeEach(() => {
      (isCloud as jest.Mock).mockReturnValue(true);
      process.env.NEXT_PUBLIC_C15T_BACKEND_URL = "https://consent.example.com";
    });

    it("initialises c15t in hosted mode and wires up the banner and PostHog", () => {
      render(
        <ConsentManager>
          <div data-testid="child" />
        </ConsentManager>,
      );

      expect(screen.getByTestId("consent-provider")).toHaveAttribute(
        "data-mode",
        "hosted",
      );
      expect(screen.getByTestId("consent-banner")).toBeInTheDocument();
      expect(screen.getByTestId("consent-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("posthog-provider")).toBeInTheDocument();
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("registers the Google Tag Manager script when a GTM ID is set", () => {
      process.env.NEXT_PUBLIC_GTM_ID = "GTM-TEST";

      render(
        <ConsentManager>
          <div data-testid="child" />
        </ConsentManager>,
      );

      expect(screen.getByTestId("consent-provider")).toHaveAttribute(
        "data-script-count",
        "1",
      );
    });

    it("registers no scripts when no GTM ID is set", () => {
      render(
        <ConsentManager>
          <div data-testid="child" />
        </ConsentManager>,
      );

      expect(screen.getByTestId("consent-provider")).toHaveAttribute(
        "data-script-count",
        "0",
      );
    });
  });

  describe("ConsentManager without c15t", () => {
    it("does not initialise c15t or PostHog in cloud mode when no backend URL is set", () => {
      (isCloud as jest.Mock).mockReturnValue(true);

      render(
        <ConsentManager>
          <div data-testid="child" />
        </ConsentManager>,
      );

      expect(screen.queryByTestId("consent-provider")).not.toBeInTheDocument();
      expect(screen.queryByTestId("consent-banner")).not.toBeInTheDocument();
      expect(screen.queryByTestId("posthog-provider")).not.toBeInTheDocument();
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("does not initialise c15t or PostHog in self-hosted mode", () => {
      (isCloud as jest.Mock).mockReturnValue(false);
      process.env.NEXT_PUBLIC_C15T_BACKEND_URL = "https://consent.example.com";

      render(
        <ConsentManager>
          <div data-testid="child" />
        </ConsentManager>,
      );

      expect(screen.queryByTestId("consent-provider")).not.toBeInTheDocument();
      expect(screen.queryByTestId("consent-banner")).not.toBeInTheDocument();
      expect(screen.queryByTestId("posthog-provider")).not.toBeInTheDocument();
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
  });
}

describe("ConsentManager consent withdrawal", () => {
  beforeEach(() => {
    (isCloud as jest.Mock).mockReturnValue(true);
    process.env.NEXT_PUBLIC_C15T_BACKEND_URL = "https://consent.example.com";
    (clearStoredUTMs as jest.Mock).mockClear();
    (clearStoredGCLID as jest.Mock).mockClear();

    render(
      <ConsentManager>
        <div data-testid="child" />
      </ConsentManager>,
    );
  });

  it("clears stored attribution when marketing consent is withdrawn", () => {
    providerOptions?.callbacks?.onConsentChanged?.({
      deniedCategories: ["marketing"],
    });

    expect(clearStoredUTMs).toHaveBeenCalledTimes(1);
    expect(clearStoredGCLID).toHaveBeenCalledTimes(1);
  });

  it("keeps stored attribution when only analytics is withdrawn", () => {
    providerOptions?.callbacks?.onConsentChanged?.({
      deniedCategories: ["measurement"],
    });

    expect(clearStoredUTMs).not.toHaveBeenCalled();
    expect(clearStoredGCLID).not.toHaveBeenCalled();
  });
});
