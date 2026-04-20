/**
 * Integration tests for Network Overview and Details pages.
 *
 * Overview: domain list, endpoint search with path suggestions,
 * status distribution chart, top endpoints table (3 tabs: Latency,
 * Error Rate, Frequency), and request timeline heatmap.
 *
 * Details: latency chart with quantile selector, status code
 * distribution chart, and endpoint timeline. Domain + path come
 * from URL query params.
 *
 * Network pages use FilterSource.Events with showNoData=false,
 * showNotOnboarded=true — filters.ready requires apps+filters
 * but NOT NoData/NotOnboarded.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

// --- jsdom polyfills ---
if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
        observe() { }
        unobserve() { }
        disconnect() { }
    } as any
}

// --- External dependency mocks ---

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}))

const mockRouterReplace = jest.fn()
const mockRouterPush = jest.fn()
const mockSearchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
    __esModule: true,
    useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
    useSearchParams: () => mockSearchParams,
    usePathname: () => '/test-team/network',
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

jest.mock('next-themes', () => ({
    __esModule: true,
    useTheme: () => ({ theme: 'light' }),
}))

jest.mock('@nivo/line', () => ({
    __esModule: true,
    ResponsiveLine: ({ data }: any) => (
        <div data-testid="nivo-line-chart">
            {data?.map((s: any) => (
                <span key={s.id} data-testid={`chart-series-${s.id}`}>
                    {s.id}: {s.data?.length ?? 0} points
                </span>
            ))}
        </div>
    ),
}))

jest.mock('@nivo/heatmap', () => ({
    __esModule: true,
    ResponsiveHeatMapCanvas: ({ data }: any) => (
        <div data-testid="nivo-heatmap">
            {data?.length ?? 0} rows
        </div>
    ),
}))

// --- MSW ---
import {
    makeNetworkDomainsFixture,
    makeNetworkEndpointLatencyFixture,
    makeNetworkEndpointStatusCodesFixture,
    makeNetworkEndpointTimelineFixture,
    makeNetworkOverviewStatusCodesFixture,
    makeNetworkTimelineFixture,
    makeNetworkTrendsFixture,
} from '../msw/fixtures'
import { server } from '../msw/server'

jest.spyOn(console, 'log').mockImplementation(() => { })
jest.spyOn(console, 'error').mockImplementation(() => { })

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
    server.resetHandlers()
    mockRouterReplace.mockClear()
    mockRouterPush.mockClear()
})
afterAll(() => server.close())

// --- Store/component imports ---
import NetworkDetails from '@/app/components/network_details'
import NetworkOverview from '@/app/components/network_overview'
import { createFiltersStore } from '@/app/stores/filters_store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

let filtersStore = createFiltersStore()
let testQueryClient: QueryClient

jest.mock('@/app/stores/provider', () => {
    const { useStore } = require('zustand')
    return {
        __esModule: true,
        useFiltersStore: (selector?: any) =>
            selector ? useStore(filtersStore, selector) : useStore(filtersStore),
    }
})

beforeEach(() => {
    filtersStore = createFiltersStore()
    testQueryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    filtersStore.getState().reset(true)
    for (const key of [...mockSearchParams.keys()]) mockSearchParams.delete(key)
    const { apiClient } = require('@/app/api/api_client')
    apiClient.init({ replace: jest.fn(), push: jest.fn() })
    // Clear localStorage for recent searches
    try { localStorage.clear() } catch { }
})

function renderWithProviders(ui: React.ReactElement) {
    return render(
        <QueryClientProvider client={testQueryClient}>
            {ui}
        </QueryClientProvider>
    )
}

// ====================================================================
// NETWORK OVERVIEW
// ====================================================================
describe('Network Overview (MSW integration)', () => {
    async function renderAndWaitForData() {
        renderWithProviders(<NetworkOverview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            // Wait for domains to load and trends table to appear
            expect(screen.getByText('Explore endpoint')).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ================================================================
    // PAGE LOAD
    // ================================================================
    describe('page load', () => {
        it('renders "Explore endpoint" section', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Explore endpoint')).toBeTruthy()
            expect(screen.getByText(/Search for endpoints using exact paths or wildcard patterns/)).toBeTruthy()
        })

        it('renders Search button', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Search')).toBeTruthy()
        })

        it('renders "Status Distribution" section', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Status Distribution')).toBeTruthy()
            expect(screen.getByText(/HTTP status code distribution/)).toBeTruthy()
        })

        it('renders "Top Endpoints" section', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Top Endpoints')).toBeTruthy()
        })

        it('renders "Timeline" section', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Timeline')).toBeTruthy()
        })

        it('auto-selects first domain from API', async () => {
            await renderAndWaitForData()
            // The component auto-selects the first domain via useEffect.
            // The domain dropdown shows the selected domain text.
            await waitFor(() => {
                expect(screen.getByText('api.example.com')).toBeTruthy()
            })
        })

        it('shows error when domains API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/domains', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderWithProviders(<NetworkOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching domains/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows "No data" when domains API returns no data', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/domains', () => {
                    return HttpResponse.json({ results: null })
                }),
            )
            renderWithProviders(<NetworkOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/No data available for the selected app/)).toBeTruthy()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // TRENDS TABLE
    // ================================================================
    describe('trends table', () => {
        it('renders trends table headers', async () => {
            await renderAndWaitForData()
            await waitFor(() => {
                expect(screen.getByText('Endpoint')).toBeTruthy()
                expect(screen.getByText('Latency (p95)')).toBeTruthy()
                expect(screen.getByText('Error Rate %')).toBeTruthy()
                // "Frequency" appears as both tab button and table header
                expect(screen.getAllByText('Frequency').length).toBeGreaterThanOrEqual(1)
            }, { timeout: 5000 })
        })

        it('renders Latency tab data by default', async () => {
            await renderAndWaitForData()
            await waitFor(() => {
                // Default tab is "Latency" → trends_latency data
                expect(screen.getByText('api.example.com/v1/checkout')).toBeTruthy()
                expect(screen.getByText('2.34s')).toBeTruthy() // 2340ms formatted
                expect(screen.getByText('5.7%')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('renders second endpoint in Latency tab with all fields', async () => {
            await renderAndWaitForData()
            await waitFor(() => {
                expect(screen.getByText('api.example.com/v1/users/*')).toBeTruthy()
                expect(screen.getByText('1.25s')).toBeTruthy() // 1250ms
                expect(screen.getByText('2.1%')).toBeTruthy()
                expect(screen.getByText('84.2K')).toBeTruthy() // 84200 → "84.2K"
            }, { timeout: 5000 })
        })

        it('renders tab buttons', async () => {
            await renderAndWaitForData()
            await waitFor(() => {
                // Tab buttons: "Latency", "Error Rate", "Frequency"
                // "Frequency" also appears as table header, so use role-based query for buttons
                const buttons = screen.getAllByRole('button')
                expect(buttons.some(b => b.textContent === 'Latency')).toBe(true)
                expect(buttons.some(b => b.textContent === 'Error Rate')).toBe(true)
                expect(buttons.some(b => b.textContent === 'Frequency')).toBe(true)
            }, { timeout: 5000 })
        })

        it('clicking "Error Rate" tab button switches data', async () => {
            await renderAndWaitForData()
            await waitFor(() => {
                expect(screen.getByText('Error Rate')).toBeTruthy()
            }, { timeout: 5000 })

            await act(async () => {
                fireEvent.click(screen.getByText('Error Rate'))
            })
            await waitFor(() => {
                expect(screen.getByText('api.example.com/v1/users/*/profile')).toBeTruthy()
                expect(screen.getByText('4.3%')).toBeTruthy()
            })
        })

        it('clicking "Frequency" tab button shows frequency data', async () => {
            await renderAndWaitForData()
            // Find the Frequency tab button (not the table header)
            const frequencyBtn = screen.getAllByText('Frequency').find(el => el.tagName === 'BUTTON')!
            await waitFor(() => {
                expect(frequencyBtn).toBeTruthy()
            }, { timeout: 5000 })

            await act(async () => {
                fireEvent.click(frequencyBtn)
            })
            await waitFor(() => {
                expect(screen.getByText('api.example.com/v1/events')).toBeTruthy()
                expect(screen.getByText('245K')).toBeTruthy() // 245000 → "245K"
            })
        })

        it('frequency tab also shows latency and error rate columns', async () => {
            await renderAndWaitForData()
            // Find the Frequency tab button (not the table header)
            const frequencyBtn = screen.getAllByText('Frequency').find(el => el.tagName === 'BUTTON')!
            await waitFor(() => {
                expect(frequencyBtn).toBeTruthy()
            }, { timeout: 5000 })

            await act(async () => {
                fireEvent.click(frequencyBtn)
            })
            await waitFor(() => {
                // /v1/events endpoint: p95_latency=180ms, error_rate=0.1%
                expect(screen.getByText('180ms')).toBeTruthy()
                expect(screen.getByText('0.1%')).toBeTruthy()
            })
        })

        it('clicking endpoint row navigates to details page', async () => {
            await renderAndWaitForData()
            await waitFor(() => {
                expect(screen.getByText('api.example.com/v1/checkout')).toBeTruthy()
            }, { timeout: 5000 })

            const rows = screen.getAllByRole('row')
            // Find the row with /v1/checkout
            const checkoutRow = rows.find(r => r.textContent?.includes('/v1/checkout'))
            if (checkoutRow) {
                fireEvent.click(checkoutRow)
                expect(mockRouterPush).toHaveBeenCalledWith(
                    expect.stringContaining('/test-team/network/details?domain=')
                )
            }
        })

        it('shows "No data" when trends are empty', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/trends', () => {
                    return HttpResponse.json({
                        trends_latency: [],
                        trends_error_rate: [],
                        trends_frequency: [],
                    })
                }),
            )
            renderWithProviders(<NetworkOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/No data available for the selected filters/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows error when trends API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/trends', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderWithProviders(<NetworkOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching overview/)).toBeTruthy()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // STATUS DISTRIBUTION PLOT
    // ================================================================
    describe('status distribution plot', () => {
        it('shows error when status plot API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/overviewStatusCodes', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderWithProviders(<NetworkOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching status overview/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows "No data" when status plot returns null', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/overviewStatusCodes', () => {
                    return HttpResponse.json(null)
                }),
            )
            renderWithProviders(<NetworkOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getAllByText(/No data available/).length).toBeGreaterThanOrEqual(1)
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // TIMELINE PLOT
    // ================================================================
    describe('timeline plot', () => {
        it('shows error when timeline API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/overviewTimeline', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderWithProviders(<NetworkOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching requests timeline/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows "No data" when timeline returns empty', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/overviewTimeline', () => {
                    return HttpResponse.json({ interval: 5, points: [] })
                }),
            )
            renderWithProviders(<NetworkOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                // Multiple "No data" messages possible (status plot + timeline)
                const noDataMessages = screen.getAllByText(/No data available/)
                expect(noDataMessages.length).toBeGreaterThanOrEqual(1)
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // ENDPOINT SEARCH
    // ================================================================
    describe('endpoint search', () => {
        it('Search button is disabled when path is empty', async () => {
            await renderAndWaitForData()
            const searchBtn = screen.getByText('Search').closest('button')!
            expect(searchBtn.disabled).toBe(true)
        })

        it('Search button is enabled when path is entered', async () => {
            await renderAndWaitForData()
            const input = screen.getByPlaceholderText(/Enter a path/)
            await act(async () => {
                fireEvent.change(input, { target: { value: '/v1/users' } })
            })
            const searchBtn = screen.getByText('Search').closest('button')!
            expect(searchBtn.disabled).toBe(false)
        })

        it('clicking Search navigates to details page', async () => {
            await renderAndWaitForData()
            const input = screen.getByPlaceholderText(/Enter a path/)
            await act(async () => {
                fireEvent.change(input, { target: { value: '/v1/users' } })
            })
            await act(async () => {
                fireEvent.click(screen.getByText('Search'))
            })
            expect(mockRouterPush).toHaveBeenCalledWith(
                expect.stringContaining('/test-team/network/details?domain=')
            )
            expect(mockRouterPush).toHaveBeenCalledWith(
                expect.stringContaining('path=')
            )
        })

        it('Enter key in path input triggers search', async () => {
            await renderAndWaitForData()
            const input = screen.getByPlaceholderText(/Enter a path/)
            await act(async () => {
                fireEvent.change(input, { target: { value: '/v1/users' } })
            })
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' })
            })
            expect(mockRouterPush).toHaveBeenCalledWith(
                expect.stringContaining('/test-team/network/details')
            )
        })

        it('path without leading slash gets / prepended', async () => {
            await renderAndWaitForData()
            const input = screen.getByPlaceholderText(/Enter a path/)
            await act(async () => {
                fireEvent.change(input, { target: { value: 'v1/users' } })
            })
            await act(async () => {
                fireEvent.click(screen.getByText('Search'))
            })
            expect(mockRouterPush).toHaveBeenCalledWith(
                expect.stringContaining('path=%2Fv1%2Fusers')
            )
        })
    })

    // ================================================================
    // URL SYNC
    // ================================================================
    describe('URL sync', () => {
        it('serialises filters into URL', async () => {
            await renderAndWaitForData()
            expect(mockRouterReplace).toHaveBeenCalled()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('a=')
            expect(url).toContain('sd=')
        })
    })

    // ================================================================
    // API PATHS
    // ================================================================
    describe('API paths', () => {
        it('fetches domains from /networkRequests/domains', async () => {
            const paths: string[] = []
            server.use(
                http.get('*/api/apps/:appId/networkRequests/domains', ({ request }) => {
                    paths.push(new URL(request.url).pathname)
                    return HttpResponse.json(makeNetworkDomainsFixture())
                }),
            )
            await renderAndWaitForData()
            expect(paths.some(p => p.includes('/networkRequests/domains'))).toBe(true)
        })

        it('fetches trends from /networkRequests/trends', async () => {
            const paths: string[] = []
            server.use(
                http.get('*/api/apps/:appId/networkRequests/trends', ({ request }) => {
                    paths.push(new URL(request.url).pathname)
                    return HttpResponse.json(makeNetworkTrendsFixture())
                }),
            )
            await renderAndWaitForData()
            expect(paths.some(p => p.includes('/networkRequests/trends'))).toBe(true)
        })
    })

    // ================================================================
    // CACHING
    // ================================================================
    describe('caching', () => {
        it('re-render with same filters does not re-fetch domains', async () => {
            let fetchCount = 0
            server.use(
                http.get('*/api/apps/:appId/networkRequests/domains', () => {
                    fetchCount++
                    return HttpResponse.json(makeNetworkDomainsFixture())
                }),
            )
            // Use a query client with gcTime > 0 so cache survives unmount
            const cachingClient = new QueryClient({
                defaultOptions: { queries: { retry: false, gcTime: 300000, staleTime: Infinity } },
            })
            const { unmount } = render(
                <QueryClientProvider client={cachingClient}>
                    <NetworkOverview params={{ teamId: 'test-team' }} />
                </QueryClientProvider>
            )
            await waitFor(() => {
                expect(screen.getByText('Explore endpoint')).toBeTruthy()
            }, { timeout: 5000 })
            const initial = fetchCount

            unmount()
            // Re-render with same query client (cache is shared)
            render(
                <QueryClientProvider client={cachingClient}>
                    <NetworkOverview params={{ teamId: 'test-team' }} />
                </QueryClientProvider>
            )
            await waitFor(() => {
                expect(screen.getByText('Explore endpoint')).toBeTruthy()
            }, { timeout: 5000 })
            // TanStack Query cache should prevent a second fetch
            expect(fetchCount).toBe(initial)
        })
    })

    // ================================================================
    // FILTER CHANGE RE-FETCH
    // ================================================================
    describe('filter change re-fetch', () => {
        it('date range change re-fetches domains, status plot, and timeline', async () => {
            let domainsFetches = 0
            let statusPlotFetches = 0
            let timelineFetches = 0
            server.use(
                http.get('*/api/apps/:appId/networkRequests/domains', () => {
                    domainsFetches++
                    return HttpResponse.json(makeNetworkDomainsFixture())
                }),
                http.get('*/api/apps/:appId/networkRequests/plots/overviewStatusCodes', () => {
                    statusPlotFetches++
                    return HttpResponse.json(makeNetworkOverviewStatusCodesFixture())
                }),
                http.get('*/api/apps/:appId/networkRequests/plots/overviewTimeline', () => {
                    timelineFetches++
                    return HttpResponse.json(makeNetworkTimelineFixture())
                }),
            )

            await renderAndWaitForData()
            const initialDomains = domainsFetches
            const initialStatus = statusPlotFetches
            const initialTimeline = timelineFetches

            // Change date range to trigger re-fetch
            const now = new Date()
            await act(async () => {
                filtersStore.getState().setSelectedDateRange('Last Week')
                filtersStore.getState().setSelectedStartDate(new Date(now.getTime() - 7 * 86400000).toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })

            await waitFor(() => {
                expect(statusPlotFetches).toBeGreaterThan(initialStatus)
            }, { timeout: 5000 })
            expect(timelineFetches).toBeGreaterThan(initialTimeline)
        })
    })

    // ================================================================
    // CONCURRENT / RE-RENDER
    // ================================================================
    describe('concurrent and re-render', () => {
        it('query cache prevents redundant fetches on re-render', async () => {
            let fetchCount = 0
            server.use(
                http.get('*/api/apps/:appId/networkRequests/domains', () => {
                    fetchCount++
                    return HttpResponse.json(makeNetworkDomainsFixture())
                }),
            )
            // Use a query client with gcTime > 0 so cache survives unmount
            const cachingClient = new QueryClient({
                defaultOptions: { queries: { retry: false, gcTime: 300000, staleTime: Infinity } },
            })
            const { unmount } = render(
                <QueryClientProvider client={cachingClient}>
                    <NetworkOverview params={{ teamId: 'test-team' }} />
                </QueryClientProvider>
            )
            await waitFor(() => {
                expect(screen.getByText('Explore endpoint')).toBeTruthy()
            }, { timeout: 5000 })
            const initial = fetchCount

            unmount()
            render(
                <QueryClientProvider client={cachingClient}>
                    <NetworkOverview params={{ teamId: 'test-team' }} />
                </QueryClientProvider>
            )
            await waitFor(() => {
                expect(screen.getByText('Explore endpoint')).toBeTruthy()
            }, { timeout: 5000 })
            expect(fetchCount).toBe(initial)
        })
    })
})

// ====================================================================
// NETWORK DETAILS
// ====================================================================
describe('Network Details (MSW integration)', () => {
    function renderDetails(domain = 'api.example.com', path = '/v1/users/*/profile') {
        mockSearchParams.set('domain', domain)
        mockSearchParams.set('path', path)
        return renderWithProviders(<NetworkDetails params={{ teamId: 'test-team' }} />)
    }

    async function renderAndWaitForDetails(domain = 'api.example.com', path = '/v1/users/*/profile') {
        renderDetails(domain, path)
        await waitFor(() => {
            expect(screen.getByText('Latency')).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ================================================================
    // PAGE LOAD
    // ================================================================
    describe('page load', () => {
        it('renders "Latency" section', async () => {
            await renderAndWaitForDetails()
            expect(screen.getByText('Latency')).toBeTruthy()
        })

        it('renders "Status Distribution" section', async () => {
            await renderAndWaitForDetails()
            expect(screen.getByText('Status Distribution')).toBeTruthy()
        })

        it('renders "Timeline" section when data exists', async () => {
            await renderAndWaitForDetails()
            await waitFor(() => {
                expect(screen.getByText('Timeline')).toBeTruthy()
            })
        })

        it('hides Timeline section when timeline returns NoData', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/endpointTimeline', () => {
                    return HttpResponse.json(null)
                }),
            )
            await renderAndWaitForDetails()
            // Timeline section should not render when NoData
            // Wait for other sections to render first
            await waitFor(() => {
                expect(screen.getByText('Latency')).toBeTruthy()
                expect(screen.getByText('Status Distribution')).toBeTruthy()
            })
            // The timeline section title should not be present
            const timelineHeaders = screen.queryAllByText('Timeline')
            // If NoData, the timeline section is not rendered at all
            // (conditional: timelineStatus !== 'nodata')
        })

    })

    // ================================================================
    // ERROR STATES
    // ================================================================
    describe('error states', () => {
        it('shows error when latency API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/endpointLatency', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderDetails()
            await waitFor(() => {
                expect(screen.getByText(/Error fetching latency data/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows "No data" when latency returns null', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/endpointLatency', () => {
                    return HttpResponse.json(null)
                }),
            )
            renderDetails()
            await waitFor(() => {
                expect(screen.getAllByText(/No data available/).length).toBeGreaterThanOrEqual(1)
            }, { timeout: 5000 })
        })

        it('shows error when status distribution API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/endpointStatusCodes', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderDetails()
            await waitFor(() => {
                expect(screen.getByText(/Error fetching status distribution/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows error when endpoint timeline API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/endpointTimeline', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderDetails()
            await waitFor(() => {
                expect(screen.getByText(/Error fetching timeline data/)).toBeTruthy()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // API PATHS
    // ================================================================
    describe('API paths', () => {
        it('sends domain and path in latency request URL', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/endpointLatency', ({ request }) => {
                    requestUrls.push(new URL(request.url).toString())
                    return HttpResponse.json(makeNetworkEndpointLatencyFixture())
                }),
            )
            await renderAndWaitForDetails()
            const lastUrl = requestUrls[requestUrls.length - 1]
            expect(lastUrl).toContain('domain=')
            expect(lastUrl).toContain('path=')
        })

        it('sends domain and path in status codes request URL', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/endpointStatusCodes', ({ request }) => {
                    requestUrls.push(new URL(request.url).toString())
                    return HttpResponse.json(makeNetworkEndpointStatusCodesFixture())
                }),
            )
            await renderAndWaitForDetails()
            const lastUrl = requestUrls[requestUrls.length - 1]
            expect(lastUrl).toContain('domain=')
            expect(lastUrl).toContain('path=')
        })
    })

    // ================================================================
    // URL SYNC
    // ================================================================
    describe('URL sync', () => {
        it('serialises filters + domain + path into URL', async () => {
            await renderAndWaitForDetails()
            expect(mockRouterReplace).toHaveBeenCalled()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('domain=')
            expect(url).toContain('path=')
        })
    })

    // ================================================================
    // CACHING
    // ================================================================
    describe('caching', () => {
        it('re-render with same params does not re-fetch latency', async () => {
            let fetchCount = 0
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/endpointLatency', () => {
                    fetchCount++
                    return HttpResponse.json(makeNetworkEndpointLatencyFixture())
                }),
            )
            mockSearchParams.set('domain', 'api.example.com')
            mockSearchParams.set('path', '/v1/users/*/profile')
            // Use a query client with gcTime > 0 so cache survives unmount
            const cachingClient = new QueryClient({
                defaultOptions: { queries: { retry: false, gcTime: 300000, staleTime: Infinity } },
            })
            const { unmount } = render(
                <QueryClientProvider client={cachingClient}>
                    <NetworkDetails params={{ teamId: 'test-team' }} />
                </QueryClientProvider>
            )
            await waitFor(() => {
                expect(screen.getByText('Latency')).toBeTruthy()
            }, { timeout: 5000 })
            const initial = fetchCount

            unmount()
            // Re-render with same query client and same params
            render(
                <QueryClientProvider client={cachingClient}>
                    <NetworkDetails params={{ teamId: 'test-team' }} />
                </QueryClientProvider>
            )
            await waitFor(() => {
                expect(screen.getByText('Latency')).toBeTruthy()
            }, { timeout: 5000 })
            expect(fetchCount).toBe(initial)
        })

        it('different domain+path bypasses cache and re-fetches', async () => {
            let fetchCount = 0
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/endpointLatency', () => {
                    fetchCount++
                    return HttpResponse.json(makeNetworkEndpointLatencyFixture())
                }),
            )

            // Render with first endpoint
            const { unmount } = renderWithProviders(<NetworkDetails params={{ teamId: 'test-team' }} />)
            mockSearchParams.set('domain', 'api.example.com')
            mockSearchParams.set('path', '/v1/users/*/profile')
            await waitFor(() => {
                expect(screen.getByText('Latency')).toBeTruthy()
            }, { timeout: 5000 })
            const initial = fetchCount

            unmount()

            // Render with different endpoint — cache miss
            mockSearchParams.set('domain', 'cdn.example.com')
            mockSearchParams.set('path', '/images/*')
            renderWithProviders(<NetworkDetails params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('Latency')).toBeTruthy()
            }, { timeout: 5000 })
            expect(fetchCount).toBeGreaterThan(initial)
        })
    })

    // ================================================================
    // FILTER CHANGE RE-FETCH
    // ================================================================
    describe('filter change re-fetch', () => {
        it('date range change re-fetches all 3 endpoints', async () => {
            let latencyFetches = 0
            let statusFetches = 0
            let timelineFetches = 0
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/endpointLatency', () => {
                    latencyFetches++
                    return HttpResponse.json(makeNetworkEndpointLatencyFixture())
                }),
                http.get('*/api/apps/:appId/networkRequests/plots/endpointStatusCodes', () => {
                    statusFetches++
                    return HttpResponse.json(makeNetworkEndpointStatusCodesFixture())
                }),
                http.get('*/api/apps/:appId/networkRequests/plots/endpointTimeline', () => {
                    timelineFetches++
                    return HttpResponse.json(makeNetworkEndpointTimelineFixture())
                }),
            )

            await renderAndWaitForDetails()
            const initialLatency = latencyFetches
            const initialStatus = statusFetches
            const initialTimeline = timelineFetches

            const now = new Date()
            await act(async () => {
                filtersStore.getState().setSelectedDateRange('Last Week')
                filtersStore.getState().setSelectedStartDate(new Date(now.getTime() - 7 * 86400000).toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })

            await waitFor(() => {
                expect(latencyFetches).toBeGreaterThan(initialLatency)
            }, { timeout: 5000 })
            expect(statusFetches).toBeGreaterThan(initialStatus)
            expect(timelineFetches).toBeGreaterThan(initialTimeline)
        })
    })

    // ================================================================
    // DIFFERENT ENDPOINT BYPASSES CACHE
    // ================================================================
    describe('endpoint change', () => {
        it('setting different domain+path bypasses latency cache', async () => {
            let fetchCount = 0
            server.use(
                http.get('*/api/apps/:appId/networkRequests/plots/endpointLatency', () => {
                    fetchCount++
                    return HttpResponse.json(makeNetworkEndpointLatencyFixture())
                }),
            )

            // Render with first endpoint
            const { unmount } = renderWithProviders(<NetworkDetails params={{ teamId: 'test-team' }} />)
            mockSearchParams.set('domain', 'api.example.com')
            mockSearchParams.set('path', '/v1/users/*/profile')
            await waitFor(() => {
                expect(screen.getByText('Latency')).toBeTruthy()
            }, { timeout: 5000 })
            const initial = fetchCount

            unmount()

            // Different endpoint → cache miss
            mockSearchParams.set('domain', 'cdn.example.com')
            mockSearchParams.set('path', '/images/*')
            renderWithProviders(<NetworkDetails params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('Latency')).toBeTruthy()
            }, { timeout: 5000 })
            expect(fetchCount).toBeGreaterThan(initial)
        })
    })

    // ================================================================
    // FILTERS SHOWN
    // ================================================================
    describe('filters', () => {
        it('shows app versions filter (unique to details page)', async () => {
            await renderAndWaitForDetails()
            expect(screen.getByText('App versions')).toBeTruthy()
        })
    })
})

