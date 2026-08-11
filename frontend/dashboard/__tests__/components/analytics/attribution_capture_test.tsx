import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, waitFor } from "@testing-library/react";

jest.mock("@c15t/nextjs", () => ({
  useConsentManager: jest.fn(),
}));

jest.mock("@/app/utils/analytics/utm", () => ({
  captureUTMsFromURL: jest.fn(),
}));

jest.mock("@/app/utils/analytics/attribution", () => ({
  captureGCLIDFromURL: jest.fn(),
}));

import {
  AttributionCapture,
  ConsentedAttributionCapture,
} from "@/app/components/analytics/attribution_capture";
import { captureGCLIDFromURL } from "@/app/utils/analytics/attribution";
import { captureUTMsFromURL } from "@/app/utils/analytics/utm";
import { useConsentManager } from "@c15t/nextjs";

function mockConsent(granted: string[]) {
  (useConsentManager as jest.Mock).mockReturnValue({
    has: (category: string) => granted.includes(category),
  });
}

beforeEach(() => {
  (captureUTMsFromURL as jest.Mock).mockClear();
  (captureGCLIDFromURL as jest.Mock).mockClear();
  mockConsent(["necessary"]);
});

describe("ConsentedAttributionCapture", () => {
  it("captures when marketing consent is granted", async () => {
    mockConsent(["necessary", "marketing"]);

    render(<ConsentedAttributionCapture />);

    await waitFor(() => {
      expect(captureUTMsFromURL).toHaveBeenCalledTimes(1);
    });
    expect(captureGCLIDFromURL).toHaveBeenCalledTimes(1);
  });

  it("does not capture without marketing consent", async () => {
    render(<ConsentedAttributionCapture />);

    await waitFor(() => {
      expect(useConsentManager).toHaveBeenCalled();
    });
    expect(captureUTMsFromURL).not.toHaveBeenCalled();
    expect(captureGCLIDFromURL).not.toHaveBeenCalled();
  });

  it("captures once consent is granted after the first render", async () => {
    const { rerender } = render(<ConsentedAttributionCapture />);

    await waitFor(() => {
      expect(captureUTMsFromURL).not.toHaveBeenCalled();
    });

    mockConsent(["necessary", "marketing"]);
    rerender(<ConsentedAttributionCapture />);

    await waitFor(() => {
      expect(captureUTMsFromURL).toHaveBeenCalledTimes(1);
    });
    expect(captureGCLIDFromURL).toHaveBeenCalledTimes(1);
  });
});

describe("AttributionCapture", () => {
  it("captures with no consent manager present", async () => {
    render(<AttributionCapture />);

    await waitFor(() => {
      expect(captureUTMsFromURL).toHaveBeenCalledTimes(1);
    });
    expect(captureGCLIDFromURL).toHaveBeenCalledTimes(1);
    expect(useConsentManager).not.toHaveBeenCalled();
  });
});
