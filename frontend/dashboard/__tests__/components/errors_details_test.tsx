import { ErrorsDetailsView } from "@/app/components/errors_details";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

let mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

const trackMock = jest.fn();
jest.mock("@/app/utils/analytics/track", () => ({
  __esModule: true,
  track: (...args: any[]) => trackMock(...args),
}));

jest.mock("@/app/components/errors_details_plot", () => ({
  __esModule: true,
  default: () => <div data-testid="errors-details-plot-mock" />,
}));

jest.mock("@/app/components/errors_distribution_plot", () => ({
  __esModule: true,
  default: () => <div data-testid="errors-distribution-plot-mock" />,
}));

jest.mock("@/app/components/error_group_common_path", () => ({
  __esModule: true,
  default: () => <div data-testid="error-group-common-path-mock" />,
}));

jest.mock("@/app/components/copy_agent_prompt", () => ({
  __esModule: true,
  default: () => <div data-testid="copy-agent-prompt-mock" />,
}));

const event = (overrides: Record<string, unknown> = {}) => ({
  id: "event-1",
  session_id: "session-1",
  timestamp: "2026-01-02T00:00:00Z",
  type: "exception",
  attribute: { os_name: "android", thread_name: "main" },
  exception: {
    title: "java.lang.IllegalStateException@Repo.kt",
    stacktrace: "java.lang.IllegalStateException\n\tat Repo.load(Repo.kt:1)",
    message: "something broke",
  },
  anr: null,
  app_hang: null,
  severity: "fatal",
  attachments: [],
  threads: [],
  ...overrides,
});

const details = (results: any[] | null) =>
  ({ meta: { next: false, previous: false }, results }) as any;

const view = (props: Record<string, unknown>) => (
  <ErrorsDetailsView
    teamId="team-1"
    appId="app-1"
    errorGroupId="group-1"
    data={details([event()])}
    status="success"
    {...props}
  />
);

describe("ErrorsDetailsView error_investigated", () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    trackMock.mockClear();
  });

  it("tracks the view with the first result and the entry point the URL specifies", () => {
    mockSearchParams = new URLSearchParams("from=errors_overview");
    render(view({}));

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("error_investigated", {
      team_id: "team-1",
      app_id: "app-1",
      app_platform: "android",
      type: "crash",
      severity: "fatal",
      feature_area: "errors",
      entry_point: "errors_overview",
    });
  });

  it("tracks a direct entry when the URL has no from parameter", () => {
    render(view({}));

    expect(trackMock).toHaveBeenCalledWith(
      "error_investigated",
      expect.objectContaining({ entry_point: "direct" }),
    );
  });

  it("names ANR and app hang groups by their type", () => {
    const { unmount } = render(
      view({
        data: details([
          event({
            exception: null,
            anr: { stacktrace: "", blamed_thread: "" },
          }),
        ]),
      }),
    );
    unmount();
    render(
      view({
        data: details([
          event({
            exception: null,
            app_hang: { stacktrace: "", thread_name: "" },
            severity: "",
          }),
        ]),
      }),
    );

    expect(trackMock).toHaveBeenNthCalledWith(
      1,
      "error_investigated",
      expect.objectContaining({ type: "anr" }),
    );
    expect(trackMock).toHaveBeenNthCalledWith(
      2,
      "error_investigated",
      expect.objectContaining({ type: "app_hang", severity: "" }),
    );
  });

  it("does not track before the first result loads", () => {
    const { rerender } = render(view({ data: details([]), status: "pending" }));
    expect(trackMock).not.toHaveBeenCalled();

    rerender(view({}));
    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it("does not track a response with no results", () => {
    render(view({ data: details(null) }));
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("tracks the first result that loads after a response with no results", () => {
    const { rerender } = render(view({ data: details(null) }));
    rerender(
      view({
        data: details([
          event({
            exception: null,
            anr: { stacktrace: "", blamed_thread: "" },
          }),
        ]),
      }),
    );

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(
      "error_investigated",
      expect.objectContaining({ type: "anr" }),
    );
  });

  it("does not track the demo", () => {
    render(view({ demo: true }));
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("tracks a view once across refetches, paging, emptied results and URL changes", () => {
    mockSearchParams = new URLSearchParams("from=errors_overview");
    const { rerender } = render(view({}));
    expect(trackMock).toHaveBeenCalledTimes(1);

    rerender(view({ data: details([event()]) }));
    rerender(
      view({
        data: details([
          event({ id: "event-2", attribute: { os_name: "android" } }),
        ]),
      }),
    );
    rerender(view({ data: details(null) }));
    mockSearchParams = new URLSearchParams("from=errors_overview&a=app-1");
    rerender(view({ data: details([event()]) }));

    expect(trackMock).toHaveBeenCalledTimes(1);
  });
});
