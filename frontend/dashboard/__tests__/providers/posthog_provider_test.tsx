import { PostHogProvider } from "@/app/context/posthog";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, waitFor } from "@testing-library/react";

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    opt_in_capturing: jest.fn(),
    opt_out_capturing: jest.fn(),
  },
}));

jest.mock("@/app/utils/env_utils", () => ({
  isCloud: jest.fn(),
}));

jest.mock("@/app/context/cookie_consent", () => ({
  useCookieConsent: jest.fn(),
}));

import { useCookieConsent } from "@/app/context/cookie_consent";
import { isCloud } from "@/app/utils/env_utils";
import posthog from "posthog-js";

beforeEach(() => {
  (posthog.init as jest.Mock).mockClear();
  (posthog.opt_in_capturing as jest.Mock).mockClear();
  (posthog.opt_out_capturing as jest.Mock).mockClear();
  (isCloud as jest.Mock).mockReturnValue(true);
  (useCookieConsent as jest.Mock).mockReturnValue({
    consent: "pending",
    setConsent: jest.fn(),
    hydrated: true,
  });
  process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
});

describe("PostHogProvider", () => {
  it("does not call posthog.init when no API key", () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY;

    render(
      <PostHogProvider>
        <div />
      </PostHogProvider>,
    );

    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("does not call posthog.init in self-hosted mode", async () => {
    (isCloud as jest.Mock).mockReturnValue(false);

    render(
      <PostHogProvider>
        <div />
      </PostHogProvider>,
    );

    await waitFor(() => {
      expect(posthog.init).not.toHaveBeenCalled();
    });
  });

  it("calls posthog.init with correct params when cloud + API key", async () => {
    render(
      <PostHogProvider>
        <div />
      </PostHogProvider>,
    );

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({
          api_host: "https://us.i.posthog.com",
          person_profiles: "identified_only",
          defaults: "2025-05-24",
          cookieless_mode: "on_reject",
        }),
      );
    });
  });

  it("uses custom host from NEXT_PUBLIC_POSTHOG_HOST env var", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://custom.posthog.com";

    render(
      <PostHogProvider>
        <div />
      </PostHogProvider>,
    );

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({ api_host: "https://custom.posthog.com" }),
      );
    });
  });

  it("uses proxyPath as api_host when proxyPath prop is provided", async () => {
    render(
      <PostHogProvider proxyPath="/yrtmlt">
        <div />
      </PostHogProvider>,
    );

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({ api_host: "/yrtmlt" }),
      );
    });
  });

  it("sets ui_host when proxyPath is provided", async () => {
    render(
      <PostHogProvider proxyPath="/yrtmlt">
        <div />
      </PostHogProvider>,
    );

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({ ui_host: "https://us.posthog.com" }),
      );
    });
  });

  it("does not set ui_host when proxyPath is not provided", async () => {
    render(
      <PostHogProvider>
        <div />
      </PostHogProvider>,
    );

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalled();
    });

    const initCall = (posthog.init as jest.Mock).mock.calls[0][1];
    expect(initCall).not.toHaveProperty("ui_host");
  });
});

describe("PostHogProvider consent sync", () => {
  it("calls opt_in_capturing when consent is 'granted'", async () => {
    (useCookieConsent as jest.Mock).mockReturnValue({
      consent: "granted",
      setConsent: jest.fn(),
      hydrated: true,
    });

    render(
      <PostHogProvider>
        <div />
      </PostHogProvider>,
    );

    await waitFor(() => {
      expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1);
    });
    expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
  });

  it("calls opt_out_capturing when consent is 'denied'", async () => {
    (useCookieConsent as jest.Mock).mockReturnValue({
      consent: "denied",
      setConsent: jest.fn(),
      hydrated: true,
    });

    render(
      <PostHogProvider>
        <div />
      </PostHogProvider>,
    );

    await waitFor(() => {
      expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1);
    });
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
  });

  it("calls opt_out_capturing when consent is 'pending' so PostHog stays cookieless until user chooses", async () => {
    (useCookieConsent as jest.Mock).mockReturnValue({
      consent: "pending",
      setConsent: jest.fn(),
      hydrated: true,
    });

    render(
      <PostHogProvider>
        <div />
      </PostHogProvider>,
    );

    await waitFor(() => {
      expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1);
    });
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
  });

  it("does not sync consent before hydration", async () => {
    (useCookieConsent as jest.Mock).mockReturnValue({
      consent: "granted",
      setConsent: jest.fn(),
      hydrated: false,
    });

    render(
      <PostHogProvider>
        <div />
      </PostHogProvider>,
    );

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalled();
    });
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
    expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
  });

  it("does not sync consent in self-hosted mode", async () => {
    (isCloud as jest.Mock).mockReturnValue(false);
    (useCookieConsent as jest.Mock).mockReturnValue({
      consent: "denied",
      setConsent: jest.fn(),
      hydrated: true,
    });

    render(
      <PostHogProvider>
        <div />
      </PostHogProvider>,
    );

    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
    expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
  });
});
