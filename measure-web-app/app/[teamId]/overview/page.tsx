"use client"

import React, { useState, useEffect } from 'react';
import Dropdown from "@/app/components/dropdown";
import FilterPill from "@/app/components/filter_pill";
import UserFlow from "@/app/components/user_flow";
import MetricsOverview from '@/app/components/metrics_overview';
import { getAccessTokenOrRedirectToAuth, logoutIfAuthError } from '@/app/utils/auth_utils';
import { useRouter } from 'next/navigation';

export default function Overview({ params }: { params: { teamId: string } }) {
  const router = useRouter()

  enum AppsApiStatus {
    Loading,
    Success,
    Error
  }

  enum FiltersApiStatus {
    Loading,
    Success,
    Error
  }
  
  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);
  const [filtersApiStatus, setFiltersApiStatus] = useState(FiltersApiStatus.Loading);

  const [apps, setApps] = useState([] as {'id': string, 'name':string}[]);
  const [selectedApp, setSelectedApp] = useState('');

  const [versions, setVersions] = useState([] as string[]);
  const [selectedVersion, setSelectedVersion] = useState(versions[0]);
  
  const today = new Date();
  var initialEndDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const [endDate, setEndDate] = useState(initialEndDate);
  const [formattedEndDate, setFormattedEndDate] = useState(endDate);

  const sevenDaysAgo = new Date(today.setDate(today.getDate() - 7));
  var initialStartDate = `${sevenDaysAgo.getFullYear()}-${(sevenDaysAgo.getMonth() + 1).toString().padStart(2, '0')}-${sevenDaysAgo.getDate().toString().padStart(2, '0')}`;
  const [startDate, setStartDate] = useState(initialStartDate);
  const [formattedStartDate, setFormattedStartDate] = useState(startDate);

  useEffect(() => {
    setFormattedStartDate(new Date(startDate).toLocaleDateString());
    setFormattedEndDate(new Date(endDate).toLocaleDateString());
  }, [startDate, endDate]);

  const getApps = async (teamId:string, ) => {
    setAppsApiStatus(AppsApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      headers: {
        "Authorization": `Bearer ${authToken}`
      }
    };

    const res = await fetch(`${origin}/teams/${teamId}/apps`, opts);
    if(!res.ok) {
      setAppsApiStatus(AppsApiStatus.Error)
      logoutIfAuthError(router, res)
      return
    } 
    const data = await res.json()

    setApps(data)
    setSelectedApp(data[0].id)
    setAppsApiStatus(AppsApiStatus.Success)
  }

  useEffect(() => {
    getApps(params.teamId)
  }, []);

  const getFilters = async (appId:string, ) => {
    setFiltersApiStatus(FiltersApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      headers: {
        "Authorization": `Bearer ${authToken}`
      }
    };

    const res = await fetch(`${origin}/apps/${appId}/filters`, opts);
    if(!res.ok) {
      logoutIfAuthError(router, res)
      setFiltersApiStatus(FiltersApiStatus.Error)
      return
    } 
    const data = await res.json()

    setVersions(data.version)
    setSelectedVersion(data.version[0])
    setFiltersApiStatus(FiltersApiStatus.Success)
  }

  useEffect(() => {
    getFilters(selectedApp)
  }, [selectedApp]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-black text-4xl max-w-6xl text-center">Overview</p>
      <div className="py-4" />
      <div className="flex flex-wrap gap-8 items-center">
        {appsApiStatus === AppsApiStatus.Loading && <p className="text-lg font-display">Updating Apps...</p>}
        {appsApiStatus === AppsApiStatus.Error && <p className="text-lg font-display">Error fetching apps, please refresh page to try again</p>}
        {appsApiStatus === AppsApiStatus.Success && <Dropdown items={apps.map((e) => e.name)} onChangeSelectedItem={(item) => setSelectedApp(apps.find((e) => e.name === item)!.id)} />}
        {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && 
          <div className="flex flex-row items-center">
            <input type="date" defaultValue={startDate} max={endDate} className="font-display text-black border border-black rounded-md p-2" onChange={(e) => setStartDate(e.target.value)} />
            <p className="text-black font-display px-2">to</p>
            <input type="date" defaultValue={endDate} min={startDate} className="font-display text-black border border-black rounded-md p-2" onChange={(e) => setEndDate(e.target.value)} />
          </div>}
        {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Loading && <p className="text-lg font-display">Updating filters...</p>}
        {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && <Dropdown items={versions} onChangeSelectedItem={(item) => setSelectedVersion(item)} />}
      </div>
      <div className="py-4" />
      <div className="flex flex-wrap gap-2 items-center w-5/6">
        {appsApiStatus === AppsApiStatus.Success && <FilterPill title={apps.find((e) => e.id === selectedApp)!.name} />}
        {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && <FilterPill title={`${formattedStartDate} to ${formattedEndDate}`} />}
        {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && <FilterPill title={selectedVersion} />}
      </div>
      <div className="py-8" />
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Error && <p className="text-lg font-display">Error fetching filters, please refresh page or select a different app to try again</p>}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && <UserFlow appId={selectedApp} startDate={startDate} endDate={endDate} appVersion={selectedVersion} />}
      <div className="py-8" />
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && <MetricsOverview appId={selectedApp} startDate={startDate} endDate={endDate} appVersion={selectedVersion} />}
    </div>
  )
}
