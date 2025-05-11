"use client"

import React, { useState, useEffect } from 'react'
import InfoCircleAppAdoption from './info_circle_app_adoption'
import InfoCircleAppSize from './info_circle_app_size'
import InfoCircleExceptionRate from './info_circle_exception_rate'
import InfoCircleAppStartTime from './info_circle_app_start_time'
import { MetricsApiStatus, emptyMetrics, fetchMetricsFromServer } from '../api/api_calls'
import { Filters } from './filters'

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
    <div className="flex flex-wrap gap-x-40 gap-y-16 w-full">
      <InfoCircleAppAdoption status={metricsApiStatus} title="App adoption" noData={metrics.adoption.nan} value={metrics.adoption.adoption} sessions={metrics.adoption.selected_version} totalSessions={metrics.adoption.all_versions} />
      <InfoCircleExceptionRate status={metricsApiStatus} title="Crash free sessions" noData={metrics.crash_free_sessions.nan} tooltipMsgLine1="Crash free sessions = (1 - Sessions which experienced a crash in selected app versions / Total sessions of selected app versions) * 100" tooltipMsgLine2="Delta value = Crash free sessions percentage of selected app versions / Crash free sessions percentage of unselected app versions" value={metrics.crash_free_sessions.crash_free_sessions} delta={metrics.crash_free_sessions.delta} />
      <InfoCircleExceptionRate status={metricsApiStatus} title="Perceived crash free sessions" noData={metrics.perceived_crash_free_sessions.nan} tooltipMsgLine1="Perceived crash free sessions = (1 - Sessions which experienced a visible crash in selected app versions / Total sessions of selected app versions) * 100" tooltipMsgLine2="Delta value = Perceived crash free sessions percentage of selected app versions / Perceived crash free sessions percentage of unselected app versions" value={metrics.perceived_crash_free_sessions.perceived_crash_free_sessions} delta={metrics.perceived_crash_free_sessions.delta} />
      {metrics.anr_free_sessions && <InfoCircleExceptionRate status={metricsApiStatus} title="ANR free sessions" noData={metrics.anr_free_sessions.nan} tooltipMsgLine1="ANR free sessions = (1 - Sessions which experienced an ANR in selected app versions / Total sessions of selected app versions) * 100" tooltipMsgLine2="Delta value = ANR free sessions percentage of selected app versions / ANR free sessions percentage of unselected app versions" value={metrics.anr_free_sessions.anr_free_sessions} delta={metrics.anr_free_sessions.delta} />}
      {metrics.perceived_anr_free_sessions && <InfoCircleExceptionRate status={metricsApiStatus} title="Perceived ANR free sessions" noData={metrics.perceived_anr_free_sessions.nan} tooltipMsgLine1="Perceived ANR free sessions = (1 - Sessions which experienced a visible ANR in selected app versions / Total sessions of selected app versions) * 100" tooltipMsgLine2="Delta value = Perceived ANR free sessions percentage of selected app versions / Perceived ANR free sessions percentage of unselected app versions" value={metrics.perceived_anr_free_sessions.perceived_anr_free_sessions} delta={metrics.perceived_anr_free_sessions.delta} />}
      <InfoCircleAppStartTime status={metricsApiStatus} title="App cold launch time" launchType="Cold" noData={metrics.cold_launch.nan} value={metrics.cold_launch.p95} delta={metrics.cold_launch.delta} />
      <InfoCircleAppStartTime status={metricsApiStatus} title="App warm launch time" launchType="Warm" noData={metrics.warm_launch.nan} value={metrics.warm_launch.p95} delta={metrics.warm_launch.delta} />
      <InfoCircleAppStartTime status={metricsApiStatus} title="App hot launch time" launchType="Hot" noData={metrics.hot_launch.nan} value={metrics.hot_launch.p95} delta={metrics.hot_launch.delta} />

      {/* show app size metrics only on single app version selection && only when app size is available */}
      {filters.versions.length === 1 && metrics.sizes !== null && <InfoCircleAppSize status={metricsApiStatus} title="App size" noData={metrics.sizes.nan} valueInBytes={metrics.sizes.selected_app_size} deltaInBytes={metrics.sizes.delta} />}
    </div>
  )
}

export default MetricsOverview
