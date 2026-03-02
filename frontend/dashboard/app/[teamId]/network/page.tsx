"use client"

import { FilterSource, NetworkDomainsApiStatus, NetworkPathsApiStatus, NetworkStatusOverviewPlotApiStatus, fetchNetworkDomainsFromServer, fetchNetworkPathsFromServer, fetchNetworkStatusOverviewPlotFromServer } from '@/app/api/api_calls'
import { getPlotTimeGroupForRange } from '@/app/utils/time_utils'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import { Button } from '@/app/components/button'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import { Input } from '@/app/components/input'
import LoadingSpinner from '@/app/components/loading_spinner'
import NetworkStatusDistributionPlot from '@/app/components/network_status_distribution_plot'
import NetworkTrends from '@/app/components/network_trends'
import { addRecentSearch, removeRecentSearch, getRecentSearchesForDomain } from '@/app/utils/network_recent_searches'
import { History } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PageState {
    filters: typeof defaultFilters
    domainsStatus: NetworkDomainsApiStatus
    domains: string[]
    pathsStatus: NetworkPathsApiStatus
    paths: string[]
    statusPlotStatus: NetworkStatusOverviewPlotApiStatus
    statusPlotData: any[]
    statusPlotDataKey: string | null
}

interface SearchState {
    domain: string
    pathPattern: string
}

