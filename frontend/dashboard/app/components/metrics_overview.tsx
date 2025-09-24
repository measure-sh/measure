"use client"

import React, { useEffect, useState } from 'react'
import { MetricsApiStatus, emptyMetrics, fetchMetricsFromServer } from '../api/api_calls'
import { Filters } from './filters'
import MetricsCard from './metrics_card'

interface MetricsOverviewProps {
  filters: Filters
}

const MetricsOverview: React.FC<MetricsOverviewProps> = ({ filters }) => {

  const [metrics, setMetrics] = useState(emptyMetrics)
  const [metricsApiStatus, setMetricsApiStatus] = useState(MetricsApiStatus.Loading)

  const getMetrics = async () => {
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
    <div className="flex flex-wrap gap-16 w-full justify-center">
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
        value={metrics.cold_launch.p95}
        delta={metrics.cold_launch.delta}
      />

      <MetricsCard
        type="app_start_time"
        status={metricsApiStatus}
        launchType="Warm"
        noData={metrics.warm_launch.nan}
        value={metrics.warm_launch.p95}
        delta={metrics.warm_launch.delta}
      />

      <MetricsCard
        type="app_start_time"
        status={metricsApiStatus}
        launchType="Hot"
        noData={metrics.hot_launch.nan}
        value={metrics.hot_launch.p95}
        delta={metrics.hot_launch.delta}
      />

      {/* show app size metrics only on single app version selection && only when app size is available */}
      {filters.versions.length === 1 && metrics.sizes !== null && (
        <MetricsCard
          type="app_size"
          status={metricsApiStatus}
          noData={metrics.sizes.nan}
          valueInBytes={metrics.sizes.selected_app_size}
          deltaInBytes={metrics.sizes.delta}
        />
      )}
    </div>
  )
}

export default MetricsOverview