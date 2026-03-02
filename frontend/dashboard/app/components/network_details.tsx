"use client"

import { FilterSource, NetworkDetailLatencyPlotApiStatus, NetworkDetailStatusDistributionPlotApiStatus, fetchNetworkDetailLatencyPlotFromServer, fetchNetworkDetailStatusDistributionPlotFromServer } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingSpinner from '@/app/components/loading_spinner'
import NetworkLatencyPlot from '@/app/components/network_latency_plot'
import NetworkStatusDistributionPlot from '@/app/components/network_status_distribution_plot'
import { getPlotTimeGroupForRange, PlotTimeGroup } from '@/app/utils/time_utils'
import { DateTime } from 'luxon'
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

const demoUrl = "payments.demo-provider.com/*/payment-methods"

const spikeDay = 10

function generateDemoData(): { latency: LatencyDataPoint[], statusDistribution: StatusDistributionDataPoint[] } {
    const now = DateTime.now().toUTC()
    const latency: LatencyDataPoint[] = []
    const statusDistribution: StatusDistributionDataPoint[] = []

    for (let i = 0; i < 14; i++) {
        const datetime = now.minus({ days: 13 - i }).toFormat('yyyy-MM-dd')
        const isSpike = i === spikeDay
        const total = Math.round(4200 + Math.random() * 1800)
        const jitter = Math.sin(i * 0.7) * 20

        // Latency — spike bumps all percentiles up
        const latencyMultiplier = isSpike ? 2.2 : 1
        latency.push({
            datetime,
            p50: Math.round((115 + jitter + Math.random() * 15) * latencyMultiplier),
            p90: Math.round((340 + jitter * 1.5 + Math.random() * 30) * latencyMultiplier),
            p95: Math.round((570 + jitter * 2 + Math.random() * 40) * latencyMultiplier),
            p99: Math.round((1180 + jitter * 3 + Math.random() * 60) * latencyMultiplier),
            count: total,
        })

        // Status distribution — spike bumps 5xx and 4xx rates
        const errorMultiplier = isSpike ? 6 : 1
        const count_5xx = Math.round(total * (0.005 + Math.random() * 0.01) * errorMultiplier)
        const count_4xx = Math.round(total * (0.02 + Math.random() * 0.02) * errorMultiplier)
        const count_3xx = Math.round(total * (0.01 + Math.random() * 0.01))
        const count_2xx = total - count_5xx - count_4xx - count_3xx
        statusDistribution.push({
            datetime,
            total_count: total,
            count_2xx,
            count_3xx,
            count_4xx,
            count_5xx,
        })
    }

    return { latency, statusDistribution }
}

const { latency: demoLatencyData, statusDistribution: demoStatusDistributionData } = generateDemoData()

interface PageState {
    filters: typeof defaultFilters
    latencyApiStatus: NetworkDetailLatencyPlotApiStatus
    latencyData: LatencyDataPoint[] | null
    latencyPlotDataKey: string | null
    statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus
    statusDistributionData: StatusDistributionDataPoint[] | null
    statusDistributionPlotDataKey: string | null
}

interface NetworkDetailsProps {
    params?: { teamId: string }
    demo?: boolean
    hideDemoTitle?: boolean
}

