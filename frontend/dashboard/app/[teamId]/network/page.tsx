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
    httpDomainsApiStatus: HttpDomainsApiStatus
    httpDomains: string[]
    httpPathsApiStatus: HttpPathsApiStatus
    httpPaths: string[]
    statusOverviewPlotApiStatus: NetworkStatusOverviewPlotApiStatus
    statusOverviewPlotData: any[]
    networkOverviewApiStatus: NetworkOverviewApiStatus
    networkOverview: NetworkOverview
    selectedOverviewTab: OverviewTab
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

export default function NetworkOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()

    const initialState: PageState = {
        filters: defaultFilters,
        httpDomainsApiStatus: HttpDomainsApiStatus.Loading,
        httpDomains: [],
        httpPathsApiStatus: HttpPathsApiStatus.Loading,
        httpPaths: [],
        statusOverviewPlotApiStatus: NetworkStatusOverviewPlotApiStatus.Loading,
        statusOverviewPlotData: [],
        networkOverviewApiStatus: NetworkOverviewApiStatus.Loading,
        networkOverview: emptyOverview,
        selectedOverviewTab: OverviewTab.Latency,
    }

    const [pageState, setPageState] = useState<PageState>(initialState)

    const [searchState, setSearchState] = useState<SearchState>({
        domain: "",
        pathPattern: "",
    })

    const updateSearchState = (newState: Partial<SearchState>) => {
        setSearchState(prevState => ({ ...prevState, ...newState }))
    }

    const handleSearch = () => {
        if (searchState.pathPattern.trim() === "") return
        const path = searchState.pathPattern.startsWith('/') ? searchState.pathPattern : '/' + searchState.pathPattern
        const domain = searchState.domain.endsWith('/') ? searchState.domain.slice(0, -1) : searchState.domain
        addRecentSearch(domain, path)
        router.push(`/${params.teamId}/network/details?url=${encodeURIComponent(domain + path)}`)
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

        updatePageState({ httpDomainsApiStatus: HttpDomainsApiStatus.Loading })

        fetchHttpDomainsFromServer(pageState.filters.app).then(result => {
            switch (result.status) {
                case HttpDomainsApiStatus.Success:
                    const domains = result.data.results as string[]
                    updatePageState({
                        httpDomainsApiStatus: HttpDomainsApiStatus.Success,
                        httpDomains: domains,
                    })
                    updateSearchState({ domain: domains[0] })
                    break
                case HttpDomainsApiStatus.NoData:
                    updatePageState({
                        httpDomainsApiStatus: HttpDomainsApiStatus.NoData,
                        httpDomains: [],
                    })
                    updateSearchState({ domain: "" })
                    break
                default:
                    updatePageState({
                        httpDomainsApiStatus: HttpDomainsApiStatus.Error,
                        httpDomains: [],
                    })
                    updateSearchState({ domain: "" })
                    break
            }
        })
    }, [pageState.filters])

    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app) {
            return
        }

        updatePageState({ networkOverviewApiStatus: NetworkOverviewApiStatus.Loading })

        fetchNetworkOverviewFromServer(pageState.filters).then(result => {
            switch (result.status) {
                case NetworkOverviewApiStatus.Success:
                    updatePageState({
                        networkOverviewApiStatus: NetworkOverviewApiStatus.Success,
                        networkOverview: result.data as NetworkOverview,
                    })
                    break
                case NetworkOverviewApiStatus.NoData:
                    updatePageState({
                        networkOverviewApiStatus: NetworkOverviewApiStatus.NoData,
                        networkOverview: emptyOverview,
                    })
                    break
                default:
                    updatePageState({
                        networkOverviewApiStatus: NetworkOverviewApiStatus.Error,
                        networkOverview: emptyOverview,
                    })
                    break
            }
        })
    }, [pageState.filters])

    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app) {
            return
        }

        updatePageState({ statusOverviewPlotApiStatus: NetworkStatusOverviewPlotApiStatus.Loading })

        fetchNetworkStatusOverviewPlotFromServer(pageState.filters).then(result => {
            switch (result.status) {
                case NetworkStatusOverviewPlotApiStatus.Success:
                    updatePageState({
                        statusOverviewPlotApiStatus: NetworkStatusOverviewPlotApiStatus.Success,
                        statusOverviewPlotData: result.data,
                    })
                    break
                case NetworkStatusOverviewPlotApiStatus.NoData:
                    updatePageState({
                        statusOverviewPlotApiStatus: NetworkStatusOverviewPlotApiStatus.NoData,
                        statusOverviewPlotData: [],
                    })
                    break
                default:
                    updatePageState({
                        statusOverviewPlotApiStatus: NetworkStatusOverviewPlotApiStatus.Error,
                        statusOverviewPlotData: [],
                    })
                    break
            }
        })
    }, [pageState.filters])

    const [showSuggestions, setShowSuggestions] = useState(false)
    const [recentPaths, setRecentPaths] = useState<string[]>([])

    useEffect(() => {
        if (!pageState.filters.ready || !pageState.filters.app || searchState.domain === "") {
            return
        }

        updatePageState({ httpPathsApiStatus: HttpPathsApiStatus.Loading, httpPaths: [] })

        const timer = setTimeout(() => {
            fetchHttpPathsFromServer(pageState.filters.app!, searchState.domain, searchState.pathPattern).then(result => {
                switch (result.status) {
                    case HttpPathsApiStatus.Success:
                        updatePageState({
                            httpPathsApiStatus: HttpPathsApiStatus.Success,
                            httpPaths: result.data.results as string[],
                        })
                        break
                    case HttpPathsApiStatus.NoData:
                        updatePageState({
                            httpPathsApiStatus: HttpPathsApiStatus.NoData,
                            httpPaths: [],
                        })
                        break
                    default:
                        updatePageState({
                            httpPathsApiStatus: HttpPathsApiStatus.Error,
                            httpPaths: [],
                        })
                        break
                }
            })
        }, 300)

        return () => clearTimeout(timer)
    }, [searchState.domain, searchState.pathPattern, pageState.filters.app])

    useEffect(() => {
        if (searchState.domain) {
            setRecentPaths(getRecentSearchesForDomain(searchState.domain, searchState.pathPattern))
        } else {
            setRecentPaths([])
        }
    }, [searchState.domain, searchState.pathPattern])

    const activeTabData = getActiveTabData(pageState.networkOverview, pageState.selectedOverviewTab)

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

            {pageState.filters.ready && pageState.httpDomainsApiStatus === HttpDomainsApiStatus.Loading &&
                <LoadingSpinner />
            }
            {pageState.httpDomainsApiStatus === HttpDomainsApiStatus.Success && pageState.httpDomains.length > 0 &&
                <>
                    {pageState.statusOverviewPlotApiStatus === NetworkStatusOverviewPlotApiStatus.Loading &&
                        <div className="w-full">
                            <LoadingBar />
                        </div>
                    }

                    {pageState.statusOverviewPlotApiStatus === NetworkStatusOverviewPlotApiStatus.Success &&
                        <div className="w-full">
                            <NetworkStatusDistributionPlot data={pageState.statusOverviewPlotData} />
                        </div>
                    }

                    {pageState.statusOverviewPlotApiStatus === NetworkStatusOverviewPlotApiStatus.NoData &&
                        <p className="font-body text-sm">No status overview data available for the selected filters</p>
                    }

                    {pageState.statusOverviewPlotApiStatus === NetworkStatusOverviewPlotApiStatus.Error &&
                        <p className="font-body text-sm">Error fetching status overview, please change filters & try again</p>
                    }

                    <div className="py-6" />

                    <p className="font-display text-xl">Explore Endpoint</p>
                    <div className="py-2" />
                    <div className="flex flex-row items-center w-full">
                        <DropdownSelect
                            type={DropdownSelectType.SingleString}
                            title="Domain"
                            items={pageState.httpDomains}
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
                            {showSuggestions && (recentPaths.length > 0 || pageState.httpPaths.length > 0) && (
                                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-border bg-background shadow-lg">
                                    {recentPaths.length > 0 && (
                                        <>
                                            {pageState.httpPaths.length > 0 && <div className="px-3 py-1.5 text-xs text-muted-foreground">Recent</div>}
                                            {recentPaths.map((path) => (
                                                <div
                                                    key={`recent-${path}`}
                                                    className="flex items-center hover:bg-accent group"
                                                >
                                                    <button
                                                        type="button"
                                                        className="flex-1 px-3 py-2 text-left text-sm font-mono cursor-pointer"
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
                                                        className="px-2 py-1 mr-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 cursor-pointer"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault()
                                                            removeRecentSearch(searchState.domain, path)
                                                            setRecentPaths(prev => prev.filter(p => p !== path))
                                                        }}
                                                    >
                                                        &times;
                                                    </button>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                    {pageState.httpPaths.length > 0 && (
                                        <>
                                            {recentPaths.length > 0 && <div className="px-3 py-1.5 text-xs text-muted-foreground">Suggestions</div>}
                                            {pageState.httpPaths.map((path) => (
                                                <button
                                                    key={`suggestion-${path}`}
                                                    type="button"
                                                    className="w-full px-3 py-2 text-left text-sm font-mono hover:bg-accent cursor-pointer"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault()
                                                        updateSearchState({ pathPattern: path })
                                                        setShowSuggestions(false)
                                                    }}
                                                >
                                                    {path}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            className="m-4"
                            disabled={searchState.pathPattern.trim() === ""}
                            onClick={handleSearch}>
                            Explore
                        </Button>
                    </div>

                    <div className="py-8" />

                    <p className="font-display text-xl">Top Endpoints</p>
                    <div className="py-2" />
                    <div className="flex justify-end w-full">
                        <TabSelect
                            items={Object.values(OverviewTab)}
                            selected={pageState.selectedOverviewTab}
                            onChangeSelected={(item) => updatePageState({ selectedOverviewTab: item as OverviewTab })}
                        />
                    </div>
                    <div className="py-2" />

                    {pageState.networkOverviewApiStatus === NetworkOverviewApiStatus.Loading &&
                        <div className="w-full">
                            <LoadingBar />
                        </div>
                    }

                    {pageState.networkOverviewApiStatus === NetworkOverviewApiStatus.Success && activeTabData.length > 0 &&
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead style={{ width: '55%' }}>Endpoint</TableHead>
                                    <TableHead style={{ width: '15%' }} className={pageState.selectedOverviewTab === OverviewTab.Latency ? underlineLinkStyle : ''}>Latency(p95)</TableHead>
                                    <TableHead style={{ width: '15%' }} className={pageState.selectedOverviewTab === OverviewTab.ErrorRate ? underlineLinkStyle : ''}>Error Rate %</TableHead>
                                    <TableHead style={{ width: '15%' }} className={pageState.selectedOverviewTab === OverviewTab.Frequency ? underlineLinkStyle : ''}>Count</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activeTabData.map((ep, index) => (
                                    <TableRow
                                        key={index}
                                        className="cursor-pointer"
                                        onClick={() => router.push(`/${params.teamId}/network/details?url=${encodeURIComponent(ep.domain + ep.path_pattern)}`)}
                                    >
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-mono truncate">{ep.domain}{ep.path_pattern}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-body">{ep.p95_latency !== null ? formatMillisToHumanReadable(ep.p95_latency) : '-'}</TableCell>
                                        <TableCell className="font-body">{ep.error_rate !== null ? `${ep.error_rate}%` : '-'}</TableCell>
                                        <TableCell className="font-body">{ep.frequency}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    }

                    {(pageState.networkOverviewApiStatus === NetworkOverviewApiStatus.NoData ||
                        (pageState.networkOverviewApiStatus === NetworkOverviewApiStatus.Success && activeTabData.length === 0)) &&
                        <p className="font-body text-sm">No data available for the selected filters</p>
                    }

                    {pageState.networkOverviewApiStatus === NetworkOverviewApiStatus.Error &&
                        <p className="font-body text-sm">Error fetching overview, please change filters & try again</p>
                    }
                </>
            }
            {pageState.httpDomainsApiStatus === HttpDomainsApiStatus.Error &&
                <p className="font-body text-sm">Error fetching domains, please change filters & try again</p>
            }
            {pageState.httpDomainsApiStatus === HttpDomainsApiStatus.NoData &&
                <p className="font-body text-sm">No data available for the selected app</p>
            }
        </div>
    )
}
