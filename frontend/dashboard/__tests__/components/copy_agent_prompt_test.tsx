import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

const mockToastPositive = jest.fn();
const mockToastNegative = jest.fn();
const mockWriteText = jest.fn();
const mockFetchSessionReplay = jest.fn();

jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  emptyErrorGroupDetails: { results: [] },
  fetchSessionReplayFromServer: (...args: any[]) =>
    mockFetchSessionReplay(...args),
}));

jest.mock("@/app/components/toast", () => ({
  toastPositive: (...args: any[]) => mockToastPositive(...args),
  toastNegative: (...args: any[]) => mockToastNegative(...args),
}));

jest.mock("@/app/utils/time_utils", () => ({
  formatDateToHumanReadableDateTime: (ts: string) => `formatted:${ts}`,
}));

jest.mock("lucide-react", () => ({
  ChevronDown: () => <span data-testid="chevron-icon" />,
  Copy: () => <span data-testid="copy-icon" />,
}));

jest.mock("@/app/components/button", () => ({
  Button: ({
    children,
    onClick,
    loading,
    disabled,
    variant,
    size,
    asChild,
    className,
    ...props
  }: any) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      data-loading={loading ? "true" : "false"}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock("@/app/components/input", () => ({
  Input: ({ className, ...props }: any) => <input {...props} />,
}));

jest.mock("@/app/components/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

jest.mock("@/app/components/popover", () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children }: any) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({ children }: any) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

jest.mock("@/app/components/switch", () => ({
  Switch: ({ checked, disabled, onCheckedChange }: any) => (
    <button
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
    >
      switch
    </button>
  ),
}));

import CopyAgentPrompt from "@/app/components/copy_agent_prompt";

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

function mockSessionReplay() {
  return {
    threads: {
      main: [
        {
          event_type: "lifecycle_activity",
          timestamp: "2023-12-31T23:59:00Z",
        },
        { event_type: "gesture_click", timestamp: "2023-12-31T23:59:30Z" },
      ],
      worker: [{ event_type: "http", timestamp: "2024-01-01T00:00:10Z" }],
    },
    traces: [
      {
        thread_name: "main",
        start_time: "2023-12-31T23:58:00Z",
        trace_id: "trace-1",
      },
    ],
  };
}

function storedPreferences(): any {
  return JSON.parse(localStorage.getItem("measure-copy-prompt") ?? "null");
}

function renderComponent(event: object = mockCrashEvent()) {
  return render(
    <CopyAgentPrompt appId="app-1" appName="MyApp" errorEvent={event as any} />,
  );
}

function copiedTextFor(event: object): string {
  renderComponent(event);
  fireEvent.click(screen.getByText("Copy Agent Prompt"));
  return mockWriteText.mock.calls[0][0];
}

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: mockWriteText },
  });
  localStorage.clear();
  mockWriteText.mockReset();
  mockToastPositive.mockClear();
  mockToastNegative.mockClear();
  mockFetchSessionReplay.mockReset();
});

