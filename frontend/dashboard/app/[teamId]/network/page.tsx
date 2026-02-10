"use client"

import { FilterSource, HttpOriginsApiStatus, fetchHttpOriginsFromServer } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import { Button } from '@/app/components/button'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import { Input } from '@/app/components/input'
import LoadingSpinner from '@/app/components/loading_spinner'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PageState {
    filters: typeof defaultFilters
    httpOriginsApiStatus: HttpOriginsApiStatus
    httpOrigins: string[]
}

interface SearchState {
    origin: string
    pathPattern: string
}

export default function NetworkOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()

    const initialState: PageState = {
        filters: defaultFilters,
        httpOriginsApiStatus: HttpOriginsApiStatus.Loading,
        httpOrigins: [],
    }

    const [pageState, setPageState] = useState<PageState>(initialState)

    const [searchState, setSearchState] = useState<SearchState>({
        origin: "",
        pathPattern: "",
    })

    const updateSearchState = (newState: Partial<SearchState>) => {
        setSearchState(prevState => ({ ...prevState, ...newState }))
    }

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

    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app) {
            return
        }

        updatePageState({ httpOriginsApiStatus: HttpOriginsApiStatus.Loading })

        fetchHttpOriginsFromServer(pageState.filters.app).then(result => {
            switch (result.status) {
                case HttpOriginsApiStatus.Success:
                    const origins = result.data.results as string[]
                    updatePageState({
                        httpOriginsApiStatus: HttpOriginsApiStatus.Success,
                        httpOrigins: origins,
                    })
                    updateSearchState({ origin: origins[0] })
                    break
                case HttpOriginsApiStatus.NoData:
                    updatePageState({
                        httpOriginsApiStatus: HttpOriginsApiStatus.NoData,
                        httpOrigins: [],
                    })
                    updateSearchState({ origin: "" })
                    break
                default:
                    updatePageState({
                        httpOriginsApiStatus: HttpOriginsApiStatus.Error,
                        httpOrigins: [],
                    })
                    updateSearchState({ origin: "" })
                    break
            }
        })
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
                showAppVersions={false}
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
                showBugReportStatus={false}
                showUdAttrs={false}
                showFreeText={false}
                onFiltersChanged={handleFiltersChanged} />

            <div className="py-4" />

            {pageState.filters.ready && pageState.httpOriginsApiStatus === HttpOriginsApiStatus.Loading &&
                <LoadingSpinner />
            }
            {pageState.httpOriginsApiStatus === HttpOriginsApiStatus.Success && pageState.httpOrigins.length > 0 &&
                <>
                    <p className="font-display text-xl max-w-6xl">Search</p>

                    <div className="py-2" />

                    <div className="flex flex-row items-center w-full">
                        <DropdownSelect
                            type={DropdownSelectType.SingleString}
                            title="Origin"
                            items={pageState.httpOrigins}
                            initialSelected={searchState.origin}
                            onChangeSelected={(item) => updateSearchState({ origin: item as string })}
                        />
                        <div className="px-2" />
                        <Input
                            type="text"
                            placeholder="Enter a path like /v1/users/*/profile"
                            className="flex-1 font-body"
                            value={searchState.pathPattern}
                            onChange={(e) => updateSearchState({ pathPattern: e.target.value })}
                        />
                        <Button
                            variant="outline"
                            className="m-4"
                            disabled={searchState.pathPattern.trim() === ""}
                            onClick={() => {
                                const path = searchState.pathPattern.startsWith('/') ? searchState.pathPattern : '/' + searchState.pathPattern
                                const origin = searchState.origin.endsWith('/') ? searchState.origin.slice(0, -1) : searchState.origin
                                router.push(`/${params.teamId}/network/explore_url?url=${encodeURIComponent(origin + path)}`)
                            }}>
                            Search
                        </Button>
                    </div>

                    <div className="py-4" />

                    <p className="font-display text-xl max-w-6xl">Overview</p>
                </>
            }
            {pageState.httpOriginsApiStatus === HttpOriginsApiStatus.Error &&
                <p className="font-body text-sm">Error fetching origins, please change filters & try again</p>
            }
            {pageState.httpOriginsApiStatus === HttpOriginsApiStatus.NoData &&
                <p className="font-body text-sm">No data available for the selected app</p>
            }
        </div>
    )
}
