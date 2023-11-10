"use client"

import React, { useState, useEffect } from 'react';
import Dropdown from "@/app/components/dropdown";
import FilterPill from "@/app/components/filter_pill";
import UserFlow from "@/app/components/user_flow";
import MetricsOverview from '@/app/components/metrics_overview';

export default function Overview() {
  var apps = ['Readly prod', 'Readly alpha', 'Readly debug'];
  const [selectedApp, setSelectedApp] = useState(apps[0]);

  var versions = ['Version 13.2.1', 'Version 13.2.2', 'Version 13.3.7'];
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
        <FilterPill title={`${formattedStartDate} to ${formattedEndDate}`} />
        <FilterPill title={selectedVersion} />
      </div>
      <div className="py-8" />
      <UserFlow authToken="abcde123" appId={selectedApp} startDate={startDate} endDate={endDate} appVersion={selectedVersion} />
      <div className="py-8" />
      <MetricsOverview authToken="abcde123" appId={selectedApp} startDate={startDate} endDate={endDate} appVersion={selectedVersion} />
    </div>
  )
}
