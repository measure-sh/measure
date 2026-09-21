import { mockRouter } from "@/__tests__/helpers/mock_router";
import type { HighMemoryUsageSession } from "@/app/api/api_calls";
import HighMemoryUsageSessions from "@/app/components/high_memory_usage_sessions";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

type Props = ComponentProps<typeof HighMemoryUsageSessions>;

const mockSession: HighMemoryUsageSession = {
  session_id: "session-1",
  app_id: "app-1",
  first_event_time: "2026-09-18T05:00:00Z",
  last_event_time: "2026-09-18T05:05:00Z",
  peak_memory_kb: 1048576,
  peak_memory_limit_utilization: 0.8,
  available_memory_at_peak_utilization_kb: 262144,
  attribute: {
    app_version: "1.0",
    app_build: "1",
    os_name: "ios",
    os_version: "26",
    device_name: "iPhone",
    device_model: "iPhone",
    device_manufacturer: "Apple",
    device_total_memory: 8388608,
  },
};

const mockSessionsData = {
  meta: { next: true, previous: true },
  results: [mockSession],
};

function queryWith(overrides: Partial<Props["query"]> = {}) {
  return {
    data: undefined,
    status: "pending",
    isFetching: true,
    error: null,
    ...overrides,
  } as Props["query"];
}

const defaultProps = {
  teamId: "team-1",
  onNext: jest.fn(),
  onPrev: jest.fn(),
};

describe("HighMemoryUsageSessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.reset();
  });

  it("renders loading state before the request resolves", () => {
    render(<HighMemoryUsageSessions {...defaultProps} query={queryWith()} />);
    expect(
      screen.getByRole("status", {
        name: "Loading high memory usage sessions",
      }),
    ).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(
      <HighMemoryUsageSessions
        {...defaultProps}
        query={queryWith({ status: "error", error: new Error("test") })}
      />,
    );
    expect(
      screen.getByText("Unable to load high memory usage sessions."),
    ).toBeInTheDocument();
  });

  it.each([null, []])("renders no data state for %p results", (results) => {
    render(
      <HighMemoryUsageSessions
        {...defaultProps}
        query={queryWith({
          status: "success",
          isFetching: false,
          data: { ...mockSessionsData, results },
        })}
      />,
    );
    expect(
      screen.getByText("No sessions found with high memory usage."),
    ).toBeInTheDocument();
  });

  it.each([
    { available: 0, label: "0 KB" },
    { available: 262144, label: "256.0 MB" },
  ])(
    "renders iOS available memory at peak utilization for $available KB",
    ({ available, label }) => {
      render(
        <HighMemoryUsageSessions
          {...defaultProps}
          query={queryWith({
            status: "success",
            isFetching: false,
            data: {
              ...mockSessionsData,
              results: [
                {
                  ...mockSession,
                  available_memory_at_peak_utilization_kb: available,
                },
              ],
            },
          })}
        />,
      );
      expect(
        screen.getByText(`${label} available at peak utilization`),
      ).toBeInTheDocument();
      expect(
        screen.getByText("80% of estimated app limit (peak)"),
      ).toBeInTheDocument();
      expect(screen.getByText(/8\.0 GB RAM/)).toBeInTheDocument();
    },
  );

  it("renders the Android target and device RAM", () => {
    render(
      <HighMemoryUsageSessions
        {...defaultProps}
        query={queryWith({
          status: "success",
          isFetching: false,
          data: {
            ...mockSessionsData,
            results: [
              {
                ...mockSession,
                target_memory_kb: 2097152,
                percent_of_target: 50,
                peak_memory_limit_utilization: undefined,
                available_memory_at_peak_utilization_kb: undefined,
                attribute: {
                  ...mockSession.attribute,
                  os_name: "android",
                  device_manufacturer: "Google",
                  device_model: "Pixel",
                },
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("50% of 2.0 GB target")).toBeInTheDocument();
    expect(screen.getByText(/8.0 GB RAM/)).toBeInTheDocument();
    expect(
      screen.queryByText(/available at peak utilization/),
    ).not.toBeInTheDocument();
  });

  it.each(["Enter", " "])(
    "opens the session replay when a row receives %p",
    (key) => {
      render(
        <HighMemoryUsageSessions
          {...defaultProps}
          query={queryWith({
            status: "success",
            isFetching: false,
            data: mockSessionsData,
          })}
        />,
      );
      const link = screen.getByRole("link", { name: "Session ID: session-1" });
      expect(link).toHaveAttribute(
        "href",
        "/team-1/session_replays/app-1/session-1",
      );
      fireEvent.keyDown(
        screen.getByRole("row", { name: /Session ID: session-1/ }),
        { key },
      );
      expect(mockRouter.pushMock).toHaveBeenCalledWith(
        "/team-1/session_replays/app-1/session-1",
      );
    },
  );

  it("calls the pagination callbacks", () => {
    render(
      <HighMemoryUsageSessions
        {...defaultProps}
        query={queryWith({
          status: "success",
          isFetching: false,
          data: mockSessionsData,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
    expect(defaultProps.onPrev).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      state: "while fetching",
      isFetching: true,
      meta: { next: true, previous: true },
    },
    {
      state: "without adjacent pages",
      isFetching: false,
      meta: { next: false, previous: false },
    },
  ])("disables pagination $state", ({ isFetching, meta }) => {
    render(
      <HighMemoryUsageSessions
        {...defaultProps}
        query={queryWith({
          status: "success",
          isFetching,
          data: { ...mockSessionsData, meta },
        })}
      />,
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });
});
