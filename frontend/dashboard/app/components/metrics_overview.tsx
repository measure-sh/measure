"use client";

import { useAppThresholdPrefsQuery, useMetricsQuery } from "@/app/query/hooks";
import { useFiltersStore } from "@/app/stores/provider";
import React from "react";
import { defaultAppThresholdPrefs, emptyMetrics } from "../api/api_calls";
import MetricsCard from "./metrics_card";

const demoMetrics = {
  adoption: {
    all_versions: 10000000,
    selected_version: 4100000,
    adoption: 41,
    no_data: false,
  },
  anr_free_sessions: {
    anr_free_sessions: 99.7,
    unselected_anr_free_sessions: 99.2,
    no_data: false,
    unselected_no_data: false,
  },
  cold_launch: {
    p95: 923,
    unselected_p95: 987,
    no_data: false,
    unselected_no_data: false,
  },
  crash_free_sessions: {
    crash_free_sessions: 99.1,
    unselected_crash_free_sessions: 98.2,
    no_data: false,
    unselected_no_data: false,
  },
  hot_launch: {
    p95: 197,
    unselected_p95: 224,
    no_data: false,
    unselected_no_data: false,
  },
  perceived_anr_free_sessions: {
    perceived_anr_free_sessions: 99.8,
    unselected_perceived_anr_free_sessions: 99.5,
    no_data: false,
    unselected_no_data: false,
  },
  perceived_crash_free_sessions: {
    perceived_crash_free_sessions: 99.6,
    unselected_perceived_crash_free_sessions: 99.1,
    no_data: false,
    unselected_no_data: false,
  },
  sizes: {
    average_app_size: 23000000,
    selected_app_size: 23345678,
    delta: -345678,
    no_data: false,
  },
  warm_launch: {
    p95: 503,
    unselected_p95: 471,
    no_data: false,
    unselected_no_data: false,
  },
};

interface MetricsOverviewProps {
  demo?: boolean;
}

const MetricsOverview: React.FC<MetricsOverviewProps> = ({ demo = false }) => {
  const filters = useFiltersStore((state) => state.filters);
  const metricsQuery = useMetricsQuery();
  const thresholdPrefsQuery = useAppThresholdPrefsQuery(filters.app?.id);

  const metricsStatus = demo ? "success" : metricsQuery.status;
  const metrics = demo ? demoMetrics : (metricsQuery.data ?? emptyMetrics);
  const appThresholdPrefs =
    thresholdPrefsQuery.data ?? defaultAppThresholdPrefs;

  return (
    <div
      className={`flex flex-wrap ${demo ? "gap-x-12 gap-y-16" : "gap-16"} w-full justify-center`}
    >
      <MetricsCard
        type="app_adoption"
        status={metricsStatus}
        noData={metrics.adoption.no_data}
        value={metrics.adoption.adoption}
        sessions={metrics.adoption.selected_version}
        totalSessions={metrics.adoption.all_versions}
      />

      <MetricsCard
        type="crash_free_sessions"
        status={metricsStatus}
        noData={metrics.crash_free_sessions.no_data}
        value={metrics.crash_free_sessions.crash_free_sessions}
        unselectedValue={
          metrics.crash_free_sessions.unselected_crash_free_sessions
        }
        noComparison={metrics.crash_free_sessions.unselected_no_data}
        errorGoodThreshold={appThresholdPrefs.error_good_threshold}
        errorCautionThreshold={appThresholdPrefs.error_caution_threshold}
      />

      <MetricsCard
        type="perceived_crash_free_sessions"
        status={metricsStatus}
        noData={metrics.perceived_crash_free_sessions.no_data}
        value={
          metrics.perceived_crash_free_sessions.perceived_crash_free_sessions
        }
        unselectedValue={
          metrics.perceived_crash_free_sessions
            .unselected_perceived_crash_free_sessions
        }
        noComparison={metrics.perceived_crash_free_sessions.unselected_no_data}
        errorGoodThreshold={appThresholdPrefs.error_good_threshold}
        errorCautionThreshold={appThresholdPrefs.error_caution_threshold}
      />

      {metrics.anr_free_sessions && (
        <MetricsCard
          type="anr_free_sessions"
          status={metricsStatus}
          noData={metrics.anr_free_sessions.no_data}
          value={metrics.anr_free_sessions.anr_free_sessions}
          unselectedValue={
            metrics.anr_free_sessions.unselected_anr_free_sessions
          }
          noComparison={metrics.anr_free_sessions.unselected_no_data}
          errorGoodThreshold={appThresholdPrefs.error_good_threshold}
          errorCautionThreshold={appThresholdPrefs.error_caution_threshold}
        />
      )}

      {metrics.perceived_anr_free_sessions && (
        <MetricsCard
          type="perceived_anr_free_sessions"
          status={metricsStatus}
          noData={metrics.perceived_anr_free_sessions.no_data}
          value={
            metrics.perceived_anr_free_sessions.perceived_anr_free_sessions
          }
          unselectedValue={
            metrics.perceived_anr_free_sessions
              .unselected_perceived_anr_free_sessions
          }
          noComparison={metrics.perceived_anr_free_sessions.unselected_no_data}
          errorGoodThreshold={appThresholdPrefs.error_good_threshold}
          errorCautionThreshold={appThresholdPrefs.error_caution_threshold}
        />
      )}

      <MetricsCard
        type="app_start_time"
        status={metricsStatus}
        launchType="Cold"
        noData={metrics.cold_launch.no_data}
        noComparison={metrics.cold_launch.unselected_no_data}
        value={metrics.cold_launch.p95}
        unselectedValue={metrics.cold_launch.unselected_p95}
      />

      <MetricsCard
        type="app_start_time"
        status={metricsStatus}
        launchType="Warm"
        noData={metrics.warm_launch.no_data}
        noComparison={metrics.warm_launch.unselected_no_data}
        value={metrics.warm_launch.p95}
        unselectedValue={metrics.warm_launch.unselected_p95}
      />

      <MetricsCard
        type="app_start_time"
        status={metricsStatus}
        launchType="Hot"
        noData={metrics.hot_launch.no_data}
        noComparison={metrics.hot_launch.unselected_no_data}
        value={metrics.hot_launch.p95}
        unselectedValue={metrics.hot_launch.unselected_p95}
      />

      {/* show app size metrics only on single app version selection && only when app size is available */}
      {metrics.sizes !== null && (
        <MetricsCard
          type="app_size"
          status={metricsStatus}
          multiVersion={filters.versions.selected.length > 1}
          noData={metrics.sizes.no_data}
          valueInBytes={metrics.sizes.selected_app_size}
          deltaInBytes={metrics.sizes.delta}
        />
      )}
    </div>
  );
};

export default MetricsOverview;
