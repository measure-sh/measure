"use client"

import { FilterSource } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PageState {
    filters: typeof defaultFilters
}

export default function ExploreUrl({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const url = searchParams.get("url") ?? ""

    const [pageState, setPageState] = useState<PageState>({
        filters: defaultFilters,
    })

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => ({ ...prevState, ...newState }))
    }

    const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
        if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
            updatePageState({
                filters: updatedFilters
            })
        }
    }

    useEffect(() => {
        if (!pageState.filters.ready) {
            return
        }

        const params = new URLSearchParams(pageState.filters.serialisedFilters!)
        params.set("url", url)
        router.replace(`?${params.toString()}`, { scroll: false })
    }, [pageState.filters])

    return (
        <div className="flex flex-col items-start">
            <p className="font-display text-4xl max-w-6xl text-center">{url}</p>
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Events}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.Latest}
                showNoData={true}
                showNotOnboarded={true}
                showAppSelector={true}
                showAppVersions={true}
                showDates={true}
                showSessionType={false}
                showOsVersions={false}
                showCountries={false}
                showNetworkTypes={true}
                showNetworkProviders={true}
                showNetworkGenerations={true}
                showLocales={false}
                showDeviceManufacturers={false}
                showDeviceNames={false}
                showBugReportStatus={false}
                showUdAttrs={false}
                showFreeText={false}
                onFiltersChanged={handleFiltersChanged} />
        </div>
    )
}
