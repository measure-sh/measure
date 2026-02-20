"use client"

import { FilterSource, HttpDomainsApiStatus, HttpPathsApiStatus, NetworkStatusOverviewPlotApiStatus, NetworkOverviewApiStatus, fetchHttpDomainsFromServer, fetchHttpPathsFromServer, fetchNetworkStatusOverviewPlotFromServer, fetchNetworkOverviewFromServer } from '@/app/api/api_calls'
import { formatMillisToHumanReadable } from '@/app/utils/time_utils'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import { Button } from '@/app/components/button'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import { Input } from '@/app/components/input'
import LoadingBar from '@/app/components/loading_bar'
import LoadingSpinner from '@/app/components/loading_spinner'
import NetworkStatusDistributionPlot from '@/app/components/network_status_distribution_plot'
import TabSelect from '@/app/components/tab_select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { addRecentSearch, removeRecentSearch, getRecentSearchesForDomain } from '@/app/utils/network_recent_searches'
import { underlineLinkStyle } from '@/app/utils/shared_styles'
import { History } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface OverviewEndpoint {
    domain: string
    path_pattern: string
    p95_latency: number | null
    error_rate: number | null
    frequency: number
}

interface NetworkOverview {
    top_n_latency: OverviewEndpoint[]
    top_n_error_rate: OverviewEndpoint[]
    top_n_frequency: OverviewEndpoint[]
}

enum OverviewTab {
    Latency = "Slowest",
    ErrorRate = "Highest Error Rate",
    Frequency = "Most Frequent",
}

interface PageState {
    filters: typeof defaultFilters
    domainsStatus: HttpDomainsApiStatus
    domains: string[]
    pathsStatus: HttpPathsApiStatus
    paths: string[]
    statusPlotStatus: NetworkStatusOverviewPlotApiStatus
    statusPlotData: any[]
    overviewStatus: NetworkOverviewApiStatus
    overview: NetworkOverview
    selectedTab: OverviewTab
}

interface SearchState {
    domain: string
    pathPattern: string
}

const emptyOverview: NetworkOverview = {
    top_n_latency: [],
    top_n_error_rate: [],
    top_n_frequency: [],
}

function getActiveTabData(overview: NetworkOverview, tab: OverviewTab): OverviewEndpoint[] {
    switch (tab) {
        case OverviewTab.Latency:
            return overview.top_n_latency
        case OverviewTab.ErrorRate:
            return overview.top_n_error_rate
        case OverviewTab.Frequency:
            return overview.top_n_frequency
    }
}

