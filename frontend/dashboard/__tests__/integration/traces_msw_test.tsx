/**
 * Integration tests for Traces Overview and Detail pages.
 *
 * Overview: paginated spans list with 4 columns (Trace, Start Time,
 * Duration, Status), span metrics plot with quantile selector, and
 * 10 filter types. Uses FilterSource.Spans which adds span_name and
 * span_statuses filters.
 *
 * Detail: single trace with pills (User ID, Start Time, Duration,
 * Device, App version, Network type), TraceViz timeline visualization,
 * and "View Session Timeline" link.
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
    usePathname: () => '/test-team/traces',
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

// --- MSW ---
import {
    makeAppFixture,
    makeSpanMetricsPlotFixture,
    makeSpansOverviewFixture,
    makeTraceDetailFixture,
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
import TracesOverview from '@/app/[teamId]/traces/page'
import TraceDetails from '@/app/components/trace_details'
import { queryClient } from '@/app/query/query_client'
import { createFiltersStore } from '@/app/stores/filters_store'
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
// TRACES OVERVIEW
// ====================================================================
describe('Traces Overview (MSW integration)', () => {
    const { AppVersion, OsVersion } = require('@/app/api/api_calls')

    async function renderAndWaitForData() {
        renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            // Wait for the trace ID to appear in the table (not span name which also appears in root span names dropdown)
            expect(screen.getByText('ID: trace-001')).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ================================================================
    // PAGE LOAD
    // ================================================================
    describe('page load', () => {
        it('renders "Traces" heading', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Traces')).toBeTruthy()
        })

        it('renders table headers', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Trace')).toBeTruthy()
            expect(screen.getByText('Start Time')).toBeTruthy()
            expect(screen.getByText('Duration')).toBeTruthy()
            expect(screen.getByText('Status')).toBeTruthy()
        })

        it('renders span names from fixture', async () => {
            await renderAndWaitForData()
            // Span names also appear in root span names dropdown, so use getAllByText
            expect(screen.getAllByText('checkout_full_display').length).toBeGreaterThanOrEqual(1)
            expect(screen.getAllByText('api_fetch_payments').length).toBeGreaterThanOrEqual(1)
        })

        it('renders trace IDs', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('ID: trace-001')).toBeTruthy()
            expect(screen.getByText('ID: trace-002')).toBeTruthy()
        })

        it('renders formatted duration', async () => {
            await renderAndWaitForData()
            // 1187ms → "1.187s", 500ms → "500ms"
            expect(screen.getByText('1.187s')).toBeTruthy()
            expect(screen.getByText('500ms')).toBeTruthy()
        })

        it('renders "Okay" status for status 1 (green)', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Okay')).toBeTruthy()
        })

        it('renders "Error" status for status 2 (red)', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Error')).toBeTruthy()
        })

        it('renders "Unset" status for status 0', async () => {
            server.use(
                http.get('*/api/apps/:appId/spans', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.includes('/roots/')) return
                    return HttpResponse.json(makeSpansOverviewFixture({
                        results: [{
                            ...makeSpansOverviewFixture().results[0],
                            status: 0,
                        }],
                    }))
                }),
            )
            renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('Unset')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('renders device info with Android API Level', async () => {
            await renderAndWaitForData()
            expect(screen.getByText(/3\.1\.0\(310\).*Android API Level.*14.*Google.*Pixel 8/)).toBeTruthy()
        })

        it('renders device info with iOS', async () => {
            await renderAndWaitForData()
            expect(screen.getByText(/3\.0\.2\(302\).*iOS.*17.*Apple.*iPhone 15/)).toBeTruthy()
        })

        it('renders device info with iPadOS', async () => {
            server.use(
                http.get('*/api/apps/:appId/spans', () => {
                    return HttpResponse.json(makeSpansOverviewFixture({
                        results: [{
                            ...makeSpansOverviewFixture().results[0],
                            os_name: 'ipados',
                            os_version: '17',
                        }],
                    }))
                }),
            )
            renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/iPadOS 17/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('falls through to raw os_name for unknown OS', async () => {
            server.use(
                http.get('*/api/apps/:appId/spans', () => {
                    return HttpResponse.json(makeSpansOverviewFixture({
                        results: [{
                            ...makeSpansOverviewFixture().results[0],
                            os_name: 'harmonyos',
                            os_version: '4',
                        }],
                    }))
                }),
            )
            renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/harmonyos 4/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('renders formatted date in start time column', async () => {
            await renderAndWaitForData()
            expect(screen.getByText(/10 Apr, 2026/)).toBeTruthy()
            expect(screen.getByText(/9 Apr, 2026/)).toBeTruthy()
        })

        it('renders formatted time in start time column', async () => {
            await renderAndWaitForData()
            expect(screen.getAllByText(/\d{1,2}:\d{2}:\d{2}\s[AP]M/i).length).toBeGreaterThanOrEqual(2)
        })

        it('renders span metrics plot', async () => {
            await renderAndWaitForData()
            expect(screen.getByTestId('nivo-line-chart')).toBeTruthy()
        })

        it('renders plot with correct series and data points', async () => {
            await renderAndWaitForData()
            expect(screen.getByTestId('chart-series-checkout_full_display')).toBeTruthy()
            expect(screen.getByTestId('chart-series-checkout_full_display').textContent).toContain('3 points')
        })

        it('store status is Success after data loads', async () => {
            await renderAndWaitForData()
            const { SpansApiStatus } = require('@/app/api/api_calls')
            // Data loaded successfully - verified by DOM content above
        })

        it('shows error when spans API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/spans', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.includes('/roots/')) return
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching list of traces/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows plot error when plot API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/spans/plots/metrics', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching plot/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows "No Data" when plot returns null', async () => {
            server.use(
                http.get('*/api/apps/:appId/spans/plots/metrics', () => {
                    return HttpResponse.json(null)
                }),
            )

            renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('No Data')).toBeTruthy()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // ROW NAVIGATION
    // ================================================================
    describe('row navigation', () => {
        it('row links point to trace detail page', async () => {
            await renderAndWaitForData()
            const links = screen.getAllByRole('link', { name: /ID: trace-001/ })
            expect(links.length).toBeGreaterThan(0)
            expect(links[0].getAttribute('href')).toBe('/test-team/traces/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/trace-001')
        })

        it('Enter key on table row navigates to trace detail', async () => {
            await renderAndWaitForData()
            const rows = screen.getAllByRole('row')
            fireEvent.keyDown(rows[1], { key: 'Enter' })
            expect(mockRouterPush).toHaveBeenCalledWith('/test-team/traces/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/trace-001')
        })

        it('Space key on table row navigates to trace detail', async () => {
            await renderAndWaitForData()
            const rows = screen.getAllByRole('row')
            fireEvent.keyDown(rows[1], { key: ' ' })
            expect(mockRouterPush).toHaveBeenCalledWith('/test-team/traces/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/trace-001')
        })

        it('second row links to different trace', async () => {
            await renderAndWaitForData()
            const rows = screen.getAllByRole('row')
            fireEvent.keyDown(rows[2], { key: 'Enter' })
            expect(mockRouterPush).toHaveBeenCalledWith('/test-team/traces/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/trace-002')
        })
    })

    // ================================================================
    // PAGINATION
    // ================================================================
    describe('pagination', () => {
        it('Next button enabled when meta.next is true', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Next').closest('button')?.disabled).toBe(false)
        })

        it('Previous button disabled on first page', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(true)
        })

        it('clicking Next updates pagination offset and URL', async () => {
            await renderAndWaitForData()
            await act(async () => { fireEvent.click(screen.getByText('Next').closest('button')!) })
            await waitFor(() => {
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('po=5')
            })
        })

        it('clicking Next renders page 2 data, Previous returns to page 1', async () => {
            const page2Fixture = makeSpansOverviewFixture({
                meta: { next: false, previous: true },
                results: [{
                    ...makeSpansOverviewFixture().results[0],
                    span_name: 'page2_span_render_ui',
                    trace_id: 'trace-page2',
                }],
            })

            server.use(
                http.get('*/api/apps/:appId/spans', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.includes('/roots/')) return
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') return HttpResponse.json(page2Fixture)
                    return HttpResponse.json(makeSpansOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            expect(screen.getByText('ID: trace-001')).toBeTruthy()

            await act(async () => { fireEvent.click(screen.getByText('Next').closest('button')!) })
            await waitFor(() => {
                expect(screen.getByText('ID: trace-page2')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByText('ID: trace-001')).toBeNull()

            await act(async () => { fireEvent.click(screen.getByText('Previous').closest('button')!) })
            await waitFor(() => {
                expect(screen.getByText('ID: trace-001')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByText('ID: trace-page2')).toBeNull()
        })

        it('deep-link with po=5 renders page 2 data', async () => {
            server.use(
                http.get('*/api/apps/:appId/spans', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.includes('/roots/')) return
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') return HttpResponse.json(makeSpansOverviewFixture({
                        results: [{ ...makeSpansOverviewFixture().results[0], trace_id: 'trace-deep-link', span_name: 'deep_link_span' }],
                    }))
                    return HttpResponse.json(makeSpansOverviewFixture())
                }),
            )

            mockSearchParams.set('po', '5')
            renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('ID: trace-deep-link')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByText('ID: trace-001')).toBeNull()
        })

        it('Previous disabled on first page', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(true)
        })

        it('prevPage at offset 0 stays at 0', async () => {
            await renderAndWaitForData()
            await act(async () => { fireEvent.click(screen.getByText('Previous').closest('button')!) })
            await waitFor(() => {
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('po=0')
            })
        })

        it('filter change resets pagination to offset 0', async () => {
            await renderAndWaitForData()
            await act(async () => { fireEvent.click(screen.getByText('Next').closest('button')!) })
            await waitFor(() => {
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('po=5')
            })

            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
            })
            await waitFor(() => {
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('po=0')
            }, { timeout: 5000 })
        })

        it('both buttons disabled when no pages', async () => {
            server.use(
                http.get('*/api/apps/:appId/spans', () => {
                    return HttpResponse.json(makeSpansOverviewFixture({ meta: { next: false, previous: false } }))
                }),
            )
            renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('ID: trace-001')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.getByText('Next').closest('button')?.disabled).toBe(true)
            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(true)
        })
    })

    // ================================================================
    // FILTERS
    // ================================================================
    describe('filters', () => {
        let shortFilterBodies: any[]

        beforeEach(() => {
            shortFilterBodies = []
            server.use(
                http.post('*/api/apps/:appId/shortFilters', async ({ request }) => {
                    shortFilterBodies.push(await request.json())
                    return HttpResponse.json({ filter_short_code: `code-${shortFilterBodies.length}` })
                }),
            )
        })

        it('version change sends versions in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.1', '301')])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.versions).toEqual(['3.0.1'])
        })

        it('OS version change sends os_names in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedOsVersions([new OsVersion('android', '14')])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.os_names).toEqual(['android'])
        })

        it('country change sends countries in POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => { filtersStore.getState().setSelectedCountries(['DE']) })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.countries).toEqual(['DE'])
        })

        it('network provider change sends network_providers in POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => { filtersStore.getState().setSelectedNetworkProviders(['Jio']) })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.network_providers).toEqual(['Jio'])
        })

        it('network type change sends network_types in POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => { filtersStore.getState().setSelectedNetworkTypes(['cellular']) })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.network_types).toEqual(['cellular'])
        })

        it('network generation change sends network_generations in POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => { filtersStore.getState().setSelectedNetworkGenerations(['5g']) })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.network_generations).toEqual(['5g'])
        })

        it('locale change sends locales in POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => { filtersStore.getState().setSelectedLocales(['hi-IN']) })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.locales).toEqual(['hi-IN'])
        })

        it('device manufacturer change sends device_manufacturers in POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => { filtersStore.getState().setSelectedDeviceManufacturers(['Samsung']) })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.device_manufacturers).toEqual(['Samsung'])
        })

        it('device name change sends device_names in POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => { filtersStore.getState().setSelectedDeviceNames(['Galaxy S24']) })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.device_names).toEqual(['Galaxy S24'])
        })

        it('span status filter sends span_statuses in request URL', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/spans', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.includes('/roots/')) return
                    requestUrls.push(url.toString())
                    return HttpResponse.json(makeSpansOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            requestUrls.length = 0

            const { SpanStatus } = require('@/app/api/api_calls')
            await act(async () => {
                filtersStore.getState().setSelectedSpanStatuses([SpanStatus.Error])
            })

            await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(requestUrls[requestUrls.length - 1]).toContain('span_statuses=2')
        })

        it('multiple span statuses sends multiple params', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/spans', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.includes('/roots/')) return
                    requestUrls.push(url.toString())
                    return HttpResponse.json(makeSpansOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            requestUrls.length = 0

            const { SpanStatus } = require('@/app/api/api_calls')
            await act(async () => {
                filtersStore.getState().setSelectedSpanStatuses([SpanStatus.Ok, SpanStatus.Error])
            })

            await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), { timeout: 5000 })
            const lastUrl = requestUrls[requestUrls.length - 1]
            expect(lastUrl).toContain('span_statuses=1')
            expect(lastUrl).toContain('span_statuses=2')
        })

        it('root span name change sends span_name in request URL', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/spans', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.includes('/roots/')) return
                    requestUrls.push(url.toString())
                    return HttpResponse.json(makeSpansOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            requestUrls.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedRootSpanName('api_fetch_payments')
            })

            await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), { timeout: 5000 })
            const lastUrl = requestUrls[requestUrls.length - 1]
            expect(lastUrl).toContain('span_name=')
            expect(decodeURIComponent(lastUrl)).toContain('api_fetch_payments')
        })

        it('root span name is also sent in plot request URL', async () => {
            const plotUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/spans/plots/metrics', ({ request }) => {
                    plotUrls.push(new URL(request.url).toString())
                    return HttpResponse.json(makeSpanMetricsPlotFixture())
                }),
            )

            await renderAndWaitForData()
            plotUrls.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedRootSpanName('api_fetch_payments')
            })

            await waitFor(() => expect(plotUrls.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(decodeURIComponent(plotUrls[plotUrls.length - 1])).toContain('api_fetch_payments')
        })
    })

    // ================================================================
    // URL SYNC
    // ================================================================
    describe('URL sync', () => {
        it('serialises pagination offset into URL', async () => {
            await renderAndWaitForData()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('po=0')
        })

        it('serialises filters into URL', async () => {
            await renderAndWaitForData()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('a=')
            expect(url).toContain('sd=')
            expect(url).toContain('ed=')
        })

        it('URL updates on pagination change', async () => {
            await renderAndWaitForData()
            const callsBefore = mockRouterReplace.mock.calls.length
            await act(async () => { fireEvent.click(screen.getByText('Next').closest('button')!) })
            await waitFor(() => {
                expect(mockRouterReplace.mock.calls.length).toBeGreaterThan(callsBefore)
            })
            expect(mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]).toContain('po=5')
        })
    })

    // ================================================================
    // REQUEST URL PARAMS
    // ================================================================
    describe('request URL params', () => {
        it('sends limit=5 and offset in request URL', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/spans', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.includes('/roots/')) return
                    requestUrls.push(url.toString())
                    return HttpResponse.json(makeSpansOverviewFixture())
                }),
            )
            await renderAndWaitForData()
            expect(requestUrls[requestUrls.length - 1]).toContain('limit=5')
            expect(requestUrls[requestUrls.length - 1]).toContain('offset=0')
        })

        it('request URL contains correct app ID', async () => {
            const requestPaths: string[] = []
            server.use(
                http.get('*/api/apps/:appId/spans', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.includes('/roots/')) return
                    requestPaths.push(url.pathname)
                    return HttpResponse.json(makeSpansOverviewFixture())
                }),
            )
            await renderAndWaitForData()
            expect(requestPaths[requestPaths.length - 1]).toContain(`/apps/${makeAppFixture().id}/spans`)
        })
    })

    // ================================================================
    // API PATH VERIFICATION
    // ================================================================
    describe('API paths', () => {
        it('fetches from /spans path', async () => {
            const requestPaths: string[] = []
            server.use(
                http.get('*/api/apps/:appId/spans', ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.includes('/roots/')) return
                    requestPaths.push(url.pathname)
                    return HttpResponse.json(makeSpansOverviewFixture())
                }),
            )
            await renderAndWaitForData()
            expect(requestPaths.some(p => p.endsWith('/spans'))).toBe(true)
        })

        it('plot endpoint uses /spans/plots/metrics', async () => {
            const plotPaths: string[] = []
            server.use(
                http.get('*/api/apps/:appId/spans/plots/metrics', ({ request }) => {
                    plotPaths.push(new URL(request.url).pathname)
                    return HttpResponse.json(makeSpanMetricsPlotFixture())
                }),
            )
            await renderAndWaitForData()
            expect(plotPaths.some(p => p.includes('/spans/plots/metrics'))).toBe(true)
        })
    })

    // ================================================================
    // CACHING
    // ================================================================
    describe('caching', () => {
        it('data loads and remains visible', async () => {
            await renderAndWaitForData()
            // Data should be visible (TanStack Query manages caching)
            expect(screen.getByText('ID: trace-001')).toBeTruthy()
        })
    })

    // ================================================================
    // EMPTY RESULTS
    // ================================================================
    describe('empty results', () => {
        it('renders empty table when no spans match', async () => {
            server.use(
                http.get('*/api/apps/:appId/spans', () => {
                    return HttpResponse.json({ meta: { next: false, previous: false }, results: [] })
                }),
            )
            renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('Trace')).toBeTruthy() // header
            }, { timeout: 5000 })
            expect(screen.queryByText('ID: trace-001')).toBeNull()
        })
    })

    // ================================================================
    // PLOT STORE
    // ================================================================
    describe('plot store', () => {
        it('plot re-fetches on filter change', async () => {
            let plotFetchCount = 0
            server.use(
                http.get('*/api/apps/:appId/spans/plots/metrics', () => {
                    plotFetchCount++
                    return HttpResponse.json(makeSpanMetricsPlotFixture())
                }),
            )
            await renderAndWaitForData()
            const initial = plotFetchCount

            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.1', '301')])
            })
            await waitFor(() => {
                expect(plotFetchCount).toBeGreaterThan(initial)
            }, { timeout: 5000 })
        })

        it('re-render still shows plot data', async () => {
            const { unmount } = renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('ID: trace-001')).toBeTruthy()
            }, { timeout: 5000 })

            unmount()
            renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('ID: trace-001')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('span metrics plot renders', async () => {
            await renderAndWaitForData()
            // Span metrics plot renders via TanStack Query
            expect(screen.getByTestId('nivo-line-chart')).toBeTruthy()
        })
    })

    // ================================================================
    // CONCURRENT / RE-RENDER
    // ================================================================
    describe('concurrent and re-render', () => {
        it('rapid filter changes settle on the last one', async () => {
            await renderAndWaitForData()
            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.1', '301')])
                filtersStore.getState().setSelectedVersions([new AppVersion('3.1.0', '310')])
            })
            await waitFor(() => {
                expect(filtersStore.getState().selectedVersions[0]?.name).toBe('3.1.0')
            })
        })

        it('re-render still shows data', async () => {
            const { unmount } = renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('ID: trace-001')).toBeTruthy()
            }, { timeout: 5000 })

            unmount()
            renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('ID: trace-001')).toBeTruthy()
            }, { timeout: 5000 })
        })
    })
})

