"use client"

import { FilterSource, NetworkMetricsApiStatus, fetchNetworkMetricsFromServer } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingSpinner from '@/app/components/loading_spinner'
import NetworkLatencyPlot from '@/app/components/network_latency_plot'
import NetworkStatusDistributionPlot from '@/app/components/network_status_distribution_plot'
import { getPlotTimeGroupForRange } from '@/app/utils/time_utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface LatencyDataPoint {
    datetime: string
    p50: number | null
    p90: number | null
    p95: number | null
    p99: number | null
    count: number
}

interface StatusDistributionDataPoint {
    datetime: string
    total_count: number
    count_2xx: number
    count_3xx: number
    count_4xx: number
    count_5xx: number
}

interface NetworkMetrics {
    latency: LatencyDataPoint[]
    status_codes: StatusDistributionDataPoint[]
}

interface PageState {
    filters: typeof defaultFilters
    networkMetricsApiStatus: NetworkMetricsApiStatus
    networkMetrics: NetworkMetrics | null
    plotDataKey: string | null
}

export default function ExploreUrl({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const url = searchParams.get("url") ?? ""

    const [pageState, setPageState] = useState<PageState>({
        filters: defaultFilters,
        networkMetricsApiStatus: NetworkMetricsApiStatus.Loading,
        networkMetrics: null,
        plotDataKey: null,
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

    const plotTimeGroup = getPlotTimeGroupForRange(pageState.filters.startDate, pageState.filters.endDate)
    const currentPlotKey = `${url}|${pageState.filters.serialisedFilters}|${plotTimeGroup}`
    const shouldRenderPlot = pageState.networkMetricsApiStatus === NetworkMetricsApiStatus.Success && pageState.networkMetrics !== null && pageState.plotDataKey === currentPlotKey

    useEffect(() => {
        if (!pageState.filters.ready) {
            return
        }

        const params = new URLSearchParams(pageState.filters.serialisedFilters!)
        params.set("url", url)
        router.replace(`?${params.toString()}`, { scroll: false })
    }, [pageState.filters])

    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app || !url) {
            return
        }

        updatePageState({ networkMetricsApiStatus: NetworkMetricsApiStatus.Loading })

        fetchNetworkMetricsFromServer(pageState.filters, url).then(result => {
            switch (result.status) {
                case NetworkMetricsApiStatus.Success:
                    updatePageState({
                        networkMetricsApiStatus: NetworkMetricsApiStatus.Success,
                        networkMetrics: result.data as NetworkMetrics,
                        plotDataKey: currentPlotKey,
                    })
                    break
                case NetworkMetricsApiStatus.NoData:
                    updatePageState({
                        networkMetricsApiStatus: NetworkMetricsApiStatus.NoData,
                        networkMetrics: null,
                        plotDataKey: null,
                    })
                    break
                default:
                    updatePageState({
                        networkMetricsApiStatus: NetworkMetricsApiStatus.Error,
                        networkMetrics: null,
                        plotDataKey: null,
                    })
                    break
            }
        })
    }, [pageState.filters])

    return (
        <div className="flex flex-col items-start w-full">
            {pageState.filters.ready && <p className="font-code text-4xl max-w-6xl text-center">{url}</p>}
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Events}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
                showNoData={false}
                showNotOnboarded={true}
                showAppSelector={true}
                showAppVersions={true}
                showDates={true}
                showSessionTypes={false}
                showOsVersions={true}
                showCountries={true}
                showNetworkTypes={true}
                showNetworkProviders={true}
                showNetworkGenerations={true}
                showLocales={true}
                showDeviceManufacturers={true}
                showDeviceNames={true}
                showBugReportStatus={false}
                showUdAttrs={false}
                showFreeText={false}
                onFiltersChanged={handleFiltersChanged} />

            <div className="py-4" />

            {pageState.filters.ready && (pageState.networkMetricsApiStatus === NetworkMetricsApiStatus.Loading || (pageState.networkMetricsApiStatus === NetworkMetricsApiStatus.Success && !shouldRenderPlot)) &&
                <LoadingSpinner />
            }
            {pageState.filters.ready && pageState.networkMetricsApiStatus === NetworkMetricsApiStatus.Error &&
                <p className="font-body text-sm">Error fetching metrics, please change filters & try again</p>
            }
            {pageState.filters.ready && pageState.networkMetricsApiStatus === NetworkMetricsApiStatus.NoData &&
                <p className="font-body text-sm">No data available for the selected filters</p>
            }
            {shouldRenderPlot &&
                <div className="flex flex-col w-full">

                    <div className="py-6" />
                    <p className="font-display text-xl">Latency</p>
                    <div className="py-2" />
                    <NetworkLatencyPlot data={pageState.networkMetrics!.latency} plotTimeGroup={plotTimeGroup} />

                    <div className="py-6" />
                    <p className="font-display text-xl">Status Distribution</p>
                    <div className="py-2" />
                    <NetworkStatusDistributionPlot data={pageState.networkMetrics!.status_codes} plotTimeGroup={plotTimeGroup} />

                </div>
            }
        </div>
    )
}
