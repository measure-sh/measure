import { ConditionalReo } from "@/app/components/conditional_reo";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("next/script", () => ({
  __esModule: true,
  default: ({
    id,
    src,
  }: {
    id: string;
    src: string;
    [key: string]: unknown;
  }) => <div data-testid="reo-script" data-id={id} data-src={src} />,
}));

jest.mock("@/app/context/cookie_consent", () => ({
  useCookieConsent: jest.fn(),
}));

import { useCookieConsent } from "@/app/context/cookie_consent";

beforeEach(() => {
  process.env.NEXT_PUBLIC_REO_ID = "REO-TEST";
  (useCookieConsent as jest.Mock).mockReturnValue({
    consent: "granted",
    setConsent: jest.fn(),
    hydrated: true,
  });
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_REO_ID;
});

describe("ConditionalReo", () => {
  it("renders Reo script when consent is granted and Reo ID is set", () => {
    render(<ConditionalReo />);

    const script = screen.getByTestId("reo-script");
    expect(script).toBeInTheDocument();
    expect(script).toHaveAttribute("data-id", "reo-js");
    expect(script).toHaveAttribute(
      "data-src",
      "https://static.reo.dev/REO-TEST/reo.js",
    );
  });

  it("does not render when consent is pending", () => {
    (useCookieConsent as jest.Mock).mockReturnValue({
      consent: "pending",
      setConsent: jest.fn(),
      hydrated: true,
    });

    render(<ConditionalReo />);

    expect(screen.queryByTestId("reo-script")).not.toBeInTheDocument();
  });

  it("does not render when consent is denied", () => {
    (useCookieConsent as jest.Mock).mockReturnValue({
      consent: "denied",
      setConsent: jest.fn(),
      hydrated: true,
    });

    render(<ConditionalReo />);

    expect(screen.queryByTestId("reo-script")).not.toBeInTheDocument();
  });

  it("does not render when Reo ID is not set, even if consent is granted", () => {
    delete process.env.NEXT_PUBLIC_REO_ID;

    render(<ConditionalReo />);

    expect(screen.queryByTestId("reo-script")).not.toBeInTheDocument();
  });
});
