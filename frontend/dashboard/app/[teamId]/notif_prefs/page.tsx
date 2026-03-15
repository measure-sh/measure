"use client"

import { FetchNotifPrefsApiStatus, UpdateNotifPrefsApiStatus, emptyNotifPrefs, fetchNotifPrefsFromServer, updateNotifPrefsFromServer } from '@/app/api/api_calls'
import { Button } from '@/app/components/button'
import { Checkbox } from '@/app/components/checkbox'
import LoadingSpinner from '@/app/components/loading_spinner'
import { toastNegative, toastPositive } from '@/app/utils/use_toast'
import React, { useEffect, useState } from 'react'

export default function Notifications() {
  const [fetchNotifPrefsApiStatus, setFetchNotifPrefsApiStatus] = useState(FetchNotifPrefsApiStatus.Loading)
  const [updateNotifPrefsApiStatus, setUpdateNotifPrefsApiStatus] = useState(UpdateNotifPrefsApiStatus.Init)

  const [notifPrefs, setNotifPrefs] = useState(emptyNotifPrefs)
  const [updatedNotifPrefs, setUpdatedNotifPrefs] = useState(emptyNotifPrefs)

  const handleToggle = (key: keyof typeof emptyNotifPrefs) => {
    setUpdatedNotifPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const areNotifPrefsSame = (a: typeof emptyNotifPrefs, b: typeof emptyNotifPrefs) => {
    return a.error_spike === b.error_spike
      && a.app_hang_spike === b.app_hang_spike
      && a.bug_report === b.bug_report
      && a.daily_summary === b.daily_summary
  }

  const getNotifPrefs = async () => {
    setFetchNotifPrefsApiStatus(FetchNotifPrefsApiStatus.Loading)

    const result = await fetchNotifPrefsFromServer()

    switch (result.status) {
      case FetchNotifPrefsApiStatus.Error:
        setFetchNotifPrefsApiStatus(FetchNotifPrefsApiStatus.Error)
        break
      case FetchNotifPrefsApiStatus.Success:
        setFetchNotifPrefsApiStatus(FetchNotifPrefsApiStatus.Success)
        setNotifPrefs(result.data)
        setUpdatedNotifPrefs(result.data)
        break
    }
  }

  useEffect(() => {
    getNotifPrefs()
  }, [])

  const saveNotifPrefs = async () => {
    setUpdateNotifPrefsApiStatus(UpdateNotifPrefsApiStatus.Loading)

    const result = await updateNotifPrefsFromServer(updatedNotifPrefs)

    switch (result.status) {
      case UpdateNotifPrefsApiStatus.Error:
        setUpdateNotifPrefsApiStatus(UpdateNotifPrefsApiStatus.Error)
        toastNegative("Error saving notification preferences", result.error)
        break
      case UpdateNotifPrefsApiStatus.Success:
        setUpdateNotifPrefsApiStatus(UpdateNotifPrefsApiStatus.Success)
        toastPositive("Notification preferences saved")
        setNotifPrefs(updatedNotifPrefs)
        break
    }
  }

  interface NotifRowProps {
    rowTitle: string
    checked: boolean
    handleChange: () => void
  }

  const NotifRow: React.FC<NotifRowProps> = ({ rowTitle, checked, handleChange }) => {
    return (
      <div className="table-row-group">
        <div className="table-cell py-2">{rowTitle}</div>
        <div className='table-cell px-12 py-2'>
          <Checkbox
            checked={checked}
            onCheckedChange={handleChange}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl max-w-6xl text-center">Notifications</p>
      <div className="py-4" />

      {fetchNotifPrefsApiStatus === FetchNotifPrefsApiStatus.Loading && <LoadingSpinner />}
      {fetchNotifPrefsApiStatus === FetchNotifPrefsApiStatus.Error && <p className='font-body text-sm'>Failed to fetch notification preferences. Please refresh page to try again.</p>}

      {fetchNotifPrefsApiStatus === FetchNotifPrefsApiStatus.Success &&
        <div>
          <p className="font-body text-sm text-muted-foreground">
            Choose which email notifications you want to receive. This setting applies only to your personal preferences and does not affect your team.
          </p>
          <div className="py-4" />
          <div className="table font-body">
            <div className="table-header-group">
              <div className="table-row">
                <div className="table-cell py-2 font-display">Alert type</div>
                <div className="table-cell px-8 py-2 font-display text-center">Email</div>
              </div>
            </div>
            <NotifRow
              rowTitle="Crash Spike email"
              checked={updatedNotifPrefs.error_spike}
              handleChange={() => handleToggle('error_spike')}
            />
            <NotifRow
              rowTitle="ANR spike email"
              checked={updatedNotifPrefs.app_hang_spike}
              handleChange={() => handleToggle('app_hang_spike')}
            />
            <NotifRow
              rowTitle="Bug Reports"
              checked={updatedNotifPrefs.bug_report}
              handleChange={() => handleToggle('bug_report')}
            />
            <NotifRow
              rowTitle="Daily Summary"
              checked={updatedNotifPrefs.daily_summary}
              handleChange={() => handleToggle('daily_summary')}
            />
          </div>
          <div className="py-4" />
          <Button
            variant="outline"
            disabled={areNotifPrefsSame(notifPrefs, updatedNotifPrefs) || updateNotifPrefsApiStatus === UpdateNotifPrefsApiStatus.Loading}
            className="flex justify-center font-display border border-black select-none"
            onClick={saveNotifPrefs}>
            Save
          </Button>
        </div>}
    </div>
  )
}
