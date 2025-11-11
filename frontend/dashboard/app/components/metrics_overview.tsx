"use client"

import React, { useEffect, useState } from 'react'
import { MetricsApiStatus, emptyMetrics, fetchMetricsFromServer } from '../api/api_calls'
import { Filters } from './filters'
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
  filters: Filters
  demo?: boolean
}

const MetricsOverview: React.FC<MetricsOverviewProps> = ({ filters, demo = false }) => {

  const [metrics, setMetrics] = useState(emptyMetrics)
  const [metricsApiStatus, setMetricsApiStatus] = useState(MetricsApiStatus.Loading)

  const getMetrics = async () => {
    if (demo) {
      setMetricsApiStatus(MetricsApiStatus.Success)
      setMetrics(demoMetrics)
      return
    }

    // Don't try to fetch metrics if filters aren't ready
    if (!filters.ready) {
      return
    }

    setMetricsApiStatus(MetricsApiStatus.Loading)

    const result = await fetchMetricsFromServer(filters)

    switch (result.status) {
      case MetricsApiStatus.Error:
        setMetricsApiStatus(MetricsApiStatus.Error)
        break
      case MetricsApiStatus.Success:
        setMetricsApiStatus(MetricsApiStatus.Success)
        setMetrics(result.data)
        break
    }
  }

  useEffect(() => {
    getMetrics()
  }, [filters])

  return (
    <div className={`flex flex-wrap ${demo ? 'gap-x-12 gap-y-16' : 'gap-16'} w-full justify-center`}>
      <MetricsCard
        type="app_adoption"
        status={metricsApiStatus}
        noData={metrics.adoption.nan}
        value={metrics.adoption.adoption}
        sessions={metrics.adoption.selected_version}
        totalSessions={metrics.adoption.all_versions}
      />

      <MetricsCard
        type="crash_free_sessions"
        status={metricsApiStatus}
        noData={metrics.crash_free_sessions.nan}
        value={metrics.crash_free_sessions.crash_free_sessions}
        delta={metrics.crash_free_sessions.delta}
      />

      <MetricsCard
        type="perceived_crash_free_sessions"
        status={metricsApiStatus}
        noData={metrics.perceived_crash_free_sessions.nan}
        value={metrics.perceived_crash_free_sessions.perceived_crash_free_sessions}
        delta={metrics.perceived_crash_free_sessions.delta}
      />

      {metrics.anr_free_sessions && (
        <MetricsCard
          type="anr_free_sessions"
          status={metricsApiStatus}
          noData={metrics.anr_free_sessions.nan}
          value={metrics.anr_free_sessions.anr_free_sessions}
          delta={metrics.anr_free_sessions.delta}
        />
      )}

      {metrics.perceived_anr_free_sessions && (
        <MetricsCard
          type="perceived_anr_free_sessions"
          status={metricsApiStatus}
          noData={metrics.perceived_anr_free_sessions.nan}
          value={metrics.perceived_anr_free_sessions.perceived_anr_free_sessions}
          delta={metrics.perceived_anr_free_sessions.delta}
        />
      )}

      <MetricsCard
        type="app_start_time"
        status={metricsApiStatus}
        launchType="Cold"
        noData={metrics.cold_launch.nan}
        noDelta={metrics.cold_launch.delta_nan}
        value={metrics.cold_launch.p95}
        delta={metrics.cold_launch.delta}
      />

      <MetricsCard
        type="app_start_time"
        status={metricsApiStatus}
        launchType="Warm"
        noData={metrics.warm_launch.nan}
        noDelta={metrics.warm_launch.delta_nan}
        value={metrics.warm_launch.p95}
        delta={metrics.warm_launch.delta}
      />

      <MetricsCard
        type="app_start_time"
        status={metricsApiStatus}
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
          status={metricsApiStatus}
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