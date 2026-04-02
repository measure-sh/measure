"use client"

import { FilterSource, NetworkDomainsApiStatus, NetworkPathsApiStatus, NetworkTimelinePlotApiStatus, NetworkOverviewStatusCodesPlotApiStatus, fetchNetworkDomainsFromServer, fetchNetworkPathsFromServer, fetchNetworkTimelinePlotFromServer, fetchNetworkOverviewStatusCodesPlotFromServer } from '@/app/api/api_calls'

const timelineLimit = 20
import { getPlotTimeGroupForRange } from '@/app/utils/time_utils'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import BetaBadge from '@/app/components/beta_badge'
import { Button } from '@/app/components/button'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import { Input } from '@/app/components/input'
import LoadingSpinner from '@/app/components/loading_spinner'
import NetworkTimelinePlot, { NetworkTimelineData, NetworkTimelineDataPoint } from '@/app/components/network_timeline_plot'
import NetworkStatusDistributionPlot from '@/app/components/network_status_distribution_plot'
import NetworkTrends from '@/app/components/network_trends'
import { addRecentSearch, removeRecentSearch, getRecentSearchesForDomain } from '@/app/utils/network_recent_searches'
import { underlineLinkStyle } from '@/app/utils/shared_styles'
import { DateTime } from 'luxon'
import { History } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface NetworkOverviewProps {
    params?: { teamId: string }
    demo?: boolean
    hideDemoTitle?: boolean
}

function generateDemoStatusData() {
    const now = DateTime.now().toUTC()
    const data = []
    const spikeDay = 10

    for (let i = 0; i < 14; i++) {
        const datetime = now.minus({ days: 13 - i }).toFormat('yyyy-MM-dd')
        const isSpike = i === spikeDay
        const total = Math.round(4200 + Math.random() * 1800)

        const errorMultiplier = isSpike ? 6 : 1
        const count_5xx = Math.round(total * (0.005 + Math.random() * 0.01) * errorMultiplier)
        const count_4xx = Math.round(total * (0.02 + Math.random() * 0.02) * errorMultiplier)
        const count_3xx = Math.round(total * (0.01 + Math.random() * 0.01))
        const count_2xx = total - count_5xx - count_4xx - count_3xx
        data.push({ datetime, total_count: total, count_2xx, count_3xx, count_4xx, count_5xx })
    }

    return data
}

function generateDemoTimelineData(): NetworkTimelineData {
    // Each endpoint has a time range where it's active and a base intensity
    const endpoints: { domain: string; path_pattern: string; startSec: number; endSec: number; baseCount: number }[] = [
        // Auth/config: concentrated in first 5 seconds
        { domain: "api.demo-provider.com", path_pattern: "/v1/auth/token", startSec: 0, endSec: 5, baseCount: 2.5 },
        { domain: "api.demo-provider.com", path_pattern: "/v1/config", startSec: 0, endSec: 3, baseCount: 1.8 },
        // Feed/content: early-mid session
        { domain: "api.demo-provider.com", path_pattern: "/v2/feed/*", startSec: 3, endSec: 30, baseCount: 1.5 },
        { domain: "cdn.demo-provider.com", path_pattern: "/images/*", startSec: 4, endSec: 35, baseCount: 3.0 },
        { domain: "api.demo-provider.com", path_pattern: "/v1/users/*/profile", startSec: 5, endSec: 20, baseCount: 0.8 },
        // Commerce: late session
        { domain: "api.demo-provider.com", path_pattern: "/v2/products/*", startSec: 25, endSec: 80, baseCount: 1.2 },
        { domain: "payments.demo-provider.com", path_pattern: "/v1/cart/*", startSec: 50, endSec: 90, baseCount: 0.9 },
        { domain: "payments.demo-provider.com", path_pattern: "/v1/checkout", startSec: 70, endSec: 100, baseCount: 0.6 },
        // Analytics: spread throughout
        { domain: "analytics.demo-provider.com", path_pattern: "/v1/events", startSec: 0, endSec: 100, baseCount: 1.0 },
        { domain: "analytics.demo-provider.com", path_pattern: "/v1/screen_view", startSec: 2, endSec: 95, baseCount: 0.7 },
    ]
    const points: NetworkTimelineDataPoint[] = []
    for (const ep of endpoints) {
        for (let sec = ep.startSec; sec <= ep.endSec; sec++) {
            // Higher intensity near the center of the active window
            const mid = (ep.startSec + ep.endSec) / 2
            const range = (ep.endSec - ep.startSec) / 2
            const falloff = 1 - 0.5 * Math.pow((sec - mid) / range, 2)
            const count = Math.round(ep.baseCount * falloff * (0.6 + Math.random() * 0.8) * 100) / 100
            if (count > 0.05) {
                points.push({ elapsed: sec, domain: ep.domain, path_pattern: ep.path_pattern, count })
            }
        }
    }
    return { interval: 5, points }
}

