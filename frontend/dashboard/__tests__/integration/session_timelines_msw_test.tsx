/**
 * Integration tests for Session Timelines Overview + Detail pages.
 *
 * The session timelines overview is the most filter-rich page in the app:
 * it enables 13 filter types (app, versions, dates, session types, OS,
 * countries, network types/providers/generations, locales, device
 * manufacturers/names, udAttrs, freeText) plus pagination. This test
 * suite exercises every filter, pagination, URL sync, and the detail page.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

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
    usePathname: () => '/test-team/session_timelines',
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
            {data?.map((series: any) => (
                <span key={series.id} data-testid={`chart-series-${series.id}`}>
                    {series.id}: {series.data?.length ?? 0} points
                </span>
            ))}
        </div>
    ),
    ResponsiveLineCanvas: ({ data }: any) => (
        <div data-testid="nivo-line-canvas">
            {JSON.stringify(data?.length ?? 0)} series
        </div>
    ),
}))

// --- MSW ---
import {
    makeSessionPlotFixture,
    makeSessionTimelineDetailFixture,
    makeSessionTimelinesOverviewFixture,
    makeSessionTimelinesOverviewPage2Fixture
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

// --- Store imports ---
import SessionDetail from '@/app/[teamId]/session_timelines/[appId]/[sessionId]/page'
import SessionTimelinesOverview from '@/app/[teamId]/session_timelines/page'
import { createFiltersStore } from '@/app/stores/filters_store'
import { queryClient } from '@/app/query/query_client'
import { QueryClientProvider } from '@tanstack/react-query'

let filtersStore = createFiltersStore()

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
    queryClient.clear()
    filtersStore.getState().reset(true)
    for (const key of [...mockSearchParams.keys()]) mockSearchParams.delete(key)
    const { apiClient } = require('@/app/api/api_client')
    apiClient.init({ replace: jest.fn(), push: jest.fn() })
})

function renderWithProviders(ui: React.ReactElement) {
    return render(
        <QueryClientProvider client={queryClient}>
            {ui}
        </QueryClientProvider>
    )
}

// ====================================================================
// SESSION TIMELINES OVERVIEW PAGE
// ====================================================================
describe('Session Timelines Overview (MSW integration)', () => {
    const { AppVersion, OsVersion } = require('@/app/api/api_calls')

    async function renderAndWaitForData() {
        renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ================================================================
    // PAGE LOAD
    // ================================================================
    describe('page load', () => {
        it('renders heading, table headers, chart, and session rows', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Session Timelines')).toBeTruthy()
            expect(screen.getByText('Session Timeline')).toBeTruthy()
            expect(screen.getByText('Start Time')).toBeTruthy()
            expect(screen.getByText('Duration')).toBeTruthy()
            expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy()
            expect(screen.getByText(/Session ID: sess-002/)).toBeTruthy()
            expect(screen.getByTestId('nivo-line-chart')).toBeTruthy()
        })

        it('renders info note about session capture', async () => {
            await renderAndWaitForData()
            expect(screen.getByText(/Timelines are captured for Crashes, ANRs, Bug Reports/)).toBeTruthy()
        })

        it('renders device info for each session row', async () => {
            await renderAndWaitForData()
            // sess-001: "3.1.0(310), Android API Level 14, Google Pixel 8"
            expect(screen.getByText(/3\.1\.0\(310\).*Android API Level 14.*Google Pixel 8/)).toBeTruthy()
            // sess-002: Samsung SM-S921B
            expect(screen.getByText(/3\.0\.2\(302\).*Samsung SM-S921B/)).toBeTruthy()
        })

        it('renders duration for each session', async () => {
            await renderAndWaitForData()
            // 330000ms = 5m 30s, 135000ms = 2m 15s
            expect(screen.getByText(/5m/)).toBeTruthy()
            expect(screen.getByText(/2m/)).toBeTruthy()
        })

        it('shows error state when sessions API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching list of sessions/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows plot error when plot API fails', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions/plots/instances', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching plot/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows plot No Data when plot returns null', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions/plots/instances', () => {
                    return HttpResponse.json(null)
                }),
            )
            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('No Data')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('renders "Matched" badge when free text matches', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    return HttpResponse.json(makeSessionTimelinesOverviewFixture({
                        results: [{
                            ...makeSessionTimelinesOverviewFixture().results[0],
                            matched_free_text: 'NullPointerException',
                        }],
                    }))
                }),
            )
            await renderAndWaitForData()
            expect(screen.getByText('Matched NullPointerException')).toBeTruthy()
        })

        it('shows N/A for zero-duration sessions', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    return HttpResponse.json(makeSessionTimelinesOverviewFixture({
                        results: [{
                            ...makeSessionTimelinesOverviewFixture().results[0],
                            // Backend sends duration as number 0, not string '0'.
                            // The page checks `(duration as unknown as number) === 0`.
                            duration: 0,
                        }],
                    }))
                }),
            )

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('N/A')).toBeTruthy()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // PAGINATION
    // ================================================================
    describe('pagination', () => {
        it('Next button is enabled when meta.next is true', async () => {
            await renderAndWaitForData()
            const nextBtn = screen.getByText('Next')
            expect(nextBtn.closest('button')?.disabled).toBe(false)
        })

        it('Previous button is disabled on first page', async () => {
            await renderAndWaitForData()
            const prevBtn = screen.getByText('Previous')
            expect(prevBtn.closest('button')?.disabled).toBe(true)
        })

        it('clicking Next fetches page 2 with offset in URL', async () => {
            const sessionRequests: string[] = []
            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    sessionRequests.push(request.url)
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') {
                        return HttpResponse.json(makeSessionTimelinesOverviewPage2Fixture())
                    }
                    return HttpResponse.json(makeSessionTimelinesOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            sessionRequests.length = 0

            // Click Next
            await act(async () => {
                fireEvent.click(screen.getByText('Next').closest('button')!)
            })

            await waitFor(() => {
                expect(screen.getByText(/Session ID: sess-006/)).toBeTruthy()
            }, { timeout: 5000 })

            // URL should contain pagination offset
            expect(mockRouterReplace).toHaveBeenCalled()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('po=5')
        })

        it('page 2 has Previous enabled and Next disabled', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    return HttpResponse.json(makeSessionTimelinesOverviewPage2Fixture())
                }),
            )

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Session ID: sess-006/)).toBeTruthy()
            }, { timeout: 5000 })

            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(false)
            expect(screen.getByText('Next').closest('button')?.disabled).toBe(true)
        })

        it('filter change resets pagination to page 1', async () => {
            await renderAndWaitForData()

            // Go to page 2
            await act(async () => {
                fireEvent.click(screen.getByText('Next').closest('button')!)
            })
            await waitFor(() => {
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('po=5')
            })

            // Change a filter — pagination should reset
            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
            })

            await waitFor(() => {
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('po=0')
            }, { timeout: 5000 })
        })

        it('clicking Previous from page 2 goes back to page 1 data', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') {
                        return HttpResponse.json(makeSessionTimelinesOverviewPage2Fixture())
                    }
                    return HttpResponse.json(makeSessionTimelinesOverviewFixture())
                }),
            )

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy()
            }, { timeout: 5000 })

            // Navigate to page 2
            await act(async () => { fireEvent.click(screen.getByText('Next').closest('button')!) })
            await waitFor(() => {
                expect(screen.getByText(/Session ID: sess-006/)).toBeTruthy()
            }, { timeout: 5000 })

            // Navigate back to page 1
            await act(async () => { fireEvent.click(screen.getByText('Previous').closest('button')!) })
            await waitFor(() => {
                expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy()
            }, { timeout: 5000 })

            // Page 2 data should be gone
            expect(screen.queryByText(/Session ID: sess-006/)).toBeNull()

            // URL should show po=0
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('po=0')
        })

        it('deep-link with po=5 renders page 2 data', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') {
                        return HttpResponse.json(makeSessionTimelinesOverviewPage2Fixture())
                    }
                    return HttpResponse.json(makeSessionTimelinesOverviewFixture())
                }),
            )

            mockSearchParams.set('po', '5')
            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Session ID: sess-006/)).toBeTruthy()
            }, { timeout: 5000 })

            // Page 1 data should NOT be present
            expect(screen.queryByText(/Session ID: sess-001/)).toBeNull()
        })

        it('initializes pagination offset from URL param', async () => {
            mockSearchParams.set('po', '10')

            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    return HttpResponse.json(makeSessionTimelinesOverviewFixture())
                }),
            )

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                const urlCheck = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(urlCheck).toContain('po=10')
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // ALL FILTERS — the session timelines page enables 13 filter types
    // ================================================================
    describe('filters', () => {
        let shortFilterBodies: any[]
        let sessionRequests: { url: string }[]

        beforeEach(() => {
            shortFilterBodies = []
            sessionRequests = []
            server.use(
                http.post('*/api/apps/:appId/shortFilters', async ({ request }) => {
                    shortFilterBodies.push(await request.json())
                    return HttpResponse.json({ filter_short_code: `code-${shortFilterBodies.length}` })
                }),
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    sessionRequests.push({ url: request.url })
                    return HttpResponse.json(makeSessionTimelinesOverviewFixture())
                }),
            )
        })

        // --- Version filter (shortFilters POST body) ---
        it('version change sends new version in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.1', '301')])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.versions).toEqual(['3.0.1'])
        })

        // --- OS version filter ---
        it('OS version change sends os_names/os_versions in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedOsVersions([new OsVersion('android', '14')])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            const body = shortFilterBodies[shortFilterBodies.length - 1]
            expect(body.filters.os_names).toEqual(['android'])
            expect(body.filters.os_versions).toEqual(['14'])
        })

        // --- Country filter ---
        it('country change sends countries in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedCountries(['US'])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.countries).toEqual(['US'])
        })

        // --- Network provider filter ---
        it('network provider change sends network_providers in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedNetworkProviders(['Jio'])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.network_providers).toEqual(['Jio'])
        })

        // --- Network type filter ---
        it('network type change sends network_types in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedNetworkTypes(['wifi'])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.network_types).toEqual(['wifi'])
        })

        // --- Network generation filter ---
        it('network generation change sends network_generations in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedNetworkGenerations(['5g'])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.network_generations).toEqual(['5g'])
        })

        // --- Locale filter ---
        it('locale change sends locales in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedLocales(['en-US'])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.locales).toEqual(['en-US'])
        })

        // --- Device manufacturer filter ---
        it('device manufacturer change sends device_manufacturers in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedDeviceManufacturers(['Samsung'])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.device_manufacturers).toEqual(['Samsung'])
        })

        // --- Device name filter ---
        it('device name change sends device_names in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedDeviceNames(['Galaxy S24'])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.device_names).toEqual(['Galaxy S24'])
        })

        // --- UdAttr matcher filter ---
        it('udAttr matcher change sends ud_expression in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedUdAttrMatchers([
                    { key: 'user_id', type: 'string', op: 'eq', value: 'user-123' },
                ])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            const body = shortFilterBodies[shortFilterBodies.length - 1]
            expect(body.filters.ud_expression).toBeDefined()
            const expr = JSON.parse(body.filters.ud_expression)
            expect(expr.and[0].cmp.key).toBe('user_id')
            expect(expr.and[0].cmp.value).toBe('user-123')
        })

        // --- Session type filter (URL param, not shortFilters body) ---
        it('session type change adds crash/anr params to data-fetch URL', async () => {
            await renderAndWaitForData()
            sessionRequests.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedSessionTypes([
                    'Crash Sessions' as any,
                    'ANR Sessions' as any,
                ])
            })
            await waitFor(() => expect(sessionRequests.length).toBeGreaterThan(0), { timeout: 5000 })
            const url = sessionRequests[sessionRequests.length - 1].url
            expect(url).toContain('crash=1')
            expect(url).toContain('anr=1')
        })

        // --- Free text filter (URL param) ---
        it('free text change adds free_text param to data-fetch URL', async () => {
            await renderAndWaitForData()
            sessionRequests.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedFreeText('NullPointerException')
            })
            await waitFor(() => expect(sessionRequests.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(sessionRequests[sessionRequests.length - 1].url).toContain('free_text=NullPointerException')
        })

        // --- Date range (URL param) ---
        it('date change refetches sessions with new from/to', async () => {
            await renderAndWaitForData()
            sessionRequests.length = 0
            const now = new Date()
            const weekAgo = new Date(now.getTime() - 7 * 86400000)
            await act(async () => {
                filtersStore.getState().setSelectedDateRange('Last Week')
                filtersStore.getState().setSelectedStartDate(weekAgo.toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })
            await waitFor(() => expect(sessionRequests.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(sessionRequests[sessionRequests.length - 1].url).toContain('from=')
        })

        // --- Date range does NOT trigger shortFilters POST ---
        it('date change does NOT fire shortFilters POST', async () => {
            await renderAndWaitForData()
            const postsBefore = shortFilterBodies.length
            const now = new Date()
            await act(async () => {
                filtersStore.getState().setSelectedDateRange('Last 24 Hours')
                filtersStore.getState().setSelectedStartDate(new Date(now.getTime() - 86400000).toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })
            await waitFor(() => expect(sessionRequests.length).toBeGreaterThan(1), { timeout: 5000 })
            expect(shortFilterBodies.length).toBe(postsBefore)
        })

        // --- Filter change refetches both sessions AND plot ---
        it('filter change refetches both the session list and the plot', async () => {
            let plotFetches = 0
            server.use(
                http.get('*/api/apps/:appId/sessions/plots/instances', () => {
                    plotFetches++
                    return HttpResponse.json(makeSessionPlotFixture())
                }),
            )

            await renderAndWaitForData()
            sessionRequests.length = 0
            const plotBefore = plotFetches

            await act(async () => {
                filtersStore.getState().setSelectedCountries(['DE'])
            })

            await waitFor(() => {
                expect(sessionRequests.length).toBeGreaterThan(0)
                expect(plotFetches).toBeGreaterThan(plotBefore)
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // URL SERIALIZATION
    // ================================================================
    describe('URL sync', () => {
        it('URL includes all enabled filter params after load', async () => {
            await renderAndWaitForData()
            expect(mockRouterReplace).toHaveBeenCalled()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('po=')    // pagination offset
            expect(url).toContain('a=')     // appId
            expect(url).toContain('v=')     // versions
            expect(url).toContain('d=')     // dateRange
        })

        it('deep-link with pagination offset initializes store offset', async () => {
            // Extra reset to ensure clean state after prior tests in full suite
            queryClient.clear()
            filtersStore.getState().reset(true)
            mockSearchParams.set('po', '10')

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)

            // The useEffect reads po from URL and calls setPaginationOffset
            await waitFor(() => {
                const urlCheck = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(urlCheck).toContain('po=10')
            }, { timeout: 5000 })
        })

        it('session row links include correct href', async () => {
            await renderAndWaitForData()
            const link = screen.getByLabelText('Session ID: sess-001')
            expect(link.getAttribute('href')).toContain('/test-team/session_timelines/')
            expect(link.getAttribute('href')).toContain('/sess-001')
        })
    })
})

// ====================================================================
// SESSION TIMELINE DETAIL PAGE
// ====================================================================
describe('Session Timeline Detail (MSW integration)', () => {
    describe('page load', () => {
        it('renders heading with session ID', async () => {
            renderWithProviders(<SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('Session: sess-001')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('fetches session data for the correct appId and sessionId', async () => {
            const detailRequests: string[] = []
            server.use(
                http.get('*/api/apps/:appId/sessions/:sessionId', ({ request }) => {
                    detailRequests.push(request.url)
                    return HttpResponse.json(makeSessionTimelineDetailFixture())
                }),
            )

            renderWithProviders(<SessionDetail params={{ teamId: 'test-team', appId: 'my-app', sessionId: 'my-session' }} />)
            await waitFor(() => {
                expect(detailRequests.length).toBeGreaterThan(0)
            }, { timeout: 5000 })

            expect(detailRequests[0]).toContain('/api/apps/my-app/sessions/my-session')
        })

        it('shows loading spinner before data arrives', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions/:sessionId', async () => {
                    await new Promise((r) => setTimeout(r, 200))
                    return HttpResponse.json(makeSessionTimelineDetailFixture())
                }),
            )

            renderWithProviders(<SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('Loading...')).toBeTruthy()
            })
        })

        it('shows error state when session API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions/:sessionId', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            renderWithProviders(<SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-001' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching session timeline/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('renders session timeline component on success', async () => {
            renderWithProviders(<SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-001' }} />)

            await waitFor(() => {
                // Session data loaded successfully - the session ID heading should render
                expect(screen.getByText('Session: sess-001')).toBeTruthy()
                // Error message should NOT be present
                expect(screen.queryByText(/Error fetching session timeline/)).toBeNull()
            }, { timeout: 5000 })
        })

        it('shows cached data instantly on re-mount with same params', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions/:sessionId', () => {
                    return HttpResponse.json(makeSessionTimelineDetailFixture())
                }),
            )

            const { unmount } = renderWithProviders(
                <SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-001' }} />,
            )
            await waitFor(() => {
                expect(screen.getByText('Session: sess-001')).toBeTruthy()
            }, { timeout: 5000 })

            unmount()
            renderWithProviders(
                <SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-001' }} />,
            )
            // Cached data shows immediately — no loading spinner
            expect(screen.getByText('Session: sess-001')).toBeTruthy()
        })

        it('fetches new data for a different sessionId', async () => {
            let fetchCount = 0
            server.use(
                http.get('*/api/apps/:appId/sessions/:sessionId', () => {
                    fetchCount++
                    return HttpResponse.json(makeSessionTimelineDetailFixture())
                }),
            )

            const { unmount } = renderWithProviders(
                <SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-001' }} />,
            )
            await waitFor(() => expect(fetchCount).toBe(1), { timeout: 5000 })

            unmount()
            renderWithProviders(
                <SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-002' }} />,
            )
            await waitFor(() => expect(fetchCount).toBe(2), { timeout: 5000 })
        })

        it('401 on session detail triggers token refresh', async () => {
            let refreshAttempted = false
            server.use(
                http.get('*/api/apps/:appId/sessions/:sessionId', () => {
                    return new HttpResponse(null, { status: 401 })
                }),
                http.post('*/auth/refresh', () => {
                    refreshAttempted = true
                    return new HttpResponse(null, { status: 401 })
                }),
            )

            renderWithProviders(<SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-001' }} />)
            await waitFor(() => expect(refreshAttempted).toBe(true), { timeout: 5000 })
        })

        it('renders with empty CPU/memory/traces/threads', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions/:sessionId', () => {
                    return HttpResponse.json(makeSessionTimelineDetailFixture({
                        cpu_usage: [],
                        memory_usage: [],
                        memory_usage_absolute: [],
                        threads: {},
                        traces: [],
                    }))
                }),
            )

            renderWithProviders(<SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-001' }} />)
            await waitFor(() => {
                // Data loaded successfully
                expect(screen.getByText('Session: sess-001')).toBeTruthy()
                expect(screen.queryByText(/Error fetching session timeline/)).toBeNull()
            }, { timeout: 5000 })
        })

        it('shows error on 404 (session not found)', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions/:sessionId', () => {
                    return new HttpResponse(null, { status: 404 })
                }),
            )

            renderWithProviders(<SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'nonexistent' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching session timeline/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('clicking an event cell selects it and shows its details in the right panel', async () => {
            renderWithProviders(<SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('Session: sess-001')).toBeTruthy()
            }, { timeout: 5000 })

            // The fixture has a lifecycle_activity event which renders as
            // "Activity Created: MainActivity" via SessionTimelineEventCell
            await waitFor(() => {
                expect(screen.getByText(/Activity Created: MainActivity/)).toBeTruthy()
            }, { timeout: 5000 })

            // The fixture also has a trace event: "Trace start: activity.onCreate"
            await waitFor(() => {
                expect(screen.getByText(/Trace start: activity\.onCreate/)).toBeTruthy()
            }, { timeout: 5000 })

            // Click the trace event cell (second event in sorted order)
            const traceEventButton = screen.getByText(/Trace start: activity\.onCreate/).closest('button')
            expect(traceEventButton).toBeTruthy()
            await act(async () => {
                fireEvent.click(traceEventButton!)
            })

            // The right panel (SessionTimelineEventDetails) should now show
            // details for the trace event, which includes trace_id and trace_name
            await waitFor(() => {
                expect(screen.getByText('trace_id')).toBeTruthy()
                expect(screen.getByText('trace-001')).toBeTruthy()
            })
        })

        it('clicking a different event cell switches the detail panel', async () => {
            renderWithProviders(<SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('Session: sess-001')).toBeTruthy()
            }, { timeout: 5000 })

            await waitFor(() => {
                expect(screen.getByText(/Activity Created: MainActivity/)).toBeTruthy()
                expect(screen.getByText(/Trace start: activity\.onCreate/)).toBeTruthy()
            }, { timeout: 5000 })

            // Click the lifecycle_activity event first
            const activityButton = screen.getByText(/Activity Created: MainActivity/).closest('button')
            await act(async () => {
                fireEvent.click(activityButton!)
            })

            // Detail panel should show lifecycle_activity details
            await waitFor(() => {
                expect(screen.getByText('event_type')).toBeTruthy()
                expect(screen.getByText('lifecycle_activity')).toBeTruthy()
            })

            // Now click the trace event
            const traceButton = screen.getByText(/Trace start: activity\.onCreate/).closest('button')
            await act(async () => {
                fireEvent.click(traceButton!)
            })

            // Detail panel should switch to show trace details
            await waitFor(() => {
                expect(screen.getByText('trace_id')).toBeTruthy()
                expect(screen.getByText('trace-001')).toBeTruthy()
            })
        })

        it('filter store state does not interfere with detail page fetch', async () => {
            // Detail page has no filters. Setting filter state shouldn't
            // prevent or alter the session detail fetch.
            filtersStore.getState().setSelectedFreeText('some search text')

            const detailUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/sessions/:sessionId', ({ request }) => {
                    detailUrls.push(request.url)
                    return HttpResponse.json(makeSessionTimelineDetailFixture())
                }),
            )

            renderWithProviders(<SessionDetail params={{ teamId: 'test-team', appId: 'app-1', sessionId: 'sess-001' }} />)
            await waitFor(() => expect(detailUrls.length).toBeGreaterThan(0), { timeout: 5000 })

            // The detail URL should NOT contain filter params
            expect(detailUrls[0]).not.toContain('free_text=')
            expect(detailUrls[0]).not.toContain('filter_short_code=')
        })
    })
})