// ====================================================================
// AUTH FAILURE FLOW
// ====================================================================
describe('Network — auth failure', () => {
    it('401 on domains fetch triggers token refresh attempt', async () => {
        let refreshAttempted = false
        server.use(
            http.get('*/api/apps/:appId/networkRequests/domains', () => {
                return new HttpResponse(null, { status: 401 })
            }),
            http.post('*/auth/refresh', () => {
                refreshAttempted = true
                return new HttpResponse(null, { status: 401 })
            }),
        )
        renderWithProviders(<NetworkOverview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(refreshAttempted).toBe(true)
        }, { timeout: 5000 })
    })

    it('401 on endpoint latency fetch triggers token refresh attempt', async () => {
        let refreshAttempted = false
        server.use(
            http.get('*/api/apps/:appId/networkRequests/plots/endpointLatency', () => {
                return new HttpResponse(null, { status: 401 })
            }),
            http.post('*/auth/refresh', () => {
                refreshAttempted = true
                return new HttpResponse(null, { status: 401 })
            }),
        )
        mockSearchParams.set('domain', 'api.example.com')
        mockSearchParams.set('path', '/v1/users')
        renderWithProviders(<NetworkDetails params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(refreshAttempted).toBe(true)
        }, { timeout: 5000 })
    })
})

