import SdkConfigHistory from "@/app/components/sdk_config_history";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

const mockUseSdkConfigHistoryQuery = jest.fn();

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  SDK_CONFIG_HISTORY_LIMIT: 5,
  useSdkConfigHistoryQuery: (...args: unknown[]) =>
    mockUseSdkConfigHistoryQuery(...args),
}));

function successQuery(results: unknown[], next = false) {
  return {
    status: "success",
    isFetching: false,
    data: { meta: { next, previous: false }, results },
  };
}

const oneChange = [
  {
    id: "1",
    changed_at: "2026-10-07T14:02:00Z",
    changed_by_email: "dev@example.com",
    changes: { trace_sampling_rate: { old: 100, new: 10 } },
  },
];

function renderHistory() {
  render(<SdkConfigHistory appId="app-1" />);
}

describe("SdkConfigHistory", () => {
  beforeEach(() => {
    mockUseSdkConfigHistoryQuery.mockReset();
  });

  it("shows each changed field with its label and formatted values", () => {
    mockUseSdkConfigHistoryQuery.mockReturnValue(
      successQuery([
        {
          id: "1",
          changed_at: "2026-10-07T14:02:00Z",
          changed_by_email: "dev@example.com",
          changes: {
            trace_sampling_rate: { old: 100, new: 10 },
            error_replay_duration: { old: 300, new: 120 },
            anr_take_screenshot: { old: true, new: false },
            screenshot_mask_level: {
              old: "all_text_and_media",
              new: "sensitive_fields_only",
            },
            log_min_severity: { old: 16, new: 8 },
            http_blocked_headers: { old: ["cookie"], new: ["x-token"] },
            log_ignore_patterns: { old: [], new: ["^debug:"] },
          },
        },
      ]),
    );

    renderHistory();

    expect(screen.getByText(/dev@example\.com/)).toBeInTheDocument();
    const rows = Array.from(document.querySelectorAll("li")).map(
      (li) => li.textContent,
    );
    expect(rows).toEqual([
      "Error session replay duration changed from 300 seconds to 120 seconds",
      "Screenshot with ANRs changed from Enabled to Disabled",
      "Trace sampling rate changed from 100% to 10%",
      "Blocked HTTP headers changed from cookie to x-token",
      "Screenshot mask level changed from All text and media to Sensitive fields only",
      "Minimum log level changed from Warning to Debug",
      "Log ignore patterns changed from none to ^debug:",
    ]);
  });

  it("lists a change's fields in the order the configurator shows them", () => {
    mockUseSdkConfigHistoryQuery.mockReturnValue(
      successQuery([
        {
          id: "1",
          changed_at: "2026-10-07T14:02:00Z",
          changed_by_email: "dev@example.com",
          changes: {
            error_fatal_replay_enabled: { old: false, new: true },
            error_fatal_sampling_rate: { old: 100, new: 50 },
            error_replay_duration: { old: 300, new: 120 },
          },
        },
      ]),
    );

    renderHistory();

    const rows = Array.from(document.querySelectorAll("li")).map(
      (li) => li.textContent,
    );
    expect(rows).toEqual([
      "Sampling rate for fatal errors changed from 100% to 50%",
      "Session replay with fatal errors changed from Disabled to Enabled",
      "Error session replay duration changed from 300 seconds to 120 seconds",
    ]);
  });

  it("shows an unknown user when the user who made the change is gone", () => {
    mockUseSdkConfigHistoryQuery.mockReturnValue(
      successQuery([
        {
          id: "1",
          changed_at: "2026-10-07T14:02:00Z",
          changed_by_email: null,
          changes: { trace_sampling_rate: { old: 100, new: 10 } },
        },
      ]),
    );

    renderHistory();

    expect(screen.getByText(/Unknown user/)).toBeInTheDocument();
  });

  it("shows an empty message when nothing has changed", () => {
    mockUseSdkConfigHistoryQuery.mockReturnValue(successQuery([]));

    renderHistory();

    expect(screen.getByText("No changes yet")).toBeInTheDocument();
  });

  it("fetches the next 5 changes when Next is clicked", () => {
    mockUseSdkConfigHistoryQuery.mockReturnValue(successQuery(oneChange, true));

    renderHistory();
    fireEvent.click(screen.getByText("Next"));

    expect(mockUseSdkConfigHistoryQuery).toHaveBeenLastCalledWith("app-1", 5);
  });
});
