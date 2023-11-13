"use client"

import React, { useState, useEffect } from 'react';
import InfoCircleAppAdoption from './info_circle_app_adoption';
import InfoCircleAppSize from './info_circle_app_size';
import InfoCircleExceptionRate from './info_circle_exception_rate';
import InfoCircleAppStartTime from './info_circle_app_start_time';

interface MetricsOverviewProps {
  authToken: string,
  appId:string, 
  startDate:string,
  endDate:string,
  appVersion:string,
}

async function getMetricsOverviewData( authToken: string, appId:string, startDate:string, endDate:string, appVersion:string) {
  const origin = "https://frosty-fog-7165.fly.dev"
  const opts = {
    headers: {
      "Authorization": `Bearer ${authToken}`
    }
  };

  const serverFormattedStartDate = new Date(startDate).toISOString()
  const serverFormattedEndDate = new Date(endDate).toISOString()
  const fakeUUID = 'e2d2f609-7425-4077-a7ff-1d09e62c84d6'
  return await fetch(`${origin}/apps/${fakeUUID}/metrics?appVersion=${appVersion}&startDate=${serverFormattedStartDate}&endDate=${serverFormattedEndDate}`, opts);
}

const emptyData = {
  "adoption": {
    "users": 0,
    "totalUsers": 0,
    "value": 0
  },
  "app_size": {
    "value": 0,
    "delta": 0
  },
  "crash_free_users": {
    "value": 0,
    "delta": 0
  },
  "perceived_crash_free_users": {
    "value": 0,
    "delta": 0
  },
  "multiple_crash_free_users": {
    "value": 0,
    "delta": 0
  },
  "anr_free_users": {
    "value": 0,
    "delta": 0
  },
  "perceived_anr_free_users": {
    "value": 0,
    "delta": 0
  },
  "multiple_anr_free_users": {
    "value": 0,
    "delta": 0
  },
  "app_cold_launch": {
    "value": 0,
    "delta": 0
  },
  "app_warm_launch": {
    "value": 0,
    "delta": 0
  },
  "app_hot_launch": {
    "value": 0,
    "delta": 0
  }
}

const MetricsOverview: React.FC<MetricsOverviewProps> = ({ authToken, appId, startDate, endDate, appVersion }) => {
    const [data, setData] = useState(emptyData);
    const [message, setMessage] = useState("");

    const getData = async (authToken:string, appId:string, startDate:string, endDate:string, appVersion:string) => {
      setMessage("Updating...")
      const res = await getMetricsOverviewData(authToken, appId, startDate, endDate, appVersion)
      if(!res.ok) {
        setMessage("Error")
      } else {
        setMessage("")
        setData(await res.json())
      }
    }
    
    useEffect(() => {
      getData(authToken, appId, startDate, endDate, appVersion)
    }, [authToken, appId, startDate, endDate, appVersion]);

    return (
      <div className="flex flex-wrap gap-16 w-5/6">
        <InfoCircleAppAdoption message={message} title="App adoption" value={data.adoption.value} users={data.adoption.users} totalUsers={data.adoption.totalUsers} />
        <InfoCircleAppSize message={message} title="App size" value={data.app_size.value} delta={data.app_size.delta} />
        <InfoCircleExceptionRate message={message} title="Crash free users" tooltipMsgLine1="Crash free users = (1 - Users who experienced a crash in selected app version / Total users of selected app version) * 100" tooltipMsgLine2="Delta value = ((Crash free users for selected app version - Crash free users across all app versions) / Crash free users across all app versions) * 100" value={data.crash_free_users.value} delta={data.crash_free_users.delta} />
        <InfoCircleExceptionRate message={message} title="Perceived crash free users" tooltipMsgLine1="Perceived crash free users = (1 - Users who experienced a visible crash in selected app version / Total users of selected app version) * 100" tooltipMsgLine2="Delta value = ((Perceived crash free users in selected app version - Perceived crash free users across all app versions) / Perceived crash free users across all app versions) * 100" value={data.perceived_crash_free_users.value} delta={data.perceived_crash_free_users.delta} />
        <InfoCircleExceptionRate message={message} title="Multiple crash free users" tooltipMsgLine1="Multiple crash free users = (1 - Users who experienced at least 2 crashes in selected app version / Total users of selected app version) * 100" tooltipMsgLine2="Delta value = ((Mulitple crash free users in selected app version - Multiple crash free users across all app versions) / Multiple crash free users across all app versions) * 100" value={data.multiple_crash_free_users.value} delta={data.multiple_anr_free_users.delta} />
        <InfoCircleExceptionRate message={message} title="ANR free users" tooltipMsgLine1="ANR free users = (1 - Users who experienced an ANR in selected app version / Total users of selected app version) * 100" tooltipMsgLine2="Delta value = ((ANR free users in selected app version - ANR free users across all app versions) / ANR free users across all app versions) * 100" value={data.anr_free_users.value} delta={data.anr_free_users.delta} />
        <InfoCircleExceptionRate message={message} title="Perceived ANR free users" tooltipMsgLine1="Perceived ANR free users = (1 - Users who experienced a visible ANR in selected app version / Total users of selected app version) * 100" tooltipMsgLine2="Delta value = ((Perceived ANR free users in selected app version - Perceived ANR free users across all app versions) / Perceived ANR free users across all app versions) * 100" value={data.perceived_anr_free_users.value} delta={data.perceived_anr_free_users.delta} />
        <InfoCircleExceptionRate message={message} title="Multiple ANR free users" tooltipMsgLine1="Multiple ANR free users = (1 - Users who experienced at least 2 ANRs in selected app version / Total users of selected app version) * 100" tooltipMsgLine2="Delta value = ((Mulitple ANR free users in selected app version - Multiple ANR free users across all app versions) / Multiple ANR free users across all app versions) * 100" value={data.multiple_anr_free_users.value} delta={data.multiple_anr_free_users.delta} />
        <InfoCircleAppStartTime message={message} title="App cold launch time" launchType="Cold" value={data.app_cold_launch.value} delta={data.app_cold_launch.delta} />
        <InfoCircleAppStartTime message={message} title="App warm launch time" launchType="Warm" value={data.app_warm_launch.value} delta={data.app_warm_launch.delta} />
        <InfoCircleAppStartTime message={message} title="App hot launch time" launchType="Hot" value={data.app_hot_launch.value} delta={data.app_hot_launch.delta} />
      </div>
  );
};

export default MetricsOverview;