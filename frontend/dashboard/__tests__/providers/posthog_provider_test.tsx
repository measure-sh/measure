import { PostHogProvider } from "@/app/context/posthog";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { usePostHog } from "posthog-js/react";

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockImplementation((_key: string, opts?: { loaded?: () => void }) => {
      opts?.loaded?.();
    }),
    get_explicit_consent_status: jest.fn().mockReturnValue("pending"),
  },
}));

import posthog from "posthog-js";

function ConsentStatusChild() {
  const ph = usePostHog();
  return <div data-testid="status">{ph?.get_explicit_consent_status?.() ?? ""}</div>;
}

beforeEach(() => {
  (posthog.get_explicit_consent_status as jest.Mock).mockReturnValue("pending");
  process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
});

describe("PostHogProvider", () => {
  it("does not call posthog.init and uses noop client when no API key", () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY;

    render(
      <PostHogProvider>
        <ConsentStatusChild />
      </PostHogProvider>,
    );

    expect(posthog.init).not.toHaveBeenCalled();
    expect(screen.getByTestId("status")).toHaveTextContent("denied");
  });

  it("calls posthog.init with correct params when API key is set", async () => {
    render(
      <PostHogProvider>
        <ConsentStatusChild />
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

    expect(screen.getByTestId("status")).toHaveTextContent("pending");
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
