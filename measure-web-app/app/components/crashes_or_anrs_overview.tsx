"use client"

import React, { useState, useEffect } from 'react';
import CheckboxDropdown from "@/app/components/checkbox_dropdown";
import Dropdown from "@/app/components/dropdown";
import ExceptionRateChart from "@/app/components/exception_rate_chart";
import FilterPill from "@/app/components/filter_pill";
import Link from "next/link";
import { useRouter, useSearchParams } from 'next/navigation';
import CreateApp from '@/app/components/create_app';
import { AppsApiStatus, CrashOrAnrGroupsApiStatus, CrashOrAnrType, FiltersApiStatus, emptyApp, emptyCrashOrAnrGroupsResponse, fetchAppsFromServer, fetchCrashOrAnrGroupsFromServer, fetchFiltersFromServer } from '@/app/api/api_calls';
import Paginator, { PaginationDirection } from '@/app/components/paginator';
import { updateDateQueryParams } from '../utils/router_utils';

interface CrashOrAnrsOverviewProps {
  crashOrAnrType: CrashOrAnrType,
  teamId: string,
}

export const CrashesOrAnrsOverview: React.FC<CrashOrAnrsOverviewProps> = ({ crashOrAnrType, teamId }) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);
  const [filtersApiStatus, setFiltersApiStatus] = useState(FiltersApiStatus.Loading);
  const [crashOrAnrGroupsApiStatus, setCrashOrAnrGroupsApiStatus] = useState(CrashOrAnrGroupsApiStatus.Loading);

  const [apps, setApps] = useState([] as typeof emptyApp[]);
  const [selectedApp, setSelectedApp] = useState(emptyApp);

  const [crashOrAnrGroups, setCrashOrAnrGroups] = useState(emptyCrashOrAnrGroupsResponse);
  const paginationOffset = 10
  const [paginationRange, setPaginationRange] = useState({ start: 1, end: paginationOffset })
  const [paginationDirection, setPaginationDirection] = useState(PaginationDirection.None)

  const [versions, setVersions] = useState([] as string[]);
  const [selectedVersions, setSelectedVersions] = useState([] as string[]);

  const today = new Date();
  var initialEndDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const [endDate, setEndDate] = useState(searchParams.has("end_date") ? searchParams.get("end_date")! : initialEndDate);
  const [formattedEndDate, setFormattedEndDate] = useState(endDate);

  const sevenDaysAgo = new Date(today.setDate(today.getDate() - 7));
  var initialStartDate = `${sevenDaysAgo.getFullYear()}-${(sevenDaysAgo.getMonth() + 1).toString().padStart(2, '0')}-${sevenDaysAgo.getDate().toString().padStart(2, '0')}`;
  const [startDate, setStartDate] = useState(searchParams.has("start_date") ? searchParams.get("start_date")! : initialStartDate);
  const [formattedStartDate, setFormattedStartDate] = useState(startDate);

  useEffect(() => {
    setFormattedStartDate(new Date(startDate).toLocaleDateString());
    setFormattedEndDate(new Date(endDate).toLocaleDateString());

    updateDateQueryParams(router, searchParams, startDate, endDate)
  }, [startDate, endDate]);

  const getApps = async () => {
    setAppsApiStatus(AppsApiStatus.Loading)

    const result = await fetchAppsFromServer(teamId, router)

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
    setFiltersApiStatus(FiltersApiStatus.Loading)

    const result = await fetchFiltersFromServer(selectedApp, router)

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
        setVersions(result.data.versions)
        setSelectedVersions(result.data.versions)
        break
    }
  }

  useEffect(() => {
    getFilters()
  }, [selectedApp]);

  const getCrashOrAnrGroups = async () => {
    setCrashOrAnrGroupsApiStatus(CrashOrAnrGroupsApiStatus.Loading)

    // Set key id if user has paginated. Last index of current list if forward navigation, first index if backward
    var keyId = null
    if (crashOrAnrGroups.results !== null && crashOrAnrGroups.results.length > 0) {
      if (paginationDirection === PaginationDirection.Forward) {
        keyId = crashOrAnrGroups.results[crashOrAnrGroups.results.length - 1].id
      } else if (paginationDirection === PaginationDirection.Backward) {
        keyId = crashOrAnrGroups.results[0].id
      }
    }

    // Invert limit if paginating backward
    var limit = paginationOffset
    if (paginationDirection === PaginationDirection.Backward) {
      limit = - limit
    }

    const result = await fetchCrashOrAnrGroupsFromServer(crashOrAnrType, selectedApp.id, startDate, endDate, selectedVersions, keyId, limit, router)

    switch (result.status) {
      case CrashOrAnrGroupsApiStatus.Error:
        setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
        setCrashOrAnrGroupsApiStatus(CrashOrAnrGroupsApiStatus.Error)
        break
      case CrashOrAnrGroupsApiStatus.Success:
        setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
        setCrashOrAnrGroupsApiStatus(CrashOrAnrGroupsApiStatus.Success)
        setCrashOrAnrGroups(result.data)
        break
    }
  }

  useEffect(() => {
    getCrashOrAnrGroups()
  }, [selectedApp, startDate, endDate, selectedVersions, paginationRange]);

  // Reset pagination range if any filters change
  useEffect(() => {
    setPaginationRange({ start: 1, end: paginationOffset })
  }, [selectedApp, selectedVersions, startDate, endDate]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-4xl max-w-6xl text-center">{crashOrAnrType === CrashOrAnrType.Crash ? 'Crashes' : 'ANRs'}</p>
      <div className="py-4" />

      {/* Error states for apps fetch */}
      {appsApiStatus === AppsApiStatus.Error && <p className="text-lg font-display">Error fetching apps, please check if Team ID is valid or refresh page to try again</p>}
      {appsApiStatus === AppsApiStatus.NoApps &&
        <div>
          <p className="text-lg font-display">Looks like you don&apos;t have any apps yet. Get started by creating your first app!</p>
          <div className="py-4" />
          <CreateApp teamId={teamId} />
        </div>}

      {/* Main apps & filters UI */}
      {appsApiStatus === AppsApiStatus.Success &&
        <div>
          <div className="flex flex-wrap gap-8 items-center">
            <Dropdown items={apps.map((e) => e.name)} initialSelectedItem={apps[0].name} onChangeSelectedItem={(item) => setSelectedApp(apps.find((e) => e.name === item)!)} />
            {filtersApiStatus === FiltersApiStatus.Success &&
              <div className="flex flex-row items-center">
                <input type="date" defaultValue={startDate} max={endDate} className="font-display border border-black rounded-md p-2" onChange={(e) => setStartDate(e.target.value)} />
                <p className="font-display px-2">to</p>
                <input type="date" defaultValue={endDate} min={startDate} className="font-display border border-black rounded-md p-2" onChange={(e) => setEndDate(e.target.value)} />
              </div>}
            {filtersApiStatus === FiltersApiStatus.Success && <CheckboxDropdown title="App versions" items={versions} initialSelectedItems={versions} onChangeSelectedItems={(items) => setSelectedVersions(items)} />}
          </div>
          <div className="py-4" />
          {filtersApiStatus === FiltersApiStatus.Success &&
            <div className="flex flex-wrap gap-2 items-center w-5/6">
              <FilterPill title={selectedApp.name} />
              <FilterPill title={`${formattedStartDate} to ${formattedEndDate}`} />
              {selectedVersions.length > 0 && <FilterPill title={Array.from(selectedVersions).join(', ')} />}
            </div>}
          <div className="py-4" />
        </div>}

      {/* Error states for filters fetch */}
      {filtersApiStatus === FiltersApiStatus.Error && <p className="text-lg font-display">Error fetching filters, please refresh page or select a different app to try again</p>}
      {filtersApiStatus === FiltersApiStatus.NoData && <p className="text-lg font-display">We don&apos;t seem to have any data for this app. It could have been removed due to exceeding data retention period. Please contact <a href="mailto:support@measure.sh" className="underline text-blue-500">Measure support.</a></p>}
      {filtersApiStatus === FiltersApiStatus.NotOnboarded && <CreateApp teamId={teamId} existingAppName={selectedApp.name} existingApiKey={selectedApp.api_key.key} />}

      {/* Error state for crash groups fetch */}
      {crashOrAnrGroupsApiStatus === CrashOrAnrGroupsApiStatus.Error && <p className="text-lg font-display">Error fetching list of {crashOrAnrType === CrashOrAnrType.Crash ? 'crashes' : 'ANRs'}, please change filters, refresh page or select a different app to try again</p>}

      {/* Empty state for crash groups fetch */}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && crashOrAnrGroupsApiStatus === CrashOrAnrGroupsApiStatus.Success && crashOrAnrGroups.results === null && <p className="text-lg font-display">It seems there are no {crashOrAnrType === CrashOrAnrType.Crash ? 'crashes' : 'ANRs'} for the current combination of filters. Please change filters to try again</p>}

      {/* Main crash groups list UI */}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && (crashOrAnrGroupsApiStatus === CrashOrAnrGroupsApiStatus.Success || crashOrAnrGroupsApiStatus === CrashOrAnrGroupsApiStatus.Loading) && crashOrAnrGroups.results !== null &&
        <div className="flex flex-col items-center">
          <div className="py-4" />
          <div className="border border-black font-sans text-sm w-full h-[36rem]">
            <ExceptionRateChart />
          </div>
          <div className="py-8" />
          <div className="table font-sans border border-black w-full">
            <div className="table-header-group border border-black">
              <div className="table-row">
                <div className="table-cell border border-black p-2 font-display">{crashOrAnrType === CrashOrAnrType.Crash ? 'Crash' : 'ANR'} Name</div>
                <div className="table-cell border border-black p-2 font-display text-center">Instances</div>
                <div className="table-cell border border-black p-2 font-display text-center">Percentage contribution</div>
              </div>
            </div>
            <div className="table-row-group">
              {crashOrAnrGroups.results.map(({ id, name, count, percentage_contribution }) => (
                <Link key={id} href={`/${teamId}/${crashOrAnrType === CrashOrAnrType.Crash ? 'crashes' : 'anrs'}/${selectedApp.id}/${id}/${name}?start_date=${startDate}&end_date=${endDate}`} className="table-row hover:bg-yellow-200 active:bg-yellow-300">
                  <div className="table-cell border border-black p-2 hover:bg-yellow-200 active:bg-yellow-300">{name}</div>
                  <div className="table-cell border border-black p-2 text-center">{count} instances</div>
                  <div className="table-cell border border-black p-2 text-center">{percentage_contribution}%</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="py-2" />
          <Paginator prevEnabled={crashOrAnrGroups.meta.previous} nextEnabled={crashOrAnrGroups.meta.next} displayText={paginationRange.start + ' - ' + paginationRange.end}
            onNext={() => {
              setPaginationRange({ start: paginationRange.start + paginationOffset, end: paginationRange.end + paginationOffset })
              setPaginationDirection(PaginationDirection.Forward)
            }}
            onPrev={() => {
              setPaginationRange({ start: paginationRange.start - paginationOffset, end: paginationRange.end - paginationOffset })
              setPaginationDirection(PaginationDirection.Backward)
            }} />
        </div>}
    </div>
  )
}
