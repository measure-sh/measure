import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  formatDateToHumanReadableDate,
  formatDateToHumanReadableTime,
} from "@/app/utils/time_utils";

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

const mockUseFunnelStepSessionsQuery = jest.fn();
jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  FUNNEL_STEP_LIST_LIMIT: 5,
  RootSpanMetricsQuantile: { p50: "p50", p90: "p90", p95: "p95", p99: "p99" },
  useFunnelStepSessionsQuery: (...args: unknown[]) =>
    mockUseFunnelStepSessionsQuery(...args),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  Skeleton: () => <div data-testid="skeleton" />,
  SkeletonTable: () => <div data-testid="skeleton-table" />,
}));

import FunnelSessions, {
  SessionsOutcome,
} from "@/app/components/funnel/sessions";

const params = {
  appId: "app-1",
  startDate: "2026-01-01T00:00:00Z",
  endDate: "2026-01-31T00:00:00Z",
  filterExpr: null as string | null,
};

const conversion = {
  steps: [
    { event_name: "view_cart", users: 10, median_seconds_from_previous: null },
    {
      event_name: "start_checkout",
      users: 4,
      median_seconds_from_previous: 30,
    },
    { event_name: "purchase", users: 3, median_seconds_from_previous: 90 },
  ],
};

const session = (
  sessionId: string,
  userId: string,
  start: string,
  duration: number,
) => ({
  session_id: sessionId,
  installation_id: `install-of-${sessionId}`,
  user_id: userId,
  first_event_time: start,
  duration,
});

const withUser = session("session-1", "user-1", "2026-01-10T09:59:00Z", 210000);
const withoutUser = session("session-2", "", "2026-01-09T08:00:00Z", 0);

const listQuery = (
  results: unknown[],
  { next = false, previous = false } = {},
) => ({
  status: "success",
  data: { meta: { next, previous }, results },
  isFetching: false,
});

const onSelectStep = jest.fn();
const onSelectOutcome = jest.fn();
const onOpenSession = jest.fn();

function renderSessions(
  overrides: Partial<React.ComponentProps<typeof FunnelSessions>> = {},
) {
  return render(
    <FunnelSessions
      teamId="team-1"
      funnelId="funnel-1"
      params={params}
      conversion={conversion}
      conversionFailed={false}
      selectedStep={1}
      onSelectStep={onSelectStep}
      outcome={SessionsOutcome.Converted}
      onSelectOutcome={onSelectOutcome}
      onOpenSession={onOpenSession}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFunnelStepSessionsQuery.mockReturnValue(
    listQuery([withUser, withoutUser], { next: true }),
  );
});

describe("FunnelSessions", () => {
  it("shows each session's user and installation, start and duration, and opens its replay from any cell", () => {
    renderSessions();

    const link = screen.getByRole("link", { name: "Session ID: session-1" });
    expect(link).toHaveAttribute(
      "href",
      "/team-1/session_replays/app-1/session-1?from=funnel_details",
    );
    const row = link.closest("tr")!;
    const cells = within(row).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "user-1install-of-session-1",
      formatDateToHumanReadableDate(withUser.first_event_time) +
        formatDateToHumanReadableTime(withUser.first_event_time),
      "3m 30s",
    ]);
    for (const cell of cells) {
      expect(cell.querySelector("a")).toHaveAttribute(
        "href",
        "/team-1/session_replays/app-1/session-1?from=funnel_details",
      );
    }
  });

  it("reports a click on a session row as opening it", () => {
    renderSessions();

    fireEvent.click(
      screen.getByRole("link", { name: "Session ID: session-1" }),
    );

    expect(onOpenSession).toHaveBeenCalledTimes(1);
  });

  it("shows only the installation id, and N/A for a zero duration, for a session without a user id", () => {
    renderSessions();

    const row = screen
      .getByRole("link", { name: "Session ID: session-2" })
      .closest("tr")!;
    const cells = within(row).getAllByRole("cell");
    expect(cells[0].textContent).toBe("install-of-session-2");
    expect(cells[2].textContent).toBe("N/A");
  });

  it("queries the whole funnel when no step is selected", () => {
    renderSessions({ selectedStep: null });

    expect(mockUseFunnelStepSessionsQuery).toHaveBeenLastCalledWith(
      params,
      "funnel-1",
      null,
      "converted",
      0,
    );
  });

  it("queries the selected step and outcome, and pages from the first page", () => {
    renderSessions();
    expect(mockUseFunnelStepSessionsQuery).toHaveBeenLastCalledWith(
      params,
      "funnel-1",
      1,
      "converted",
      0,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(mockUseFunnelStepSessionsQuery).toHaveBeenLastCalledWith(
      params,
      "funnel-1",
      1,
      "converted",
      5,
    );

    fireEvent.click(screen.getByText("Dropped off"));
    expect(onSelectOutcome).toHaveBeenCalledWith(SessionsOutcome.Dropped);
    expect(mockUseFunnelStepSessionsQuery).toHaveBeenLastCalledWith(
      params,
      "funnel-1",
      1,
      "converted",
      0,
    );
  });

  it("pages back a page at a time", () => {
    mockUseFunnelStepSessionsQuery.mockReturnValue(
      listQuery([withUser], { next: true, previous: true }),
    );
    renderSessions();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));

    expect(mockUseFunnelStepSessionsQuery).toHaveBeenLastCalledWith(
      params,
      "funnel-1",
      1,
      "converted",
      5,
    );
  });

  it("shows an empty state when no users did the first step", () => {
    mockUseFunnelStepSessionsQuery.mockReturnValue(listQuery([]));
    renderSessions();

    expect(
      screen.getByText("No session replays between these steps"),
    ).toBeInTheDocument();
  });

  it("shows placeholders until the filters and conversion load", () => {
    renderSessions({ params: null, conversion: undefined });

    expect(screen.getByTestId("skeleton-table")).toBeInTheDocument();
    expect(mockUseFunnelStepSessionsQuery).not.toHaveBeenCalled();
  });

  it("shows an error when the conversion fails to load", () => {
    renderSessions({ conversionFailed: true });

    expect(
      screen.getByText(/Error fetching session replays/),
    ).toBeInTheDocument();
  });
});
