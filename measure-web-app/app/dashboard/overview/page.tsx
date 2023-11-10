"use client"

import React, { useState } from 'react';
import Dropdown from "@/app/components/dropdown";
import FilterPill from "@/app/components/filter_pill";
import InfoCircleAppAdoption from "@/app/components/info_circle_app_adoption";
import InfoCircleAppSize from "@/app/components/info_circle_app_size";
import InfoCircleAppStartTime from "@/app/components/info_circle_app_start_time";
import InfoCircleExceptionRate from "@/app/components/info_circle_exception_rate";
import UserFlow from "@/app/components/user_flow";

export default function Overview() {
  const today = new Date();
  var initialEndDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const [endDate, setEndDate] = useState(initialEndDate);

  const sevenDaysAgo = new Date(today.setDate(today.getDate() - 7));
  var initialStartDate = `${sevenDaysAgo.getFullYear()}-${(sevenDaysAgo.getMonth() + 1).toString().padStart(2, '0')}-${sevenDaysAgo.getDate().toString().padStart(2, '0')}`;
  const [startDate, setStartDate] = useState(initialStartDate);

  var apps = ['Readly prod', 'Readly alpha', 'Readly debug'];
  const [selectedApp, setSelectedApp] = useState(apps[0]);

  var versions = ['Version 13.2.1', 'Version 13.2.2', 'Version 13.3.7'];
  const [selectedVersion, setSelectedVersion] = useState(versions[0]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-black text-4xl max-w-6xl text-center">Overview</p>
      <div className="py-4" />
      <div className="flex flex-wrap gap-8 items-center">
        <Dropdown items={apps} onChangeSelectedItem={(item) => setSelectedApp(item)} />
        <div className="flex flex-row items-center">
          <input type="date" defaultValue={startDate} className="font-display text-black border border-black rounded-md p-2" onChange={(e) => setStartDate(e.target.value)} />
          <p className="text-black font-display px-2">to</p>
          <input type="date" defaultValue={endDate} className="font-display text-black border border-black rounded-md p-2" onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Dropdown items={versions} onChangeSelectedItem={(item) => setSelectedVersion(item)} />
      </div>
      <div className="py-4" />
      <div className="flex flex-wrap gap-2 items-center w-5/6">
        <FilterPill title={selectedApp} />
        <FilterPill title={`${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`} />
        <FilterPill title={selectedVersion} />
      </div>
      <div className="py-8" />
      <UserFlow authToken="abcde123" appId={selectedApp} startDate={startDate} endDate={endDate} appVersion={selectedVersion} />
      <div className="py-8" />
      <div className="flex flex-wrap gap-16 w-5/6">
        <InfoCircleAppAdoption title="App adoption" value={20} users={40000} totalUsers={200000} />
        <InfoCircleAppSize title="App size" value={20} delta={3.18} />
        <InfoCircleExceptionRate title="Crash free users" tooltipMsgLine1="Crash free users = (1 - Users who experienced a crash in selected app version / Total users of selected app version) * 100" tooltipMsgLine2="Delta value = ((Crash free users for selected app version - Crash free users across all app versions) / Crash free users across all app versions) * 100" value={98.5} delta={0.73} />
        <InfoCircleExceptionRate title="Perceived crash free users" tooltipMsgLine1="Perceived crash free users = (1 - Users who experienced a visible crash in selected app version / Total users of selected app version) * 100" tooltipMsgLine2="Delta value = ((Perceived crash free users in selected app version - Perceived crash free users across all app versions) / Perceived crash free users across all app versions) * 100" value={91.3} delta={-0.51} />
        <InfoCircleExceptionRate title="Multiple crash free users" tooltipMsgLine1="Multiple crash free users = (1 - Users who experienced at least 2 crashes in selected app version / Total users of selected app version) * 100" tooltipMsgLine2="Delta value = ((Mulitple crash free users in selected app version - Multiple crash free users across all app versions) / Multiple crash free users across all app versions) * 100" value={76.37} delta={+0.62} />
        <InfoCircleExceptionRate title="ANR free users" tooltipMsgLine1="ANR free users = (1 - Users who experienced an ANR in selected app version / Total users of selected app version) * 100" tooltipMsgLine2="Delta value = ((ANR free users in selected app version - ANR free users across all app versions) / ANR free users across all app versions) * 100" value={98.5} delta={0.73} />
        <InfoCircleExceptionRate title="Perceived ANR free users" tooltipMsgLine1="Perceived ANR free users = (1 - Users who experienced a visible ANR in selected app version / Total users of selected app version) * 100" tooltipMsgLine2="Delta value = ((Perceived ANR free users in selected app version - Perceived ANR free users across all app versions) / Perceived ANR free users across all app versions) * 100" value={91.3} delta={0.27} />
        <InfoCircleExceptionRate title="Multiple ANR free users" tooltipMsgLine1="Multiple ANR free users = (1 - Users who experienced at least 2 ANRs in selected app version / Total users of selected app version) * 100" tooltipMsgLine2="Delta value = ((Mulitple ANR free users in selected app version - Multiple ANR free users across all app versions) / Multiple ANR free users across all app versions) * 100" value={97.88} delta={-3.13} />
        <InfoCircleAppStartTime title="App cold launch time" launchType="Cold" value={900} delta={-200} />
        <InfoCircleAppStartTime title="App warm launch time" launchType="Warm" value={600} delta={-1270} />
        <InfoCircleAppStartTime title="App hot launch time" launchType="Hot" value={300} delta={-50} />
      </div>
    </div>
  )
}
