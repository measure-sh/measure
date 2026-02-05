"use client"

import { FilterSource } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import MetricsOverview from '@/app/components/metrics_overview'
import SessionsVsExceptionsPlot from '@/app/components/sessions_vs_exceptions_overview_plot'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PageState {
    filters: typeof defaultFilters
}

interface OverviewProps {
    params?: { teamId: string }
    demo?: boolean
    hideDemoTitle?: boolean
}

export default function Overview({ params = { teamId: 'demo-team-id' }, demo = false, hideDemoTitle = false }: OverviewProps) {
    const router = useRouter()
    const teamId = params?.teamId ?? "demo-team"

    const initialState: PageState = {
        filters: defaultFilters,
    }

    const [pageState, setPageState] = useState<PageState>(initialState)

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
        // update filters only if they have changed
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

        // update url
        router.replace(`?${pageState.filters.serialisedFilters!}`, { scroll: false })
    }, [pageState.filters])

    return (
        <div className="flex flex-col items-start">
            <p className="font-display text-4xl max-w-6xl text-center">{demo ? (hideDemoTitle ? '' : 'App Health') : 'Overview'}</p>
            <div className="py-4" />

            {!demo &&
                <Filters
                    teamId={teamId}
                    filterSource={FilterSource.Events}
                    appVersionsInitialSelectionType={AppVersionsInitialSelectionType.Latest}
                    showNoData={true}
                    showNotOnboarded={true}
                    showAppSelector={true}
                    showAppVersions={true}
                    showDates={true}
                    showSessionTypes={false}
                    showOsVersions={false}
                    showCountries={false}
                    showNetworkTypes={false}
                    showNetworkProviders={false}
                    showNetworkGenerations={false}
                    showLocales={false}
                    showDeviceManufacturers={false}
                    showDeviceNames={false}
                    showBugReportStatus={false}
                    showFreeText={false}
                    showUdAttrs={false}
                    onFiltersChanged={handleFiltersChanged} />}

            <div className="py-2" />

            {(demo || pageState.filters.ready) && (
                <>
                    <SessionsVsExceptionsPlot filters={pageState.filters} demo={demo} />
                    <div className="py-8" />
                    <MetricsOverview
                        filters={pageState.filters} demo={demo} />
                </>
            )}
        </div>
    )
}