export default function NetworkPage({ params }: { params: { teamId: string } }) {
    const router = useRouter()

    const [pageState, setPageState] = useState<PageState>({
        filters: defaultFilters,
        domainsStatus: HttpDomainsApiStatus.Loading,
        domains: [],
        pathsStatus: HttpPathsApiStatus.Loading,
        paths: [],
        statusPlotStatus: NetworkStatusOverviewPlotApiStatus.Loading,
        statusPlotData: [],
        overviewStatus: NetworkOverviewApiStatus.Loading,
        overview: emptyOverview,
        selectedTab: OverviewTab.Latency,
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

    const handleSearch = () => {
        if (searchState.pathPattern.trim() === "") return
        const path = searchState.pathPattern.startsWith('/') ? searchState.pathPattern : '/' + searchState.pathPattern
        const domain = searchState.domain.endsWith('/') ? searchState.domain.slice(0, -1) : searchState.domain
        addRecentSearch(domain, path)
        router.push(`/${params.teamId}/network/details?url=${encodeURIComponent(domain + path)}`)
    }

    const navigateToEndpoint = (endpoint: OverviewEndpoint) => {
        router.push(`/${params.teamId}/network/details?url=${encodeURIComponent(endpoint.domain + endpoint.path_pattern)}`)
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

        updatePageState({ domainsStatus: HttpDomainsApiStatus.Loading })

        fetchHttpDomainsFromServer(pageState.filters.app).then(result => {
            switch (result.status) {
                case HttpDomainsApiStatus.Success:
                    const domains = result.data.results as string[]
                    updatePageState({
                        domainsStatus: HttpDomainsApiStatus.Success,
                        domains,
                    })
                    updateSearchState({ domain: domains[0] })
                    break
                case HttpDomainsApiStatus.NoData:
                    updatePageState({ domainsStatus: HttpDomainsApiStatus.NoData, domains: [] })
                    updateSearchState({ domain: "" })
                    break
                default:
                    updatePageState({ domainsStatus: HttpDomainsApiStatus.Error, domains: [] })
                    updateSearchState({ domain: "" })
                    break
            }
        })
    }, [pageState.filters])

    // Fetch overview and status plot when filters change
    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app) return

        updatePageState({
            overviewStatus: NetworkOverviewApiStatus.Loading,
            statusPlotStatus: NetworkStatusOverviewPlotApiStatus.Loading,
        })

        fetchNetworkOverviewFromServer(pageState.filters).then(result => {
            switch (result.status) {
                case NetworkOverviewApiStatus.Success:
                    updatePageState({
                        overviewStatus: NetworkOverviewApiStatus.Success,
                        overview: result.data as NetworkOverview,
                    })
                    break
                case NetworkOverviewApiStatus.NoData:
                    updatePageState({ overviewStatus: NetworkOverviewApiStatus.NoData, overview: emptyOverview })
                    break
                default:
                    updatePageState({ overviewStatus: NetworkOverviewApiStatus.Error, overview: emptyOverview })
                    break
            }
        })

        fetchNetworkStatusOverviewPlotFromServer(pageState.filters).then(result => {
            switch (result.status) {
                case NetworkStatusOverviewPlotApiStatus.Success:
                    updatePageState({
                        statusPlotStatus: NetworkStatusOverviewPlotApiStatus.Success,
                        statusPlotData: result.data,
                    })
                    break
                case NetworkStatusOverviewPlotApiStatus.NoData:
                    updatePageState({ statusPlotStatus: NetworkStatusOverviewPlotApiStatus.NoData, statusPlotData: [] })
                    break
                default:
                    updatePageState({ statusPlotStatus: NetworkStatusOverviewPlotApiStatus.Error, statusPlotData: [] })
                    break
            }
        })
    }, [pageState.filters])

    // Fetch path suggestions with debounce
    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app || searchState.domain === "") return

        updatePageState({ pathsStatus: HttpPathsApiStatus.Loading, paths: [] })

        const timer = setTimeout(() => {
            fetchHttpPathsFromServer(pageState.filters.app!, searchState.domain, searchState.pathPattern).then(result => {
                switch (result.status) {
                    case HttpPathsApiStatus.Success:
                        updatePageState({
                            pathsStatus: HttpPathsApiStatus.Success,
                            paths: result.data.results as string[],
                        })
                        break
                    case HttpPathsApiStatus.NoData:
                        updatePageState({ pathsStatus: HttpPathsApiStatus.NoData, paths: [] })
                        break
                    default:
                        updatePageState({ pathsStatus: HttpPathsApiStatus.Error, paths: [] })
                        break
                }
            })
        }, 300)

        return () => clearTimeout(timer)
    }, [searchState.domain, searchState.pathPattern, pageState.filters.app])

    // Update recent paths when domain or pattern changes
    useEffect(() => {
        if (searchState.domain) {
            setRecentPaths(getRecentSearchesForDomain(searchState.domain, searchState.pathPattern))
        } else {
            setRecentPaths([])
        }
    }, [searchState.domain, searchState.pathPattern])

    const activeTabData = getActiveTabData(pageState.overview, pageState.selectedTab)

    return (
        <div className="flex flex-col items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Network Performance</p>
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Events}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
                showNoData={false}
                showNotOnboarded={false}
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
                showUdAttrs={false}
                showFreeText={false}
                onFiltersChanged={handleFiltersChanged} />

            <div className="py-4" />

            {pageState.filters.ready && pageState.domainsStatus === HttpDomainsApiStatus.Loading &&
                <LoadingSpinner />
            }
            {pageState.domainsStatus === HttpDomainsApiStatus.Success && pageState.domains.length > 0 &&
                <>
                    {pageState.statusPlotStatus === NetworkStatusOverviewPlotApiStatus.Loading &&
                        <div className="w-full">
                            <LoadingBar />
                        </div>
                    }

                    {pageState.statusPlotStatus === NetworkStatusOverviewPlotApiStatus.Success &&
                        <div className="w-full">
                            <NetworkStatusDistributionPlot data={pageState.statusPlotData} />
                        </div>
                    }

                    {pageState.statusPlotStatus === NetworkStatusOverviewPlotApiStatus.NoData &&
                        <p className="font-body text-sm">No status overview data available for the selected filters</p>
                    }

                    {pageState.statusPlotStatus === NetworkStatusOverviewPlotApiStatus.Error &&
                        <p className="font-body text-sm">Error fetching status overview, please change filters & try again</p>
                    }

                    <div className="py-6" />

                    <p className="font-display text-xl">Search Endpoint</p>
                    <div className="py-2" />
                    <div className="flex flex-row items-center w-full">
                        <DropdownSelect
                            type={DropdownSelectType.SingleString}
                            title="Domain"
                            items={pageState.domains}
                            initialSelected={searchState.domain}
                            onChangeSelected={(item) => updateSearchState({ domain: item as string })}
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
                                                    <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-accent-foreground" />
                                                    <button
                                                        type="button"
                                                        className="flex-1 text-left text-sm font-mono group-hover:text-accent-foreground cursor-pointer"
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
                                                            removeRecentSearch(searchState.domain, path)
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
                                                    className="w-full px-2 py-1.5 text-left text-sm font-mono rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
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
                            disabled={searchState.pathPattern.trim() === ""}
                            onClick={handleSearch}>
                            Search
                        </Button>
                    </div>

                    <div className="py-12" />

                    <p className="font-display text-xl">Trends</p>
                    <div className="py-2" />
                    {pageState.overviewStatus === NetworkOverviewApiStatus.Loading &&
                        <div className="w-full">
                            <LoadingBar />
                        </div>
                    }

                    {pageState.overviewStatus === NetworkOverviewApiStatus.Success && activeTabData.length > 0 &&
                        <>
                        <div className="py-2" />
                        <div className="flex justify-start w-full">
                            <TabSelect
                                items={Object.values(OverviewTab)}
                                selected={pageState.selectedTab}
                                onChangeSelected={(item) => updatePageState({ selectedTab: item as OverviewTab })}
                            />
                        </div>
                        <div className="py-2" />
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead style={{ width: '55%' }}>Endpoint</TableHead>
                                    <TableHead style={{ width: '15%' }} className={pageState.selectedTab === OverviewTab.Latency ? underlineLinkStyle : ''}>Latency(p95)</TableHead>
                                    <TableHead style={{ width: '15%' }} className={pageState.selectedTab === OverviewTab.ErrorRate ? underlineLinkStyle : ''}>Error Rate %</TableHead>
                                    <TableHead style={{ width: '15%' }} className={pageState.selectedTab === OverviewTab.Frequency ? underlineLinkStyle : ''}>Count</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activeTabData.map((endpoint, index) => (
                                    <TableRow
                                        key={index}
                                        className="cursor-pointer"
                                        onClick={() => navigateToEndpoint(endpoint)}
                                    >
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-mono truncate">{endpoint.domain}{endpoint.path_pattern}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-body">{endpoint.p95_latency !== null ? formatMillisToHumanReadable(endpoint.p95_latency) : '-'}</TableCell>
                                        <TableCell className="font-body">{endpoint.error_rate !== null ? `${endpoint.error_rate}%` : '-'}</TableCell>
                                        <TableCell className="font-body">{endpoint.frequency}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </>
                    }

                    {(pageState.overviewStatus === NetworkOverviewApiStatus.NoData ||
                        (pageState.overviewStatus === NetworkOverviewApiStatus.Success && activeTabData.length === 0)) &&
                        <p className="font-body text-sm">No data available for the selected filters</p>
                    }

                    {pageState.overviewStatus === NetworkOverviewApiStatus.Error &&
                        <p className="font-body text-sm">Error fetching overview, please change filters & try again</p>
                    }
                </>
            }
            {pageState.domainsStatus === HttpDomainsApiStatus.Error &&
                <p className="font-body text-sm">Error fetching domains, please change filters & try again</p>
            }
            {pageState.domainsStatus === HttpDomainsApiStatus.NoData &&
                <p className="font-body text-sm">No data available for the selected app</p>
            }
        </div>
    )
}