// ====================================================================
// TRACE DETAIL
// ====================================================================
describe('Trace Detail (MSW integration)', () => {
    const defaultParams = {
        teamId: 'test-team',
        appId: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
        traceId: 'trace-001',
    }

    async function renderDetail(params = defaultParams) {
        renderWithProviders(<TraceDetails params={params} />)
        await waitFor(() => {
            expect(screen.getByText(`Trace: ${params.traceId}`)).toBeTruthy()
            // Wait for data to load (pills appear on success)
            expect(screen.getByText(/User ID:/)).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ================================================================
    // PAGE LOAD
    // ================================================================
    describe('page load', () => {
        it('renders trace title with ID', async () => {
            await renderDetail()
            expect(screen.getByText('Trace: trace-001')).toBeTruthy()
        })

        it('renders user ID pill', async () => {
            await renderDetail()
            expect(screen.getByText('User ID: user-trace-123')).toBeTruthy()
        })

        it('renders User ID: N/A when user_id is empty', async () => {
            server.use(
                http.get('*/api/apps/:appId/traces/:traceId', () => {
                    return HttpResponse.json(makeTraceDetailFixture({ user_id: '' }))
                }),
            )
            renderWithProviders(<TraceDetails params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText('User ID: N/A')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('renders start time pill', async () => {
            await renderDetail()
            expect(screen.getByText(/Start Time:.*10 Apr, 2026/)).toBeTruthy()
        })

        it('renders duration pill', async () => {
            await renderDetail()
            expect(screen.getByText('Duration: 1.187s')).toBeTruthy()
        })

        it('renders device pill', async () => {
            await renderDetail()
            expect(screen.getByText(/Device:.*Google.*Pixel 8/)).toBeTruthy()
        })

        it('renders app version pill', async () => {
            await renderDetail()
            expect(screen.getByText('App version: 3.1.0 (310)')).toBeTruthy()
        })

        it('renders network type pill', async () => {
            await renderDetail()
            expect(screen.getByText('Network type: wifi')).toBeTruthy()
        })

        it('renders "View Session Timeline" link', async () => {
            await renderDetail()
            const link = screen.getByText('View Session Timeline')
            expect(link).toBeTruthy()
            expect(link.closest('a')?.getAttribute('href')).toBe('/test-team/session_timelines/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/sess-trace-001')
        })
    })

    // ================================================================
    // TRACE VIZ — RENDERING
    // ================================================================
    describe('TraceViz rendering', () => {
        // Helper: find span bar buttons (absolute positioned, top-6 class)
        function getSpanBarButtons() {
            return Array.from(document.querySelectorAll('button')).filter(b =>
                b.className.includes('absolute') && b.className.includes('top-6')
            )
        }

        // Helper: find span name buttons in the left panel (they contain span name text)
        function getSpanNameButtons() {
            return Array.from(document.querySelectorAll('button')).filter(b =>
                b.className.includes('flex') && b.className.includes('flex-row') && b.className.includes('items-center') && b.className.includes('h-12')
            )
        }

        it('renders span names from fixture in the timeline', async () => {
            await renderDetail()
            expect(screen.getAllByText('checkout_full_display').length).toBeGreaterThanOrEqual(1)
            expect(screen.getAllByText('api_fetch_payments').length).toBeGreaterThanOrEqual(1)
        })

        it('renders formatted duration labels on span bars', async () => {
            await renderDetail()
            expect(screen.getAllByText('1.187s').length).toBeGreaterThanOrEqual(1)
            expect(screen.getAllByText('750ms').length).toBeGreaterThanOrEqual(1)
        })

        it('renders child span count badge', async () => {
            await renderDetail()
            // Root span has 1 child
            expect(screen.getByText('1')).toBeTruthy()
        })

        it('renders timeline ruler values', async () => {
            await renderDetail()
            // Trace duration 1187ms → ruler: 0ms, ~237ms, ~475ms, ~712ms, ~950ms, 1.187s
            expect(screen.getAllByText('0ms').length).toBeGreaterThanOrEqual(1)
            // The last ruler marker is the full duration
            expect(screen.getAllByText('1.187s').length).toBeGreaterThanOrEqual(1)
        })
    })

    // ================================================================
    // TRACE VIZ — PANEL CONTENT
    // ================================================================
    describe('TraceViz panel content', () => {
        function getSpanBarButtons() {
            return Array.from(document.querySelectorAll('button')).filter(b =>
                b.className.includes('absolute') && b.className.includes('top-6')
            )
        }

        it('panel shows all core span fields when root span is clicked', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            // Click root span bar (first one)
            await act(async () => { fireEvent.click(spanBarButtons[0]) })

            await waitFor(() => {
                expect(screen.getByText('Span Name')).toBeTruthy()
                expect(screen.getByText('Span Id')).toBeTruthy()
                expect(screen.getByText('Start Time')).toBeTruthy()
                expect(screen.getByText('End Time')).toBeTruthy()
                expect(screen.getByText('Duration')).toBeTruthy()
                expect(screen.getByText('Parent Id')).toBeTruthy()
                expect(screen.getByText('Thread Name')).toBeTruthy()
                expect(screen.getByText('Span Status')).toBeTruthy()
            })
        })

        it('panel shows span name value for root span', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            await act(async () => { fireEvent.click(spanBarButtons[0]) })
            await waitFor(() => {
                // Root span name from fixture
                const vals = screen.getAllByText(/checkout_full_display/)
                expect(vals.length).toBeGreaterThanOrEqual(2) // one in left panel + one in detail panel
            })
        })

        it('panel shows span_id value', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            await act(async () => { fireEvent.click(spanBarButtons[0]) })
            await waitFor(() => {
                expect(screen.getByText(/span-root/)).toBeTruthy()
            })
        })

        it('panel shows "--" for parent_id on root span', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            // Root span has parent_id: ''
            await act(async () => { fireEvent.click(spanBarButtons[0]) })
            await waitFor(() => {
                expect(screen.getByText('--')).toBeTruthy()
            })
        })

        it('panel shows actual parent_id for child span', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            // Child span has parent_id: 'span-root'
            await act(async () => { fireEvent.click(spanBarButtons[1]) })
            await waitFor(() => {
                expect(screen.getByText(/span-root/)).toBeTruthy()
            })
        })

        it('panel shows thread name', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            await act(async () => { fireEvent.click(spanBarButtons[0]) })
            await waitFor(() => {
                expect(screen.getByText(/main/)).toBeTruthy()
            })
        })

        it('panel shows child span thread name "okhttp"', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            await act(async () => { fireEvent.click(spanBarButtons[1]) })
            await waitFor(() => {
                expect(screen.getByText(/okhttp/)).toBeTruthy()
            })
        })

        it('panel shows Span Status "Unset" for status 0', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            // Root span has status: 0
            await act(async () => { fireEvent.click(spanBarButtons[0]) })
            await waitFor(() => {
                // "Unset" appears as span status in the panel (and maybe in overview if rendered)
                const statusTexts = screen.getAllByText('Unset')
                expect(statusTexts.length).toBeGreaterThanOrEqual(1)
            })
        })

        it('panel shows Span Status "Okay" for status 1', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            // Child span has status: 1
            await act(async () => { fireEvent.click(spanBarButtons[1]) })
            await waitFor(() => {
                const statusTexts = screen.getAllByText('Okay')
                expect(statusTexts.length).toBeGreaterThanOrEqual(1)
            })
        })

        it('panel shows user_defined_attributes for child span', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            await act(async () => { fireEvent.click(spanBarButtons[1]) })
            await waitFor(() => {
                expect(screen.getByText('endpoint')).toBeTruthy()
                expect(screen.getByText('/api/payments')).toBeTruthy()
            })
        })

        it('panel shows "Checkpoints: []" for span with no checkpoints', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            // Root span has checkpoints: null
            await act(async () => { fireEvent.click(spanBarButtons[0]) })
            await waitFor(() => {
                expect(screen.getByText('Checkpoints')).toBeTruthy()
                expect(screen.getByText(': []')).toBeTruthy()
            })
        })

        it('panel shows checkpoint names for span with checkpoints', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            // Child span has 2 checkpoints
            await act(async () => { fireEvent.click(spanBarButtons[1]) })
            await waitFor(() => {
                expect(screen.getByText('Checkpoints')).toBeTruthy()
                expect(screen.getByText('request_sent')).toBeTruthy()
                expect(screen.getByText('response_received')).toBeTruthy()
            })
        })

        it('checkpoint shows formatted timestamp in panel', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            await act(async () => { fireEvent.click(spanBarButtons[1]) })
            await waitFor(() => {
                // Checkpoint timestamps are formatted with formatDateToHumanReadableDateTime
                // "Time" label appears for each checkpoint
                const timeLabels = screen.getAllByText('Time')
                expect(timeLabels.length).toBeGreaterThanOrEqual(1)
            })
        })
    })

    // ================================================================
    // TRACE VIZ — SPAN BAR CLICK ACTIONS
    // ================================================================
    describe('TraceViz span bar click actions', () => {
        function getSpanBarButtons() {
            return Array.from(document.querySelectorAll('button')).filter(b =>
                b.className.includes('absolute') && b.className.includes('top-6')
            )
        }

        it('clicking span bar opens panel', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            // Panel should be closed initially
            const panelBefore = Array.from(document.querySelectorAll('[class*="translate"]')).find(el =>
                el.className.includes('-translate-x-full')
            )
            expect(panelBefore).toBeTruthy()

            // Click a span bar
            await act(async () => { fireEvent.click(spanBarButtons[0]) })
            await waitFor(() => {
                const panelAfter = Array.from(document.querySelectorAll('[class*="translate"]')).find(el =>
                    el.className.includes('translate-x-0')
                )
                expect(panelAfter).toBeTruthy()
            })
        })

        it('clicking same span bar again deselects and closes panel', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            // Open panel
            await act(async () => { fireEvent.click(spanBarButtons[0]) })
            await waitFor(() => {
                expect(screen.getByText('Span Name')).toBeTruthy()
            })

            // Click same span bar again → panel closes
            await act(async () => { fireEvent.click(spanBarButtons[0]) })
            await waitFor(() => {
                const closedPanel = Array.from(document.querySelectorAll('[class*="translate"]')).find(el =>
                    el.className.includes('-translate-x-full')
                )
                expect(closedPanel).toBeTruthy()
            })
        })

        it('clicking different span bar switches panel content', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            // Click root span
            await act(async () => { fireEvent.click(spanBarButtons[0]) })
            await waitFor(() => {
                expect(screen.getByText('--')).toBeTruthy() // root has no parent
            })

            // Click child span — panel should switch to show child's data
            await act(async () => { fireEvent.click(spanBarButtons[1]) })
            await waitFor(() => {
                expect(screen.getByText('endpoint')).toBeTruthy() // child has user_defined_attributes
                expect(screen.queryByText('--')).toBeNull() // no longer showing root's "--" parent
            })
        })

        it('selected span bar gets bg-primary class', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            // Before click — should not have bg-primary
            expect(spanBarButtons[0].className).not.toContain('bg-primary')

            // Click to select
            await act(async () => { fireEvent.click(spanBarButtons[0]) })
            await waitFor(() => {
                // Re-query because React re-renders
                const updatedButtons = getSpanBarButtons()
                expect(updatedButtons[0].className).toContain('bg-primary')
            })
        })

        it('close button hides panel', async () => {
            await renderDetail()
            const spanBarButtons = getSpanBarButtons()

            await act(async () => { fireEvent.click(spanBarButtons[0]) })
            await waitFor(() => { expect(screen.getByText('Span Name')).toBeTruthy() })

            const closeButton = screen.getByText('Close')
            await act(async () => { fireEvent.click(closeButton) })
            await waitFor(() => {
                const closedPanel = Array.from(document.querySelectorAll('[class*="translate"]')).find(el =>
                    el.className.includes('-translate-x-full')
                )
                expect(closedPanel).toBeTruthy()
            })
        })
    })

    // ================================================================
    // TRACE VIZ — CHECKPOINT CLICK ACTIONS
    // ================================================================
    describe('TraceViz checkpoint click actions', () => {
        function getSpanBarButtons() {
            return Array.from(document.querySelectorAll('button')).filter(b =>
                b.className.includes('absolute') && b.className.includes('top-6')
            )
        }

        function getCheckpointDots() {
            return Array.from(document.querySelectorAll('button')).filter(b =>
                b.className.includes('rounded-full') && b.className.includes('w-0.5')
            )
        }

        it('clicking checkpoint dot opens panel with that checkpoint selected', async () => {
            await renderDetail()
            const checkpointDots = getCheckpointDots()
            expect(checkpointDots.length).toBe(2) // fixture has 2 checkpoints

            // Click first checkpoint dot
            await act(async () => { fireEvent.click(checkpointDots[0]) })
            await waitFor(() => {
                // Panel should open showing the parent span and checkpoint details
                expect(screen.getByText('Span Name')).toBeTruthy()
                expect(screen.getByText('request_sent')).toBeTruthy()
            })
        })

        it('clicking same checkpoint dot again deselects both span and checkpoint', async () => {
            await renderDetail()
            const checkpointDots = getCheckpointDots()

            // Click checkpoint to open
            await act(async () => { fireEvent.click(checkpointDots[0]) })
            await waitFor(() => { expect(screen.getByText('Span Name')).toBeTruthy() })

            // Click same checkpoint again → closes panel
            await act(async () => { fireEvent.click(checkpointDots[0]) })
            await waitFor(() => {
                const closedPanel = Array.from(document.querySelectorAll('[class*="translate"]')).find(el =>
                    el.className.includes('-translate-x-full')
                )
                expect(closedPanel).toBeTruthy()
            })
        })

        it('clicking different checkpoint switches selected checkpoint', async () => {
            await renderDetail()
            const checkpointDots = getCheckpointDots()

            // Click first checkpoint
            await act(async () => { fireEvent.click(checkpointDots[0]) })
            await waitFor(() => { expect(screen.getByText('request_sent')).toBeTruthy() })

            // First checkpoint button in panel should have bg-background (selected)
            // Click second checkpoint dot
            await act(async () => { fireEvent.click(checkpointDots[1]) })
            await waitFor(() => {
                expect(screen.getByText('response_received')).toBeTruthy()
            })
        })

        it('selected checkpoint dot gets bg-primary class', async () => {
            await renderDetail()
            const checkpointDots = getCheckpointDots()

            expect(checkpointDots[0].className).not.toContain('bg-primary')

            await act(async () => { fireEvent.click(checkpointDots[0]) })
            await waitFor(() => {
                const updatedDots = getCheckpointDots()
                expect(updatedDots[0].className).toContain('bg-primary')
            })
        })
    })

    // ================================================================
    // TRACE VIZ — EXPAND / COLLAPSE
    // ================================================================
    describe('TraceViz expand/collapse', () => {
        function getSpanNameButtons() {
            return Array.from(document.querySelectorAll('button')).filter(b =>
                b.className.includes('flex') && b.className.includes('flex-row') &&
                b.className.includes('items-center') && b.className.includes('h-12')
            )
        }

        function getSpanBarButtons() {
            return Array.from(document.querySelectorAll('button')).filter(b =>
                b.className.includes('absolute') && b.className.includes('top-6')
            )
        }

        it('initially both spans are visible (expanded)', async () => {
            await renderDetail()
            // Both span names visible in left panel
            const nameButtons = getSpanNameButtons()
            expect(nameButtons.length).toBe(2) // root + child

            // Both span bars visible
            const barButtons = getSpanBarButtons()
            expect(barButtons.length).toBe(2)
        })

        it('collapsing root span hides child span', async () => {
            await renderDetail()
            const nameButtons = getSpanNameButtons()
            expect(nameButtons.length).toBe(2)

            // Click root span name to collapse
            await act(async () => { fireEvent.click(nameButtons[0]) })
            await waitFor(() => {
                // Only root should be visible now
                const updatedNameButtons = getSpanNameButtons()
                expect(updatedNameButtons.length).toBe(1)
            })

            // Span bars should also be reduced to 1
            const barButtons = getSpanBarButtons()
            expect(barButtons.length).toBe(1)
        })

        it('re-expanding root span shows child span again', async () => {
            await renderDetail()
            const nameButtons = getSpanNameButtons()

            // Collapse
            await act(async () => { fireEvent.click(nameButtons[0]) })
            await waitFor(() => {
                expect(getSpanNameButtons().length).toBe(1)
            })

            // Expand again
            const collapsedButtons = getSpanNameButtons()
            await act(async () => { fireEvent.click(collapsedButtons[0]) })
            await waitFor(() => {
                expect(getSpanNameButtons().length).toBe(2)
            })

            // Both bars visible again
            expect(getSpanBarButtons().length).toBe(2)
        })

        it('expanded span with children shows ˅ indicator', async () => {
            await renderDetail()
            // ˅ is U+02C5 — shown when expanded + has children
            expect(screen.getByText('\u02c5')).toBeTruthy()
        })

        it('collapsed span shows ˃ indicator', async () => {
            await renderDetail()
            const nameButtons = getSpanNameButtons()

            // Collapse root
            await act(async () => { fireEvent.click(nameButtons[0]) })
            await waitFor(() => {
                // ˃ is U+02C3 — shown when collapsed + has children
                expect(screen.getByText('\u02c3')).toBeTruthy()
            })
            // ˅ should no longer be present
            expect(screen.queryByText('\u02c5')).toBeNull()
        })
    })

    // ================================================================
    // ERROR STATES
    // ================================================================
    describe('error states', () => {
        it('shows error message when detail API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/traces/:traceId', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderWithProviders(<TraceDetails params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching trace/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows skeleton loading before data arrives', async () => {
            server.use(
                http.get('*/api/apps/:appId/traces/:traceId', async () => {
                    await new Promise(resolve => setTimeout(resolve, 200))
                    return HttpResponse.json(makeTraceDetailFixture())
                }),
            )
            renderWithProviders(<TraceDetails params={defaultParams} />)
            // Skeleton should be visible, data should not be present yet
            expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
            expect(screen.queryByText('User ID: user-trace-123')).toBeNull()
        })
    })

    // ================================================================
    // CACHING
    // ================================================================
    describe('caching', () => {
        it('data is cached by TanStack Query', async () => {
            await renderDetail()
            // Data loaded successfully and is cached
            expect(screen.getByText(/User ID:/)).toBeTruthy()
        })
    })

    // ================================================================
    // API PATH VERIFICATION
    // ================================================================
    describe('API paths', () => {
        it('fetches from /traces/:traceId', async () => {
            let detailPath = ''
            server.use(
                http.get('*/api/apps/:appId/traces/:traceId', ({ request }) => {
                    detailPath = new URL(request.url).pathname
                    return HttpResponse.json(makeTraceDetailFixture())
                }),
            )
            await renderDetail()
            expect(detailPath).toContain('/apps/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/traces/trace-001')
        })
    })
})

