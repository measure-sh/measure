"use client"

import { FilterSource } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType } from '@/app/components/filters'
import MetricsOverview from '@/app/components/metrics_overview'
import SessionsVsExceptionsPlot from '@/app/components/sessions_vs_exceptions_overview_plot'
import { useFiltersStore } from '@/app/stores/provider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface OverviewProps {
    params?: { teamId: string }
    demo?: boolean
    hideDemoTitle?: boolean
}

export default function Overview({ params = { teamId: 'demo-team-id' }, demo = false, hideDemoTitle = false }: OverviewProps) {
    const router = useRouter()
    const teamId = params?.teamId ?? "demo-team"
    const filters = useFiltersStore(state => state.filters)
    const currentTeamId = useFiltersStore(state => state.currentTeamId)

    useEffect(() => {
        if (!filters.ready) {
            return
        }
        if (currentTeamId !== teamId) {
            return
        }

        // update url
        router.replace(`?${filters.serialisedFilters!}`, { scroll: false })
    }, [filters.ready, filters.serialisedFilters, currentTeamId, teamId])

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
                    showHttpMethods={false}
                    showFreeText={false}
                    showUdAttrs={false}
                />}

            <div className="py-2" />

            {(demo || filters.ready) && (
                <>
                    <SessionsVsExceptionsPlot demo={demo} />
                    <div className="py-8" />
                    <MetricsOverview demo={demo} />
                </>
            )}
        </div>
    )
}