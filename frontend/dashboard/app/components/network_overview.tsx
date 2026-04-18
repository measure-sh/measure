"use client"

import { FilterSource } from '@/app/api/api_calls'

import BetaBadge from '@/app/components/beta_badge'
import { Button } from '@/app/components/button'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import Filters, { AppVersionsInitialSelectionType } from '@/app/components/filters'
import { Input } from '@/app/components/input'
import NetworkStatusDistributionPlot from '@/app/components/network_status_distribution_plot'
import NetworkTimelinePlot, { NetworkTimelineData, NetworkTimelineDataPoint } from '@/app/components/network_timeline_plot'
import NetworkTrends from '@/app/components/network_trends'
import { Skeleton, SkeletonPlot, SkeletonTable } from '@/app/components/skeleton'
import { useNetworkDomainsQuery, useNetworkPathsQuery, useNetworkStatusPlotQuery, useNetworkTimelineQuery } from '@/app/query/hooks'
import { useFiltersStore } from '@/app/stores/provider'
import { addRecentSearch, getRecentSearchesForDomain, removeRecentSearch } from '@/app/utils/network_recent_searches'
import { underlineLinkStyle } from '@/app/utils/shared_styles'
import { getPlotTimeGroupForRange } from '@/app/utils/time_utils'
import { History } from 'lucide-react'
import { DateTime } from 'luxon'
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

