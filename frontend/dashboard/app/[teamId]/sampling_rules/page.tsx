"use client"

import { FilterSource, SamplingRulesApiStatus as SamplingRulesApiStatus, emptySamplingRulesResponse, fetchSamplingRulesFromServer } from "@/app/api/api_calls"
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from "@/app/components/filters"
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from "react"

interface PageState {
    samplingRulesApiStatus: SamplingRulesApiStatus
    filters: typeof defaultFilters
    samplingOverview: typeof emptySamplingRulesResponse
    paginationOffset: number
}

const paginationLimit = 5
const paginationOffsetUrlKey = "po"

export default function SamplingRules({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const initialState: PageState = {
        samplingRulesApiStatus: SamplingRulesApiStatus.Loading,
        filters: defaultFilters,
        samplingOverview: emptySamplingRulesResponse,
        paginationOffset: searchParams.get(paginationOffsetUrlKey) ? parseInt(searchParams.get(paginationOffsetUrlKey)!) : 0
    }

    const [pageState, setPageState] = useState<PageState>(initialState)

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const getSamplingRules = async () => {
        updatePageState({ samplingRulesApiStatus: SamplingRulesApiStatus.Loading })

        const result = await fetchSamplingRulesFromServer(pageState.filters.app!.id, paginationLimit, pageState.paginationOffset)

        switch (result.status) {
            case SamplingRulesApiStatus.Error:
                updatePageState({ samplingRulesApiStatus: SamplingRulesApiStatus.Error })
                break
            case SamplingRulesApiStatus.Success:
                updatePageState({
                    samplingRulesApiStatus: SamplingRulesApiStatus.Success,
                    samplingOverview: result.data
                })
                break
        }
    }

    const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
        // update filters only if they have changed
        if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
            updatePageState({
                filters: updatedFilters,
                // Reset pagination on filters change if previous filters were not default filters
                paginationOffset: pageState.filters.serialisedFilters && searchParams.get(paginationOffsetUrlKey) ? 0 : pageState.paginationOffset
            })
        }
    }

    useEffect(() => {
        if (!pageState.filters.ready) {
            return
        }

        // update url
        router.replace(`?${paginationOffsetUrlKey}=${encodeURIComponent(pageState.paginationOffset)}&${pageState.filters.serialisedFilters!}`, { scroll: false })

        getSamplingRules()
    }, [pageState.paginationOffset, pageState.filters])

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <div className="flex flex-row items-center gap-2 justify-between w-full">
                <p className="font-display text-4xl max-w-6xl text-center">Sampling</p>
            </div>

            <div className="py-4" />

            {/* Shows app selector */}
            <Filters
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
                onFiltersChanged={handleFiltersChanged} />

        </div>
    )
}
