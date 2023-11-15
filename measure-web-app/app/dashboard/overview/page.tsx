"use client"

import React, { useState, useEffect } from 'react';
import Dropdown from "@/app/components/dropdown";
import FilterPill from "@/app/components/filter_pill";
import UserFlow from "@/app/components/user_flow";
import MetricsOverview from '@/app/components/metrics_overview';

export default function Overview() {
  enum FiltersApiStatus {
    Loading,
    Success,
    Error
  }
  
  const [filtersApiStatus, setFiltersApiStatus] = useState(FiltersApiStatus.Loading);

  var apps = [{'id':'59ba1c7f-2a42-4b7f-b9cb-735d25146675', 'name': 'Readly prod'}, {'id':'243f3214-0f41-4361-8ef3-21d8f5d99a70', 'name': 'Readly alpha'}, {'id':'bae4fb9e-07cd-4435-a42e-d99986830c2c', 'name': 'Readly debug'}];
  const [selectedApp, setSelectedApp] = useState(apps[0].id);

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

  const getFilters = async (authToken:string, appId:string, ) => {
    setFiltersApiStatus(FiltersApiStatus.Loading)

    const origin = "https://frosty-fog-7165.fly.dev"
    const opts = {
      headers: {
        "Authorization": `Bearer ${authToken}`
      }
    };

    const res = await fetch(`${origin}/apps/${appId}/filters`, opts);
    if(!res.ok) {
      setFiltersApiStatus(FiltersApiStatus.Error)
      return
    } 
    const data = await res.json()

    setVersions(data.version)
    setSelectedVersion(data.version[0])
    setFiltersApiStatus(FiltersApiStatus.Success)
  }

  useEffect(() => {
    getFilters("abcde123", selectedApp)
  }, [selectedApp]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-black text-4xl max-w-6xl text-center">Overview</p>
      <div className="py-4" />
      <div className="flex flex-wrap gap-8 items-center">
        <Dropdown items={apps.map((e) => e.name)} onChangeSelectedItem={(item) => setSelectedApp(apps.find((e) => e.name === item)!.id)} />
        <div className="flex flex-row items-center">
          <input type="date" defaultValue={startDate} max={endDate} className="font-display text-black border border-black rounded-md p-2" onChange={(e) => setStartDate(e.target.value)} />
          <p className="text-black font-display px-2">to</p>
          <input type="date" defaultValue={endDate} min={startDate} className="font-display text-black border border-black rounded-md p-2" onChange={(e) => setEndDate(e.target.value)} />
        </div>
        {filtersApiStatus === FiltersApiStatus.Success && <Dropdown items={versions} onChangeSelectedItem={(item) => setSelectedVersion(item)} />}
      </div>
      <div className="py-4" />
      <div className="flex flex-wrap gap-2 items-center w-5/6">
        <FilterPill title={apps.find((e) => e.id === selectedApp)!.name} />
        <FilterPill title={`${formattedStartDate} to ${formattedEndDate}`} />
        {filtersApiStatus === FiltersApiStatus.Success && <FilterPill title={selectedVersion} />}
      </div>
      <div className="py-8" />
      {filtersApiStatus === FiltersApiStatus.Loading && <p className="text-lg font-display">Updating filters...</p>}
      {filtersApiStatus === FiltersApiStatus.Error && <p className="text-lg font-display">Error fetching filters, please try again</p>}
      {filtersApiStatus === FiltersApiStatus.Success && <UserFlow authToken="abcde123" appId={selectedApp} startDate={startDate} endDate={endDate} appVersion={selectedVersion} />}
      <div className="py-8" />
      {filtersApiStatus === FiltersApiStatus.Success && <MetricsOverview authToken="abcde123" appId={selectedApp} startDate={startDate} endDate={endDate} appVersion={selectedVersion} />}
    </div>
  )
}
