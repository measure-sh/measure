"use client"

import React, { useState, useEffect } from 'react';
import CheckboxDropdown from "@/app/components/checkbox_dropdown";
import Dropdown from "@/app/components/dropdown";
import ExceptionRateChart from "@/app/components/exception_rate_chart";
import FilterPill from "@/app/components/filter_pill";
import Link from "next/link";
import { getAccessTokenOrRedirectToAuth, logoutIfAuthError } from '@/app/utils/auth_utils';
import { useRouter } from 'next/navigation';
import CreateApp from '@/app/components/create_app';

const crashes = [
  {
    id: 'asldkfjlk34343',
    title: 'NullPointerException.kt',
    count: 87928,
    percentage: 15,
  },
  {
    id: 'sldfkjsklf898',
    title: 'LayoutInflaterException.kt',
    count: 56789,
    percentage: 9,
  },
  {
    id: 'asafdasfd9900',
    title: 'RuntimeException.kt',
    count: 7890,
    percentage: 3,
  },
  {
    id: 'bnflkjfg8989',
    title: 'MainThreadException.kt',
    count: 4546,
    percentage: 1.5,
  },
  {
    id: 'cbcmvncmvn89898',
    title: 'InvalidDataException.kt',
    count: 1031,
    percentage: 0.76,
  },
  {
    id: 'sldkjkjdf8989',
    title: 'JsonParsingException.kt',
    count: 1031,
    percentage: 0.76,
  },
  {
    id: 'sbxcbvcv898',
    title: 'InvalidParameterException.kt',
    count: 1002,
    percentage: 0.73,
  },
  {
    id: 'asdfsdgsdg90909',
    title: 'InvalidDimensionsException.kt',
    count: 856,
    percentage: 0.61,
  },
  {
    id: 'ckvjdfsfjh78aswe',
    title: 'InvalidPaymentMethodException.kt',
    count: 768,
    percentage: 0.51,
  },
  {
    id: 'askjbljhdkfe5435',
    title: 'ApiResponseException.kt',
    count: 652,
    percentage: 0.43,
  },
];

