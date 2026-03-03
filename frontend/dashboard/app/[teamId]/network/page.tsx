"use client"

import { FilterSource, NetworkDomainsApiStatus, NetworkPathsApiStatus, NetworkRequestTimelinePlotApiStatus, NetworkStatusOverviewPlotApiStatus, fetchNetworkDomainsFromServer, fetchNetworkPathsFromServer, fetchNetworkRequestTimelinePlotFromServer, fetchNetworkStatusOverviewPlotFromServer } from '@/app/api/api_calls'
import { getPlotTimeGroupForRange } from '@/app/utils/time_utils'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import { Button } from '@/app/components/button'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import { Input } from '@/app/components/input'
import LoadingSpinner from '@/app/components/loading_spinner'
import NetworkRequestTimelinePlot, { NetworkRequestTimelineDataPoint } from '@/app/components/network_request_timeline_plot'
import NetworkStatusDistributionPlot from '@/app/components/network_status_distribution_plot'
import NetworkTrends from '@/app/components/network_trends'
import TabSelect from '@/app/components/tab_select'
import { addRecentSearch, removeRecentSearch, getRecentSearchesForDomain } from '@/app/utils/network_recent_searches'
import { underlineLinkStyle } from '@/app/utils/shared_styles'
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
    requestTimelineStatus: NetworkRequestTimelinePlotApiStatus
    requestTimelineData: NetworkRequestTimelineDataPoint[] | null
    requestTimelineDataKey: string | null
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
        requestTimelineStatus: NetworkRequestTimelinePlotApiStatus.Loading,
        requestTimelineData: null,
        requestTimelineDataKey: null,
    })

    const [searchState, setSearchState] = useState<SearchState>({
        domain: "",
        pathPattern: "",
    })

    const [selectedTab, setSelectedTab] = useState("Overview")
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

    const currentRequestTimelineKey = pageState.filters.serialisedFilters
    const shouldRenderRequestTimeline = pageState.requestTimelineStatus === NetworkRequestTimelinePlotApiStatus.Success && pageState.requestTimelineData !== null && pageState.requestTimelineData.length > 0 && pageState.requestTimelineDataKey === currentRequestTimelineKey

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

    // Fetch status plot when Overview tab is active and filters change
    useEffect(() => {
        if (selectedTab !== "Overview") return
        if (!pageState.filters.ready || !pageState.filters.app) return
        if (pageState.statusPlotDataKey === currentStatusPlotKey) return

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
    }, [selectedTab, pageState.filters])

    // Fetch request timeline data when Timeline tab is active and filters change
    useEffect(() => {
        if (selectedTab !== "Timeline") return
        if (!pageState.filters.ready || !pageState.filters.app) return
        if (pageState.requestTimelineDataKey === currentRequestTimelineKey) return

        let stale = false
        updatePageState({
            requestTimelineStatus: NetworkRequestTimelinePlotApiStatus.Loading,
            requestTimelineData: null,
        })

        fetchNetworkRequestTimelinePlotFromServer(pageState.filters).then(result => {
            if (stale) return
            switch (result.status) {
                case NetworkRequestTimelinePlotApiStatus.Success:
                    updatePageState({
                        requestTimelineStatus: NetworkRequestTimelinePlotApiStatus.Success,
                        requestTimelineData: result.data,
                        requestTimelineDataKey: currentRequestTimelineKey,
                    })
                    break
                case NetworkRequestTimelinePlotApiStatus.NoData:
                    updatePageState({ requestTimelineStatus: NetworkRequestTimelinePlotApiStatus.NoData, requestTimelineData: null, requestTimelineDataKey: null })
                    break
                default:
                    updatePageState({ requestTimelineStatus: NetworkRequestTimelinePlotApiStatus.Error, requestTimelineData: null, requestTimelineDataKey: null })
                    break
            }
        })

        return () => { stale = true }
    }, [selectedTab, pageState.filters])

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
                    {/* Search endpoint */}
                    <p className="font-display text-lg">Explore endpoint</p>
                    <div className="py-1" />
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

                    <div className="py-8" />

                    <div className="w-full flex justify-center pb-2">
                        <TabSelect
                            items={["Overview", "Top Endpoints", "Timeline"]}
                            selected={selectedTab}
                            onChangeSelected={setSelectedTab}
                        />
                    </div>
                    <div className="py-2" />
                    <p className="font-body text-sm text-muted-foreground text-center w-full">
                        {selectedTab === "Overview" && "HTTP status code distribution over time for all requests made by the app"}
                        {selectedTab === "Top Endpoints" && <>Endpoints ranked by latency, error rate, and request frequency.<br /><span className={underlineLinkStyle}>Learn more</span> about how endpoints are grouped.</>}
                        {selectedTab === "Timeline" && <>See when network requests occur during a session and how frequently.<br /><span className={underlineLinkStyle}>Learn more</span> about how endpoints are grouped.</>}
                    </p>

                    <div className="py-10" />

                    <div className="min-h-[36rem] w-full">
                        <div className={selectedTab !== "Top Endpoints" ? "hidden" : ""}>
                            <NetworkTrends filters={pageState.filters} teamId={params.teamId} hideTitle active={selectedTab === "Top Endpoints"} />
                        </div>

                        {selectedTab === "Overview" && (
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
                        )}

                        {selectedTab === "Timeline" && (
                            <div className="flex font-body items-center justify-center w-full h-[36rem]">
                                {pageState.requestTimelineStatus === NetworkRequestTimelinePlotApiStatus.Loading && <LoadingSpinner />}
                                {shouldRenderRequestTimeline &&
                                    <NetworkRequestTimelinePlot data={pageState.requestTimelineData!} />
                                }
                                {(pageState.requestTimelineStatus === NetworkRequestTimelinePlotApiStatus.NoData || (pageState.requestTimelineStatus === NetworkRequestTimelinePlotApiStatus.Success && !shouldRenderRequestTimeline)) &&
                                    <p className="font-body text-sm">No data available for the selected filters</p>
                                }
                                {pageState.requestTimelineStatus === NetworkRequestTimelinePlotApiStatus.Error &&
                                    <p className="font-body text-sm">Error fetching requests timeline, please change filters & try again</p>
                                }
                            </div>
                        )}
                    </div>
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
