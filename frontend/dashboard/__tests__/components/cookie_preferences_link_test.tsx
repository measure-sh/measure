import { CookiePreferencesLink } from "@/app/components/cookie_preferences_link";
import { afterEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

jest.mock("@c15t/nextjs", () => ({
  useConsentManager: jest.fn(),
  ConsentDialogLink: ({ children }: { children: ReactNode }) => (
    <div data-testid="consent-dialog-link">{children}</div>
  ),
}));

jest.mock("@/app/components/consent_manager", () => ({
  isConsentManaged: jest.fn(),
}));

import { isConsentManaged } from "@/app/components/consent_manager";
import { useConsentManager } from "@c15t/nextjs";

afterEach(() => {
  jest.clearAllMocks();
});

describe("CookiePreferencesLink", () => {
  it("renders the trigger when c15t is running and the jurisdiction needs consent", () => {
    (isConsentManaged as jest.Mock).mockReturnValue(true);
    (useConsentManager as jest.Mock).mockReturnValue({
      hasFetchedBanner: true,
      model: "opt-in",
    });

    render(
      <CookiePreferencesLink>
        <button type="button">Cookie Preferences</button>
      </CookiePreferencesLink>,
    );

    expect(screen.getByTestId("consent-dialog-link")).toBeInTheDocument();
    expect(screen.getByText("Cookie Preferences")).toBeInTheDocument();
  });

  it("renders nothing when the jurisdiction needs no consent handling", () => {
    (isConsentManaged as jest.Mock).mockReturnValue(true);
    (useConsentManager as jest.Mock).mockReturnValue({
      hasFetchedBanner: true,
      model: null,
    });

    render(
      <CookiePreferencesLink>
        <button type="button">Cookie Preferences</button>
      </CookiePreferencesLink>,
    );

    expect(screen.queryByText("Cookie Preferences")).not.toBeInTheDocument();
  });

  it("renders nothing when c15t is not running", () => {
    (isConsentManaged as jest.Mock).mockReturnValue(false);

    render(
      <CookiePreferencesLink>
        <button type="button">Cookie Preferences</button>
      </CookiePreferencesLink>,
    );

    expect(screen.queryByText("Cookie Preferences")).not.toBeInTheDocument();
  });

  it("renders nothing when c15t has not resolved the jurisdiction", () => {
    (isConsentManaged as jest.Mock).mockReturnValue(true);
    (useConsentManager as jest.Mock).mockReturnValue({
      hasFetchedBanner: false,
      model: "opt-in",
    });

    render(
      <CookiePreferencesLink>
        <button type="button">Cookie Preferences</button>
      </CookiePreferencesLink>,
    );

    expect(screen.queryByText("Cookie Preferences")).not.toBeInTheDocument();
  });
});
