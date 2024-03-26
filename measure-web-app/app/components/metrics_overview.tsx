"use client"

import React, { useState, useEffect } from 'react';
import InfoCircleAppAdoption from './info_circle_app_adoption';
import InfoCircleAppSize from './info_circle_app_size';
import InfoCircleExceptionRate from './info_circle_exception_rate';
import InfoCircleAppStartTime from './info_circle_app_start_time';
import { useRouter } from 'next/navigation';
import { AppVersion, MetricsApiStatus, emptyMetrics, fetchMetricsFromServer } from '../api/api_calls';

interface MetricsOverviewProps {
  appId: string,
  startDate: string,
  endDate: string,
  appVersion: AppVersion,
}

const MetricsOverview: React.FC<MetricsOverviewProps> = ({ appId, startDate, endDate, appVersion }) => {

  const [metrics, setMetrics] = useState(emptyMetrics);
  const [metricsApiStatus, setMetricsApiStatus] = useState(MetricsApiStatus.Loading);

  const router = useRouter()

  const getMetrics = async (appId: string, startDate: string, endDate: string, appVersion: AppVersion) => {
    setMetricsApiStatus(MetricsApiStatus.Loading)

    const result = await fetchMetricsFromServer(appId, startDate, endDate, appVersion, router)

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
    getMetrics(appId, startDate, endDate, appVersion)
  }, [appId, startDate, endDate, appVersion]);

  return (
    <div className="flex flex-wrap gap-16 w-5/6">
      <InfoCircleAppAdoption status={metricsApiStatus} title="App adoption" noData={metrics.adoption.nan} value={metrics.adoption.adoption} sessions={metrics.adoption.selected_version} totalSessions={metrics.adoption.all_versions} />
      <InfoCircleAppSize status={metricsApiStatus} title="App size" noData={metrics.sizes.nan} valueInBytes={metrics.sizes.selected_app_size} deltaInBytes={metrics.sizes.delta} />
      <InfoCircleExceptionRate status={metricsApiStatus} title="Crash free sessions" noData={metrics.crash_free_sessions.nan} tooltipMsgLine1="Crash free sessions = (1 - Sessions which experienced a crash in selected app version / Total sessions of selected app version) * 100" tooltipMsgLine2="Delta value = ((Crash free sessions for selected app version - Crash free sessions across all app versions) / Crash free sessions across all app versions) * 100" value={metrics.crash_free_sessions.crash_free_sessions} delta={metrics.crash_free_sessions.delta} />
      <InfoCircleExceptionRate status={metricsApiStatus} title="Perceived crash free sessions" noData={metrics.perceived_crash_free_sessions.nan} tooltipMsgLine1="Perceived crash free sessions = (1 - Sessions which experienced a visible crash in selected app version / Total sessions of selected app version) * 100" tooltipMsgLine2="Delta value = ((Perceived crash free sessions in selected app version - Perceived crash free sessions across all app versions) / Perceived crash free sessions across all app versions) * 100" value={metrics.perceived_crash_free_sessions.perceived_crash_free_sessions} delta={metrics.perceived_crash_free_sessions.delta} />
      <InfoCircleExceptionRate status={metricsApiStatus} title="ANR free sessions" noData={metrics.anr_free_sessions.nan} tooltipMsgLine1="ANR free sessions = (1 - Sessions which experienced an ANR in selected app version / Total sessions of selected app version) * 100" tooltipMsgLine2="Delta value = ((ANR free sessions in selected app version - ANR free sessions across all app versions) / ANR free sessions across all app versions) * 100" value={metrics.anr_free_sessions.anr_free_sessions} delta={metrics.anr_free_sessions.delta} />
      <InfoCircleExceptionRate status={metricsApiStatus} title="Perceived ANR free sessions" noData={metrics.perceived_anr_free_sessions.nan} tooltipMsgLine1="Perceived ANR free sessions = (1 - Sessions which experienced a visible ANR in selected app version / Total sessions of selected app version) * 100" tooltipMsgLine2="Delta value = ((Perceived ANR free sessions in selected app version - Perceived ANR free sessions across all app versions) / Perceived ANR free sessions across all app versions) * 100" value={metrics.perceived_anr_free_sessions.perceived_anr_free_sessions} delta={metrics.perceived_anr_free_sessions.delta} />
      <InfoCircleAppStartTime status={metricsApiStatus} title="App cold launch time" launchType="Cold" noData={metrics.cold_launch.nan} value={metrics.cold_launch.p95} delta={metrics.cold_launch.delta} />
      <InfoCircleAppStartTime status={metricsApiStatus} title="App warm launch time" launchType="Warm" noData={metrics.warm_launch.nan} value={metrics.warm_launch.p95} delta={metrics.warm_launch.delta} />
      <InfoCircleAppStartTime status={metricsApiStatus} title="App hot launch time" launchType="Hot" noData={metrics.hot_launch.nan} value={metrics.hot_launch.p95} delta={metrics.warm_launch.delta} />
    </div>
  );
};

export default MetricsOverview;