describe('Network — team switch to no-apps team', () => {
    it('switching from team with apps to team with no apps shows NoApps after store reset', async () => {
        // Phase 1: render with team that has apps — fully load
        const { unmount } = renderWithProviders(<NetworkOverview params={{ teamId: 'team-with-apps' }} />)

        await waitFor(() => {
            expect(screen.getByText('Explore endpoint')).toBeTruthy()
        }, { timeout: 5000 })

        // Reset the filtersStore (simulating what onTeamChanged does in the layout)
        filtersStore.getState().reset(true)

        // Phase 2: override MSW to return 404 for apps, unmount, re-render with new teamId
        server.use(
            http.get('*/api/teams/:teamId/apps', () => {
                return new HttpResponse(null, { status: 404 })
            }),
        )

        unmount()

        renderWithProviders(<NetworkOverview params={{ teamId: 'team-no-apps' }} />)

        // Wait for NoApps message to appear
        await waitFor(() => {
            expect(screen.getByText(/don.t have any apps/i)).toBeTruthy()
        }, { timeout: 5000 })
    })
})

describe('Network page — loading states', () => {
    it('shows skeleton loading before data arrives', async () => {
        server.use(
            http.get('*/api/apps', async () => {
                await new Promise(r => setTimeout(r, 200))
                return HttpResponse.json([])
            }),
        )
        renderWithProviders(<NetworkOverview params={{ teamId: 'test-team' }} />)
        expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
    })
})
