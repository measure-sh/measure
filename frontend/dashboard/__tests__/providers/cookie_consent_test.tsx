import { CookieConsentProvider, useCookieConsent } from "@/app/context/cookie_consent";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("@/app/utils/env_utils", () => ({
  isCloud: jest.fn(),
}));

import { isCloud } from "@/app/utils/env_utils";

const STORAGE_KEY = "msr_cookie_consent";

function ConsentProbe() {
  const { consent, hydrated, setConsent } = useCookieConsent();
  return (
    <>
      <div data-testid="consent">{consent}</div>
      <div data-testid="hydrated">{String(hydrated)}</div>
      <button data-testid="grant" onClick={() => setConsent("granted")}>grant</button>
      <button data-testid="deny" onClick={() => setConsent("denied")}>deny</button>
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("CookieConsentProvider in cloud mode", () => {
  beforeEach(() => {
    (isCloud as jest.Mock).mockReturnValue(true);
  });

  it("starts pending and hydrates from empty storage", async () => {
    render(
      <CookieConsentProvider>
        <ConsentProbe />
      </CookieConsentProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated")).toHaveTextContent("true");
    });
    expect(screen.getByTestId("consent")).toHaveTextContent("pending");
  });

  it("hydrates 'granted' from localStorage", async () => {
    window.localStorage.setItem(STORAGE_KEY, "granted");

    render(
      <CookieConsentProvider>
        <ConsentProbe />
      </CookieConsentProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("consent")).toHaveTextContent("granted");
    });
  });

  it("hydrates 'denied' from localStorage", async () => {
    window.localStorage.setItem(STORAGE_KEY, "denied");

    render(
      <CookieConsentProvider>
        <ConsentProbe />
      </CookieConsentProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("consent")).toHaveTextContent("denied");
    });
  });

  it("ignores unknown stored values", async () => {
    window.localStorage.setItem(STORAGE_KEY, "garbage");

    render(
      <CookieConsentProvider>
        <ConsentProbe />
      </CookieConsentProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated")).toHaveTextContent("true");
    });
    expect(screen.getByTestId("consent")).toHaveTextContent("pending");
  });

  it("setConsent('granted') writes to localStorage and updates state", async () => {
    render(
      <CookieConsentProvider>
        <ConsentProbe />
      </CookieConsentProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId("grant"));
    });

    expect(screen.getByTestId("consent")).toHaveTextContent("granted");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("granted");
  });

  it("setConsent('denied') writes to localStorage and updates state", async () => {
    render(
      <CookieConsentProvider>
        <ConsentProbe />
      </CookieConsentProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId("deny"));
    });

    expect(screen.getByTestId("consent")).toHaveTextContent("denied");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("denied");
  });
});

describe("CookieConsentProvider in self-hosted mode", () => {
  beforeEach(() => {
    (isCloud as jest.Mock).mockReturnValue(false);
  });

  it("forces consent to 'denied' regardless of localStorage", async () => {
    window.localStorage.setItem(STORAGE_KEY, "granted");

    render(
      <CookieConsentProvider>
        <ConsentProbe />
      </CookieConsentProvider>,
    );

    expect(screen.getByTestId("consent")).toHaveTextContent("denied");
    expect(screen.getByTestId("hydrated")).toHaveTextContent("true");
  });

  it("setConsent is a noop and does not write to localStorage", async () => {
    render(
      <CookieConsentProvider>
        <ConsentProbe />
      </CookieConsentProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId("grant"));
    });

    expect(screen.getByTestId("consent")).toHaveTextContent("denied");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
