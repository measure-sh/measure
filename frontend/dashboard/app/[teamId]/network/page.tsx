"use client"

import { FilterSource } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PageState {
    filters: typeof defaultFilters
}

export default function NetworkOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()

    const initialState: PageState = {
        filters: defaultFilters
    }

    const [pageState, setPageState] = useState<PageState>(initialState)

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
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

        router.replace(`?${pageState.filters.serialisedFilters!}`, { scroll: false })
    }, [pageState.filters])

    return (
        <div className="flex flex-col items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Network</p>
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
                showOsVersions={true}
                showCountries={true}
                showNetworkTypes={true}
                showNetworkProviders={true}
                showNetworkGenerations={true}
                showLocales={true}
                showDeviceManufacturers={true}
                showDeviceNames={true}
                showBugReportStatus={false}
                showUdAttrs={true}
                showFreeText={false}
                onFiltersChanged={handleFiltersChanged} />
            <div className="py-4" />
        </div>
    )
}
