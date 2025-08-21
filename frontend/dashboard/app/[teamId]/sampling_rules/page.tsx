"use client"

import { FilterSource, SamplingOverviewApiStatus } from "@/app/api/api_calls"
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from "@/app/components/filters"
import { useRef, useState } from "react"

export default function SamplingRulesOverview({ params }: { params: { teamId: string } }) {
    const [filters, setFilters] = useState(defaultFilters)
    const [sampingOverviewApiStatus, setSamplingOverviewApiStatus] = useState(SamplingOverviewApiStatus.Loading)
    const filtersRef = useRef<any>(null)



    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <div className="flex flex-row items-center gap-2 justify-between w-full">
                <p className="font-display text-4xl max-w-6xl text-center">Sampling</p>
            </div>
        
            <div className="py-4" />
            
            <Filters
                ref={filtersRef}
                teamId={params.teamId}
                filterSource={FilterSource.Events}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
                showNoData={false}
                showNotOnboarded={false}
                showAppSelector={true}
                showAppVersions={false}
                showDates={false}
                showSessionType={false}
                showOsVersions={false}
                showCountries={false}
                showNetworkTypes={false}
                showNetworkProviders={false}
                showNetworkGenerations={false}
                showLocales={false}
                showDeviceManufacturers={false}
                showDeviceNames={false}
                showBugReportStatus={false}
                showUdAttrs={false}
                showFreeText={false}
                onFiltersChanged={(updatedFilters) => setFilters(updatedFilters)} />
        </div>
    )
}