export default function Crashes({ params }: { params: { teamId: string } }) {
  const router = useRouter()

  enum AppsApiStatus {
    Loading,
    Success,
    Error,
    NoApps
  }

  enum FiltersApiStatus {
    Loading,
    Success,
    Error,
    NoData
  }

  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);
  const [filtersApiStatus, setFiltersApiStatus] = useState(FiltersApiStatus.Loading);

  const emptyApp = {
    "id": "",
    "team_id": "",
    "name": "",
    "api_key": {
      "created_at": "",
      "key": "",
      "last_seen": null,
      "revoked": false
    },
    "onboarded": false,
    "created_at": "",
    "updated_at": "",
    "platform": null,
    "onboarded_at": null,
    "unique_identifier": null
  }

  const [apps, setApps] = useState([] as typeof emptyApp[]);
  const [selectedApp, setSelectedApp] = useState(emptyApp);

  const [versions, setVersions] = useState([] as string[]);
  const [selectedVersions, setSelectedVersions] = useState([versions[0]]);

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

  const getApps = async (teamId: string,) => {
    setAppsApiStatus(AppsApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      headers: {
        "Authorization": `Bearer ${authToken}`
      }
    };

    const res = await fetch(`${origin}/teams/${teamId}/apps`, opts);

    if (!res.ok && res.status == 404) {
      setAppsApiStatus(AppsApiStatus.NoApps)
      return
    }

    if (!res.ok) {
      setAppsApiStatus(AppsApiStatus.Error)
      logoutIfAuthError(router, res)
      return
    }

    const data = await res.json()

    setApps(data)
    setSelectedApp(data[0])
    setAppsApiStatus(AppsApiStatus.Success)
  }

  useEffect(() => {
    getApps(params.teamId)
  }, []);

  const getFilters = async (selectedApp: typeof emptyApp) => {
    if (!selectedApp.onboarded) {
      setFiltersApiStatus(FiltersApiStatus.NoData)
      return
    }

    setFiltersApiStatus(FiltersApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      headers: {
        "Authorization": `Bearer ${authToken}`
      }
    };

    const res = await fetch(`${origin}/apps/${selectedApp.id}/filters`, opts);

    if (!res.ok && res.status == 404) {
      setFiltersApiStatus(FiltersApiStatus.NoData)
      return
    }

    if (!res.ok) {
      logoutIfAuthError(router, res)
      setFiltersApiStatus(FiltersApiStatus.Error)
      return
    }
    const data = await res.json()

    setVersions(data.versions)
    setSelectedVersions(data.versions[0])
    setFiltersApiStatus(FiltersApiStatus.Success)
  }

  useEffect(() => {
    getFilters(selectedApp)
  }, [selectedApp]);

  useEffect(() => {
    setFormattedStartDate(new Date(startDate).toLocaleDateString());
    setFormattedEndDate(new Date(endDate).toLocaleDateString());
  }, [startDate, endDate]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-4xl max-w-6xl text-center">Crashes</p>
      <div className="py-4" />
      <div className="flex flex-wrap gap-8 items-center">
        {/* Loading message for apps */}
        {appsApiStatus === AppsApiStatus.Loading && <p className="text-lg font-display">Updating Apps...</p>}

        {/* Error message for apps fetch error */}
        {appsApiStatus === AppsApiStatus.Error && <p className="text-lg font-display">Error fetching apps, please refresh page to try again</p>}

        {/* Create app when no apps exist */}
        {appsApiStatus === AppsApiStatus.NoApps && <p className="text-lg font-display">Looks like you don&apos;t have any apps yet. Get started by creating your first app!</p>}
        {appsApiStatus === AppsApiStatus.NoApps && <div className="py-4" />}
        {appsApiStatus === AppsApiStatus.NoApps && <CreateApp teamId={params.teamId} />}

        {/* Show app selector dropdown if apps fetch succeeds */}
        {appsApiStatus === AppsApiStatus.Success && <Dropdown items={apps.map((e) => e.name)} onChangeSelectedItem={(item) => setSelectedApp(apps.find((e) => e.name === item)!)} />}

        {/* Show date selector if apps and filters fetch succeeds */}
        {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success &&
          <div className="flex flex-row items-center">
            <input type="date" defaultValue={startDate} max={endDate} className="font-display border border-black rounded-md p-2" onChange={(e) => setStartDate(e.target.value)} />
            <p className="font-display px-2">to</p>
            <input type="date" defaultValue={endDate} min={startDate} className="font-display border border-black rounded-md p-2" onChange={(e) => setEndDate(e.target.value)} />
          </div>}

        {/* Loading message for filters */}
        {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Loading && <p className="text-lg font-display">Updating filters...</p>}

        {/* Show versions selector if apps and filters fetch succeeds  */}
        {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && <CheckboxDropdown title="App versions" items={versions} onChangeSelectedItems={(items) => setSelectedVersions(items)} />}
      </div>

      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && <div className="py-4" />}

      {/* Show filter pills if apps and filters fetch succeeds  */}
      <div className="flex flex-wrap gap-2 items-center w-5/6">
        {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && <FilterPill title={selectedApp.name} />}
        {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && <FilterPill title={`${formattedStartDate} to ${formattedEndDate}`} />}
        {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success && selectedVersions.length > 0 && <FilterPill title={Array.from(selectedVersions).join(', ')} />}
      </div>
      <div className="py-8" />
      {/* Filters fetch error message  */}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Error && <p className="text-lg font-display">Error fetching filters, please refresh page or select a different app to try again</p>}

      {/* Create app when app exists but has no data */}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.NoData && <CreateApp teamId={params.teamId} existingAppName={selectedApp.name} existingApiKey={selectedApp.api_key.key} />}

      {/* Show exception rate chart if apps and filters fetch succeeds  */}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success &&
        <div className="border border-black font-sans text-sm w-full h-[36rem]">
          <ExceptionRateChart />
        </div>}
      <div className="py-8" />
      {/* Show list of crashes if apps and filters fetch succeeds  */}
      {appsApiStatus === AppsApiStatus.Success && filtersApiStatus === FiltersApiStatus.Success &&
        <div className="table font-sans border border-black w-full">
          <div className="table-header-group border border-black">
            <div className="table-row">
              <div className="table-cell border border-black p-2 font-display">Crash Name</div>
              <div className="table-cell border border-black p-2 font-display text-center">Instances</div>
              <div className="table-cell border border-black p-2 font-display text-center">Percentage contribution</div>
            </div>
          </div>
          <div className="table-row-group">
            {crashes.map(({ id, title, count, percentage }) => (
              <Link key={id} href={`/${params.teamId}/crashes/${id}`} className="table-row hover:bg-yellow-200 active:bg-yellow-300">
                <div className="table-cell border border-black p-2 hover:bg-yellow-200 active:bg-yellow-300">{title}</div>
                <div className="table-cell border border-black p-2 text-center">{count} instances</div>
                <div className="table-cell border border-black p-2 text-center">{percentage}%</div>
              </Link>
            ))}
          </div>
        </div>}
    </div>
  )
}
