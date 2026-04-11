"use client"

import { useAppThresholdPrefsQuery, useMetricsQuery } from '@/app/query/hooks'
import { useFiltersStore } from '@/app/stores/provider'
import React from 'react'
import { defaultAppThresholdPrefs, emptyMetrics } from '../api/api_calls'
import MetricsCard from './metrics_card'

const demoMetrics = {
  adoption: { all_versions: 10000000, selected_version: 4100000, adoption: 41, nan: false },
  anr_free_sessions: { anr_free_sessions: 99.7, delta: 1.01, nan: false },
  cold_launch: { delta: 0.07, nan: false, delta_nan: false, p95: 923 },
  crash_free_sessions: { crash_free_sessions: 99.1, delta: 1.1, nan: false },
  hot_launch: { delta: 0.02, nan: false, delta_nan: false, p95: 197 },
  perceived_anr_free_sessions: { perceived_anr_free_sessions: 99.8, delta: 1.05, nan: false },
  perceived_crash_free_sessions: { perceived_crash_free_sessions: 99.6, delta: 1.05, nan: false },
  sizes: { average_app_size: 23000000, selected_app_size: 23345678, delta: -345678, nan: false },
  warm_launch: { delta: 1.03, nan: false, delta_nan: false, p95: 503 },
}

interface MetricsOverviewProps {
  demo?: boolean
}

const MetricsOverview: React.FC<MetricsOverviewProps> = ({ demo = false }) => {
  const filters = useFiltersStore(state => state.filters)
  const metricsQuery = useMetricsQuery()
  const thresholdPrefsQuery = useAppThresholdPrefsQuery(filters.app?.id)

  const metricsStatus = demo ? 'success' : metricsQuery.status
  const metrics = demo ? demoMetrics : (metricsQuery.data ?? emptyMetrics)
  const appThresholdPrefs = thresholdPrefsQuery.data ?? defaultAppThresholdPrefs

  return (
    <div className={`flex flex-wrap ${demo ? 'gap-x-12 gap-y-16' : 'gap-16'} w-full justify-center`}>
      <MetricsCard
        type="app_adoption"
        status={metricsStatus}
        noData={metrics.adoption.nan}
        value={metrics.adoption.adoption}
        sessions={metrics.adoption.selected_version}
        totalSessions={metrics.adoption.all_versions}
      />

      <MetricsCard
        type="crash_free_sessions"
        status={metricsStatus}
        noData={metrics.crash_free_sessions.nan}
        value={metrics.crash_free_sessions.crash_free_sessions}
        delta={metrics.crash_free_sessions.delta}
        errorGoodThreshold={appThresholdPrefs.error_good_threshold}
        errorCautionThreshold={appThresholdPrefs.error_caution_threshold}
      />

      <MetricsCard
        type="perceived_crash_free_sessions"
        status={metricsStatus}
        noData={metrics.perceived_crash_free_sessions.nan}
        value={metrics.perceived_crash_free_sessions.perceived_crash_free_sessions}
        delta={metrics.perceived_crash_free_sessions.delta}
        errorGoodThreshold={appThresholdPrefs.error_good_threshold}
        errorCautionThreshold={appThresholdPrefs.error_caution_threshold}
      />

      {metrics.anr_free_sessions && (
        <MetricsCard
          type="anr_free_sessions"
          status={metricsStatus}
          noData={metrics.anr_free_sessions.nan}
          value={metrics.anr_free_sessions.anr_free_sessions}
          delta={metrics.anr_free_sessions.delta}
          errorGoodThreshold={appThresholdPrefs.error_good_threshold}
          errorCautionThreshold={appThresholdPrefs.error_caution_threshold}
        />
      )}

      {metrics.perceived_anr_free_sessions && (
        <MetricsCard
          type="perceived_anr_free_sessions"
          status={metricsStatus}
          noData={metrics.perceived_anr_free_sessions.nan}
          value={metrics.perceived_anr_free_sessions.perceived_anr_free_sessions}
          delta={metrics.perceived_anr_free_sessions.delta}
          errorGoodThreshold={appThresholdPrefs.error_good_threshold}
          errorCautionThreshold={appThresholdPrefs.error_caution_threshold}
        />
      )}

      <MetricsCard
        type="app_start_time"
        status={metricsStatus}
        launchType="Cold"
        noData={metrics.cold_launch.nan}
        noDelta={metrics.cold_launch.delta_nan}
        value={metrics.cold_launch.p95}
        delta={metrics.cold_launch.delta}
      />

      <MetricsCard
        type="app_start_time"
        status={metricsStatus}
        launchType="Warm"
        noData={metrics.warm_launch.nan}
        noDelta={metrics.warm_launch.delta_nan}
        value={metrics.warm_launch.p95}
        delta={metrics.warm_launch.delta}
      />

      <MetricsCard
        type="app_start_time"
        status={metricsStatus}
        launchType="Hot"
        noData={metrics.hot_launch.nan}
        noDelta={metrics.hot_launch.delta_nan}
        value={metrics.hot_launch.p95}
        delta={metrics.hot_launch.delta}
      />

      {/* show app size metrics only on single app version selection && only when app size is available */}
      {metrics.sizes !== null && (
        <MetricsCard
          type="app_size"
          status={metricsStatus}
          multiVersion={filters.versions.selected.length > 1}
          noData={metrics.sizes.nan}
          valueInBytes={metrics.sizes.selected_app_size}
          deltaInBytes={metrics.sizes.delta}
        />
      )}
    </div>
  )
}

export default MetricsOverview
