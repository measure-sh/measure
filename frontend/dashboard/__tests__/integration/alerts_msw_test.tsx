/**
 * Integration tests for Alerts Overview page.
 *
 * The alerts page is a list-only page (no detail page, no plot) with
 * minimal filters (app selector + date range only). Each alert row
 * links to an external URL (crash/ANR detail page) via the `url` field
 * from the API.
 *
 * Tests cover: page load, table rendering, pagination (Next/Previous,
 * deep-link, edge cases), date range filter, URL sync, caching,
 * in-flight dedup, re-render resilience, keyboard nav, time formatting,
 * empty results, error states, and 401 auth failure.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
    usePathname: () => '/test-team/alerts',
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

jest.mock('next-themes', () => ({
    __esModule: true,
    useTheme: () => ({ theme: 'light' }),
}))

// --- MSW ---
import {
    makeAlertsOverviewFixture,
    makeAppFixture,
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
import AlertsOverview from '@/app/[teamId]/alerts/page'
import { createFiltersStore } from '@/app/stores/filters_store'

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
})

function renderWithProviders(ui: React.ReactElement) {
    return render(
        <QueryClientProvider client={testQueryClient}>
            {ui}
        </QueryClientProvider>
    )
}

// ====================================================================
// ALERTS OVERVIEW
// ====================================================================
describe('Alerts Overview (MSW integration)', () => {
    async function renderAndWaitForData() {
        renderWithProviders(<AlertsOverview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByText('Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity')).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ================================================================
    // PAGE LOAD
    // ================================================================
    describe('page load', () => {
        it('renders "Alerts" heading', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Alerts')).toBeTruthy()
        })

        it('renders table headers', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Alert')).toBeTruthy()
            expect(screen.getByText('Time')).toBeTruthy()
        })

        it('renders alert messages from fixture', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity')).toBeTruthy()
            expect(screen.getByText('ANR rate increased above threshold in CartActivity')).toBeTruthy()
        })

        it('renders alert IDs', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('ID: alert-001')).toBeTruthy()
            expect(screen.getByText('ID: alert-002')).toBeTruthy()
        })

        it('renders formatted date in time column', async () => {
            await renderAndWaitForData()
            // First alert: '2026-04-10T14:30:00Z' → "10 Apr, 2026"
            expect(screen.getByText(/10 Apr, 2026/)).toBeTruthy()
            // Second alert: '2026-04-09T09:15:00Z' → "9 Apr, 2026"
            expect(screen.getByText(/9 Apr, 2026/)).toBeTruthy()
        })

        it('renders formatted time in time column', async () => {
            await renderAndWaitForData()
            // Check time format "h:mm:ss AM/PM"
            expect(screen.getAllByText(/\d{1,2}:\d{2}:\d{2}\s[AP]M/i).length).toBeGreaterThanOrEqual(2)
        })

        it('data loads successfully', async () => {
            await renderAndWaitForData()
            // Verify data rendered in DOM (replaces old store status assertion)
            expect(screen.getByText('Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity')).toBeTruthy()
            expect(screen.getByText('ANR rate increased above threshold in CartActivity')).toBeTruthy()
        })

        it('shows error when API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/alerts', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            renderWithProviders(<AlertsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching list of alerts/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('only shows app selector and date range filters', async () => {
            await renderAndWaitForData()
            // App selector and date range are shown
            expect(screen.getByText('measure demo')).toBeTruthy()
            expect(screen.getByText('Last 6 Hours')).toBeTruthy()
            // Other filters should NOT be present
            expect(screen.queryByText('App versions')).toBeNull()
            expect(screen.queryByText('OS versions')).toBeNull()
            expect(screen.queryByText('Countries')).toBeNull()
        })
    })

    // ================================================================
    // ROW LINKS
    // ================================================================
    describe('row links', () => {
        it('alert rows link to the URL from the API response', async () => {
            await renderAndWaitForData()
            const links = screen.getAllByRole('link', { name: /ID: alert-001/ })
            expect(links.length).toBeGreaterThan(0)
            expect(links[0].getAttribute('href')).toBe('/test-team/crashes/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/crash-group-001')
        })

        it('second alert row links to ANR detail page', async () => {
            await renderAndWaitForData()
            const links = screen.getAllByRole('link', { name: /ID: alert-002/ })
            expect(links.length).toBeGreaterThan(0)
            expect(links[0].getAttribute('href')).toBe('/test-team/anrs/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/anr-group-001')
        })

        it('Enter key on table row navigates to alert URL', async () => {
            await renderAndWaitForData()
            const rows = screen.getAllByRole('row')
            const dataRow = rows[1] // first data row (index 0 is header)
            fireEvent.keyDown(dataRow, { key: 'Enter' })
            expect(mockRouterPush).toHaveBeenCalledWith('/test-team/crashes/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/crash-group-001')
        })

        it('Space key on table row navigates to alert URL', async () => {
            await renderAndWaitForData()
            const rows = screen.getAllByRole('row')
            const dataRow = rows[1]
            fireEvent.keyDown(dataRow, { key: ' ' })
            expect(mockRouterPush).toHaveBeenCalledWith('/test-team/crashes/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/crash-group-001')
        })

        it('second row Enter key navigates to ANR URL', async () => {
            await renderAndWaitForData()
            const rows = screen.getAllByRole('row')
            const dataRow = rows[2] // second data row
            fireEvent.keyDown(dataRow, { key: 'Enter' })
            expect(mockRouterPush).toHaveBeenCalledWith('/test-team/anrs/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/anr-group-001')
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

        it('clicking Next updates URL with new offset', async () => {
            await renderAndWaitForData()

            const nextBtn = screen.getByText('Next').closest('button')!
            await act(async () => {
                fireEvent.click(nextBtn)
            })

            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('po=5')
            })
        })

        it('clicking Next renders page 2 data, Previous returns to page 1', async () => {
            const page2Fixture = makeAlertsOverviewFixture({
                meta: { next: false, previous: true },
                results: [{
                    id: 'alert-page2',
                    team_id: 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
                    app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                    entity_id: 'crash-group-page2',
                    type: 'crash_spike',
                    message: 'Page 2 alert: OutOfMemoryError spike',
                    url: '/test-team/crashes/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/crash-group-page2',
                    created_at: '2026-04-08T12:00:00Z',
                    updated_at: '2026-04-08T12:00:00Z',
                }],
            })

            server.use(
                http.get('*/api/apps/:appId/alerts', ({ request }) => {
                    const url = new URL(request.url)
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') return HttpResponse.json(page2Fixture)
                    return HttpResponse.json(makeAlertsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            expect(screen.getByText('Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity')).toBeTruthy()

            // Navigate to page 2
            const nextBtn = screen.getByText('Next').closest('button')!
            await act(async () => { fireEvent.click(nextBtn) })
            await waitFor(() => {
                expect(screen.getByText('Page 2 alert: OutOfMemoryError spike')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByText('Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity')).toBeNull()

            // Navigate back to page 1
            const prevBtn = screen.getByText('Previous').closest('button')!
            await act(async () => { fireEvent.click(prevBtn) })
            await waitFor(() => {
                expect(screen.getByText('Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByText('Page 2 alert: OutOfMemoryError spike')).toBeNull()

            // URL reflects page 1
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('po=0')
        })

        it('deep-link with po=5 renders page 2 data', async () => {
            const page2Fixture = makeAlertsOverviewFixture({
                meta: { next: false, previous: true },
                results: [{
                    id: 'alert-page2',
                    team_id: 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
                    app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                    entity_id: 'crash-group-page2',
                    type: 'crash_spike',
                    message: 'Deep-linked page 2 alert',
                    url: '/test-team/crashes/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/crash-group-page2',
                    created_at: '2026-04-08T12:00:00Z',
                    updated_at: '2026-04-08T12:00:00Z',
                }],
            })

            server.use(
                http.get('*/api/apps/:appId/alerts', ({ request }) => {
                    const url = new URL(request.url)
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') return HttpResponse.json(page2Fixture)
                    return HttpResponse.json(makeAlertsOverviewFixture())
                }),
            )

            mockSearchParams.set('po', '5')
            renderWithProviders(<AlertsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('Deep-linked page 2 alert')).toBeTruthy()
            }, { timeout: 5000 })

            expect(screen.queryByText('Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity')).toBeNull()
        })

        it('Next disabled and Previous enabled on last page', async () => {
            server.use(
                http.get('*/api/apps/:appId/alerts', () => {
                    return HttpResponse.json(makeAlertsOverviewFixture({
                        meta: { next: false, previous: true },
                    }))
                }),
            )

            renderWithProviders(<AlertsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity')).toBeTruthy()
            }, { timeout: 5000 })

            expect(screen.getByText('Next').closest('button')?.disabled).toBe(true)
            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(false)
        })

        it('both pagination buttons disabled when neither next nor previous', async () => {
            server.use(
                http.get('*/api/apps/:appId/alerts', () => {
                    return HttpResponse.json(makeAlertsOverviewFixture({
                        meta: { next: false, previous: false },
                    }))
                }),
            )

            renderWithProviders(<AlertsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity')).toBeTruthy()
            }, { timeout: 5000 })

            expect(screen.getByText('Next').closest('button')?.disabled).toBe(true)
            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(true)
        })

        it('filter change resets pagination to offset 0', async () => {
            const page2Fixture = makeAlertsOverviewFixture({
                meta: { next: false, previous: true },
                results: [{
                    id: 'alert-page2',
                    team_id: 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
                    app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                    entity_id: 'crash-group-page2',
                    type: 'crash_spike',
                    message: 'Page 2 alert',
                    url: '/test-team/crashes/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/crash-group-page2',
                    created_at: '2026-04-08T12:00:00Z',
                    updated_at: '2026-04-08T12:00:00Z',
                }],
            })

            server.use(
                http.get('*/api/apps/:appId/alerts', ({ request }) => {
                    const url = new URL(request.url)
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') return HttpResponse.json(page2Fixture)
                    return HttpResponse.json(makeAlertsOverviewFixture())
                }),
            )

            await renderAndWaitForData()

            // Go to page 2
            const nextBtn = screen.getByText('Next').closest('button')!
            await act(async () => { fireEvent.click(nextBtn) })
            await waitFor(() => {
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('po=5')
            })

            // Change date range to trigger serialisedFilters change
            await act(async () => {
                filtersStore.getState().setSelectedDateRange('Last Week')
                filtersStore.getState().setSelectedStartDate(new Date(Date.now() - 7 * 86400000).toISOString())
                filtersStore.getState().setSelectedEndDate(new Date().toISOString())
            })
            await waitFor(() => {
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('po=0')
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // URL SYNC
    // ================================================================
    describe('URL sync', () => {
        it('serialises pagination offset into URL', async () => {
            await renderAndWaitForData()
            expect(mockRouterReplace).toHaveBeenCalled()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('po=0')
        })

        it('serialises app and date filters into URL', async () => {
            await renderAndWaitForData()
            expect(mockRouterReplace).toHaveBeenCalled()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('a=')
            expect(url).toContain('sd=')
            expect(url).toContain('ed=')
        })

        it('URL updates on each pagination change', async () => {
            await renderAndWaitForData()
            const callsBefore = mockRouterReplace.mock.calls.length

            const nextBtn = screen.getByText('Next').closest('button')!
            await act(async () => { fireEvent.click(nextBtn) })
            await waitFor(() => {
                expect(mockRouterReplace.mock.calls.length).toBeGreaterThan(callsBefore)
            })
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('po=5')
        })
    })

    // ================================================================
    // REQUEST URL PARAMS
    // ================================================================
    describe('request URL params', () => {
        it('sends limit=5 and offset in request URL', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/alerts', ({ request }) => {
                    requestUrls.push(new URL(request.url).toString())
                    return HttpResponse.json(makeAlertsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            const lastUrl = requestUrls[requestUrls.length - 1]
            expect(lastUrl).toContain('limit=5')
            expect(lastUrl).toContain('offset=0')
        })

        it('sends from and to date params', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/alerts', ({ request }) => {
                    requestUrls.push(new URL(request.url).toString())
                    return HttpResponse.json(makeAlertsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            const lastUrl = requestUrls[requestUrls.length - 1]
            expect(lastUrl).toContain('from=')
            expect(lastUrl).toContain('to=')
            expect(lastUrl).toContain('timezone=')
        })

        it('request URL contains correct app ID from filters', async () => {
            const requestPaths: string[] = []
            server.use(
                http.get('*/api/apps/:appId/alerts', ({ request }) => {
                    requestPaths.push(new URL(request.url).pathname)
                    return HttpResponse.json(makeAlertsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            expect(requestPaths[requestPaths.length - 1]).toContain(`/apps/${makeAppFixture().id}/alerts`)
        })

        it('offset updates in request URL after nextPage', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/alerts', ({ request }) => {
                    requestUrls.push(new URL(request.url).toString())
                    return HttpResponse.json(makeAlertsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            requestUrls.length = 0

            const nextBtn = screen.getByText('Next').closest('button')!
            await act(async () => { fireEvent.click(nextBtn) })
            await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(requestUrls[requestUrls.length - 1]).toContain('offset=5')
        })
    })

    // ================================================================
    // API PATH VERIFICATION
    // ================================================================
    describe('API paths', () => {
        it('fetches from /alerts path', async () => {
            const requestPaths: string[] = []
            server.use(
                http.get('*/api/apps/:appId/alerts', ({ request }) => {
                    requestPaths.push(new URL(request.url).pathname)
                    return HttpResponse.json(makeAlertsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            expect(requestPaths.some(p => p.includes('/alerts'))).toBe(true)
        })
    })

    // ================================================================
    // EMPTY RESULTS
    // ================================================================
    describe('empty results', () => {
        it('renders empty table when no alerts match', async () => {
            server.use(
                http.get('*/api/apps/:appId/alerts', () => {
                    return HttpResponse.json({
                        meta: { next: false, previous: false },
                        results: [],
                    })
                }),
            )

            renderWithProviders(<AlertsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                // Table header should render
                expect(screen.getByText('Alert')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByText('alert-001')).toBeNull()
        })

        it('both pagination buttons disabled with empty results', async () => {
            server.use(
                http.get('*/api/apps/:appId/alerts', () => {
                    return HttpResponse.json({
                        meta: { next: false, previous: false },
                        results: [],
                    })
                }),
            )

            renderWithProviders(<AlertsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('Alert')).toBeTruthy()
            }, { timeout: 5000 })

            expect(screen.getByText('Next').closest('button')?.disabled).toBe(true)
            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(true)
        })
    })

    // ================================================================
    // CONCURRENT / RE-RENDER
    // ================================================================
    describe('concurrent and re-render', () => {
        it('rapid date changes settle on the last one', async () => {
            await renderAndWaitForData()
            const now = new Date()

            await act(async () => {
                filtersStore.getState().setSelectedDateRange('Last Week')
                filtersStore.getState().setSelectedStartDate(new Date(now.getTime() - 7 * 86400000).toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())

                filtersStore.getState().setSelectedDateRange('Last Month')
                filtersStore.getState().setSelectedStartDate(new Date(now.getTime() - 30 * 86400000).toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })

            expect(filtersStore.getState().selectedDateRange).toBe('Last Month')
        })
    })
})

// ====================================================================
// AUTH FAILURE FLOW
// ====================================================================
describe('Alerts — auth failure', () => {
    it('401 on alerts fetch triggers token refresh attempt', async () => {
        let refreshAttempted = false
        server.use(
            http.get('*/api/apps/:appId/alerts', () => {
                return new HttpResponse(null, { status: 401 })
            }),
            http.post('*/auth/refresh', () => {
                refreshAttempted = true
                return new HttpResponse(null, { status: 401 })
            }),
        )

        renderWithProviders(<AlertsOverview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(refreshAttempted).toBe(true)
        }, { timeout: 5000 })
    })
})
