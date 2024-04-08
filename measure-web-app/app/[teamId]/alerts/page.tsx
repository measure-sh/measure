"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CreateApp from '@/app/components/create_app';
import { AppsApiStatus, FetchAlertPrefsApiStatus, UpdateAlertPrefsApiStatus, emptyAlertPrefs, emptyApp, fetchAlertPrefsFromServer, fetchAppsFromServer, updateAlertPrefsFromServer } from '@/app/api/api_calls';
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select';
import Link from 'next/link';

export default function Overview({ params }: { params: { teamId: string } }) {
  const router = useRouter()

  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);
  const [fetchAlertPrefsApiStatus, setFetchAlertPrefsApiStatus] = useState(FetchAlertPrefsApiStatus.Loading);
  const [updateAlertPrefsApiStatus, setUpdateAlertPrefsApiStatus] = useState(UpdateAlertPrefsApiStatus.Init);

  const [apps, setApps] = useState([] as typeof emptyApp[]);
  const [selectedApp, setSelectedApp] = useState(emptyApp);

  const [slackConnected, setSlackConnected] = useState(false)

  const [alertPrefs, setAlertPrefs] = useState(emptyAlertPrefs);
  const [updatedAlertPrefs, setUpdatedAlertPrefs] = useState(emptyAlertPrefs);

  const [updatePrefsMsg, setUpdatePrefsMsg] = useState("");

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
    setUpdatedAlertPrefs((prevAlertPrefs) => ({
      ...prevAlertPrefs,
      [alertKey]: {
        ...prevAlertPrefs[alertKey],
        email: !prevAlertPrefs[alertKey].email,
      },
    }));
  };

  const handleSlackChange = (alertKey: keyof UpdatedAlertsState) => {
    setUpdatedAlertPrefs((prevAlertPrefs) => ({
      ...prevAlertPrefs,
      [alertKey]: {
        ...prevAlertPrefs[alertKey],
        slack: !prevAlertPrefs[alertKey].slack,
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
      </div>
    )
  }

  const areAlertPrefsSame = (a: typeof emptyAlertPrefs, b: typeof emptyAlertPrefs) => {
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

  const getAlertPrefs = async () => {
    setFetchAlertPrefsApiStatus(FetchAlertPrefsApiStatus.Loading)

    const result = await fetchAlertPrefsFromServer(selectedApp.id, router)

    switch (result.status) {
      case FetchAlertPrefsApiStatus.Error:
        setFetchAlertPrefsApiStatus(FetchAlertPrefsApiStatus.Error)
        break
      case FetchAlertPrefsApiStatus.Success:
        setFetchAlertPrefsApiStatus(FetchAlertPrefsApiStatus.Success)
        setAlertPrefs(result.data)
        setUpdatedAlertPrefs(result.data)
        break
    }
  }

  useEffect(() => {
    getAlertPrefs()
    setUpdatePrefsMsg("")
  }, [selectedApp]);

  const saveAlertPrefs = async () => {
    setUpdateAlertPrefsApiStatus(UpdateAlertPrefsApiStatus.Loading)
    setUpdatePrefsMsg("Saving...")

    const result = await updateAlertPrefsFromServer(selectedApp.id, updatedAlertPrefs, router)

    switch (result.status) {
      case UpdateAlertPrefsApiStatus.Error:
        setUpdateAlertPrefsApiStatus(UpdateAlertPrefsApiStatus.Error)
        setUpdatePrefsMsg(result.error)
        break
      case UpdateAlertPrefsApiStatus.Success:
        setUpdateAlertPrefsApiStatus(UpdateAlertPrefsApiStatus.Success)
        setUpdatePrefsMsg("Alert preferences saved!")
        break
    }
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
          {/* <div className="py-4" />
          {slackConnected && <p className="px-3 py-1 text-emerald-600 font-display text-sm border border-emerald-600 rounded-full outline-none">Slack connected</p>}
          {!slackConnected && <Link href={`https://slack.com/apps/placeholderId`} className="outline-none justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4">Connect Slack</Link>} */}
          <div className="py-4" />

          {fetchAlertPrefsApiStatus === FetchAlertPrefsApiStatus.Loading && <p className='font-sans'> Fetching alert preferences...</p>}
          {fetchAlertPrefsApiStatus === FetchAlertPrefsApiStatus.Error && <p className='font-sans'> Failed to fetch alert preferences. Please change selected app or refresh page to try again</p>}
          {fetchAlertPrefsApiStatus === FetchAlertPrefsApiStatus.Success &&
            <div>
              <div className="table font-sans">
                <div className="table-header-group ">
                  <div className="table-row">
                    <div className="table-cell py-2 font-display">Alert type</div>
                    <div className="table-cell px-8 py-2 font-display text-center">Email</div>
                  </div>
                </div>
                <AlertRow
                  rowTitle="Crash Rate Spike"
                  emailChecked={updatedAlertPrefs.crash_rate_spike.email}
                  slackChecked={updatedAlertPrefs.crash_rate_spike.slack}
                  handleEmailChange={() => handleEmailChange('crash_rate_spike')}
                  handleSlackChange={() => handleSlackChange('crash_rate_spike')}
                />
                <AlertRow
                  rowTitle="ANR Rate Spike"
                  emailChecked={updatedAlertPrefs.anr_rate_spike.email}
                  slackChecked={updatedAlertPrefs.anr_rate_spike.slack}
                  handleEmailChange={() => handleEmailChange('anr_rate_spike')}
                  handleSlackChange={() => handleSlackChange('anr_rate_spike')}
                />
                <AlertRow
                  rowTitle="Launch Time Spike"
                  emailChecked={updatedAlertPrefs.launch_time_spike.email}
                  slackChecked={updatedAlertPrefs.launch_time_spike.slack}
                  handleEmailChange={() => handleEmailChange('launch_time_spike')}
                  handleSlackChange={() => handleSlackChange('launch_time_spike')}
                />
              </div>
              <div className="py-4" />
              <button disabled={areAlertPrefsSame(alertPrefs, updatedAlertPrefs) || updateAlertPrefsApiStatus === UpdateAlertPrefsApiStatus.Loading} className="outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" onClick={saveAlertPrefs}>Save</button>
              <div className="py-1" />
              {updateAlertPrefsApiStatus !== UpdateAlertPrefsApiStatus.Init && <p className="text-sm font-sans">{updatePrefsMsg}</p>}
            </div>}
        </div>}
    </div>
  )
}