export default function NetworkPage({ params }: { params: { teamId: string } }) {
    const router = useRouter()

    const [pageState, setPageState] = useState<PageState>({
        filters: defaultFilters,
        domainsStatus: NetworkDomainsApiStatus.Loading,
        domains: [],
        pathsStatus: NetworkPathsApiStatus.Loading,
        paths: [],
        statusPlotStatus: NetworkStatusOverviewPlotApiStatus.Loading,
        statusPlotData: [],
        statusPlotDataKey: null,
    })

    const [searchState, setSearchState] = useState<SearchState>({
        domain: "",
        pathPattern: "",
    })

    const [showSuggestions, setShowSuggestions] = useState(false)
    const [recentPaths, setRecentPaths] = useState<string[]>([])

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prev => ({ ...prev, ...newState }))
    }

    const updateSearchState = (newState: Partial<SearchState>) => {
        setSearchState(prev => ({ ...prev, ...newState }))
    }

    const plotTimeGroup = getPlotTimeGroupForRange(pageState.filters.startDate, pageState.filters.endDate)
    const currentStatusPlotKey = `${pageState.filters.serialisedFilters}|${plotTimeGroup}`
    const shouldRenderStatusPlot = pageState.statusPlotStatus === NetworkStatusOverviewPlotApiStatus.Success && pageState.statusPlotData.length > 0 && pageState.statusPlotDataKey === currentStatusPlotKey

    const handleSearch = () => {
        if (searchState.pathPattern.trim() === "") return
        const path = searchState.pathPattern.startsWith('/') ? searchState.pathPattern : '/' + searchState.pathPattern
        const domain = searchState.domain.endsWith('/') ? searchState.domain.slice(0, -1) : searchState.domain
        addRecentSearch(params.teamId, domain, path)
        router.push(`/${params.teamId}/network/details?url=${encodeURIComponent(domain + path)}`)
    }

    const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
        if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
            updatePageState({ filters: updatedFilters })
        }
    }

    // Sync filters to URL
    useEffect(() => {
        if (!pageState.filters.ready) return
        router.replace(`?${pageState.filters.serialisedFilters!}`, { scroll: false })
    }, [pageState.filters])

    // Fetch domains when filters change
    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app) return

        let stale = false
        updatePageState({ domainsStatus: NetworkDomainsApiStatus.Loading })

        fetchNetworkDomainsFromServer(pageState.filters.app).then(result => {
            if (stale) return
            switch (result.status) {
                case NetworkDomainsApiStatus.Success:
                    const domains = result.data.results as string[]
                    updatePageState({
                        domainsStatus: NetworkDomainsApiStatus.Success,
                        domains,
                    })
                    updateSearchState({ domain: domains[0] })
                    break
                case NetworkDomainsApiStatus.NoData:
                    updatePageState({ domainsStatus: NetworkDomainsApiStatus.NoData, domains: [] })
                    updateSearchState({ domain: "" })
                    break
                default:
                    updatePageState({ domainsStatus: NetworkDomainsApiStatus.Error, domains: [] })
                    updateSearchState({ domain: "" })
                    break
            }
        })

        return () => { stale = true }
    }, [pageState.filters])

    // Fetch status plot when filters change
    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app) return

        let stale = false
        updatePageState({
            statusPlotStatus: NetworkStatusOverviewPlotApiStatus.Loading,
            statusPlotData: [],
        })

        fetchNetworkStatusOverviewPlotFromServer(pageState.filters).then(result => {
            if (stale) return
            switch (result.status) {
                case NetworkStatusOverviewPlotApiStatus.Success:
                    updatePageState({
                        statusPlotStatus: NetworkStatusOverviewPlotApiStatus.Success,
                        statusPlotData: result.data,
                        statusPlotDataKey: currentStatusPlotKey,
                    })
                    break
                case NetworkStatusOverviewPlotApiStatus.NoData:
                    updatePageState({ statusPlotStatus: NetworkStatusOverviewPlotApiStatus.NoData, statusPlotData: [], statusPlotDataKey: null })
                    break
                default:
                    updatePageState({ statusPlotStatus: NetworkStatusOverviewPlotApiStatus.Error, statusPlotData: [], statusPlotDataKey: null })
                    break
            }
        })

        return () => { stale = true }
    }, [pageState.filters])

    // Fetch path suggestions with debounce
    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app || searchState.domain === "") return

        updatePageState({ pathsStatus: NetworkPathsApiStatus.Loading, paths: [] })

        const timer = setTimeout(() => {
            fetchNetworkPathsFromServer(pageState.filters.app!, searchState.domain, searchState.pathPattern).then(result => {
                switch (result.status) {
                    case NetworkPathsApiStatus.Success:
                        updatePageState({
                            pathsStatus: NetworkPathsApiStatus.Success,
                            paths: result.data.results as string[],
                        })
                        break
                    case NetworkPathsApiStatus.NoData:
                        updatePageState({ pathsStatus: NetworkPathsApiStatus.NoData, paths: [] })
                        break
                    default:
                        updatePageState({ pathsStatus: NetworkPathsApiStatus.Error, paths: [] })
                        break
                }
            })
        }, 300)

        return () => clearTimeout(timer)
    }, [searchState.domain, searchState.pathPattern, pageState.filters.app])

    // Update recent paths when domain or pattern changes
    useEffect(() => {
        if (searchState.domain) {
            setRecentPaths(getRecentSearchesForDomain(params.teamId, searchState.domain, searchState.pathPattern))
        } else {
            setRecentPaths([])
        }
    }, [searchState.domain, searchState.pathPattern])

    return (
        <div className="flex flex-col items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Network Performance</p>
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Events}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
                showNoData={true}
                showNotOnboarded={true}
                showAppSelector={true}
                showAppVersions={false}
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
                showUdAttrs={false}
                showFreeText={false}
                onFiltersChanged={handleFiltersChanged} />

            <div className="py-4" />

            {pageState.filters.ready &&
                pageState.domainsStatus !== NetworkDomainsApiStatus.Error &&
                pageState.domainsStatus !== NetworkDomainsApiStatus.NoData &&
                <>
                    {/* Status code plot */}
                    <div className="flex font-body items-center justify-center w-full h-[36rem]">
                        {(pageState.statusPlotStatus === NetworkStatusOverviewPlotApiStatus.Loading || (pageState.statusPlotStatus === NetworkStatusOverviewPlotApiStatus.Success && !shouldRenderStatusPlot)) && <LoadingSpinner />}
                        {shouldRenderStatusPlot &&
                            <NetworkStatusDistributionPlot data={pageState.statusPlotData} plotTimeGroup={plotTimeGroup} />
                        }
                        {pageState.statusPlotStatus === NetworkStatusOverviewPlotApiStatus.NoData &&
                            <p className="font-body text-sm">No data available for the selected filters</p>
                        }
                        {pageState.statusPlotStatus === NetworkStatusOverviewPlotApiStatus.Error &&
                            <p className="font-body text-sm">Error fetching status overview, please change filters & try again</p>
                        }
                    </div>

                    <div className="py-6" />

                    {/* Search endpoint */}
                    <p className="font-display text-xl">Search Endpoint</p>
                    <div className="py-2" />
                    <div className="flex flex-row items-center w-full">
                        <DropdownSelect
                            type={DropdownSelectType.SingleString}
                            title="Domain"
                            items={pageState.domains}
                            initialSelected={pageState.domainsStatus === NetworkDomainsApiStatus.Loading ? "Loading..." : searchState.domain}
                            onChangeSelected={(item) => updateSearchState({ domain: item as string })}
                            disabled={pageState.domainsStatus !== NetworkDomainsApiStatus.Success}
                        />
                        <div className="px-2" />
                        <div className="relative flex-1">
                            <Input
                                type="text"
                                placeholder="Enter a path like /v1/users/*/profile"
                                className="w-full font-body"
                                value={searchState.pathPattern}
                                onChange={(e) => {
                                    updateSearchState({ pathPattern: e.target.value.replace(/\s/g, '') })
                                    setShowSuggestions(true)
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setShowSuggestions(false)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setShowSuggestions(false)
                                        handleSearch()
                                    } else if (e.key === 'Escape') {
                                        setShowSuggestions(false)
                                    }
                                }}
                            />
                            {showSuggestions && (recentPaths.length > 0 || pageState.paths.length > 0) && (
                                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-1">
                                    {recentPaths.length > 0 && (
                                        <>
                                            {recentPaths.map((path) => (
                                                <div
                                                    key={`recent-${path}`}
                                                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent hover:text-accent-foreground group"
                                                >
                                                    <History className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-accent-foreground" />
                                                    <button
                                                        type="button"
                                                        className="flex-1 text-left text-sm font-display translate-y-0.5 group-hover:text-accent-foreground cursor-pointer"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault()
                                                            updateSearchState({ pathPattern: path })
                                                            setShowSuggestions(false)
                                                        }}
                                                    >
                                                        {path}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="px-2 py-0.5 text-xs text-muted-foreground group-hover:text-accent-foreground opacity-0 group-hover:opacity-100 cursor-pointer"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault()
                                                            removeRecentSearch(params.teamId, searchState.domain, path)
                                                            setRecentPaths(prev => prev.filter(p => p !== path))
                                                        }}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                    {pageState.paths.length > 0 && (
                                        <div className={recentPaths.length > 0 ? "mt-4" : ""}>
                                            {pageState.paths.map((path) => (
                                                <button
                                                    key={`suggestion-${path}`}
                                                    type="button"
                                                    className="w-full px-2 py-1.5 text-left text-sm font-display rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault()
                                                        updateSearchState({ pathPattern: path })
                                                        setShowSuggestions(false)
                                                    }}
                                                >
                                                    {path}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            className="m-4"
                            disabled={searchState.pathPattern.trim() === "" || pageState.domainsStatus !== NetworkDomainsApiStatus.Success}
                            onClick={handleSearch}>
                            Search
                        </Button>
                    </div>

                    <div className="py-10" />

                    {/* Trends */}
                    <NetworkTrends filters={pageState.filters} teamId={params.teamId} />
                </>
            }
            {pageState.domainsStatus === NetworkDomainsApiStatus.Error &&
                <p className="font-body text-sm">Error fetching domains, please change filters & try again</p>
            }
            {pageState.domainsStatus === NetworkDomainsApiStatus.NoData &&
                <p className="font-body text-sm">No data available for the selected app</p>
            }
        </div>
    )
}