describe("CopyAgentPrompt", () => {
  describe("Rendering", () => {
    it("renders the Copy Agent Prompt label", () => {
      renderComponent();
      expect(screen.getByText("Copy Agent Prompt")).toBeInTheDocument();
    });

    it("renders tooltip content", () => {
      renderComponent();
      expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
    });

    it("renders the replay row text, switch and count input", () => {
      renderComponent();
      expect(
        screen.getByLabelText("Include latest available replay events"),
      ).toHaveValue(200);
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-checked",
        "false",
      );
    });
  });

  describe("Replay preference", () => {
    it("toggles and stores the flag when the switch is clicked", () => {
      renderComponent();
      fireEvent.click(screen.getByRole("switch"));
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(storedPreferences().includeReplay).toBe(true);
    });

    it("stores the replay event count when the input changes", () => {
      renderComponent();
      fireEvent.change(
        screen.getByLabelText("Include latest available replay events"),
        { target: { value: "50" } },
      );
      expect(storedPreferences().replayEventCount).toBe(50);
    });

    it("keeps the last valid count when the input is cleared", () => {
      renderComponent();
      const input = screen.getByLabelText(
        "Include latest available replay events",
      );
      fireEvent.change(input, { target: { value: "50" } });
      fireEvent.change(input, { target: { value: "" } });
      expect(storedPreferences().replayEventCount).toBe(50);
    });

    it("clamps the count to the maximum and shows a toast", () => {
      renderComponent();
      const input = screen.getByLabelText(
        "Include latest available replay events",
      );
      fireEvent.change(input, { target: { value: "20000" } });
      expect((input as HTMLInputElement).value).toBe("10000");
      expect(storedPreferences().replayEventCount).toBe(10000);
      expect(mockToastPositive).toHaveBeenCalledWith(
        "Replay event count set to the maximum of 10000",
      );
    });

    it("clamps the count to the minimum and shows a toast", () => {
      renderComponent();
      const input = screen.getByLabelText(
        "Include latest available replay events",
      );
      fireEvent.change(input, { target: { value: "0" } });
      expect((input as HTMLInputElement).value).toBe("1");
      expect(storedPreferences().replayEventCount).toBe(1);
      expect(mockToastPositive).toHaveBeenCalledWith(
        "Replay event count set to the minimum of 1",
      );
    });

    it("clamps scientific notation input against the maximum", () => {
      renderComponent();
      const input = screen.getByLabelText(
        "Include latest available replay events",
      );
      fireEvent.change(input, { target: { value: "9e9" } });
      expect((input as HTMLInputElement).value).toBe("10000");
      expect(storedPreferences().replayEventCount).toBe(10000);
    });

    it("stores a whole number when a decimal is entered", () => {
      renderComponent();
      const input = screen.getByLabelText(
        "Include latest available replay events",
      );
      fireEvent.change(input, { target: { value: "5.5" } });
      expect(storedPreferences().replayEventCount).toBe(5);
    });
  });

  describe("Preference restore", () => {
    it("restores the replay settings from localStorage on mount", () => {
      localStorage.setItem(
        "measure-copy-prompt",
        JSON.stringify({
          includeReplay: true,
          replayEventCount: 5,
        }),
      );
      renderComponent();
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(
        screen.getByLabelText("Include latest available replay events"),
      ).toHaveValue(5);
    });

    it("falls back to defaults when stored preferences are malformed", () => {
      localStorage.setItem("measure-copy-prompt", "not-json");
      renderComponent();
      expect(screen.getByText("Copy Agent Prompt")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-checked",
        "false",
      );
    });

    it("ignores a stored mode field from an older build", () => {
      localStorage.setItem(
        "measure-copy-prompt",
        JSON.stringify({
          mode: "explain",
          includeReplay: false,
          replayEventCount: 30,
        }),
      );
      renderComponent();
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-checked",
        "false",
      );
      expect(
        screen.getByLabelText("Include latest available replay events"),
      ).toHaveValue(30);
    });
  });

  describe("Copying with replay events", () => {
    beforeEach(() => {
      localStorage.setItem(
        "measure-copy-prompt",
        JSON.stringify({
          includeReplay: true,
          replayEventCount: 200,
        }),
      );
    });

    it("fetches the session and appends the replay section", async () => {
      mockFetchSessionReplay.mockResolvedValue(mockSessionReplay());
      renderComponent();
      fireEvent.click(screen.getByText("Copy Agent Prompt"));
      await waitFor(() => expect(mockWriteText).toHaveBeenCalledTimes(1));

      expect(mockFetchSessionReplay).toHaveBeenCalledWith(
        "app-1",
        "session-abc",
      );
      const copied = mockWriteText.mock.calls[0][0];
      expect(copied).toContain("## Session replay events");
      expect(copied).toContain("lifecycle_activity");
      expect(copied).toContain("gesture_click");
      expect(copied).toContain("trace");
      expect(mockToastPositive).toHaveBeenCalledWith(
        "AI context copied to clipboard",
      );
    });

    it("excludes events recorded after the error", async () => {
      mockFetchSessionReplay.mockResolvedValue(mockSessionReplay());
      renderComponent();
      fireEvent.click(screen.getByText("Copy Agent Prompt"));
      await waitFor(() => expect(mockWriteText).toHaveBeenCalledTimes(1));
      // "http" alone would also match the attachment URL in the summary
      // section, so the after-error event is identified by its formatted
      // timestamp instead, which appears nowhere else in the prompt.
      expect(mockWriteText.mock.calls[0][0]).not.toContain(
        "formatted:2024-01-01T00:00:10Z",
      );
    });

    it("lists replay events in ascending time order before the closing line", async () => {
      mockFetchSessionReplay.mockResolvedValue(mockSessionReplay());
      renderComponent();
      fireEvent.click(screen.getByText("Copy Agent Prompt"));
      await waitFor(() => expect(mockWriteText).toHaveBeenCalledTimes(1));
      const copied = mockWriteText.mock.calls[0][0];
      const traceIndex = copied.indexOf("trace-1");
      const lifecycleIndex = copied.indexOf("lifecycle_activity");
      const gestureIndex = copied.indexOf("gesture_click");
      const closingIndex = copied.indexOf(
        "Please help me identify the root cause and suggest a fix.",
      );
      expect(traceIndex).toBeGreaterThan(-1);
      expect(traceIndex).toBeLessThan(lifecycleIndex);
      expect(lifecycleIndex).toBeLessThan(gestureIndex);
      expect(gestureIndex).toBeLessThan(closingIndex);
    });

    it("keeps only the latest N events when the count is lower", async () => {
      localStorage.setItem(
        "measure-copy-prompt",
        JSON.stringify({
          includeReplay: true,
          replayEventCount: 2,
        }),
      );
      mockFetchSessionReplay.mockResolvedValue(mockSessionReplay());
      renderComponent();
      fireEvent.click(screen.getByText("Copy Agent Prompt"));
      await waitFor(() => expect(mockWriteText).toHaveBeenCalledTimes(1));
      const copied = mockWriteText.mock.calls[0][0];
      expect(copied).toContain("The latest 2 replay events");
      expect(copied).toContain("lifecycle_activity");
      expect(copied).toContain("gesture_click");
      expect(copied).not.toContain("trace-1");
    });

    it("shows a loading state while the session is being fetched", async () => {
      let resolveFetch: (value: unknown) => void = () => {};
      mockFetchSessionReplay.mockImplementation(
        () => new Promise((resolve) => (resolveFetch = resolve)),
      );
      renderComponent();
      const mainButton = screen
        .getByText("Copy Agent Prompt")
        .closest("button")!;
      fireEvent.click(mainButton);
      expect(mainButton).toHaveAttribute("data-loading", "true");
      expect(mainButton).toBeDisabled();

      resolveFetch(mockSessionReplay());
      await waitFor(() => expect(mockWriteText).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(mainButton).toHaveAttribute("data-loading", "false"),
      );
    });

    it("copies without the replay section and adjusts the toast when the fetch fails", async () => {
      mockFetchSessionReplay.mockRejectedValue(new Error("network down"));
      renderComponent();
      fireEvent.click(screen.getByText("Copy Agent Prompt"));
      await waitFor(() => expect(mockWriteText).toHaveBeenCalledTimes(1));
      expect(mockWriteText.mock.calls[0][0]).not.toContain(
        "## Session replay events",
      );
      expect(mockToastPositive).toHaveBeenCalledWith(
        "AI context copied without replay events",
      );
      expect(mockToastNegative).not.toHaveBeenCalled();
    });

    it("omits the replay section when the session has no events", async () => {
      mockFetchSessionReplay.mockResolvedValue({ threads: {}, traces: [] });
      renderComponent();
      fireEvent.click(screen.getByText("Copy Agent Prompt"));
      await waitFor(() => expect(mockWriteText).toHaveBeenCalledTimes(1));
      expect(mockWriteText.mock.calls[0][0]).not.toContain(
        "## Session replay events",
      );
      expect(mockToastPositive).toHaveBeenCalledWith(
        "AI context copied to clipboard",
      );
    });

    it("skips the fetch when the event has no session id", async () => {
      const event = { ...mockCrashEvent(), session_id: "" };
      renderComponent(event);
      fireEvent.click(screen.getByText("Copy Agent Prompt"));
      await waitFor(() => expect(mockWriteText).toHaveBeenCalledTimes(1));
      expect(mockFetchSessionReplay).not.toHaveBeenCalled();
      expect(mockWriteText.mock.calls[0][0]).not.toContain(
        "## Session replay events",
      );
    });
  });

  describe("Copying without replay", () => {
    it("does not fetch the session and omits the replay section", async () => {
      renderComponent();
      fireEvent.click(screen.getByText("Copy Agent Prompt"));
      await waitFor(() => expect(mockToastPositive).toHaveBeenCalled());
      expect(mockFetchSessionReplay).not.toHaveBeenCalled();
      expect(mockWriteText.mock.calls[0][0]).not.toContain(
        "## Session replay events",
      );
    });

    it("shows a success toast on click", async () => {
      renderComponent();
      fireEvent.click(screen.getByText("Copy Agent Prompt"));
      await waitFor(() =>
        expect(mockToastPositive).toHaveBeenCalledWith(
          "AI context copied to clipboard",
        ),
      );
    });

    it("shows an error toast when the clipboard write fails", async () => {
      mockWriteText.mockImplementation(() => {
        throw new Error("denied");
      });
      renderComponent();
      fireEvent.click(screen.getByText("Copy Agent Prompt"));
      await waitFor(() =>
        expect(mockToastNegative).toHaveBeenCalledWith(
          "Failed to copy AI context",
        ),
      );
      expect(mockToastPositive).not.toHaveBeenCalled();
    });
  });

  describe("Crash context formatting", () => {
    it("uses the exception title as the markdown heading", () => {
      expect(copiedTextFor(mockCrashEvent())).toContain(
        "# java.lang.NullPointerException",
      );
    });

    it("includes the debugging intro and fix closing", () => {
      const copied = copiedTextFor(mockCrashEvent());
      expect(copied).toContain(
        "I'm debugging this error in my app. The full context is below.",
      );
      expect(copied).toContain(
        "Please help me identify the root cause and suggest a fix.",
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
