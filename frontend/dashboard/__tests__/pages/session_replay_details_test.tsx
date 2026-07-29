import { promiseParams } from "@/__tests__/helpers/promise_params";
import SessionReplayDetailsPage from "@/app/[teamId]/session_replays/[appId]/[sessionId]/page";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

let mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

const mockUseSessionReplayQuery = jest.fn(
  (_appId: string, _sessionId: string) => ({
    data: undefined as any,
    status: "pending" as string,
  }),
);

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useSessionReplayQuery: (appId: string, sessionId: string) =>
    mockUseSessionReplayQuery(appId, sessionId),
}));

const trackMock = jest.fn();
jest.mock("@/app/utils/analytics/track", () => ({
  __esModule: true,
  track: (...args: any[]) => trackMock(...args),
}));

jest.mock("@/app/components/session_replay", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="session-replay-mock">
      {props.teamId}/{props.appId}/{props.session.session_id}
    </div>
  ),
}));

const sampleSession = {
  session_id: "sess-1",
  attribute: { os_name: "android" },
};

describe("SessionReplayDetails Page", () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    trackMock.mockClear();
    mockUseSessionReplayQuery.mockReset();
    mockUseSessionReplayQuery.mockReturnValue({
      data: undefined,
      status: "pending",
    });
  });

  const renderPage = () =>
    render(
      <SessionReplayDetailsPage
        params={promiseParams({
          teamId: "123",
          appId: "app-1",
          sessionId: "sess-1",
        })}
      />,
    );

  it("queries the session named by the route", () => {
    renderPage();
    expect(mockUseSessionReplayQuery).toHaveBeenCalledWith("app-1", "sess-1");
  });

  it("shows loading skeletons while the session is fetched", () => {
    renderPage();
    expect(
      document.querySelector('[data-slot="skeleton"]'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("session-replay-mock")).not.toBeInTheDocument();
  });

  it("shows the error message when the fetch fails", () => {
    mockUseSessionReplayQuery.mockReturnValue({
      data: undefined,
      status: "error",
    });
    renderPage();
    expect(
      screen.getByText(/Error fetching session replay/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("session-replay-mock")).not.toBeInTheDocument();
  });

  it("hands the fetched session and route ids to the replay", () => {
    mockUseSessionReplayQuery.mockReturnValue({
      data: sampleSession,
      status: "success",
    });
    renderPage();
    expect(screen.getByTestId("session-replay-mock")).toHaveTextContent(
      "123/app-1/sess-1",
    );
  });

  it("tracks the view with the entry point the URL names", () => {
    mockSearchParams = new URLSearchParams("from=errors");
    mockUseSessionReplayQuery.mockReturnValue({
      data: sampleSession,
      status: "success",
    });
    renderPage();
    expect(trackMock).toHaveBeenCalledWith("session_investigated", {
      team_id: "123",
      app_id: "app-1",
      app_platform: "android",
      feature_area: "sessions",
      entry_point: "errors",
    });
  });

  it("tracks a direct entry when the URL names none", () => {
    mockUseSessionReplayQuery.mockReturnValue({
      data: sampleSession,
      status: "success",
    });
    renderPage();
    expect(trackMock).toHaveBeenCalledWith(
      "session_investigated",
      expect.objectContaining({ entry_point: "direct" }),
    );
  });

  it("tracks a session view once, not on every render", () => {
    mockUseSessionReplayQuery.mockReturnValue({
      data: sampleSession,
      status: "success",
    });
    const { rerender } = renderPage();
    expect(trackMock).toHaveBeenCalledTimes(1);

    // A changed entry point re-runs the effect; the session was already
    // counted.
    mockSearchParams = new URLSearchParams("from=alerts");
    rerender(
      <SessionReplayDetailsPage
        params={promiseParams({
          teamId: "123",
          appId: "app-1",
          sessionId: "sess-1",
        })}
      />,
    );
    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it("does not track before the session has loaded", () => {
    renderPage();
    expect(trackMock).not.toHaveBeenCalled();
  });
});