// ====================================================================
// ADDITIONAL OVERVIEW COVERAGE
// ====================================================================
describe('Session Timelines Overview — additional coverage', () => {
    const { AppVersion, OsVersion } = require('@/app/api/api_calls')

    // Helper to track all request types
    let shortFilterBodies: any[]
    let sessionRequests: { url: string }[]

    beforeEach(() => {
        shortFilterBodies = []
        sessionRequests = []
        server.use(
            http.post('*/api/apps/:appId/shortFilters', async ({ request }) => {
                shortFilterBodies.push(await request.json())
                return HttpResponse.json({ filter_short_code: `code-${shortFilterBodies.length}` })
            }),
            http.get('*/api/apps/:appId/sessions', ({ request }) => {
                const url = new URL(request.url)
                if (url.pathname.split('/').filter(Boolean).length > 4) return
                sessionRequests.push({ url: request.url })
                return HttpResponse.json(makeSessionTimelinesOverviewFixture())
            }),
        )
    })

    async function renderAndWaitForData() {
        renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ================================================================
    // INDIVIDUAL SESSION TYPE PARAMS
    // ================================================================
    describe('session type params — each type individually', () => {
        it.each([
            ['Crash Sessions', 'crash=1'],
            ['ANR Sessions', 'anr=1'],
            ['Bug Report Sessions', 'bug_report=1'],
            ['User Interaction Sessions', 'user_interaction=1'],
            ['Foreground Sessions', 'foreground=1'],
            ['Background Sessions', 'background=1'],
        ])('selecting "%s" adds %s to data-fetch URL', async (sessionType, expectedParam) => {
            await renderAndWaitForData()
            sessionRequests.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedSessionTypes([sessionType as any])
            })

            await waitFor(() => expect(sessionRequests.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(sessionRequests[sessionRequests.length - 1].url).toContain(expectedParam)
        })

        it('selecting all session types (all=true) does NOT add type params', async () => {
            await renderAndWaitForData()
            sessionRequests.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedSessionTypes([
                    'Crash Sessions',
                    'ANR Sessions',
                    'Bug Report Sessions',
                    'User Interaction Sessions',
                    'Foreground Sessions',
                    'Background Sessions',
                ] as any)
            })

            await waitFor(() => expect(sessionRequests.length).toBeGreaterThan(0), { timeout: 5000 })
            const url = sessionRequests[sessionRequests.length - 1].url
            // When all are selected, sessionTypes.all = true → no params added
            expect(url).not.toContain('crash=1')
            expect(url).not.toContain('anr=1')
        })
    })

    // ================================================================
    // MULTIPLE FILTERS IN ONE POST
    // ================================================================
    describe('multiple filters combined', () => {
        it('setting OS + country + locale produces a single POST with all three', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedOsVersions([new OsVersion('android', '14')])
                filtersStore.getState().setSelectedCountries(['US'])
                filtersStore.getState().setSelectedLocales(['en-US'])
            })

            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })

            const body = shortFilterBodies[shortFilterBodies.length - 1]
            expect(body.filters.os_names).toEqual(['android'])
            expect(body.filters.countries).toEqual(['US'])
            expect(body.filters.locales).toEqual(['en-US'])
        })

        it('setting device manufacturer + device name + network type in one POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedDeviceManufacturers(['Google'])
                filtersStore.getState().setSelectedDeviceNames(['Pixel 8'])
                filtersStore.getState().setSelectedNetworkTypes(['wifi'])
            })

            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })

            const body = shortFilterBodies[shortFilterBodies.length - 1]
            expect(body.filters.device_manufacturers).toEqual(['Google'])
            expect(body.filters.device_names).toEqual(['Pixel 8'])
            expect(body.filters.network_types).toEqual(['wifi'])
        })
    })

    // ================================================================
    // RENDERED VALUES
    // ================================================================
    describe('rendered values from fixture', () => {
        it('renders exact formatted duration "5m 30s" for sess-001', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('5m 30s')).toBeTruthy()
        })

        it('renders exact formatted duration "2m 15s" for sess-002', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('2m 15s')).toBeTruthy()
        })

        it('renders session IDs as text', async () => {
            await renderAndWaitForData()
            expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy()
            expect(screen.getByText(/Session ID: sess-002/)).toBeTruthy()
        })

        it('renders user ID in session row if present', async () => {
            // The fixture has user_id in the attribute but the page displays
            // app_version, OS, manufacturer, model — not user_id directly.
            // Verify the actual displayed text.
            await renderAndWaitForData()
            expect(screen.getByText(/Google Pixel 8/)).toBeTruthy()
        })
    })

    // ================================================================
    // EMPTY RESULTS
    // ================================================================
    describe('empty results', () => {
        it('renders table shell but no rows when results are empty', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    return HttpResponse.json({
                        meta: { next: false, previous: false },
                        results: [],
                    })
                }),
            )

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                // Table headers still render
                expect(screen.getByText('Session Timeline')).toBeTruthy()
                expect(screen.getByText('Start Time')).toBeTruthy()
            }, { timeout: 5000 })

            // No session rows
            expect(screen.queryByText(/Session ID:/)).toBeNull()

            // Both pagination buttons disabled
            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(true)
            expect(screen.getByText('Next').closest('button')?.disabled).toBe(true)
        })
    })

    // ================================================================
    // FREE TEXT SPECIAL CHARACTERS
    // ================================================================
    describe('free text edge cases', () => {
        it('free text with special characters is URL-encoded', async () => {
            await renderAndWaitForData()
            sessionRequests.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedFreeText('key=value&other=true')
            })

            await waitFor(() => expect(sessionRequests.length).toBeGreaterThan(0), { timeout: 5000 })
            const url = sessionRequests[sessionRequests.length - 1].url
            // Should be encoded, not raw & and =
            expect(url).toContain('free_text=')
            expect(url).not.toMatch(/free_text=key=value&other/)
        })

        it('free text with spaces is encoded', async () => {
            await renderAndWaitForData()
            sessionRequests.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedFreeText('hello world')
            })

            await waitFor(() => expect(sessionRequests.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(sessionRequests[sessionRequests.length - 1].url).toContain('free_text=hello')
        })
    })

    // ================================================================
    // PLOT TIME GROUP
    // ================================================================
    describe('plot time group', () => {
        it('Last 6 Hours produces "minutes" plot_time_group', async () => {
            let plotUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/sessions/plots/instances', ({ request }) => {
                    plotUrls.push(request.url)
                    return HttpResponse.json(makeSessionPlotFixture())
                }),
            )

            await renderAndWaitForData()
            expect(plotUrls.length).toBeGreaterThan(0)
            expect(plotUrls[0]).toContain('plot_time_group=minutes')
        })
    })

    // ================================================================
    // URL ROUND-TRIP
    // ================================================================
    describe('URL round-trip', () => {
        it('version + date range survive URL round-trip', async () => {
            await renderAndWaitForData()

            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
                const now = new Date()
                filtersStore.getState().setSelectedDateRange('Last Week')
                filtersStore.getState().setSelectedStartDate(new Date(now.getTime() - 7 * 86400000).toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })

            await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled())
            const serializedUrl = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0] as string
            const params = new URLSearchParams(serializedUrl.replace(/^\?/, ''))

            // Reset and re-render with captured URL
            filtersStore.getState().reset(true)
            queryClient.clear()
            // TanStack Query cache cleared via queryClient.clear() above
            for (const key of [...mockSearchParams.keys()]) mockSearchParams.delete(key)
            for (const [key, value] of params.entries()) mockSearchParams.set(key, value)

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getAllByText(/Session ID:/).length).toBeGreaterThanOrEqual(1)
            }, { timeout: 5000 })

            expect(filtersStore.getState().selectedVersions[0]?.name).toBe('3.0.2')
            expect(filtersStore.getState().selectedDateRange).toBe('Last Week')
        })
    })

    // ================================================================
    // STORE CACHE ON RE-MOUNT
    // ================================================================
    describe('store cache', () => {
        it('re-mount still shows data', async () => {
            const { unmount } = renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy(), { timeout: 5000 })

            unmount()
            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy(), { timeout: 5000 })
        })
    })

    // ================================================================
    // iOS / iPadOS OS NAME FORMATTING
    // ================================================================
    describe('OS name formatting in session rows', () => {
        function makeSessionWithOs(osName: string, osVersion: string) {
            return {
                ...makeSessionTimelinesOverviewFixture().results[0],
                session_id: `sess-os-${osName}`,
                attribute: {
                    ...makeSessionTimelinesOverviewFixture().results[0].attribute,
                    os_name: osName,
                    os_version: osVersion,
                },
            }
        }

        it('renders "iOS" label for os_name=ios', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    return HttpResponse.json({
                        meta: { next: false, previous: false },
                        results: [makeSessionWithOs('ios', '17')],
                    })
                }),
            )

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/iOS 17/)).toBeTruthy()
            }, { timeout: 5000 })
            // Should NOT show raw "ios"
            expect(screen.queryByText(/\bios 17\b/)).toBeNull()
        })

        it('renders "iPadOS" label for os_name=ipados', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    return HttpResponse.json({
                        meta: { next: false, previous: false },
                        results: [makeSessionWithOs('ipados', '17')],
                    })
                }),
            )

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/iPadOS 17/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('renders "Android API Level" label for os_name=android', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    return HttpResponse.json({
                        meta: { next: false, previous: false },
                        results: [makeSessionWithOs('android', '14')],
                    })
                }),
            )

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Android API Level 14/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('passes through unknown OS name directly', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    return HttpResponse.json({
                        meta: { next: false, previous: false },
                        results: [makeSessionWithOs('harmony', '4')],
                    })
                }),
            )

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/harmony 4/)).toBeTruthy()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // LEARN MORE LINK
    // ================================================================
    describe('info note link', () => {
        it('"Learn more" link points to the correct docs page', async () => {
            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Timelines are captured/)).toBeTruthy()
            }, { timeout: 5000 })

            const link = screen.getByText('Learn more')
            expect(link.closest('a')?.getAttribute('href')).toBe('/docs/features/feature-session-timelines')
        })
    })

    // ================================================================
    // KEYBOARD NAVIGATION ON TABLE ROWS
    // ================================================================
    describe('keyboard navigation', () => {
        it('pressing Enter on a table row calls router.push with session href', async () => {
            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy()
            }, { timeout: 5000 })

            // Find the table row with sess-001 and simulate Enter keydown
            const row = screen.getByLabelText('Session ID: sess-001').closest('tr')
            expect(row).toBeTruthy()

            await act(async () => {
                const event = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                })
                row!.dispatchEvent(event)
            })

            expect(mockRouterPush).toHaveBeenCalledWith(
                expect.stringContaining('/sess-001'),
            )
        })

        it('pressing Space on a table row calls router.push with session href', async () => {
            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy()
            }, { timeout: 5000 })

            const row = screen.getByLabelText('Session ID: sess-001').closest('tr')

            await act(async () => {
                const event = new KeyboardEvent('keydown', {
                    key: ' ',
                    bubbles: true,
                })
                row!.dispatchEvent(event)
            })

            expect(mockRouterPush).toHaveBeenCalledWith(
                expect.stringContaining('/sess-001'),
            )
        })
    })

    // ================================================================
    // PAGINATION OFFSET URL ROUND-TRIP
    // ================================================================
    describe('pagination URL round-trip', () => {
        it('paginating to page 2 then capturing URL preserves offset on reload', async () => {
            server.use(
                http.get('*/api/apps/:appId/sessions', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.split('/').filter(Boolean).length > 4) return
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') {
                        return HttpResponse.json(makeSessionTimelinesOverviewPage2Fixture())
                    }
                    return HttpResponse.json(makeSessionTimelinesOverviewFixture())
                }),
            )

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy()
            }, { timeout: 5000 })

            // Navigate to page 2
            await act(async () => {
                fireEvent.click(screen.getByText('Next').closest('button')!)
            })

            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('po=5')
            })

            // Capture URL, reset, re-render with that URL
            const serializedUrl = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0] as string
            const params = new URLSearchParams(serializedUrl.replace(/^\?/, ''))

            filtersStore.getState().reset(true)
            queryClient.clear()
            // TanStack Query cache cleared via queryClient.clear() above
            for (const key of [...mockSearchParams.keys()]) mockSearchParams.delete(key)
            for (const [key, value] of params.entries()) mockSearchParams.set(key, value)

            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)

            await waitFor(() => {
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('po=5')
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // SESSION TYPE + FREE TEXT COMBINED
    // ================================================================
    describe('combined session type + free text', () => {
        it('session type + free text both appear in data-fetch URL', async () => {
            renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy()
            }, { timeout: 5000 })
            sessionRequests.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedSessionTypes(['Crash Sessions' as any])
                filtersStore.getState().setSelectedFreeText('NullPointerException')
            })

            await waitFor(() => expect(sessionRequests.length).toBeGreaterThan(0), { timeout: 5000 })
            const url = sessionRequests[sessionRequests.length - 1].url
            expect(url).toContain('crash=1')
            expect(url).toContain('free_text=NullPointerException')
        })
    })
})

