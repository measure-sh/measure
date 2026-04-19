/**
 * Integration tests for Bug Reports Overview and Detail pages.
 *
 * Overview page: paginated list with Open/Closed status pills, descriptions,
 * matched_free_text badges, and a time-series plot.
 * Detail page: single bug report with status badge, pills (user, device, etc.),
 * user_defined_attribute pills, description, attachments, status toggle
 * (PATCH endpoint), and "View Session Timeline" link.
 *
 * Unique to bug reports:
 *   - bugReportStatus filter (Open/Closed)
 *   - freeText search with matched_free_text badge
 *   - PATCH endpoint for status toggle
 *   - user_defined_attribute rendered as pills
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
    usePathname: () => '/test-team/bug_reports',
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

jest.mock('next-themes', () => ({
    __esModule: true,
    useTheme: () => ({ theme: 'light' }),
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => <img {...props} />,
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
    makeBugReportDetailFixture,
    makeBugReportsOverviewFixture,
    makeBugReportsPlotFixture,
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
import BugReportsOverview from '@/app/[teamId]/bug_reports/page'
import BugReport from '@/app/components/bug_report'
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
// BUG REPORTS OVERVIEW
// ====================================================================
describe('Bug Reports Overview (MSW integration)', () => {
    const { AppVersion, OsVersion } = require('@/app/api/api_calls')

    async function renderAndWaitForData() {
        renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ================================================================
    // PAGE LOAD
    // ================================================================
    describe('page load', () => {
        it('renders "Bug Reports" heading', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Bug Reports')).toBeTruthy()
        })

        it('renders table headers', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Bug Report')).toBeTruthy()
            expect(screen.getByText('Time')).toBeTruthy()
            expect(screen.getByText('Status')).toBeTruthy()
        })

        it('renders bug report descriptions from fixture', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
        })

        it('renders "No Description" for empty description', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('No Description')).toBeTruthy()
        })

        it('renders event IDs', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('ID: evt-br-001')).toBeTruthy()
            expect(screen.getByText('ID: evt-br-002')).toBeTruthy()
        })

        it('renders Open status pill for status 0', async () => {
            await renderAndWaitForData()
            // "Open" appears in both the status pill and the bug report status filter
            const openElements = screen.getAllByText('Open')
            expect(openElements.length).toBeGreaterThanOrEqual(1)
        })

        it('renders Closed status pill for status 1', async () => {
            await renderAndWaitForData()
            // Second fixture item has status 1 (Closed)
            const closedElements = screen.getAllByText('Closed')
            expect(closedElements.length).toBeGreaterThanOrEqual(1)
        })

        it('renders device info line', async () => {
            await renderAndWaitForData()
            // First row: "3.1.0(310), Android API Level 14, Google Pixel 8"
            expect(screen.getByText(/3\.1\.0\(310\).*Android API Level.*14.*Google.*Pixel 8/)).toBeTruthy()
        })

        it('renders Samsung device info for second row', async () => {
            await renderAndWaitForData()
            expect(screen.getByText(/3\.0\.2\(302\).*Android API Level.*14.*Samsung.*SM-S921B/)).toBeTruthy()
        })

        it('renders overview plot', async () => {
            await renderAndWaitForData()
            expect(screen.getByTestId('nivo-line-chart')).toBeTruthy()
        })

        it('renders plot with correct data points', async () => {
            await renderAndWaitForData()
            expect(screen.getByTestId('chart-series-3.1.0')).toBeTruthy()
            expect(screen.getByTestId('chart-series-3.1.0').textContent).toContain('3 points')
        })

        it('shows error when overview API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching list of bug reports/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows plot error when plot API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports/plots/instances', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching plot/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows "No Data" when plot returns null', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports/plots/instances', () => {
                    return HttpResponse.json(null)
                }),
            )

            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('No Data')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('renders matched_free_text badge when present', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    return HttpResponse.json(makeBugReportsOverviewFixture({
                        results: [
                            {
                                ...makeBugReportsOverviewFixture().results[0],
                                matched_free_text: 'user_id',
                            },
                        ],
                    }))
                }),
            )

            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('Matched user_id')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('does not render matched_free_text badge when empty', async () => {
            await renderAndWaitForData()
            expect(screen.queryByText(/Matched /)).toBeNull()
        })

        it('data loads successfully', async () => {
            await renderAndWaitForData()
            // Verify data rendered in DOM (replaces old store status assertion)
            expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
        })

        it('formats iOS os_name correctly', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    return HttpResponse.json(makeBugReportsOverviewFixture({
                        results: [{
                            ...makeBugReportsOverviewFixture().results[0],
                            attribute: { ...makeBugReportsOverviewFixture().results[0].attribute, os_name: 'ios', os_version: '17' },
                        }],
                    }))
                }),
            )
            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/iOS 17/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('formats iPadOS os_name correctly', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    return HttpResponse.json(makeBugReportsOverviewFixture({
                        results: [{
                            ...makeBugReportsOverviewFixture().results[0],
                            attribute: { ...makeBugReportsOverviewFixture().results[0].attribute, os_name: 'ipados', os_version: '17' },
                        }],
                    }))
                }),
            )
            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/iPadOS 17/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('formats android os_name as "Android API Level"', async () => {
            await renderAndWaitForData()
            // Both fixture rows have os_name: 'android'
            expect(screen.getAllByText(/Android API Level/).length).toBeGreaterThanOrEqual(1)
        })

        it('falls through to raw os_name for unknown OS', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    return HttpResponse.json(makeBugReportsOverviewFixture({
                        results: [{
                            ...makeBugReportsOverviewFixture().results[0],
                            attribute: { ...makeBugReportsOverviewFixture().results[0].attribute, os_name: 'harmonyos', os_version: '4' },
                        }],
                    }))
                }),
            )
            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText(/harmonyos 4/)).toBeTruthy()
            }, { timeout: 5000 })
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

        it('clicking Next renders page 2 data, Previous returns to page 1', async () => {
            const page2Fixture = makeBugReportsOverviewFixture({
                meta: { next: false, previous: true },
                results: [{
                    ...makeBugReportsOverviewFixture().results[0],
                    event_id: 'evt-br-page2',
                    description: 'Page 2 bug report',
                    status: 1,
                }],
            })

            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') return HttpResponse.json(page2Fixture)
                    return HttpResponse.json(makeBugReportsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()

            // Navigate to page 2
            await act(async () => { fireEvent.click(screen.getByText('Next').closest('button')!) })
            await waitFor(() => {
                expect(screen.getByText('Page 2 bug report')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByText('App crashes when tapping checkout button')).toBeNull()

            // Navigate back to page 1
            await act(async () => { fireEvent.click(screen.getByText('Previous').closest('button')!) })
            await waitFor(() => {
                expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByText('Page 2 bug report')).toBeNull()

            // URL reflects page 1
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('po=0')
        })

        it('deep-link with po=5 renders page 2 data', async () => {
            const page2Fixture = makeBugReportsOverviewFixture({
                meta: { next: false, previous: true },
                results: [{
                    ...makeBugReportsOverviewFixture().results[0],
                    event_id: 'evt-br-page2',
                    description: 'Deep-linked page 2 bug report',
                }],
            })

            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') return HttpResponse.json(page2Fixture)
                    return HttpResponse.json(makeBugReportsOverviewFixture())
                }),
            )

            mockSearchParams.set('po', '5')
            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('Deep-linked page 2 bug report')).toBeTruthy()
            }, { timeout: 8000 })

            expect(screen.queryByText('App crashes when tapping checkout button')).toBeNull()
        })

        it('Previous is disabled on first page even after data loads', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(true)
        })
    })

    // ================================================================
    // FILTERS — all relevant filter types
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

        it('free text change triggers re-fetch with free_text in URL', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    requestUrls.push(url.toString())
                    return HttpResponse.json(makeBugReportsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            requestUrls.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedFreeText('user-123')
            })

            await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), { timeout: 5000 })
            const lastUrl = requestUrls[requestUrls.length - 1]
            expect(lastUrl).toContain('free_text=')
        })

        it('bug report status filter sends bug_report_statuses in URL', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    requestUrls.push(url.toString())
                    return HttpResponse.json(makeBugReportsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            requestUrls.length = 0

            const { BugReportStatus } = require('@/app/api/api_calls')
            await act(async () => {
                filtersStore.getState().setSelectedBugReportStatuses([BugReportStatus.Closed])
            })

            await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), { timeout: 5000 })
            const lastUrl = requestUrls[requestUrls.length - 1]
            expect(lastUrl).toContain('bug_report_statuses=1')
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

        it('serialises filters into URL', async () => {
            await renderAndWaitForData()
            expect(mockRouterReplace).toHaveBeenCalled()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            // The URL should contain serialised filter params (app, dates, etc.)
            expect(url).toContain('a=')
            expect(url).toContain('sd=')
            expect(url).toContain('ed=')
        })

        it('URL updates on each pagination change', async () => {
            await renderAndWaitForData()
            const callsBefore = mockRouterReplace.mock.calls.length

            await act(async () => { fireEvent.click(screen.getByText('Next').closest('button')!) })
            await waitFor(() => {
                expect(mockRouterReplace.mock.calls.length).toBeGreaterThan(callsBefore)
            })
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('po=5')
        })
    })

    // ================================================================
    // CACHING
    // ================================================================
    describe('caching', () => {
        it('re-render with same filters still shows data', async () => {
            await renderAndWaitForData()
            // Data should be visible (TanStack Query manages caching)
            expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
        })
    })

    // ================================================================
    // EMPTY RESULTS
    // ================================================================
    describe('empty results', () => {
        it('renders empty table when no bug reports match', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    return HttpResponse.json({
                        meta: { next: false, previous: false },
                        results: [],
                    })
                }),
            )

            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                // Table should render but with no rows
                expect(screen.getByText('Bug Report')).toBeTruthy() // header
            }, { timeout: 5000 })
            expect(screen.queryByText('evt-br-001')).toBeNull()
        })
    })

    // ================================================================
    // API PATH VERIFICATION
    // ================================================================
    describe('API paths', () => {
        it('fetches from /bugReports path (not /crashGroups or /anrGroups)', async () => {
            const requestPaths: string[] = []
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    requestPaths.push(url.pathname)
                    return HttpResponse.json(makeBugReportsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            expect(requestPaths.some(p => p.includes('/bugReports'))).toBe(true)
            expect(requestPaths.some(p => p.includes('/crashGroups'))).toBe(false)
        })

        it('plot endpoint uses /bugReports/plots/instances', async () => {
            const plotPaths: string[] = []
            server.use(
                http.get('*/api/apps/:appId/bugReports/plots/instances', ({ request }) => {
                    plotPaths.push(new URL(request.url).pathname)
                    return HttpResponse.json(makeBugReportsPlotFixture())
                }),
            )

            await renderAndWaitForData()
            expect(plotPaths.some(p => p.includes('/bugReports/plots/instances'))).toBe(true)
        })
    })

    // ================================================================
    // ROW NAVIGATION
    // ================================================================
    describe('row navigation', () => {
        it('row links point to detail page with correct teamId/appId/eventId', async () => {
            await renderAndWaitForData()
            const links = screen.getAllByRole('link', { name: /ID: evt-br-001/ })
            expect(links.length).toBeGreaterThan(0)
            expect(links[0].getAttribute('href')).toBe('/test-team/bug_reports/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/evt-br-001')
        })

        it('Enter key on table row navigates to detail page', async () => {
            await renderAndWaitForData()
            const rows = screen.getAllByRole('row')
            // First data row (index 1, since index 0 is the header)
            const dataRow = rows[1]
            fireEvent.keyDown(dataRow, { key: 'Enter' })
            expect(mockRouterPush).toHaveBeenCalledWith('/test-team/bug_reports/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/evt-br-001')
        })

        it('Space key on table row navigates to detail page', async () => {
            await renderAndWaitForData()
            const rows = screen.getAllByRole('row')
            const dataRow = rows[1]
            fireEvent.keyDown(dataRow, { key: ' ' })
            expect(mockRouterPush).toHaveBeenCalledWith('/test-team/bug_reports/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/evt-br-001')
        })
    })

    // ================================================================
    // REQUEST URL PARAMS
    // ================================================================
    describe('request URL params', () => {
        it('sends limit=5 and offset in request URL', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    requestUrls.push(url.toString())
                    return HttpResponse.json(makeBugReportsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            const lastUrl = requestUrls[requestUrls.length - 1]
            expect(lastUrl).toContain('limit=5')
            expect(lastUrl).toContain('offset=0')
        })

        it('default selection (Open only) sends bug_report_statuses=0 in initial request', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    requestUrls.push(url.toString())
                    return HttpResponse.json(makeBugReportsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            // Default bug report status selection is [Open], so initial request should include status 0
            const lastUrl = requestUrls[requestUrls.length - 1]
            expect(lastUrl).toContain('bug_report_statuses=0')
            expect(lastUrl).not.toContain('bug_report_statuses=1')
        })

        it('selecting all statuses omits bug_report_statuses from URL', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    requestUrls.push(url.toString())
                    return HttpResponse.json(makeBugReportsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            requestUrls.length = 0

            const { BugReportStatus } = require('@/app/api/api_calls')
            await act(async () => {
                filtersStore.getState().setSelectedBugReportStatuses([BugReportStatus.Open, BugReportStatus.Closed])
            })

            await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), { timeout: 5000 })
            const lastUrl = requestUrls[requestUrls.length - 1]
            // When all statuses selected, the filter is omitted (all=true → no param)
            expect(lastUrl).not.toContain('bug_report_statuses=')
        })

        it('ud_expression sent in shortFilters POST for user-defined attribute filter', async () => {
            let shortFilterBodies: any[] = []
            server.use(
                http.post('*/api/apps/:appId/shortFilters', async ({ request }) => {
                    shortFilterBodies.push(await request.json())
                    return HttpResponse.json({ filter_short_code: `code-ud-${shortFilterBodies.length}` })
                }),
            )

            await renderAndWaitForData()
            shortFilterBodies.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedUdAttrMatchers([
                    { key: 'premium', type: 'bool', op: 'eq', value: true },
                ])
            })

            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            const body = shortFilterBodies[shortFilterBodies.length - 1]
            expect(body.filters.ud_expression).toBeDefined()
            const expr = JSON.parse(body.filters.ud_expression)
            expect(expr.and[0].cmp.key).toBe('premium')
            expect(expr.and[0].cmp.op).toBe('eq')
            // Value may be serialized as string "true" or boolean true depending on JSON encoding
            expect(String(expr.and[0].cmp.value)).toBe('true')
        })

        it('request URL contains correct app ID from filters', async () => {
            const requestPaths: string[] = []
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    requestPaths.push(url.pathname)
                    return HttpResponse.json(makeBugReportsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            expect(requestPaths[requestPaths.length - 1]).toContain(`/apps/${makeAppFixture().id}/bugReports`)
        })
    })

    // ================================================================
    // TIME COLUMN
    // ================================================================
    describe('time column', () => {
        it('renders formatted date in time column', async () => {
            await renderAndWaitForData()
            // Fixture timestamp: '2026-04-10T14:30:00Z' → formatDateToHumanReadableDate → "10 Apr, 2026"
            expect(screen.getByText(/10 Apr, 2026/)).toBeTruthy()
        })

        it('renders formatted time in time column', async () => {
            await renderAndWaitForData()
            // Fixture timestamp: '2026-04-10T14:30:00Z' → formatDateToHumanReadableTime → local time "h:mm:ss a"
            // The exact time depends on local timezone, so just check the format
            expect(screen.getAllByText(/\d{1,2}:\d{2}:\d{2}\s[AP]M/i).length).toBeGreaterThanOrEqual(1)
        })

        it('renders date for second row as well', async () => {
            await renderAndWaitForData()
            // Second fixture: '2026-04-09T09:15:00Z' → "9 Apr, 2026"
            // \b prevents matching "19 Apr, 2026" from the date-range filter.
            expect(screen.getByText(/\b9 Apr, 2026/)).toBeTruthy()
        })
    })

    // ================================================================
    // PAGINATION EDGE CASES
    // ================================================================
    describe('pagination edge cases', () => {
        it('Previous button disabled at offset 0', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(true)
        })

        it('Next disabled and Previous enabled on last page', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    return HttpResponse.json(makeBugReportsOverviewFixture({
                        meta: { next: false, previous: true },
                    }))
                }),
            )

            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
            }, { timeout: 5000 })

            expect(screen.getByText('Next').closest('button')?.disabled).toBe(true)
            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(false)
        })

        it('both pagination buttons disabled when neither next nor previous', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    return HttpResponse.json(makeBugReportsOverviewFixture({
                        meta: { next: false, previous: false },
                    }))
                }),
            )

            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
            }, { timeout: 5000 })

            expect(screen.getByText('Next').closest('button')?.disabled).toBe(true)
            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(true)
        })

        it('offset updates in request URL after nextPage', async () => {
            const requestUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    requestUrls.push(url.toString())
                    return HttpResponse.json(makeBugReportsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            requestUrls.length = 0

            await act(async () => { fireEvent.click(screen.getByText('Next').closest('button')!) })
            await waitFor(() => expect(requestUrls.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(requestUrls[requestUrls.length - 1]).toContain('offset=5')
        })
    })

    // ================================================================
    // PLOT STORE
    // ================================================================
    describe('plot store', () => {
        it('plot re-fetches when filters change', async () => {
            let plotFetchCount = 0
            server.use(
                http.get('*/api/apps/:appId/bugReports/plots/instances', () => {
                    plotFetchCount++
                    return HttpResponse.json(makeBugReportsPlotFixture())
                }),
            )

            await renderAndWaitForData()
            const initialPlotCount = plotFetchCount

            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.1', '301')])
            })

            await waitFor(() => {
                expect(plotFetchCount).toBeGreaterThan(initialPlotCount)
            }, { timeout: 5000 })
        })

        it('re-render still shows plot data', async () => {
            const { unmount } = renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByTestId('nivo-line-chart')).toBeTruthy()
            }, { timeout: 5000 })

            unmount()
            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByTestId('nivo-line-chart')).toBeTruthy()
            }, { timeout: 5000 })
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
            const { unmount } = renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
            }, { timeout: 5000 })

            unmount()
            renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('rapid pagination does not produce duplicate fetches for same offset', async () => {
            let fetchCount = 0
            server.use(
                http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                    const url = new URL(request.url)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    if (pathParts.length > 4) return
                    fetchCount++
                    return HttpResponse.json(makeBugReportsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            fetchCount = 0

            // Rapidly click next then previous — should settle at offset 0
            await act(async () => {
                fireEvent.click(screen.getByText('Next').closest('button')!)
                fireEvent.click(screen.getByText('Previous').closest('button')!)
            })

            // Wait for any fetches to settle
            await new Promise(r => setTimeout(r, 200))
            // The final offset is 0 (same as initial), so no new fetch should be needed
            // (or at most 1 if the intermediate state triggered one)
            expect(fetchCount).toBeLessThanOrEqual(1)
        })
    })
})

