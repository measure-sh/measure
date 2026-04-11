"use client"

import LoadingBar from '@/app/components/loading_bar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { TrendsTab, useNetworkTrendsQuery } from '@/app/query/hooks'
import { numberToKMB } from '@/app/utils/number_utils'
import { underlineLinkStyle } from '@/app/utils/shared_styles'
import { formatMillisToHumanReadable } from '@/app/utils/time_utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface TrendsEndpoint {
    domain: string
    path_pattern: string
    p95_latency: number
    error_rate: number
    frequency: number
}

interface NetworkTrendsData {
    trends_latency: TrendsEndpoint[]
    trends_error_rate: TrendsEndpoint[]
    trends_frequency: TrendsEndpoint[]
}

const emptyTrends: NetworkTrendsData = {
    trends_latency: [],
    trends_error_rate: [],
    trends_frequency: [],
}

function getActiveTabData(trends: NetworkTrendsData, tab: TrendsTab): TrendsEndpoint[] {
    switch (tab) {
        case TrendsTab.Latency:
            return trends.trends_latency
        case TrendsTab.ErrorRate:
            return trends.trends_error_rate
        case TrendsTab.Frequency:
            return trends.trends_frequency
    }
}

const demoEndpoints: TrendsEndpoint[] = [
    { domain: "payments.demo-provider.com", path_pattern: "/*/payment-methods", p95_latency: 2340, error_rate: 0.8, frequency: 32100 },
    { domain: "payments.demo-provider.com", path_pattern: "/*/checkout", p95_latency: 3100, error_rate: 5.7, frequency: 8400 },
    { domain: "payments.demo-provider.com", path_pattern: "/*/refunds", p95_latency: 1780, error_rate: 3.2, frequency: 41300 },
    { domain: "payments.demo-provider.com", path_pattern: "/*/invoices", p95_latency: 890, error_rate: 1.5, frequency: 67500 },
    { domain: "api.demo-provider.com", path_pattern: "/v1/users/*", p95_latency: 1250, error_rate: 2.1, frequency: 84200 },
    { domain: "api.demo-provider.com", path_pattern: "/v1/users/*/profile", p95_latency: 560, error_rate: 4.3, frequency: 18900 },
    { domain: "api.demo-provider.com", path_pattern: "/v2/orders/*/status", p95_latency: 1560, error_rate: 1.8, frequency: 28700 },
    { domain: "api.demo-provider.com", path_pattern: "/v1/notifications", p95_latency: 440, error_rate: 0.9, frequency: 56200 },
    { domain: "api.demo-provider.com", path_pattern: "/v1/products/search", p95_latency: 320, error_rate: 0.3, frequency: 189000 },
    { domain: "api.demo-provider.com", path_pattern: "/v1/events", p95_latency: 180, error_rate: 0.1, frequency: 245000 },
]

function generateDemoTrends(): NetworkTrendsData {
    const byLatency = [...demoEndpoints].sort((a, b) => b.p95_latency - a.p95_latency)
    const byErrorRate = [...demoEndpoints].sort((a, b) => b.error_rate - a.error_rate)
    const byFrequency = [...demoEndpoints].sort((a, b) => b.frequency - a.frequency)
    return {
        trends_latency: byLatency,
        trends_error_rate: byErrorRate,
        trends_frequency: byFrequency,
    }
}

const demoTrends = generateDemoTrends()

interface NetworkTrendsProps {
    teamId?: string
    demo?: boolean
    active?: boolean
}

export default function NetworkTrends({ teamId, demo = false, active = true }: NetworkTrendsProps) {
    const router = useRouter()
    const trendsQuery = useNetworkTrendsQuery(active)

    const [selectedTab, setSelectedTab] = useState<TrendsTab>(TrendsTab.Latency)

    const trends = demo ? demoTrends : (trendsQuery.data ?? emptyTrends)
    const effectiveStatus = (() => {
        if (demo) {
            return 'success' as const
        }
        if (trendsQuery.status === 'success' && trendsQuery.data === null) {
            return 'nodata' as const
        }
        return trendsQuery.status
    })()

    const navigateToEndpoint = (endpoint: TrendsEndpoint) => {
        if (demo || !teamId) return
        router.push(`/${teamId}/network/details?domain=${encodeURIComponent(endpoint.domain)}&path=${encodeURIComponent(endpoint.path_pattern)}`)
    }

    const activeTabData = getActiveTabData(trends, selectedTab)

    const tabButtons = (
        <div className="flex gap-1">
            {Object.values(TrendsTab).map((tab) => (
                <button
                    key={tab}
                    type="button"
                    className={`px-3 py-1.5 text-sm font-display rounded-md cursor-pointer transition-colors ${selectedTab === tab
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                    onClick={() => setSelectedTab(tab)}
                >
                    {tab}
                </button>
            ))}
        </div>
    )

    return (
        <div className="flex flex-col w-full">
            <div className="flex items-start justify-between w-full">
                <div className="flex flex-col">
                    <p className="font-display text-xl">Top Endpoints</p>
                    {!demo && <p className="mt-2 font-body text-xs text-muted-foreground"><Link href="/docs/features/feature-network-monitoring#how-are-endpoint-patterns-generated" className={underlineLinkStyle}>Learn more</Link> about how endpoint patterns are generated</p>}
                </div>
                {effectiveStatus === 'success' && activeTabData.length > 0 && tabButtons}
            </div>
            {effectiveStatus === 'pending' &&
                <div className="w-full" style={{ minHeight: 480 }}>
                    <LoadingBar />
                </div>
            }

            {effectiveStatus === 'success' && activeTabData.length > 0 &&
                <>
                    <div className="py-6" />
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead style={{ width: '55%' }}>Endpoint</TableHead>
                                <TableHead style={{ width: '15%' }}>Latency (p95)</TableHead>
                                <TableHead style={{ width: '15%' }}>Error Rate %</TableHead>
                                <TableHead style={{ width: '15%' }}>Frequency</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activeTabData.map((endpoint, index) => (
                                <TableRow
                                    key={index}
                                    className={demo ? '' : 'cursor-pointer'}
                                    onClick={() => navigateToEndpoint(endpoint)}
                                >
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-mono truncate">{endpoint.domain}{endpoint.path_pattern}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-body">{formatMillisToHumanReadable(endpoint.p95_latency)}</TableCell>
                                    <TableCell className="font-body">{`${endpoint.error_rate}%`}</TableCell>
                                    <TableCell className="font-body">{numberToKMB(endpoint.frequency)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </>
            }

            {(effectiveStatus === 'nodata' ||
                (effectiveStatus === 'success' && activeTabData.length === 0)) &&
                <p className="font-body text-sm mt-4">No data available for the selected filters</p>
            }

            {effectiveStatus === 'error' &&
                <p className="font-body text-sm">Error fetching overview, please change filters & try again</p>
            }
        </div>
    )
}
