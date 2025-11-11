"use client"

import { App, AppsApiStatus, FetchAlertPrefsApiStatus, UpdateAlertPrefsApiStatus, emptyAlertPrefs, fetchAlertPrefsFromServer, fetchAppsFromServer, updateAlertPrefsFromServer } from '@/app/api/api_calls'
import { Button } from '@/app/components/button'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import LoadingSpinner from '@/app/components/loading_spinner'
import { underlineLinkStyle } from '@/app/utils/shared_styles'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

export default function Overview({ params }: { params: { teamId: string } }) {
  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading)
  const [fetchAlertPrefsApiStatus, setFetchAlertPrefsApiStatus] = useState(FetchAlertPrefsApiStatus.Loading)
  const [updateAlertPrefsApiStatus, setUpdateAlertPrefsApiStatus] = useState(UpdateAlertPrefsApiStatus.Init)

  const [apps, setApps] = useState([] as App[])
  const [selectedApp, setSelectedApp] = useState<App | null>(null)

  const [alertPrefs, setAlertPrefs] = useState(emptyAlertPrefs)
  const [updatedAlertPrefs, setUpdatedAlertPrefs] = useState(emptyAlertPrefs)

  const [updatePrefsMsg, setUpdatePrefsMsg] = useState("")

  interface AlertState {
    email: boolean
  }

  interface UpdatedAlertsState {
    crash_rate_spike: AlertState
    anr_rate_spike: AlertState
    launch_time_spike: AlertState
  }

  interface AlertRowProps {
    rowTitle: string
    emailChecked: boolean
    handleEmailChange: () => void
  }

  const handleEmailChange = (alertKey: keyof UpdatedAlertsState) => {
    setUpdatedAlertPrefs((prevAlertPrefs) => ({
      ...prevAlertPrefs,
      [alertKey]: {
        ...prevAlertPrefs[alertKey],
        email: !prevAlertPrefs[alertKey].email,
      },
    }))
  }

  const AlertRow: React.FC<AlertRowProps> = ({
    rowTitle,
    emailChecked,
    handleEmailChange,
  }) => {

    const checkboxStyle = "appearance-none border-black rounded-xs font-display checked:bg-neutral-950 checked:hover:bg-neutral-950 focus:ring-offset-yellow-200 focus:ring-0 checked:focus:bg-neutral-950"

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
    if (a.crash_rate_spike.email != b.crash_rate_spike.email) {
      return false
    }
    if (a.launch_time_spike.email != b.launch_time_spike.email) {
      return false
    }
    return true
  }

  const getApps = async () => {
    setAppsApiStatus(AppsApiStatus.Loading)

    const result = await fetchAppsFromServer(params.teamId)

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
  }, [])

  const getAlertPrefs = async () => {
    setFetchAlertPrefsApiStatus(FetchAlertPrefsApiStatus.Loading)

    const result = await fetchAlertPrefsFromServer(selectedApp!.id)

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
  }, [selectedApp])

  const saveAlertPrefs = async () => {
    setUpdateAlertPrefsApiStatus(UpdateAlertPrefsApiStatus.Loading)
    setUpdatePrefsMsg("Saving...")

    const result = await updateAlertPrefsFromServer(selectedApp!.id, updatedAlertPrefs)

    switch (result.status) {
      case UpdateAlertPrefsApiStatus.Error:
        setUpdateAlertPrefsApiStatus(UpdateAlertPrefsApiStatus.Error)
        setUpdatePrefsMsg(result.error)
        break
      case UpdateAlertPrefsApiStatus.Success:
        setUpdateAlertPrefsApiStatus(UpdateAlertPrefsApiStatus.Success)
        setUpdatePrefsMsg("Alert preferences saved!")
        setAlertPrefs(updatedAlertPrefs)
        break
    }
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl max-w-6xl text-center">Alerts</p>
      <div className="py-4" />

      {/* Error states for apps fetch */}
      {appsApiStatus === AppsApiStatus.Error && <p className="font-body text-sm">Error fetching apps, please check if Team ID is valid or refresh page to try again</p>}
      {appsApiStatus === AppsApiStatus.NoApps && <p className='font-body text-sm'>Looks like you don&apos;t have any apps yet. Get started by <Link className={underlineLinkStyle} href={`apps`}>creating your first app!</Link></p>}

      {/* Main UI */}
      {appsApiStatus === AppsApiStatus.Success &&
        <div className="flex flex-col items-start">
          <DropdownSelect title="App Name" type={DropdownSelectType.SingleString} items={apps.map((e) => e.name)} initialSelected={apps[0].name} onChangeSelected={(item) => setSelectedApp(apps.find((e) => e.name === item)!)} />
          <div className="py-4" />

          {fetchAlertPrefsApiStatus === FetchAlertPrefsApiStatus.Loading && <LoadingSpinner />}
          {fetchAlertPrefsApiStatus === FetchAlertPrefsApiStatus.Error && <p className='font-body text-sm'> Failed to fetch alert preferences. Please change selected app or refresh page to try again</p>}
          {fetchAlertPrefsApiStatus === FetchAlertPrefsApiStatus.Success &&
            <div>
              <div className="table font-body">
                <div className="table-header-group ">
                  <div className="table-row">
                    <div className="table-cell py-2 font-display">Alert type</div>
                    <div className="table-cell px-8 py-2 font-display text-center">Email</div>
                  </div>
                </div>
                <AlertRow
                  rowTitle="Crash Rate Spike"
                  emailChecked={updatedAlertPrefs.crash_rate_spike.email}
                  handleEmailChange={() => handleEmailChange('crash_rate_spike')}
                />
                <AlertRow
                  rowTitle="ANR Rate Spike"
                  emailChecked={updatedAlertPrefs.anr_rate_spike.email}
                  handleEmailChange={() => handleEmailChange('anr_rate_spike')}
                />
                <AlertRow
                  rowTitle="Launch Time Spike"
                  emailChecked={updatedAlertPrefs.launch_time_spike.email}
                  handleEmailChange={() => handleEmailChange('launch_time_spike')}
                />
              </div>
              <div className="py-4" />
              <Button
                variant="outline"
                disabled={areAlertPrefsSame(alertPrefs, updatedAlertPrefs) || updateAlertPrefsApiStatus === UpdateAlertPrefsApiStatus.Loading}
                className="flex justify-center font-display border border-black select-none"
                onClick={saveAlertPrefs}>
                Save
              </Button>
              <div className="py-1" />
              {updateAlertPrefsApiStatus !== UpdateAlertPrefsApiStatus.Init && <p className="text-sm font-body">{updatePrefsMsg}</p>}
            </div>}
        </div>}
    </div>
  )
}