const demoStatusData = generateDemoStatusData()
const demoTimelineData = generateDemoTimelineData()

interface PageState {
    filters: typeof defaultFilters
    domainsStatus: NetworkDomainsApiStatus
    domains: string[]
    pathsStatus: NetworkPathsApiStatus
    paths: string[]
    statusPlotStatus: NetworkOverviewStatusCodesPlotApiStatus
    statusPlotData: any[]
    statusPlotDataKey: string | null
    timelinePlotStatus: NetworkTimelinePlotApiStatus
    timelinePlotData: NetworkTimelineData | null
    timelineDataPlotKey: string | null
}

interface SearchState {
    domain: string
    pathPattern: string
}

export default function NetworkOverview({ params, demo = false, hideDemoTitle = false }: NetworkOverviewProps) {
    const router = useRouter()

    const [pageState, setPageState] = useState<PageState>(() => {
        if (demo) {
            return {
                filters: defaultFilters,
                domainsStatus: NetworkDomainsApiStatus.Success,
                domains: ["payments.demo-provider.com", "api.demo-provider.com", "cdn.demo-provider.com"],
                pathsStatus: NetworkPathsApiStatus.Success,
                paths: [],
                statusPlotStatus: NetworkOverviewStatusCodesPlotApiStatus.Success,
                statusPlotData: demoStatusData,
                statusPlotDataKey: "demo",
                timelinePlotStatus: NetworkTimelinePlotApiStatus.Success,
                timelinePlotData: demoTimelineData,
                timelineDataPlotKey: "demo",
            }
        }
        return {
            filters: defaultFilters,
            domainsStatus: NetworkDomainsApiStatus.Loading,
            domains: [],
            pathsStatus: NetworkPathsApiStatus.Loading,
            paths: [],
            statusPlotStatus: NetworkOverviewStatusCodesPlotApiStatus.Loading,
            statusPlotData: [],
            statusPlotDataKey: null,
            timelinePlotStatus: NetworkTimelinePlotApiStatus.Loading,
            timelinePlotData: null,
            timelineDataPlotKey: null,
        }
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

    const plotTimeGroup = demo ? "days" : getPlotTimeGroupForRange(pageState.filters.startDate, pageState.filters.endDate)
    const currentStatusPlotKey = demo ? "demo" : `${pageState.filters.serialisedFilters}|${plotTimeGroup}`
    const shouldRenderStatusPlot = pageState.statusPlotStatus === NetworkOverviewStatusCodesPlotApiStatus.Success && pageState.statusPlotData.length > 0 && pageState.statusPlotDataKey === currentStatusPlotKey

    const currentTimelineKey = demo ? "demo" : pageState.filters.serialisedFilters
    const shouldRenderTimeline = pageState.timelinePlotStatus === NetworkTimelinePlotApiStatus.Success && pageState.timelinePlotData !== null && pageState.timelinePlotData.points.length > 0 && pageState.timelineDataPlotKey === currentTimelineKey

    const handleSearch = () => {
        if (demo) return
        if (searchState.pathPattern.trim() === "") return
        const path = searchState.pathPattern.startsWith('/') ? searchState.pathPattern : '/' + searchState.pathPattern
        const domain = searchState.domain.endsWith('/') ? searchState.domain.slice(0, -1) : searchState.domain
        addRecentSearch(params!.teamId, domain, path)
        router.push(`/${params!.teamId}/network/details?domain=${encodeURIComponent(domain)}&path=${encodeURIComponent(path)}`)
    }

    const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
        if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
            updatePageState({ filters: updatedFilters })
        }
    }

    // Sync filters to URL
    useEffect(() => {
        if (demo) return
        if (!pageState.filters.ready) return
        router.replace(`?${pageState.filters.serialisedFilters!}`, { scroll: false })
    }, [pageState.filters])

    // Fetch domains when filters change
    useEffect(() => {
        if (demo) return
        if (!pageState.filters.ready || !pageState.filters.app) return

        let stale = false
        updatePageState({ domainsStatus: NetworkDomainsApiStatus.Loading })

        fetchNetworkDomainsFromServer(pageState.filters.app, pageState.filters).then(result => {
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
        if (demo) return
        if (!pageState.filters.ready || !pageState.filters.app) return
        if (pageState.statusPlotDataKey === currentStatusPlotKey) return

        let stale = false
        updatePageState({
            statusPlotStatus: NetworkOverviewStatusCodesPlotApiStatus.Loading,
            statusPlotData: [],
        })

        fetchNetworkOverviewStatusCodesPlotFromServer(pageState.filters).then(result => {
            if (stale) return
            switch (result.status) {
                case NetworkOverviewStatusCodesPlotApiStatus.Success:
                    updatePageState({
                        statusPlotStatus: NetworkOverviewStatusCodesPlotApiStatus.Success,
                        statusPlotData: result.data,
                        statusPlotDataKey: currentStatusPlotKey,
                    })
                    break
                case NetworkOverviewStatusCodesPlotApiStatus.NoData:
                    updatePageState({ statusPlotStatus: NetworkOverviewStatusCodesPlotApiStatus.NoData, statusPlotData: [], statusPlotDataKey: null })
                    break
                default:
                    updatePageState({ statusPlotStatus: NetworkOverviewStatusCodesPlotApiStatus.Error, statusPlotData: [], statusPlotDataKey: null })
                    break
            }
        })

        return () => { stale = true }
    }, [pageState.filters])

    // Fetch request timeline data when filters change
    useEffect(() => {
        if (demo) return
        if (!pageState.filters.ready || !pageState.filters.app) return
        if (pageState.timelineDataPlotKey === currentTimelineKey) return

        let stale = false
        updatePageState({
            timelinePlotStatus: NetworkTimelinePlotApiStatus.Loading,
            timelinePlotData: null,
        })

        fetchNetworkTimelinePlotFromServer(pageState.filters, timelineLimit).then(result => {
            if (stale) return
            switch (result.status) {
                case NetworkTimelinePlotApiStatus.Success:
                    updatePageState({
                        timelinePlotStatus: NetworkTimelinePlotApiStatus.Success,
                        timelinePlotData: result.data,
                        timelineDataPlotKey: currentTimelineKey,
                    })
                    break
                case NetworkTimelinePlotApiStatus.NoData:
                    updatePageState({ timelinePlotStatus: NetworkTimelinePlotApiStatus.NoData, timelinePlotData: null, timelineDataPlotKey: null })
                    break
                default:
                    updatePageState({ timelinePlotStatus: NetworkTimelinePlotApiStatus.Error, timelinePlotData: null, timelineDataPlotKey: null })
                    break
            }
        })

        return () => { stale = true }
    }, [pageState.filters])

    // Fetch path suggestions with debounce
    useEffect(() => {
        if (demo) return
        if (!pageState.filters.ready || !pageState.filters.app || searchState.domain === "") return

        const timer = setTimeout(() => {
            updatePageState({ pathsStatus: NetworkPathsApiStatus.Loading, paths: [] })
            fetchNetworkPathsFromServer(pageState.filters.app!, searchState.domain, searchState.pathPattern, pageState.filters).then(result => {
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
        if (demo) return
        if (searchState.domain) {
            setRecentPaths(getRecentSearchesForDomain(params!.teamId, searchState.domain, searchState.pathPattern))
        } else {
            setRecentPaths([])
        }
    }, [searchState.domain, searchState.pathPattern])

    return (
        <div className="flex flex-col items-start">
            {!hideDemoTitle && <div className="font-display text-4xl max-w-6xl text-center">
                Network Performance{" "}
                {!demo && <BetaBadge popup={<>
                    <p>Some features require minimum SDK versions: Android 0.16.1 and iOS 0.9.2.</p>
                    <br />
                    <p>Review the <Link href={`/${params?.teamId}/apps`} className={underlineLinkStyle}>http sampling rate</Link> configuration to adjust the volume of data collected.</p>
                </>} />}
            </div>}
            {!hideDemoTitle && <div className="py-4" />}

            {!demo && params && (
                <Filters
                    teamId={params.teamId}
                    filterSource={FilterSource.Events}
                    appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
                    showNoData={false}
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
            )}

            {!demo && pageState.filters.ready && pageState.domainsStatus === NetworkDomainsApiStatus.Loading &&
                <div className="flex font-body items-center justify-center w-full h-[36rem]">
                    <LoadingSpinner />
                </div>
            }

            {(demo || (pageState.filters.ready &&
                pageState.domainsStatus === NetworkDomainsApiStatus.Success)) &&
                <>
                    {/* Search endpoint - hidden in demo mode */}
                    {!demo && (
                        <>
                            <div className="py-8" />
                            <p className="font-display text-xl">Explore endpoint</p>
                            <p className="mt-2 font-body text-xs text-muted-foreground">
                                Search for endpoints using exact paths or wildcard patterns.
                                {' '}
                                <Link href="/docs/features/feature-network-monitoring#searching-for-endpoints" className={underlineLinkStyle}>
                                    Learn more
                                </Link>
                                {' '}about how to use wildcard patterns to search.
                            </p>
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
                                                                    removeRecentSearch(params!.teamId, searchState.domain, path)
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
                        </>
                    )}

                    {/* Status Overview Section */}
                    <div className="w-full">
                        <p className="font-display text-xl">Status Distribution</p>
                        <p className="mt-2 font-body text-xs text-muted-foreground">HTTP status code distribution over time for all requests made by the app</p>
                        <div className="py-4" />
                        <div className="flex font-body items-center justify-center w-full h-[36rem]">
                            {(pageState.statusPlotStatus === NetworkOverviewStatusCodesPlotApiStatus.Loading || (pageState.statusPlotStatus === NetworkOverviewStatusCodesPlotApiStatus.Success && !shouldRenderStatusPlot)) && <LoadingSpinner />}
                            {shouldRenderStatusPlot &&
                                <NetworkStatusDistributionPlot data={pageState.statusPlotData} plotTimeGroup={plotTimeGroup} />
                            }
                            {pageState.statusPlotStatus === NetworkOverviewStatusCodesPlotApiStatus.NoData &&
                                <p className="font-body text-sm">No data available for the selected filters</p>
                            }
                            {pageState.statusPlotStatus === NetworkOverviewStatusCodesPlotApiStatus.Error &&
                                <p className="font-body text-sm">Error fetching status overview, please change filters & try again</p>
                            }
                        </div>
                    </div>

                    <div className="py-8" />

                    {/* Top Endpoints Section */}
                    <div className="w-full">
                        <NetworkTrends
                            filters={pageState.filters}
                            teamId={params?.teamId}
                            active
                            demo={demo}
                        />
                    </div>

                    <div className="py-10" />

                    {/* Request Timeline Section */}
                    <div className="w-full">
                        <p className="font-display text-xl">Timeline</p>
                        <p className="mt-2 font-body text-xs text-muted-foreground">Distribution of when endpoint patterns are typically called in a session.{!demo && <>{' '}<Link href="/docs/features/feature-network-monitoring#request-timeline" className={underlineLinkStyle}>Learn more</Link> about how the timeline is generated</>}</p>
                        {shouldRenderTimeline && <div className="py-8">
                            <NetworkTimelinePlot data={pageState.timelinePlotData!} />
                        </div>}
                        {!shouldRenderTimeline && <div className="flex font-body items-center justify-center w-full h-[36rem]">
                            {pageState.timelinePlotStatus === NetworkTimelinePlotApiStatus.Loading && <LoadingSpinner />}
                            {(pageState.timelinePlotStatus === NetworkTimelinePlotApiStatus.NoData || (pageState.timelinePlotStatus === NetworkTimelinePlotApiStatus.Success)) &&
                                <p className="font-body text-sm">No data available for the selected filters</p>
                            }
                            {pageState.timelinePlotStatus === NetworkTimelinePlotApiStatus.Error &&
                                <p className="font-body text-sm">Error fetching requests timeline, please change filters & try again</p>
                            }
                        </div>}
                    </div>
                </>
            }
            {!demo && pageState.domainsStatus === NetworkDomainsApiStatus.Error &&
                <p className="pt-8 font-body text-sm">Error fetching domains, please change filters & try again</p>
            }
            {!demo && pageState.domainsStatus === NetworkDomainsApiStatus.NoData &&
                <p className="pt-8 font-body text-sm">No data available for the selected app</p>
            }
        </div>
    )
}
