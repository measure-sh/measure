"use client"

import React, { useState } from 'react';
import Journey, { JourneyType } from "@/app/components/journey";
import MetricsOverview from '@/app/components/metrics_overview';
import { FiltersApiType } from '@/app/api/api_calls';
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters';

export default function Overview({ params }: { params: { teamId: string } }) {
  const [filters, setFilters] = useState(defaultFilters);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-4xl max-w-6xl text-center">Overview</p>
      <div className="py-4" />

      <Filters
        teamId={params.teamId}
        filtersApiType={FiltersApiType.All}
        appVersionsInitialSelectionType={AppVersionsInitialSelectionType.Latest}
        showCreateApp={true}
        showNoData={true}
        showNotOnboarded={true}
        showAppSelector={true}
        showAppVersions={true}
        showDates={true}
        showSessionType={false}
        showOsVersions={false}
        showCountries={false}
        showNetworkTypes={false}
        showNetworkProviders={false}
        showNetworkGenerations={false}
        showLocales={false}
        showDeviceManufacturers={false}
        showDeviceNames={false}
        showFreeText={false}
        showUdAttrs={false}
        onFiltersChanged={(updatedFilters) => setFilters(updatedFilters)} />

      <div className="py-4" />

      {filters.ready &&
        <div className='w-5/6 h-[700px]'>
          <Journey
            teamId={params.teamId}
            bidirectional={false}
            journeyType={JourneyType.Overview}
            exceptionsGroupId={null}
            filters={filters} />
        </div>
      }
      <div className="py-8" />

      {filters.ready &&
        <MetricsOverview
          filters={filters} />}
    </div>
  )
}
