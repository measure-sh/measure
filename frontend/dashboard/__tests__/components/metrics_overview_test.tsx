import MetricsOverview from "@/app/components/metrics_overview";
import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/components/metrics_card", () => ({
  __esModule: true,
  default: ({
    type,
    status,
    launchType,
    errorGoodThreshold,
    errorCautionThreshold,
    multiVersion,
  }: any) => (
    <div
      data-testid={`metrics-card-${type}${launchType ? `-${launchType}` : ""}`}
      data-status={status}
      data-error-good-threshold={errorGoodThreshold}
      data-error-caution-threshold={errorCautionThreshold}
      data-multi-version={multiVersion}
    >
      {type}
      {launchType ? ` ${launchType}` : ""}
    </div>
  ),
}));

const appThresholdPrefs = {
  error_good_threshold: 99,
  error_caution_threshold: 95,
  error_spike_min_count_threshold: 100,
  error_spike_min_rate_threshold: 0.5,
};

function mockMetricsData() {
  return {
    adoption: {
      all_versions: 10000,
      selected_version: 4100,
      adoption: 41,
      no_data: false,
    },
    crash_free_sessions: {
      crash_free_sessions: 99.1,
      unselected_crash_free_sessions: 98.2,
      no_data: false,
      unselected_no_data: false,
    },
    perceived_crash_free_sessions: {
      perceived_crash_free_sessions: 99.6,
      unselected_perceived_crash_free_sessions: 99.1,
      no_data: false,
      unselected_no_data: false,
    },
    anr_free_sessions: {
      anr_free_sessions: 99.7,
      unselected_anr_free_sessions: 99.2,
      no_data: false,
      unselected_no_data: false,
    },
    perceived_anr_free_sessions: {
      perceived_anr_free_sessions: 99.8,
      unselected_perceived_anr_free_sessions: 99.5,
      no_data: false,
      unselected_no_data: false,
    },
    cold_launch: {
      p95: 923,
      unselected_p95: 987,
      no_data: false,
      unselected_no_data: false,
    },
    warm_launch: {
      p95: 503,
      unselected_p95: 471,
      no_data: false,
      unselected_no_data: false,
    },
    hot_launch: {
      p95: 197,
      unselected_p95: 224,
      no_data: false,
      unselected_no_data: false,
    },
    sizes: {
      average_app_size: 23000000,
      selected_app_size: 23345678,
      delta: -345678,
      no_data: false,
    },
  };
}

const emptyMetrics = {
  adoption: {
    all_versions: 0,
    selected_version: 0,
    adoption: 0,
    no_data: true,
  },
  crash_free_sessions: {
    crash_free_sessions: 0,
    unselected_crash_free_sessions: 0,
    no_data: true,
    unselected_no_data: true,
  },
  perceived_crash_free_sessions: {
    perceived_crash_free_sessions: 0,
    unselected_perceived_crash_free_sessions: 0,
    no_data: true,
    unselected_no_data: true,
  },
  anr_free_sessions: null,
  perceived_anr_free_sessions: null,
  cold_launch: {
    p95: 0,
    unselected_p95: 0,
    no_data: true,
    unselected_no_data: true,
  },
  warm_launch: {
    p95: 0,
    unselected_p95: 0,
    no_data: true,
    unselected_no_data: true,
  },
  hot_launch: {
    p95: 0,
    unselected_p95: 0,
    no_data: true,
    unselected_no_data: true,
  },
  sizes: null,
};

describe("MetricsOverview", () => {
  it("renders metrics cards with pending status", () => {
    render(
      <MetricsOverview
        status="pending"
        metrics={emptyMetrics as any}
        appThresholdPrefs={appThresholdPrefs}
      />,
    );
    const card = screen.getByTestId("metrics-card-app_adoption");
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("data-status", "pending");
  });

  it("renders all metrics cards on success", () => {
    render(
      <MetricsOverview
        status="success"
        metrics={mockMetricsData()}
        appThresholdPrefs={appThresholdPrefs}
      />,
    );
    expect(screen.getByTestId("metrics-card-app_adoption")).toBeInTheDocument();
    expect(
      screen.getByTestId("metrics-card-crash_free_sessions"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("metrics-card-perceived_crash_free_sessions"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("metrics-card-anr_free_sessions"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("metrics-card-perceived_anr_free_sessions"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("metrics-card-app_start_time-Cold"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("metrics-card-app_start_time-Warm"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("metrics-card-app_start_time-Hot"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("metrics-card-app_size")).toBeInTheDocument();
  });

  it("passes the threshold prefs through to cards that need them", () => {
    render(
      <MetricsOverview
        status="success"
        metrics={mockMetricsData()}
        appThresholdPrefs={appThresholdPrefs}
      />,
    );
    const card = screen.getByTestId("metrics-card-crash_free_sessions");
    expect(card).toHaveAttribute("data-error-good-threshold", "99");
    expect(card).toHaveAttribute("data-error-caution-threshold", "95");
  });

  it("does not render ANR cards when anr_free_sessions is null", () => {
    const data = mockMetricsData();
    (data as any).anr_free_sessions = null;
    (data as any).perceived_anr_free_sessions = null;
    render(
      <MetricsOverview
        status="success"
        metrics={data}
        appThresholdPrefs={appThresholdPrefs}
      />,
    );
    expect(
      screen.queryByTestId("metrics-card-anr_free_sessions"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("metrics-card-perceived_anr_free_sessions"),
    ).not.toBeInTheDocument();
  });

  it("marks the app size card multi-version when sizes is null", () => {
    const data = mockMetricsData();
    (data as any).sizes = null;
    render(
      <MetricsOverview
        status="success"
        metrics={data}
        appThresholdPrefs={appThresholdPrefs}
      />,
    );
    expect(screen.getByTestId("metrics-card-app_size")).toHaveAttribute(
      "data-multi-version",
      "true",
    );
  });
});
