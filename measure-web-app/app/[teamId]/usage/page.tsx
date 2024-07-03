"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CreateApp from '@/app/components/create_app';
import { FetchUsageApiStatus, emptyUsage, fetchUsageFromServer } from '@/app/api/api_calls';
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select';

export default function Overview({ params }: { params: { teamId: string } }) {
  const router = useRouter()

  type AppMonthlyUsage = {
    app_id: string;
    app_name: string;
    event_count: number;
    session_count: number;
  }

  const [fetchUsageApiStatus, setFetchUsageApiStatus] = useState(FetchUsageApiStatus.Loading);
  const [usage, setUsage] = useState(emptyUsage);
  const [months, setMonths] = useState<string[]>();
  const [selectedMonth, setSelectedMonth] = useState<string>();
  const [selectedMonthUsage, setSelectedMonthUsage] = useState<AppMonthlyUsage[]>();

  function parseMonths(data: typeof emptyUsage): string[] {
    const monthYearSet: Set<string> = new Set();

    data.forEach(app => {
      app.monthly_app_usage.forEach(u => {
        monthYearSet.add(u.month_year);
      });
    });

    return Array.from(monthYearSet);
  }

  function parseUsageForMonth(usage: typeof emptyUsage, month: string): AppMonthlyUsage[] {
    const selectedMonthUsages: AppMonthlyUsage[] = []

    usage.forEach(app => {
      app.monthly_app_usage.forEach(u => {
        if (u.month_year === month) {
          selectedMonthUsages.push({ app_id: app.app_id, app_name: app.app_name, event_count: u.event_count, session_count: u.session_count });
        }
      });
    });

    return selectedMonthUsages
  }

  const getUsage = async () => {
    setFetchUsageApiStatus(FetchUsageApiStatus.Loading)

    const result = await fetchUsageFromServer(params.teamId, router)

    switch (result.status) {
      case FetchUsageApiStatus.NoApps:
        setFetchUsageApiStatus(FetchUsageApiStatus.NoApps)
        break
      case FetchUsageApiStatus.Error:
        setFetchUsageApiStatus(FetchUsageApiStatus.Error)
        break
      case FetchUsageApiStatus.Success:
        setFetchUsageApiStatus(FetchUsageApiStatus.Success)
        setUsage(result.data)
        let months = parseMonths(result.data)
        let initialMonth = months[months.length - 1] // set month to last index (latest)
        setMonths(months)
        setSelectedMonth(initialMonth)
        setSelectedMonthUsage(parseUsageForMonth(result.data, initialMonth))
        break
    }
  }

  useEffect(() => {
    getUsage()
  }, []);

  useEffect(() => {
    setSelectedMonthUsage(parseUsageForMonth(usage, selectedMonth!))
  }, [selectedMonth]);


  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-4xl max-w-6xl text-center">Usage</p>
      <div className="py-4" />

      {/* Error states */}
      {fetchUsageApiStatus === FetchUsageApiStatus.Error && <p className="text-lg font-display">Error fetching usage data, please check if Team ID is valid or refresh page to try again</p>}
      {fetchUsageApiStatus === FetchUsageApiStatus.NoApps &&
        <div>
          <p className="text-lg font-display">Looks like you don&apos;t have any apps yet. Get started by creating your first app!</p>
          <div className="py-4" />
          <CreateApp teamId={params.teamId} />
        </div>}

      {/* Main UI */}
      {fetchUsageApiStatus === FetchUsageApiStatus.Loading && <p className='font-sans'> Fetching usage data...</p>}
      {fetchUsageApiStatus === FetchUsageApiStatus.Success &&
        <div className="flex flex-col items-start">
          <DropdownSelect title="App Name" type={DropdownSelectType.SingleString} items={months!} initialSelected={selectedMonth!} onChangeSelected={(item) => setSelectedMonth(item as string)} />
          <div className="py-4" />
          {selectedMonthUsage!.map(({ app_id, app_name, event_count, session_count }) => (
            <div key={app_id + '-usage'} className="font-sans">
              <div className="flex flex-col">
                <p className="text-xl font-semibold">{app_name}</p>
                <div className="py-1" />
                <p>Sessions: {session_count}</p>
                <div className="py-1" />
                <p>Events: {event_count}</p>
                <div className="py-2" />
              </div>
              <div className="py-4" />
            </div>
          ))}
        </div>}
    </div>
  )
}
