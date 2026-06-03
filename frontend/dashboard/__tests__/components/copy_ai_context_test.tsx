import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

const mockToastPositive = jest.fn();
const mockWriteText = jest.fn();

jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  emptyErrorGroupDetails: { results: [] },
}));

jest.mock("@/app/utils/use_toast", () => ({
  toastPositive: (...args: any[]) => mockToastPositive(...args),
}));

jest.mock("@/app/utils/time_utils", () => ({
  formatDateToHumanReadableDateTime: (ts: string) => `formatted:${ts}`,
}));

jest.mock("@/app/components/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/app/components/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

import CopyAiContext from "@/app/components/copy_ai_context";

function mockCrashEvent() {
  return {
    id: "event-123",
    session_id: "session-abc",
    type: "exception",
    severity: "fatal",
    timestamp: "2024-01-01T00:00:00Z",
    attribute: {
      app_version: "2.0.0",
      platform: "android",
      device_manufacturer: "Google ",
      device_model: "Pixel 7",
      network_type: "Wifi",
      thread_name: "main",
    },
    exception: {
      title: "java.lang.NullPointerException",
      message: "Attempt to invoke method on null object reference",
      stacktrace:
        "at com.example.Main.run(Main.java:10)\nat com.example.App.start(App.java:5)",
    },
    anr: null,
    code: "SIGSEGV",
    num_code: 11,
    user_defined_attribute: { screen: "checkout", premium: true },
    meta: { build_type: "release" },
    attachments: [
      {
        id: "a1",
        name: "screenshot.png",
        type: "screenshot",
        key: "k1",
        location: "https://example.com/s.png",
      },
    ],
    threads: [{ name: "worker-1", frames: ["frame1", "frame2"] }],
  };
}

function mockAnrEvent() {
  return {
    id: "anr-1",
    session_id: "session-xyz",
    type: "anr",
    timestamp: "2024-06-15T12:00:00Z",
    attribute: {
      app_version: "1.0.0",
      platform: "android",
      device_manufacturer: "Samsung ",
      device_model: "Galaxy S21",
      network_type: "5G",
      thread_name: "main",
    },
    exception: null,
    anr: {
      title: "ANR in main thread",
      stacktrace: "at com.example.ANR.block(ANR.java:20)",
    },
    threads: null,
  };
}

function copiedTextFor(event: object): string {
  render(<CopyAiContext appName="MyApp" errorEvent={event as any} />);
  fireEvent.click(screen.getByText("Copy AI Context"));
  return mockWriteText.mock.calls[0][0];
}

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: mockWriteText },
  });
  mockWriteText.mockClear();
  mockToastPositive.mockClear();
});

describe("CopyAiContext", () => {
  describe("Rendering", () => {
    it("renders Copy AI Context button", () => {
      render(
        <CopyAiContext appName="MyApp" errorEvent={mockCrashEvent() as any} />,
      );
      expect(screen.getByText("Copy AI Context")).toBeInTheDocument();
    });

    it("renders tooltip content", () => {
      render(
        <CopyAiContext appName="MyApp" errorEvent={mockCrashEvent() as any} />,
      );
      expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
    });
  });

  describe("Clipboard and toast", () => {
    it("copies markdown context to clipboard on click", () => {
      const copied = copiedTextFor(mockCrashEvent());
      expect(mockWriteText).toHaveBeenCalledTimes(1);
      expect(copied).toContain("# java.lang.NullPointerException");
      expect(copied).toContain(
        "Please help me identify the root cause and suggest a fix.",
      );
    });

    it("shows success toast on click", () => {
      render(
        <CopyAiContext appName="MyApp" errorEvent={mockCrashEvent() as any} />,
      );
      fireEvent.click(screen.getByText("Copy AI Context"));
      expect(mockToastPositive).toHaveBeenCalledWith(
        "AI context copied to clipboard",
      );
    });
  });

  describe("Crash context formatting", () => {
    it("uses the exception title as the markdown heading", () => {
      expect(copiedTextFor(mockCrashEvent())).toContain(
        "# java.lang.NullPointerException",
      );
    });

    it("includes app name in the summary", () => {
      expect(copiedTextFor(mockCrashEvent())).toContain("- app: MyApp");
    });

    it("includes app version among attributes", () => {
      expect(copiedTextFor(mockCrashEvent())).toContain("- app_version: 2.0.0");
    });

    it("includes severity and exception message", () => {
      const copied = copiedTextFor(mockCrashEvent());
      expect(copied).toContain("- severity: fatal");
      expect(copied).toContain(
        "- message: Attempt to invoke method on null object reference",
      );
    });

    it("includes session and event identifiers", () => {
      const copied = copiedTextFor(mockCrashEvent());
      expect(copied).toContain("- session_id: session-abc");
      expect(copied).toContain("- event_id: event-123");
    });

    it("includes the crash stacktrace in a fenced code block", () => {
      const copied = copiedTextFor(mockCrashEvent());
      expect(copied).toContain("## Stack trace (thread: main)");
      expect(copied).toContain("```");
      expect(copied).toContain("at com.example.Main.run(Main.java:10)");
    });

    it("includes all threads", () => {
      const copied = copiedTextFor(mockCrashEvent());
      expect(copied).toContain("## All threads");
      expect(copied).toContain("### worker-1");
      expect(copied).toContain("frame1\nframe2");
    });

    it("includes device info as discrete attributes", () => {
      const copied = copiedTextFor(mockCrashEvent());
      expect(copied).toContain("- device_manufacturer: Google");
      expect(copied).toContain("- device_model: Pixel 7");
    });

    it("includes user-defined attributes", () => {
      const copied = copiedTextFor(mockCrashEvent());
      expect(copied).toContain("## User-defined attributes");
      expect(copied).toContain("- screen: checkout");
      expect(copied).toContain("- premium: true");
    });

    it("includes meta", () => {
      const copied = copiedTextFor(mockCrashEvent());
      expect(copied).toContain("## Meta");
      expect(copied).toContain("- build_type: release");
    });

    it("includes attachments", () => {
      const copied = copiedTextFor(mockCrashEvent());
      expect(copied).toContain("## Attachments");
      expect(copied).toContain("screenshot.png");
    });
  });

  describe("ANR context formatting", () => {
    it("uses the anr title as the heading", () => {
      expect(copiedTextFor(mockAnrEvent())).toContain("# ANR in main thread");
    });

    it("uses anr stacktrace when exception is null", () => {
      expect(copiedTextFor(mockAnrEvent())).toContain(
        "at com.example.ANR.block(ANR.java:20)",
      );
    });

    it("handles null threads gracefully", () => {
      const copied = copiedTextFor(mockAnrEvent());
      expect(copied).toContain("- app: MyApp");
      expect(copied).not.toContain("## All threads");
    });
  });
});
