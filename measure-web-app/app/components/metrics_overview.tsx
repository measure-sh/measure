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
      <InfoCircleAppAdoption status={metricsApiStatus} title="App adoption" value={metrics.adoption.value} sessions={metrics.adoption.users} totalSessions={metrics.adoption.totalUsers} />
      <InfoCircleAppSize status={metricsApiStatus} title="App size" value={metrics.app_size.value} delta={metrics.app_size.delta} />
      <InfoCircleExceptionRate status={metricsApiStatus} title="Crash free sessions" tooltipMsgLine1="Crash free sessions = (1 - Sessions which experienced a crash in selected app version / Total sessions of selected app version) * 100" tooltipMsgLine2="Delta value = ((Crash free sessions for selected app version - Crash free sessions across all app versions) / Crash free sessions across all app versions) * 100" value={metrics.crash_free_users.value} delta={metrics.crash_free_users.delta} />
      <InfoCircleExceptionRate status={metricsApiStatus} title="Perceived crash free sessions" tooltipMsgLine1="Perceived crash free sessions = (1 - Sessions which experienced a visible crash in selected app version / Total sessions of selected app version) * 100" tooltipMsgLine2="Delta value = ((Perceived crash free sessions in selected app version - Perceived crash free sessions across all app versions) / Perceived crash free sessions across all app versions) * 100" value={metrics.perceived_crash_free_users.value} delta={metrics.perceived_crash_free_users.delta} />
      <InfoCircleExceptionRate status={metricsApiStatus} title="ANR free sessions" tooltipMsgLine1="ANR free sessions = (1 - Sessions which experienced an ANR in selected app version / Total sessions of selected app version) * 100" tooltipMsgLine2="Delta value = ((ANR free sessions in selected app version - ANR free sessions across all app versions) / ANR free sessions across all app versions) * 100" value={metrics.anr_free_users.value} delta={metrics.anr_free_users.delta} />
      <InfoCircleExceptionRate status={metricsApiStatus} title="Perceived ANR free sessions" tooltipMsgLine1="Perceived ANR free sessions = (1 - Sessions which experienced a visible ANR in selected app version / Total sessions of selected app version) * 100" tooltipMsgLine2="Delta value = ((Perceived ANR free sessions in selected app version - Perceived ANR free sessions across all app versions) / Perceived ANR free sessions across all app versions) * 100" value={metrics.perceived_anr_free_users.value} delta={metrics.perceived_anr_free_users.delta} />
      <InfoCircleAppStartTime status={metricsApiStatus} title="App cold launch time" launchType="Cold" value={metrics.app_cold_launch.value} delta={metrics.app_cold_launch.delta} />
      <InfoCircleAppStartTime status={metricsApiStatus} title="App warm launch time" launchType="Warm" value={metrics.app_warm_launch.value} delta={metrics.app_warm_launch.delta} />
      <InfoCircleAppStartTime status={metricsApiStatus} title="App hot launch time" launchType="Hot" value={metrics.app_hot_launch.value} delta={metrics.app_hot_launch.delta} />
    </div>
  );
};

export default MetricsOverview;