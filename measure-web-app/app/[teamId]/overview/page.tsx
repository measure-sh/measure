"use client"

import React, { useState, useEffect } from 'react';
import FilterPill from "@/app/components/filter_pill";
import Journey from "@/app/components/journey";
import MetricsOverview from '@/app/components/metrics_overview';
import { useRouter, useSearchParams } from 'next/navigation';
import CreateApp from '@/app/components/create_app';
import { AppVersion, AppsApiStatus, FiltersApiStatus, FiltersApiType, emptyApp, fetchAppsFromServer, fetchFiltersFromServer } from '@/app/api/api_calls';
import { updateDateQueryParams } from '@/app/utils/router_utils';
import { formatDateToHumanReadable, isValidTimestamp } from '@/app/utils/time_utils';
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select';
import { DateTime } from 'luxon';

export default function Overview({ params }: { params: { teamId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);
  const [filtersApiStatus, setFiltersApiStatus] = useState(FiltersApiStatus.Loading);

  const [apps, setApps] = useState([] as typeof emptyApp[]);
  const [selectedApp, setSelectedApp] = useState(emptyApp);

  const [versions, setVersions] = useState([] as AppVersion[]);
  const [selectedVersion, setSelectedVersion] = useState(versions[0]);

  const today = DateTime.now();
  const todayDate = today.toFormat('yyyy-MM-dd');
  const [endDate, setEndDate] = useState(searchParams.has("end_date") ? searchParams.get("end_date")! : todayDate);
  const [formattedEndDate, setFormattedEndDate] = useState(formatDateToHumanReadable(endDate));

  const sevenDaysAgo = today.minus({ days: 7 });
  var initialStartDate = sevenDaysAgo.toFormat('yyyy-MM-dd');
  const [startDate, setStartDate] = useState(searchParams.has("start_date") ? searchParams.get("start_date")! : initialStartDate);
  const [formattedStartDate, setFormattedStartDate] = useState(formatDateToHumanReadable(startDate));

  useEffect(() => {
    setFormattedStartDate(formatDateToHumanReadable(startDate));
    setFormattedEndDate(formatDateToHumanReadable(endDate));

    updateDateQueryParams(router, searchParams, startDate, endDate)
  }, [startDate, endDate]);

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

  const getFilters = async () => {
    // Don't try to fetch filters if app id is not yet set
    if (selectedApp.id === "") {
      return
    }

    setFiltersApiStatus(FiltersApiStatus.Loading)

    const result = await fetchFiltersFromServer(selectedApp, FiltersApiType.All, router)

    switch (result.status) {
      case FiltersApiStatus.NotOnboarded:
        setFiltersApiStatus(FiltersApiStatus.NotOnboarded)
        break
      case FiltersApiStatus.NoData:
        setFiltersApiStatus(FiltersApiStatus.NoData)
        break
      case FiltersApiStatus.Error:
        setFiltersApiStatus(FiltersApiStatus.Error)
        break
      case FiltersApiStatus.Success:
        setFiltersApiStatus(FiltersApiStatus.Success)
        let versions = result.data.versions.map((v: { name: string; code: string; }) => new AppVersion(v.name, v.code))
        setVersions(versions)
        setSelectedVersion(versions[0])
        break
    }
  }

  useEffect(() => {
    getFilters()
  }, [selectedApp]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-4xl max-w-6xl text-center">Overview</p>
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
        <div>
          <div className="flex flex-wrap gap-8 items-center">
            <DropdownSelect title="App Name" type={DropdownSelectType.SingleString} items={apps.map((e) => e.name)} initialSelected={apps[0].name} onChangeSelected={(item) => setSelectedApp(apps.find((e) => e.name === item)!)} />
            {filtersApiStatus === FiltersApiStatus.Success &&
              <div className="flex flex-row items-center">
                <input type="date" defaultValue={startDate} max={endDate} className="font-display border border-black rounded-md p-2" onChange={(e) => {
                  if (isValidTimestamp(e.target.value)) {
                    setStartDate(e.target.value)
                  }
                }} />
                <p className="font-display px-2">to</p>
                <input type="date" defaultValue={endDate} min={startDate} max={todayDate} className="font-display border border-black rounded-md p-2" onChange={(e) => {
                  if (isValidTimestamp(e.target.value)) {
                    setEndDate(e.target.value)
                  }
                }} />
              </div>}
            {filtersApiStatus === FiltersApiStatus.Success && <DropdownSelect title="App Version" type={DropdownSelectType.SingleAppVersion} items={versions} initialSelected={selectedVersion} onChangeSelected={(item) => setSelectedVersion(item as AppVersion)} />}
          </div>
          <div className="py-4" />

          {/* Error states for filters fetch */}
          {filtersApiStatus === FiltersApiStatus.Error && <p className="text-lg font-display">Error fetching filters, please refresh page or select a different app to try again</p>}
          {filtersApiStatus === FiltersApiStatus.NoData && <p className="text-lg font-display">We don&apos;t seem to have any data for this app. It could have been removed due to exceeding data retention period. Please contact <a href="mailto:support@measure.sh" className="underline text-blue-500">Measure support.</a></p>}
          {filtersApiStatus === FiltersApiStatus.NotOnboarded && <CreateApp teamId={params.teamId} existingAppName={selectedApp.name} existingApiKey={selectedApp.api_key.key} />}

          {filtersApiStatus === FiltersApiStatus.Success &&
            <div className="flex flex-wrap gap-2 items-center w-5/6">
              <FilterPill title={selectedApp.name} />
              <FilterPill title={`${formattedStartDate} to ${formattedEndDate}`} />
              <FilterPill title={selectedVersion.displayName} />
            </div>}
          <div className="py-8" />
          {filtersApiStatus === FiltersApiStatus.Success && <Journey teamId={params.teamId} appId={selectedApp.id} startDate={startDate} endDate={endDate} appVersion={selectedVersion} />}
          <div className="py-8" />
          {filtersApiStatus === FiltersApiStatus.Success && <MetricsOverview appId={selectedApp.id} startDate={startDate} endDate={endDate} appVersion={selectedVersion} />}
        </div>}
    </div>
  )
}
