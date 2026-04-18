"use client"

import { emptyNotifPrefs } from '@/app/api/api_calls'
import { Button } from '@/app/components/button'
import { Checkbox } from '@/app/components/checkbox'
import { Skeleton } from '@/app/components/skeleton'
import { useNotifPrefsQuery, useSaveNotifPrefsMutation } from '@/app/query/hooks'
import { toastNegative, toastPositive } from '@/app/utils/use_toast'
import React, { useEffect, useState } from 'react'

type NotifPrefs = typeof emptyNotifPrefs

export default function Notifications() {
  const notifPrefsQuery = useNotifPrefsQuery()
  const saveNotifPrefsMutation = useSaveNotifPrefsMutation()

  const notifPrefs = notifPrefsQuery.data ?? emptyNotifPrefs
  const [updatedNotifPrefs, setUpdatedNotifPrefs] = useState<NotifPrefs>(emptyNotifPrefs)

  useEffect(() => {
    if (notifPrefsQuery.data) {
      setUpdatedNotifPrefs(notifPrefsQuery.data)
    }
  }, [notifPrefsQuery.data])

  const togglePref = (key: keyof NotifPrefs) => {
    setUpdatedNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const areNotifPrefsSame =
    notifPrefs.error_spike === updatedNotifPrefs.error_spike &&
    notifPrefs.app_hang_spike === updatedNotifPrefs.app_hang_spike &&
    notifPrefs.bug_report === updatedNotifPrefs.bug_report &&
    notifPrefs.daily_summary === updatedNotifPrefs.daily_summary

  const handleSave = async () => {
    try {
      await saveNotifPrefsMutation.mutateAsync({ notifPrefs: updatedNotifPrefs })
      toastPositive("Notification preferences saved")
    } catch (error) {
      toastNegative("Error saving notification preferences", error instanceof Error ? error.message : undefined)
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

      {notifPrefsQuery.isLoading &&
        <div className="flex flex-col gap-4 w-full max-w-md">
          <Skeleton className="h-4 w-64" />
          <div className="flex items-center gap-8">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-8">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-8">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-8">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-4" />
          </div>
        </div>
      }
      {notifPrefsQuery.isError && <p className='font-body text-sm'>Failed to fetch notification preferences. Please refresh page to try again.</p>}

      {notifPrefsQuery.isSuccess &&
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
              handleChange={() => togglePref('error_spike')}
            />
            <NotifRow
              rowTitle="ANR spike email"
              checked={updatedNotifPrefs.app_hang_spike}
              handleChange={() => togglePref('app_hang_spike')}
            />
            <NotifRow
              rowTitle="Bug Reports"
              checked={updatedNotifPrefs.bug_report}
              handleChange={() => togglePref('bug_report')}
            />
            <NotifRow
              rowTitle="Daily Summary"
              checked={updatedNotifPrefs.daily_summary}
              handleChange={() => togglePref('daily_summary')}
            />
          </div>
          <div className="py-4" />
          <Button
            variant="outline"
            disabled={areNotifPrefsSame || saveNotifPrefsMutation.isPending}
            className="flex justify-center font-display border border-black select-none"
            onClick={handleSave}>
            Save
          </Button>
        </div>}
    </div>
  )
}