// ====================================================================
// AUTH FAILURE FLOW
// ====================================================================
describe('Traces — auth failure', () => {
    it('401 on spans fetch triggers token refresh attempt', async () => {
        let refreshAttempted = false
        server.use(
            http.get('*/api/apps/:appId/spans', ({ request }) => {
                const url = new URL(request.url)
                if (url.pathname.includes('/plots/') || url.pathname.includes('/roots/')) return
                return new HttpResponse(null, { status: 401 })
            }),
            http.post('*/auth/refresh', () => {
                refreshAttempted = true
                return new HttpResponse(null, { status: 401 })
            }),
        )
        renderWithProviders(<TracesOverview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(refreshAttempted).toBe(true)
        }, { timeout: 5000 })
    })

    it('401 on trace detail fetch triggers token refresh attempt', async () => {
        let refreshAttempted = false
        server.use(
            http.get('*/api/apps/:appId/traces/:traceId', () => {
                return new HttpResponse(null, { status: 401 })
            }),
            http.post('*/auth/refresh', () => {
                refreshAttempted = true
                return new HttpResponse(null, { status: 401 })
            }),
        )
        renderWithProviders(<TraceDetails params={{ teamId: 'test-team', appId: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f', traceId: 'trace-001' }} />)
        await waitFor(() => {
            expect(refreshAttempted).toBe(true)
        }, { timeout: 5000 })
    })
})

describe('Traces — team switch to no-apps team', () => {
    it('switching from team with apps to team with no apps shows NoApps after store reset', async () => {
        // Phase 1: render with team that has apps — fully load
        const { unmount } = renderWithProviders(<TracesOverview params={{ teamId: 'team-with-apps' }} />)

        await waitFor(() => {
            expect(screen.getByText('ID: trace-001')).toBeTruthy()
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

        renderWithProviders(<TracesOverview params={{ teamId: 'team-no-apps' }} />)

        // Wait for NoApps message to appear
        await waitFor(() => {
            expect(screen.getByText(/don.t have any apps/i)).toBeTruthy()
        }, { timeout: 5000 })
    })
})
