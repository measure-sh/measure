import { ConditionalLeadsy } from "@/app/components/conditional_leadsy";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("next/script", () => ({
  __esModule: true,
  default: ({
    id,
    src,
    ...rest
  }: {
    id: string;
    src: string;
    [key: string]: unknown;
  }) => (
    <div
      data-testid="leadsy-script"
      data-id={id}
      data-src={src}
      data-pid={(rest as { "data-pid"?: string })["data-pid"]}
      data-version={(rest as { "data-version"?: string })["data-version"]}
    />
  ),
}));

jest.mock("@/app/context/cookie_consent", () => ({
  useCookieConsent: jest.fn(),
}));

import { useCookieConsent } from "@/app/context/cookie_consent";

beforeEach(() => {
  process.env.NEXT_PUBLIC_LEADSY_ID = "LEADSY-TEST";
  (useCookieConsent as jest.Mock).mockReturnValue({
    consent: "granted",
    setConsent: jest.fn(),
    hydrated: true,
  });
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_LEADSY_ID;
});

describe("ConditionalLeadsy", () => {
  it("renders Leadsy script when consent is granted and Leadsy ID is set", () => {
    render(<ConditionalLeadsy />);

    const script = screen.getByTestId("leadsy-script");
    expect(script).toBeInTheDocument();
    expect(script).toHaveAttribute("data-id", "vtag-ai-js");
    expect(script).toHaveAttribute("data-src", "https://r2.leadsy.ai/tag.js");
    expect(script).toHaveAttribute("data-pid", "LEADSY-TEST");
    expect(script).toHaveAttribute("data-version", "062024");
  });

  it("does not render when consent is pending", () => {
    (useCookieConsent as jest.Mock).mockReturnValue({
      consent: "pending",
      setConsent: jest.fn(),
      hydrated: true,
    });

    render(<ConditionalLeadsy />);

    expect(screen.queryByTestId("leadsy-script")).not.toBeInTheDocument();
  });

  it("does not render when consent is denied", () => {
    (useCookieConsent as jest.Mock).mockReturnValue({
      consent: "denied",
      setConsent: jest.fn(),
      hydrated: true,
    });

    render(<ConditionalLeadsy />);

    expect(screen.queryByTestId("leadsy-script")).not.toBeInTheDocument();
  });

  it("does not render when Leadsy ID is not set, even if consent is granted", () => {
    delete process.env.NEXT_PUBLIC_LEADSY_ID;

    render(<ConditionalLeadsy />);

    expect(screen.queryByTestId("leadsy-script")).not.toBeInTheDocument();
  });
});
