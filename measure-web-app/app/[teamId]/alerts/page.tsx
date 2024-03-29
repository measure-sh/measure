"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CreateApp from '@/app/components/create_app';
import { AppsApiStatus, emptyAlerts, emptyApp, fetchAppsFromServer } from '@/app/api/api_calls';
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select';

export default function Overview({ params }: { params: { teamId: string } }) {
  const router = useRouter()

  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);

  const [apps, setApps] = useState([] as typeof emptyApp[]);
  const [selectedApp, setSelectedApp] = useState(emptyApp);
  const [alerts, setAlerts] = useState(emptyAlerts);
  const [updatedAlerts, setUpdatedAlerts] = useState(emptyAlerts);

  interface AlertState {
    email: boolean;
    slack: boolean;
  }

  interface UpdatedAlertsState {
    crash_rate_spike: AlertState;
    anr_rate_spike: AlertState;
    launch_time_spike: AlertState;
  }

  interface AlertRowProps {
    rowTitle: string;
    emailChecked: boolean;
    slackChecked: boolean;
    handleEmailChange: () => void;
    handleSlackChange: () => void;
  }

  const handleEmailChange = (alertKey: keyof UpdatedAlertsState) => {
    setUpdatedAlerts((prevAlerts) => ({
      ...prevAlerts,
      [alertKey]: {
        ...prevAlerts[alertKey],
        email: !prevAlerts[alertKey].email,
      },
    }));
  };

  const handleSlackChange = (alertKey: keyof UpdatedAlertsState) => {
    setUpdatedAlerts((prevAlerts) => ({
      ...prevAlerts,
      [alertKey]: {
        ...prevAlerts[alertKey],
        slack: !prevAlerts[alertKey].slack,
      },
    }));
  };

  const AlertRow: React.FC<AlertRowProps> = ({
    rowTitle,
    emailChecked,
    slackChecked,
    handleEmailChange,
    handleSlackChange,
  }) => {

    const checkboxStyle = "appearance-none border-black rounded-sm font-display checked:bg-neutral-950 checked:hover:bg-neutral-950 focus:ring-offset-yellow-200 focus:ring-0 checked:focus:bg-neutral-950"

    return (
      <div className="table-row-group">
        <div className="table-cell py-2">{rowTitle}</div>
        <div className='table-cell px-12 py-2'>
          <input
            type="checkbox"
            className={checkboxStyle}
            value="Email"
            checked={emailChecked}
            onChange={handleEmailChange}
          />
        </div>
        <div className='table-cell px-12 py-2'>
          <input
            type="checkbox"
            className={checkboxStyle}
            value="Slack"
            checked={slackChecked}
            onChange={handleSlackChange}
          />
        </div>
      </div>
    )
  }

  const getApps = async () => {
    setAppsApiStatus(AppsApiStatus.Loading)

    const result = await fetchAppsFromServer(params.teamId, router)

    switch (result.status) {
      case AppsApiStatus.NoApps:
        setAppsApiStatus(AppsApiStatus.NoApps)
        break
      case AppsApiStatus.Error:
        setAppsApiStatus(AppsApiStatus.Error)
        break
      case AppsApiStatus.Success:
        setAppsApiStatus(AppsApiStatus.Success)
        setApps(result.data)
        setSelectedApp(result.data[0])
        break
    }
  }

  useEffect(() => {
    getApps()
  }, []);

  const arePrefsSame = (a: typeof emptyAlerts, b: typeof emptyAlerts) => {
    if (a.anr_rate_spike.email != b.anr_rate_spike.email) {
      return false
    }
    if (a.anr_rate_spike.slack != b.anr_rate_spike.slack) {
      return false
    }
    if (a.crash_rate_spike.email != b.crash_rate_spike.email) {
      return false
    }
    if (a.crash_rate_spike.slack != b.crash_rate_spike.slack) {
      return false
    }
    if (a.launch_time_spike.email != b.launch_time_spike.email) {
      return false
    }
    if (a.launch_time_spike.slack != b.launch_time_spike.slack) {
      return false
    }

    return true
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-4xl max-w-6xl text-center">Alerts</p>
      <div className="py-4" />

      {/* Error states for apps fetch */}
      {appsApiStatus === AppsApiStatus.Error && <p className="text-lg font-display">Error fetching apps, please check if Team ID is valid or refresh page to try again</p>}
      {appsApiStatus === AppsApiStatus.NoApps &&
        <div>
          <p className="text-lg font-display">Looks like you don&apos;t have any apps yet. Get started by creating your first app!</p>
          <div className="py-4" />
          <CreateApp teamId={params.teamId} />
        </div>}

      {/* Main UI */}
      {appsApiStatus === AppsApiStatus.Success &&
        <div className="flex flex-col items-start">
          <DropdownSelect title="App Name" type={DropdownSelectType.SingleString} items={apps.map((e) => e.name)} initialSelected={apps[0].name} onChangeSelected={(item) => setSelectedApp(apps.find((e) => e.name === item)!)} />
          <div className="py-8" />
          <div className="table font-sans">
            <div className="table-header-group ">
              <div className="table-row">
                <div className="table-cell py-2 font-display">Alert type</div>
                <div className="table-cell px-8 py-2 font-display text-center">Email</div>
                <div className="table-cell px-8 py-2 font-display text-center">Slack</div>
              </div>
            </div>
            <AlertRow
              rowTitle="Crash Rate Spike"
              emailChecked={updatedAlerts.crash_rate_spike.email}
              slackChecked={updatedAlerts.crash_rate_spike.slack}
              handleEmailChange={() => handleEmailChange('crash_rate_spike')}
              handleSlackChange={() => handleSlackChange('crash_rate_spike')}
            />
            <AlertRow
              rowTitle="ANR Rate Spike"
              emailChecked={updatedAlerts.anr_rate_spike.email}
              slackChecked={updatedAlerts.anr_rate_spike.slack}
              handleEmailChange={() => handleEmailChange('anr_rate_spike')}
              handleSlackChange={() => handleSlackChange('anr_rate_spike')}
            />
            <AlertRow
              rowTitle="Launch Time Spike"
              emailChecked={updatedAlerts.launch_time_spike.email}
              slackChecked={updatedAlerts.launch_time_spike.slack}
              handleEmailChange={() => handleEmailChange('launch_time_spike')}
              handleSlackChange={() => handleSlackChange('launch_time_spike')}
            />
          </div>
          <div className="py-4" />
          <button disabled={arePrefsSame(alerts, updatedAlerts)} className="outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" onClick={() => { }}>Save</button>
        </div>}
    </div>
  )
}