export default function NetworkDetails({ params = { teamId: 'demo-team-id' }, demo = false, hideDemoTitle = false }: NetworkDetailsProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const url = demo ? demoUrl : (searchParams.get("url") ?? "")

    const [pageState, setPageState] = useState<PageState>(() => {
        if (demo) {
            return {
                filters: defaultFilters,
                latencyApiStatus: NetworkDetailLatencyPlotApiStatus.Success,
                latencyData: demoLatencyData,
                latencyPlotDataKey: 'demo',
                statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus.Success,
                statusDistributionData: demoStatusDistributionData,
                statusDistributionPlotDataKey: 'demo',
            }
        }
        return {
            filters: defaultFilters,
            latencyApiStatus: NetworkDetailLatencyPlotApiStatus.Loading,
            latencyData: null,
            latencyPlotDataKey: null,
            statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus.Loading,
            statusDistributionData: null,
            statusDistributionPlotDataKey: null,
        }
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

    const plotTimeGroup: PlotTimeGroup = demo ? "days" : getPlotTimeGroupForRange(pageState.filters.startDate, pageState.filters.endDate)
    const currentPlotKey = demo ? 'demo' : `${url}|${pageState.filters.serialisedFilters}|${plotTimeGroup}`
    const shouldRenderLatencyPlot = demo || (pageState.latencyApiStatus === NetworkDetailLatencyPlotApiStatus.Success && pageState.latencyData !== null && pageState.latencyPlotDataKey === currentPlotKey)
    const shouldRenderStatusDistributionPlot = demo || (pageState.statusDistributionApiStatus === NetworkDetailStatusDistributionPlotApiStatus.Success && pageState.statusDistributionData !== null && pageState.statusDistributionPlotDataKey === currentPlotKey)

    useEffect(() => {
        if (demo) return

        if (!pageState.filters.ready) {
            return
        }

        const params = new URLSearchParams(pageState.filters.serialisedFilters!)
        params.set("url", url)
        router.replace(`?${params.toString()}`, { scroll: false })
    }, [pageState.filters])

    useEffect(() => {
        if (demo) return

        if (!pageState.filters.ready || !pageState.filters.app || !url) {
            return
        }

        updatePageState({ latencyApiStatus: NetworkDetailLatencyPlotApiStatus.Loading })

        fetchNetworkDetailLatencyPlotFromServer(pageState.filters, url).then(result => {
            switch (result.status) {
                case NetworkDetailLatencyPlotApiStatus.Success:
                    updatePageState({
                        latencyApiStatus: NetworkDetailLatencyPlotApiStatus.Success,
                        latencyData: result.data as LatencyDataPoint[],
                        latencyPlotDataKey: currentPlotKey,
                    })
                    break
                case NetworkDetailLatencyPlotApiStatus.NoData:
                    updatePageState({
                        latencyApiStatus: NetworkDetailLatencyPlotApiStatus.NoData,
                        latencyData: null,
                        latencyPlotDataKey: null,
                    })
                    break
                default:
                    updatePageState({
                        latencyApiStatus: NetworkDetailLatencyPlotApiStatus.Error,
                        latencyData: null,
                        latencyPlotDataKey: null,
                    })
                    break
            }
        })
    }, [pageState.filters])

    useEffect(() => {
        if (demo) return

        if (!pageState.filters.ready || !pageState.filters.app || !url) {
            return
        }

        updatePageState({ statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus.Loading })

        fetchNetworkDetailStatusDistributionPlotFromServer(pageState.filters, url).then(result => {
            switch (result.status) {
                case NetworkDetailStatusDistributionPlotApiStatus.Success:
                    updatePageState({
                        statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus.Success,
                        statusDistributionData: result.data as StatusDistributionDataPoint[],
                        statusDistributionPlotDataKey: currentPlotKey,
                    })
                    break
                case NetworkDetailStatusDistributionPlotApiStatus.NoData:
                    updatePageState({
                        statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus.NoData,
                        statusDistributionData: null,
                        statusDistributionPlotDataKey: null,
                    })
                    break
                default:
                    updatePageState({
                        statusDistributionApiStatus: NetworkDetailStatusDistributionPlotApiStatus.Error,
                        statusDistributionData: null,
                        statusDistributionPlotDataKey: null,
                    })
                    break
            }
        })
    }, [pageState.filters])

    return (
        <div className="flex flex-col items-start w-full">
            {!hideDemoTitle && <p className="font-display text-4xl max-w-6xl text-center">Network Performance</p>}
            {(demo || pageState.filters.ready) && <p className="font-code text-lg max-w-6xl text-center text-muted-foreground">{url}</p>}
            <div className="py-4" />

            {!demo && <Filters
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
                showHttpMethods={true}
                showUdAttrs={false}
                showFreeText={false}
                onFiltersChanged={handleFiltersChanged} />}

            {!demo && <div className="py-4" />}

            {/* Latency Section */}
            {(demo || pageState.filters.ready) && <div className="flex flex-col w-full">
                <div className="py-6" />
                <p className="font-display text-xl">Latency</p>
                <div className="py-2" />
                {!demo && (pageState.latencyApiStatus === NetworkDetailLatencyPlotApiStatus.Loading || (pageState.latencyApiStatus === NetworkDetailLatencyPlotApiStatus.Success && !shouldRenderLatencyPlot)) &&
                    <LoadingSpinner />
                }
                {!demo && pageState.latencyApiStatus === NetworkDetailLatencyPlotApiStatus.Error &&
                    <p className="font-body text-sm">Error fetching latency data, please change filters & try again</p>
                }
                {!demo && pageState.latencyApiStatus === NetworkDetailLatencyPlotApiStatus.NoData &&
                    <p className="font-body text-sm">No data available for the selected filters</p>
                }
                {shouldRenderLatencyPlot &&
                    <NetworkLatencyPlot data={pageState.latencyData!} plotTimeGroup={plotTimeGroup} />
                }
            </div>}

            {/* Status Distribution Section */}
            {(demo || pageState.filters.ready) && <div className="flex flex-col w-full">
                <div className="py-6" />
                <p className="font-display text-xl">Status Distribution</p>
                <div className="py-6" />
                {!demo && (pageState.statusDistributionApiStatus === NetworkDetailStatusDistributionPlotApiStatus.Loading || (pageState.statusDistributionApiStatus === NetworkDetailStatusDistributionPlotApiStatus.Success && !shouldRenderStatusDistributionPlot)) &&
                    <LoadingSpinner />
                }
                {!demo && pageState.statusDistributionApiStatus === NetworkDetailStatusDistributionPlotApiStatus.Error &&
                    <p className="font-body text-sm">Error fetching status distribution data, please change filters & try again</p>
                }
                {!demo && pageState.statusDistributionApiStatus === NetworkDetailStatusDistributionPlotApiStatus.NoData &&
                    <p className="font-body text-sm">No data available for the selected filters</p>
                }
                {shouldRenderStatusDistributionPlot &&
                    <NetworkStatusDistributionPlot data={pageState.statusDistributionData!} plotTimeGroup={plotTimeGroup} />
                }
            </div>}
        </div>
    )
}