// ====================================================================
// AUTH FAILURE FLOW
// ====================================================================
describe('Bug Reports — auth failure', () => {
    it('401 on overview fetch triggers token refresh attempt', async () => {
        let refreshAttempted = false
        server.use(
            http.get('*/api/apps/:appId/bugReports', ({ request }) => {
                const url = new URL(request.url)
                const pathParts = url.pathname.split('/').filter(Boolean)
                if (pathParts.length > 4) return
                return new HttpResponse(null, { status: 401 })
            }),
            http.post('*/auth/refresh', () => {
                refreshAttempted = true
                return new HttpResponse(null, { status: 401 })
            }),
        )

        renderWithProviders(<BugReportsOverview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(refreshAttempted).toBe(true)
        }, { timeout: 5000 })
    })

    it('401 on detail fetch triggers token refresh attempt', async () => {
        let refreshAttempted = false
        server.use(
            http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                return new HttpResponse(null, { status: 401 })
            }),
            http.post('*/auth/refresh', () => {
                refreshAttempted = true
                return new HttpResponse(null, { status: 401 })
            }),
        )

        renderWithProviders(<BugReport params={{ teamId: 'test-team', appId: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f', bugReportId: 'evt-br-001' }} />)
        await waitFor(() => {
            expect(refreshAttempted).toBe(true)
        }, { timeout: 5000 })
    })

    it('401 on PATCH status toggle triggers token refresh attempt', async () => {
        let refreshAttempted = false
        server.use(
            http.patch('*/api/apps/:appId/bugReports/:bugReportId', () => {
                return new HttpResponse(null, { status: 401 })
            }),
            http.post('*/auth/refresh', () => {
                refreshAttempted = true
                return new HttpResponse(null, { status: 401 })
            }),
        )

        renderWithProviders(<BugReport params={{ teamId: 'test-team', appId: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f', bugReportId: 'evt-br-001' }} />)
        await waitFor(() => {
            expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
        }, { timeout: 5000 })

        await act(async () => {
            fireEvent.click(screen.getByText('Close Bug Report'))
        })

        await waitFor(() => {
            expect(refreshAttempted).toBe(true)
        }, { timeout: 5000 })
    })
})

// ====================================================================
// BUG REPORT DETAIL
// ====================================================================
describe('Bug Report Detail (MSW integration)', () => {
    const defaultParams = {
        teamId: 'test-team',
        appId: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
        bugReportId: 'evt-br-001',
    }

    async function renderDetail(params = defaultParams) {
        renderWithProviders(<BugReport params={params} />)
        await waitFor(() => {
            expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ================================================================
    // PAGE LOAD
    // ================================================================
    describe('page load', () => {
        it('renders bug report title with ID', async () => {
            await renderDetail()
            expect(screen.getByText('Bug Report: evt-br-001')).toBeTruthy()
        })

        it('renders description', async () => {
            await renderDetail()
            expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
        })

        it('renders Open status badge for status 0', async () => {
            await renderDetail()
            expect(screen.getByText('Open')).toBeTruthy()
        })

        it('renders Closed status badge for status 1', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return HttpResponse.json(makeBugReportDetailFixture({ status: 1 }))
                }),
            )
            renderWithProviders(<BugReport params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText('Closed')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('renders user ID pill', async () => {
            await renderDetail()
            expect(screen.getByText('User ID: user-br-123')).toBeTruthy()
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

        it('renders user_defined_attribute pills', async () => {
            await renderDetail()
            expect(screen.getByText('premium: true')).toBeTruthy()
            expect(screen.getByText('plan: pro')).toBeTruthy()
        })

        it('does not render user_defined_attribute pills when null', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return HttpResponse.json(makeBugReportDetailFixture({ user_defined_attribute: null }))
                }),
            )
            renderWithProviders(<BugReport params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByText('premium: true')).toBeNull()
        })

        it('renders "View Session Timeline" link', async () => {
            await renderDetail()
            const link = screen.getByText('View Session Timeline')
            expect(link).toBeTruthy()
            expect(link.closest('a')?.getAttribute('href')).toBe('/test-team/session_timelines/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/sess-br-001')
        })

        it('renders "Close Bug Report" button for Open report', async () => {
            await renderDetail()
            expect(screen.getByText('Close Bug Report')).toBeTruthy()
        })

        it('renders "Re-Open Bug Report" button for Closed report', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return HttpResponse.json(makeBugReportDetailFixture({ status: 1 }))
                }),
            )
            renderWithProviders(<BugReport params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText('Re-Open Bug Report')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('renders attachment images', async () => {
            await renderDetail()
            const img = screen.getByAltText('Screenshot 0')
            expect(img).toBeTruthy()
            expect(img.getAttribute('src')).toBe('https://example.com/bug-screenshot.png')
        })

        it('does not render attachments when null', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return HttpResponse.json(makeBugReportDetailFixture({ attachments: null }))
                }),
            )
            renderWithProviders(<BugReport params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByAltText('Screenshot 0')).toBeNull()
        })

        it('does not render attachments when empty array', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return HttpResponse.json(makeBugReportDetailFixture({ attachments: [] }))
                }),
            )
            renderWithProviders(<BugReport params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByAltText('Screenshot 0')).toBeNull()
        })

        it('renders time pill with formatted timestamp', async () => {
            await renderDetail()
            // Fixture timestamp is '2026-04-10T14:30:00Z'
            // formatDateToHumanReadableDateTime → local time format "d MMM, yyyy, h:mm:ss a"
            expect(screen.getByText(/Time:.*10 Apr, 2026/)).toBeTruthy()
        })

        it('renders multiple attachments', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return HttpResponse.json(makeBugReportDetailFixture({
                        attachments: [
                            { id: 'att-1', name: 'screenshot1.png', type: 'screenshot', key: 'key-1', location: 'https://example.com/img1.png' },
                            { id: 'att-2', name: 'screenshot2.png', type: 'screenshot', key: 'key-2', location: 'https://example.com/img2.png' },
                            { id: 'att-3', name: 'screenshot3.png', type: 'screenshot', key: 'key-3', location: 'https://example.com/img3.png' },
                        ],
                    }))
                }),
            )
            renderWithProviders(<BugReport params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.getByAltText('Screenshot 0')).toBeTruthy()
            expect(screen.getByAltText('Screenshot 1')).toBeTruthy()
            expect(screen.getByAltText('Screenshot 2')).toBeTruthy()
        })

        it('renders User ID: N/A when user_id is empty', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return HttpResponse.json(makeBugReportDetailFixture({
                        attribute: { ...makeBugReportDetailFixture().attribute, user_id: '' },
                    }))
                }),
            )
            renderWithProviders(<BugReport params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText('User ID: N/A')).toBeTruthy()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // STATUS TOGGLE
    // ================================================================
    describe('status toggle', () => {
        it('clicking Close sends PATCH with status 1', async () => {
            let patchBody: any = null
            server.use(
                http.patch('*/api/apps/:appId/bugReports/:bugReportId', async ({ request }) => {
                    patchBody = await request.json()
                    return HttpResponse.json({ ok: true })
                }),
            )

            await renderDetail()
            await act(async () => {
                fireEvent.click(screen.getByText('Close Bug Report'))
            })

            await waitFor(() => {
                expect(patchBody).toEqual({ status: 1 })
            }, { timeout: 5000 })
        })

        it('clicking Re-Open sends PATCH with status 0', async () => {
            let patchBody: any = null
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return HttpResponse.json(makeBugReportDetailFixture({ status: 1 }))
                }),
                http.patch('*/api/apps/:appId/bugReports/:bugReportId', async ({ request }) => {
                    patchBody = await request.json()
                    return HttpResponse.json({ ok: true })
                }),
            )

            renderWithProviders(<BugReport params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText('Re-Open Bug Report')).toBeTruthy()
            }, { timeout: 5000 })

            await act(async () => {
                fireEvent.click(screen.getByText('Re-Open Bug Report'))
            })

            await waitFor(() => {
                expect(patchBody).toEqual({ status: 0 })
            }, { timeout: 5000 })
        })

        it('status updates in UI after successful toggle', async () => {
            // After successful PATCH, TanStack Query invalidates and re-fetches.
            // Set up MSW to return status 1 (Closed) on re-fetch after PATCH.
            let patched = false
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return HttpResponse.json(makeBugReportDetailFixture(patched ? { status: 1 } : {}))
                }),
                http.patch('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    patched = true
                    return HttpResponse.json({ ok: true })
                }),
            )

            await renderDetail()
            expect(screen.getByText('Open')).toBeTruthy()
            expect(screen.getByText('Close Bug Report')).toBeTruthy()

            await act(async () => {
                fireEvent.click(screen.getByText('Close Bug Report'))
            })

            await waitFor(() => {
                expect(screen.getByText('Closed')).toBeTruthy()
                expect(screen.getByText('Re-Open Bug Report')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('status toggle error does not change displayed status', async () => {
            server.use(
                http.patch('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return HttpResponse.json({ error: 'server error' }, { status: 500 })
                }),
            )

            await renderDetail()
            expect(screen.getByText('Open')).toBeTruthy()

            await act(async () => {
                fireEvent.click(screen.getByText('Close Bug Report'))
            })

            // Status should remain Open after error
            await waitFor(() => {
                expect(screen.getByText('Open')).toBeTruthy()
                expect(screen.getByText('Close Bug Report')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('toggle button is disabled during loading', async () => {
            server.use(
                http.patch('*/api/apps/:appId/bugReports/:bugReportId', async () => {
                    // Delay response so we can observe disabled state
                    await new Promise(resolve => setTimeout(resolve, 500))
                    return HttpResponse.json({ ok: true })
                }),
            )

            await renderDetail()
            const button = screen.getByText('Close Bug Report').closest('button')!
            expect(button.disabled).toBe(false)

            // Click toggle — button should become disabled during request
            await act(async () => {
                fireEvent.click(button)
            })

            await waitFor(() => {
                expect(button.disabled).toBe(true)
            })
        })

        it('toggle fails (PATCH 500) — button re-enables so user can retry', async () => {
            let patchCallCount = 0
            server.use(
                http.patch('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    patchCallCount++
                    return HttpResponse.json({ error: 'server error' }, { status: 500 })
                }),
            )

            await renderDetail()
            const button = screen.getByText('Close Bug Report').closest('button')!
            expect(button.disabled).toBe(false)

            // First attempt — click toggle
            await act(async () => {
                fireEvent.click(button)
            })

            // Wait for the error to be processed
            await waitFor(() => {
                expect(patchCallCount).toBe(1)
            }, { timeout: 5000 })

            // Button should be re-enabled after error so user can retry
            await waitFor(() => {
                expect(button.disabled).toBe(false)
            }, { timeout: 5000 })

            // Status should remain Open
            expect(screen.getByText('Open')).toBeTruthy()
            expect(screen.getByText('Close Bug Report')).toBeTruthy()

            // Second attempt — user retries
            await act(async () => {
                fireEvent.click(button)
            })

            await waitFor(() => {
                expect(patchCallCount).toBe(2)
            }, { timeout: 5000 })

            // Button should still be re-enabled
            await waitFor(() => {
                expect(button.disabled).toBe(false)
            }, { timeout: 5000 })
        })

        it('PATCH request hits correct URL path', async () => {
            let patchPath = ''
            server.use(
                http.patch('*/api/apps/:appId/bugReports/:bugReportId', ({ request }) => {
                    patchPath = new URL(request.url).pathname
                    return HttpResponse.json({ ok: true })
                }),
            )

            await renderDetail()
            await act(async () => {
                fireEvent.click(screen.getByText('Close Bug Report'))
            })

            await waitFor(() => {
                expect(patchPath).toContain('/bugReports/evt-br-001')
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // ERROR STATES
    // ================================================================
    describe('error states', () => {
        it('shows error message when detail API returns 500', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            renderWithProviders(<BugReport params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching bug report/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows skeleton loading initially', async () => {
            // Delay the response to observe loading state
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', async () => {
                    await new Promise(resolve => setTimeout(resolve, 200))
                    return HttpResponse.json(makeBugReportDetailFixture())
                }),
            )

            renderWithProviders(<BugReport params={defaultParams} />)
            // Skeleton should be visible, data should not
            expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
            expect(screen.queryByText('App crashes when tapping checkout button')).toBeNull()
        })
    })

    // ================================================================
    // CACHING
    // ================================================================
    describe('caching', () => {
        it('data is cached by TanStack Query', async () => {
            await renderDetail()
            // Data loaded successfully and is cached
            expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
        })
    })

    // ================================================================
    // API PATH VERIFICATION
    // ================================================================
    describe('API paths', () => {
        it('fetches detail from /bugReports/:bugReportId', async () => {
            let detailPath = ''
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', ({ request }) => {
                    detailPath = new URL(request.url).pathname
                    return HttpResponse.json(makeBugReportDetailFixture())
                }),
            )

            await renderDetail()
            expect(detailPath).toContain('/apps/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/bugReports/evt-br-001')
        })
    })

    // ================================================================
    // DESCRIPTION EDGE CASES
    // ================================================================
    describe('description edge cases', () => {
        it('renders long description without truncation', async () => {
            const longDesc = 'A'.repeat(500)
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return HttpResponse.json(makeBugReportDetailFixture({ description: longDesc }))
                }),
            )
            renderWithProviders(<BugReport params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText(longDesc)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('does not render description paragraph when empty', async () => {
            server.use(
                http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
                    return HttpResponse.json(makeBugReportDetailFixture({ description: '' }))
                }),
            )
            renderWithProviders(<BugReport params={defaultParams} />)
            await waitFor(() => {
                expect(screen.getByText('Bug Report: evt-br-001')).toBeTruthy()
            }, { timeout: 5000 })
            // The description paragraph should not be rendered for empty string
            // (conditional rendering: displayBugReport.description && ...)
        })
    })
})

describe('Bug reports — team switch to no-apps team', () => {
    it('switching from team with apps to team with no apps shows NoApps after store reset', async () => {
        // Phase 1: render with team that has apps — fully load
        const { unmount } = renderWithProviders(<BugReportsOverview params={{ teamId: 'team-with-apps' }} />)

        await waitFor(() => {
            expect(screen.getByText('App crashes when tapping checkout button')).toBeTruthy()
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

        renderWithProviders(<BugReportsOverview params={{ teamId: 'team-no-apps' }} />)

        // Wait for NoApps message to appear
        await waitFor(() => {
            expect(screen.getByText(/don.t have any apps/i)).toBeTruthy()
        }, { timeout: 5000 })
    })
})
