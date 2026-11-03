import { CookiePreferencesLink } from "@/app/components/cookie_preferences_link";
import { afterEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

jest.mock("c15t/next", () => ({
  ConsentDialogLink: ({
    children,
    slotKey,
  }: {
    children: ReactNode;
    slotKey?: string;
  }) => (
    <div data-testid="consent-dialog-link" data-slot-key={slotKey}>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/consent_manager", () => ({
  isConsentManaged: jest.fn(),
}));

import { isConsentManaged } from "@/app/components/consent_manager";

afterEach(() => {
  jest.clearAllMocks();
});

describe("CookiePreferencesLink", () => {
  it("renders the trigger through ConsentDialogLink when c15t is running", () => {
    (isConsentManaged as jest.Mock).mockReturnValue(true);

    render(
      <CookiePreferencesLink>
        <button type="button">Cookie Preferences</button>
      </CookiePreferencesLink>,
    );

    expect(screen.getByTestId("consent-dialog-link")).toHaveAttribute(
      "data-slot-key",
      "trigger.root",
    );
    expect(screen.getByText("Cookie Preferences")).toBeInTheDocument();
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
});