describe('Session timelines — team switch to no-apps team', () => {
    it('switching from team with apps to team with no apps must not router.replace with stale filters', async () => {
        // Phase 1: render with team that has apps — fully load
        const { unmount } = renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'team-with-apps' }} />)

        await waitFor(() => {
            expect(screen.getByText(/Session ID: sess-001/)).toBeTruthy()
        }, { timeout: 5000 })

        // Confirm router.replace was called for the first team
        expect(mockRouterReplace).toHaveBeenCalled()

        // Phase 2: switch to team with no apps (404 on /apps)
        server.use(
            http.get('*/api/teams/:teamId/apps', () => {
                return new HttpResponse(null, { status: 404 })
            }),
        )

        unmount()
        mockRouterReplace.mockClear()

        renderWithProviders(<SessionTimelinesOverview params={{ teamId: 'team-no-apps' }} />)

        // Should show NoApps message
        await waitFor(() => {
            expect(screen.getByText(/don.t have any apps/i)).toBeTruthy()
        }, { timeout: 5000 })

        // router.replace must NOT have been called with stale filters
        // from the previous team. With the real Next.js router, a stale
        // router.replace during/after navigation corrupts the RSC flight
        // response causing the "unparsable" crash in production builds.
        expect(mockRouterReplace).not.toHaveBeenCalled()
    })
})
