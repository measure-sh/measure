"use client"

import { FilterSource, NetworkMetricsApiStatus, fetchNetworkMetricsFromServer } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingSpinner from '@/app/components/loading_spinner'
import NetworkFrequencyPlot from '@/app/components/network_frequency_plot'
import NetworkLatencyPlot from '@/app/components/network_latency_plot'
import NetworkStatusCodesPlot from '@/app/components/network_status_codes_plot'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PageState {
    filters: typeof defaultFilters
    networkMetricsApiStatus: NetworkMetricsApiStatus
    networkMetrics: any
}

export default function ExploreUrl({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const url = searchParams.get("url") ?? ""

    const [pageState, setPageState] = useState<PageState>({
        filters: defaultFilters,
        networkMetricsApiStatus: NetworkMetricsApiStatus.Loading,
        networkMetrics: null,
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
                        networkMetrics: result.data,
                    })
                    break
                case NetworkMetricsApiStatus.NoData:
                    updatePageState({
                        networkMetricsApiStatus: NetworkMetricsApiStatus.NoData,
                        networkMetrics: null,
                    })
                    break
                default:
                    updatePageState({
                        networkMetricsApiStatus: NetworkMetricsApiStatus.Error,
                        networkMetrics: null,
                    })
                    break
            }
        })
    }, [pageState.filters])

    return (
        <div className="flex flex-col items-start w-full">
            <p className="font-code text-4xl max-w-6xl text-center">{url}</p>
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Events}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
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
                showUdAttrs={false}
                showFreeText={false}
                onFiltersChanged={handleFiltersChanged} />

            <div className="py-4" />

            {pageState.networkMetricsApiStatus === NetworkMetricsApiStatus.Loading &&
                <LoadingSpinner />
            }
            {pageState.networkMetricsApiStatus === NetworkMetricsApiStatus.Error &&
                <p className="font-body text-sm">Error fetching metrics, please change filters & try again</p>
            }
            {pageState.networkMetricsApiStatus === NetworkMetricsApiStatus.NoData &&
                <p className="font-body text-sm">No data available for the selected filters</p>
            }
            {pageState.networkMetricsApiStatus === NetworkMetricsApiStatus.Success && pageState.networkMetrics &&
                <div className="flex flex-col w-full">

                    <div className="py-6" />
                    <p className="font-display text-xl">Latency</p>
                    <div className="py-2" />
                    <NetworkLatencyPlot data={pageState.networkMetrics.latency} />

                    <div className="py-6" />
                    <p className="font-display text-xl">Status Codes</p>
                    <div className="py-2" />
                    <NetworkStatusCodesPlot data={pageState.networkMetrics.status_codes} />

                    <div className="py-6" />
                    <p className="font-display text-xl">Frequency</p>
                    <div className="py-2" />
                    <NetworkFrequencyPlot data={pageState.networkMetrics.frequency} />
                </div>
            }
        </div>
    )
}