export default function NetworkOverview({ params, demo = false, hideDemoTitle = false }: NetworkOverviewProps) {
    const router = useRouter()
    const filters = useFiltersStore(state => state.filters)

    const domainsQuery = useNetworkDomainsQuery()

    const [searchDomain, setSearchDomain] = useState("")
    const [searchPathPattern, setSearchPathPattern] = useState("")

    const pathsQuery = useNetworkPathsQuery(searchDomain, searchPathPattern)
    const statusPlotQuery = useNetworkStatusPlotQuery()
    const timelineQuery = useNetworkTimelineQuery()

    // In demo mode, use static data instead of store data
    const domainsStatus = demo ? 'success' as const : domainsQuery.status === 'success' && domainsQuery.data === null ? 'nodata' as const : domainsQuery.status
    const domains = demo ? ["payments.demo-provider.com", "api.demo-provider.com", "cdn.demo-provider.com"] : (domainsQuery.data ?? [])
    const statusPlotStatus = demo ? 'success' as const : statusPlotQuery.status === 'success' && statusPlotQuery.data === null ? 'nodata' as const : statusPlotQuery.status
    const statusPlotData = demo ? demoStatusData : (statusPlotQuery.data ?? [])
    const timelinePlotStatus = demo ? 'success' as const : timelineQuery.status === 'success' && timelineQuery.data === null ? 'nodata' as const : timelineQuery.status
    const timelinePlotData = demo ? demoTimelineData : (timelineQuery.data ?? null)
    const paths = pathsQuery.data ?? []

    const [showSuggestions, setShowSuggestions] = useState(false)
    const [recentPaths, setRecentPaths] = useState<string[]>([])

    const plotTimeGroup = demo ? "days" : getPlotTimeGroupForRange(filters.startDate, filters.endDate)
    const shouldRenderStatusPlot = demo
        ? true
        : statusPlotStatus === 'success' && statusPlotData.length > 0
    const shouldRenderTimeline = demo
        ? true
        : timelinePlotStatus === 'success' && timelinePlotData !== null && timelinePlotData.points.length > 0

    // Auto-select first domain when domains load
    useEffect(() => {
        if (!demo && domainsQuery.status === 'success' && domainsQuery.data && domainsQuery.data.length > 0 && searchDomain === "") {
            setSearchDomain(domainsQuery.data[0])
            setSearchPathPattern("")
        }
    }, [domainsQuery.status, domainsQuery.data])

    const handleSearch = () => {
        if (demo) return
        if (searchPathPattern.trim() === "") return
        const path = searchPathPattern.startsWith('/') ? searchPathPattern : '/' + searchPathPattern
        const domain = searchDomain.endsWith('/') ? searchDomain.slice(0, -1) : searchDomain
        addRecentSearch(params!.teamId, domain, path)
        router.push(`/${params!.teamId}/network/details?domain=${encodeURIComponent(domain)}&path=${encodeURIComponent(path)}`)
    }

    // Sync filters to URL
    useEffect(() => {
        if (demo) return
        if (!filters.ready) return
        router.replace(`?${filters.serialisedFilters!}`, { scroll: false })
    }, [filters.ready, filters.serialisedFilters])

    // Update recent paths when domain or pattern changes
    useEffect(() => {
        if (demo) return
        if (searchDomain) {
            setRecentPaths(getRecentSearchesForDomain(params!.teamId, searchDomain, searchPathPattern))
        } else {
            setRecentPaths([])
        }
    }, [searchDomain, searchPathPattern])

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
                />
            )}

            {!demo && (filters.loading || (filters.ready && domainsStatus === 'pending')) &&
                <div className="flex flex-col w-full">
                    {/* Explore endpoint */}
                    <div className="py-8" />
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-3 w-96 mt-2" />
                    <div className="py-2" />
                    <div className="flex flex-row items-center w-full gap-2">
                        <Skeleton className="h-9 w-[150px]" />
                        <Skeleton className="h-9 flex-1" />
                        <Skeleton className="h-9 w-20" />
                    </div>

                    {/* Status Distribution */}
                    <div className="py-8" />
                    <Skeleton className="h-6 w-44" />
                    <Skeleton className="h-3 w-80 mt-2" />
                    <div className="py-4" />
                    <div className="flex font-body items-center justify-center w-full h-[36rem]">
                        <SkeletonPlot />
                    </div>

                    {/* Top Endpoints */}
                    <div className="py-8" />
                    <Skeleton className="h-6 w-36" />
                    <Skeleton className="h-3 w-64 mt-2" />
                    <SkeletonTable rows={5} columns={5} />

                    {/* Timeline */}
                    <div className="py-10" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-3 w-72 mt-2" />
                    <div className="flex font-body items-center justify-center w-full h-[36rem]">
                        <SkeletonPlot />
                    </div>
                </div>
            }

            {(demo || (filters.ready &&
                domainsStatus === 'success')) &&
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
                                    items={domains}
                                    initialSelected={domainsStatus === 'pending' ? "Loading..." : searchDomain}
                                    onChangeSelected={(item) => {
                                        setSearchDomain(item as string)
                                        setSearchPathPattern("")
                                    }}
                                    disabled={domainsStatus !== 'success'}
                                />
                                <div className="px-2" />
                                <div className="relative flex-1">
                                    <Input
                                        type="text"
                                        placeholder="Enter a path like /v1/users/*/profile"
                                        className="w-full font-body"
                                        value={searchPathPattern}
                                        onChange={(e) => {
                                            setSearchPathPattern(e.target.value.replace(/\s/g, ''))
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
                                    {showSuggestions && (recentPaths.length > 0 || paths.length > 0) && (
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
                                                                    setSearchPathPattern(path)
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
                                                                    removeRecentSearch(params!.teamId, searchDomain, path)
                                                                    setRecentPaths(prev => prev.filter(p => p !== path))
                                                                }}
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                            {paths.length > 0 && (
                                                <div className={recentPaths.length > 0 ? "mt-4" : ""}>
                                                    {paths.map((path) => (
                                                        <button
                                                            key={`suggestion-${path}`}
                                                            type="button"
                                                            className="w-full px-2 py-1.5 text-left text-sm font-display rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault()
                                                                setSearchPathPattern(path)
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
                                    disabled={searchPathPattern.trim() === "" || domainsStatus !== 'success'}
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
                            {(statusPlotStatus === 'pending' || (statusPlotStatus === 'success' && !shouldRenderStatusPlot)) && <SkeletonPlot />}
                            {shouldRenderStatusPlot &&
                                <NetworkStatusDistributionPlot data={statusPlotData} plotTimeGroup={plotTimeGroup} />
                            }
                            {statusPlotStatus === 'nodata' &&
                                <p className="font-body text-sm">No data available for the selected filters</p>
                            }
                            {statusPlotStatus === 'error' &&
                                <p className="font-body text-sm">Error fetching status overview, please change filters & try again</p>
                            }
                        </div>
                    </div>

                    <div className="py-8" />

                    {/* Top Endpoints Section */}
                    <div className="w-full">
                        <NetworkTrends
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
                            <NetworkTimelinePlot data={timelinePlotData!} />
                        </div>}
                        {!shouldRenderTimeline && <div className="flex font-body items-center justify-center w-full h-[36rem]">
                            {timelinePlotStatus === 'pending' && <SkeletonPlot />}
                            {(timelinePlotStatus === 'nodata' || (timelinePlotStatus === 'success')) &&
                                <p className="font-body text-sm">No data available for the selected filters</p>
                            }
                            {timelinePlotStatus === 'error' &&
                                <p className="font-body text-sm">Error fetching requests timeline, please change filters & try again</p>
                            }
                        </div>}
                    </div>
                </>
            }
            {!demo && domainsStatus === 'error' &&
                <p className="pt-8 font-body text-sm">Error fetching domains, please change filters & try again</p>
            }
            {!demo && domainsStatus === 'nodata' &&
                <p className="pt-8 font-body text-sm">No data available for the selected app</p>
            }
        </div>
    )
}
