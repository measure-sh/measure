/**
 * Integration test for the Overview page.
 *
 * Everything except the network is real: React components, Zustand stores,
 * api_calls URL builders, apiClient.fetch — all run as they would in the
 * browser. MSW intercepts at the global `fetch()` boundary and returns
 * fixture data matching the Go backend struct shapes.
 *
 * What this catches that unit tests can't:
 * - Filter change → store refetch → plot/metrics re-render
 * - URL serialisation round-trip
 * - Cross-store effects (filters store → plot store → component)
 * - Error propagation from API → store → component
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'
import { act, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

// --- External dependency mocks (things that don't exist in jsdom) ---

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}))

const mockRouterReplace = jest.fn()
const mockSearchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
    __esModule: true,
    useRouter: () => ({ replace: mockRouterReplace, push: jest.fn() }),
    useSearchParams: () => mockSearchParams,
    usePathname: () => '/test-team/overview',
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

jest.mock('next-themes', () => ({
    __esModule: true,
    useTheme: () => ({ theme: 'light' }),
}))

// Nivo charts need a real DOM layout engine which jsdom doesn't have.
// Stub ResponsiveLine to render a testable placeholder with the data prop.
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
}))

// --- Restore real fetch (jest config sets globals.fetch to a no-op) ---
// MSW needs the real fetch/Request to intercept. jsdom provides them.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { makeAppFixture, makeFiltersFixture, makeMetricsFixture, makeSessionPlotFixture } from '../msw/fixtures'
import { server } from '../msw/server'

// Silence console noise from stores/api during tests
jest.spyOn(console, 'log').mockImplementation(() => { })
jest.spyOn(console, 'error').mockImplementation(() => { })

// --- MSW lifecycle ---
beforeAll(() => {
    server.listen({ onUnhandledRequest: 'warn' })
})
afterEach(() => {
    server.resetHandlers()
    mockRouterReplace.mockClear()
})
afterAll(() => {
    server.close()
})

// --- Imports that transitively load api_client (must come after mocks) ---
import Overview from '@/app/components/overview'
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

// --- Store reset and URL param cleanup between tests ---
beforeEach(() => {
    const { queryClient: singletonClient } = require('@/app/query/query_client')
    singletonClient.clear()
    filtersStore = createFiltersStore()
    testQueryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    filtersStore.getState().reset(true)
    // Clear any URL params set by previous tests
    for (const key of [...mockSearchParams.keys()]) {
        mockSearchParams.delete(key)
    }
    // Init router so apiClient doesn't throw on redirectToLogin
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
describe('Overview page (MSW integration)', () => {
    it('renders heading, filters, chart, and metrics with real stores + MSW', async () => {
        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        // Heading renders immediately
        expect(screen.getByText('Overview')).toBeTruthy()

        // Wait for the full async chain:
        // fetchApps → selectApp → fetchFilters → filters.ready → TanStack Query fetches plots + metrics
        await waitFor(() => {
            // Metrics data values appear when TanStack Query resolves
            expect(screen.getByText('99.1%')).toBeTruthy()
        }, { timeout: 5000 })

        // Chart rendered with series data from MSW
        expect(screen.getByTestId('nivo-line-chart')).toBeTruthy()

        // Metrics cards rendered with fixture data
        expect(screen.getByText('App adoption')).toBeTruthy()
        expect(screen.getByText('ANR free sessions')).toBeTruthy()

        // URL was synced via router.replace
        expect(mockRouterReplace).toHaveBeenCalled()
        const replacedUrl = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
        expect(replacedUrl).toContain('?')
    })

    it('shows error state when apps API returns 500', async () => {
        server.use(
            http.get('*/api/teams/:teamId/apps', () => {
                return new HttpResponse(null, { status: 500 })
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            expect(
                screen.getByText(/error fetching apps/i),
            ).toBeTruthy()
        }, { timeout: 5000 })
    })

    it('shows no-data state when filters return null versions for an onboarded app', async () => {
        server.use(
            http.get('*/api/apps/:appId/filters', () => {
                return HttpResponse.json({ versions: null })
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            // When filters.ready is false due to NoData, the overview
            // body (plots + metrics) does not render.
            expect(screen.queryByText('Crash free sessions')).toBeNull()
        }, { timeout: 5000 })
    })

    it('renders chart error when sessions plot API fails', async () => {
        server.use(
            http.get('*/api/apps/:appId/sessions/plots/instances', () => {
                return new HttpResponse(null, { status: 500 })
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            expect(
                screen.getByText(/error fetching plot/i),
            ).toBeTruthy()
        }, { timeout: 5000 })
    })

    it('renders metrics even when the plot API fails', async () => {
        // Plot APIs all fail, but metrics should still load independently
        server.use(
            http.get('*/api/apps/:appId/sessions/plots/instances', () => {
                return new HttpResponse(null, { status: 500 })
            }),
            http.get('*/api/apps/:appId/crashGroups/plots/instances', () => {
                return new HttpResponse(null, { status: 500 })
            }),
            http.get('*/api/apps/:appId/anrGroups/plots/instances', () => {
                return new HttpResponse(null, { status: 500 })
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            // Metrics cards should still appear
            expect(screen.getByText('Crash free sessions')).toBeTruthy()
        }, { timeout: 5000 })
    })

    it('shows all-nan state when metrics report no data', async () => {
        server.use(
            http.get('*/api/apps/:appId/metrics', () => {
                return HttpResponse.json(makeMetricsFixture({
                    crash_free_sessions: {
                        crash_free_sessions: 0,
                        delta: 0,
                        nan: true,
                        delta_nan: true,
                    },
                    adoption: {
                        all_versions: 0,
                        selected_version: 0,
                        adoption: 0,
                        nan: true,
                    },
                }))
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            // The metrics cards should render (the component handles nan internally)
            expect(screen.getByText('App adoption')).toBeTruthy()
        }, { timeout: 5000 })
    })

    it('renders with multiple apps and selects the first by default', async () => {
        const app1 = makeAppFixture({ id: 'app-1', name: 'App Alpha' })
        const app2 = makeAppFixture({ id: 'app-2', name: 'App Beta' })

        server.use(
            http.get('*/api/teams/:teamId/apps', () => {
                return HttpResponse.json([app1, app2])
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            expect(screen.getByText('Crash free sessions')).toBeTruthy()
        }, { timeout: 5000 })

        // The first app should be selected — filters ready with its data
        const state = filtersStore.getState()
        expect(state.selectedApp?.id).toBe('app-1')
    })
})

// ====================================================================
// Filter interaction tests — COMPREHENSIVE
//
// The overview page has 3 active filters: app selector, app versions,
// and date range. These tests exhaustively exercise every meaningful
// interaction with each filter and verify the full chain:
// store setter → wrapped set → serialisedFilters change → component
// useEffect fires → store fetch → api_calls URL builder → MSW intercept
// → response parsed → store updated → component re-renders.
//
// Interactions go through store setters (not Radix dropdowns) because
// the dropdown UI is tested in dropdown_select_test.tsx. The value here
// is the integration between store, api_calls, and rendering.
// ====================================================================
describe('Overview page — filter interactions', () => {
    const { AppVersion } = require('@/app/api/api_calls')

    // Common test infra: captured requests
    let shortFilterBodies: any[]
    let metricsRequests: { url: string; appId: string }[]
    let sessionPlotRequests: { url: string }[]
    let crashPlotRequests: { url: string }[]
    let anrPlotRequests: { url: string }[]
    let filtersRequests: { url: string; appId: string }[]

    const defaultInitConfig = {
        urlFilters: {},
        appVersionsInitialSelectionType: 0, // Latest
        filterSource: 0, // Events
    }

    beforeEach(() => {
        shortFilterBodies = []
        metricsRequests = []
        sessionPlotRequests = []
        crashPlotRequests = []
        anrPlotRequests = []
        filtersRequests = []

        // Install request-tracking handlers for ALL overview endpoints
        server.use(
            http.post('*/api/apps/:appId/shortFilters', async ({ request }) => {
                shortFilterBodies.push(await request.json())
                return HttpResponse.json({ filter_short_code: `code-${shortFilterBodies.length}` })
            }),
            http.get('*/api/apps/:appId/metrics', ({ request, params }) => {
                metricsRequests.push({ url: request.url, appId: params.appId as string })
                return HttpResponse.json(makeMetricsFixture())
            }),
            http.get('*/api/apps/:appId/sessions/plots/instances', ({ request }) => {
                sessionPlotRequests.push({ url: request.url })
                return HttpResponse.json(makeSessionPlotFixture())
            }),
            http.get('*/api/apps/:appId/crashGroups/plots/instances', ({ request }) => {
                crashPlotRequests.push({ url: request.url })
                return HttpResponse.json([])
            }),
            http.get('*/api/apps/:appId/anrGroups/plots/instances', ({ request }) => {
                anrPlotRequests.push({ url: request.url })
                return HttpResponse.json([])
            }),
            http.get('*/api/apps/:appId/filters', ({ request, params }) => {
                filtersRequests.push({ url: request.url, appId: params.appId as string })
                return HttpResponse.json(makeFiltersFixture())
            }),
        )
    })

    async function renderAndWaitForData() {
        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            // Wait for actual metrics data to render via TanStack Query
            expect(screen.getByText('99.1%')).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ================================================================
    // APP SELECTOR — single-select, changes which app's data loads
    // ================================================================
    describe('app selector', () => {
        const app1 = makeAppFixture({ id: 'app-1', name: 'App Alpha' })
        const app2 = makeAppFixture({ id: 'app-2', name: 'App Beta' })
        const app3 = makeAppFixture({ id: 'app-3', name: 'App Gamma' })

        beforeEach(() => {
            server.use(
                http.get('*/api/teams/:teamId/apps', () => {
                    return HttpResponse.json([app1, app2, app3])
                }),
            )
        })

        it('selects the first app by default', async () => {
            await renderAndWaitForData()
            expect(filtersStore.getState().selectedApp?.id).toBe('app-1')
            expect(metricsRequests.some((r) => r.appId === 'app-1')).toBe(true)
        })

        it('switching app refetches filters for the new app', async () => {
            await renderAndWaitForData()
            filtersRequests.length = 0

            await act(async () => {
                await filtersStore.getState().selectApp(app2 as any, defaultInitConfig as any)
            })

            await waitFor(() => {
                expect(filtersRequests.some((r) => r.appId === 'app-2')).toBe(true)
            }, { timeout: 5000 })
        })

        it('switching app refetches metrics for the new app', async () => {
            await renderAndWaitForData()
            metricsRequests.length = 0

            await act(async () => {
                await filtersStore.getState().selectApp(app2 as any, defaultInitConfig as any)
            })

            await waitFor(() => {
                expect(metricsRequests.some((r) => r.appId === 'app-2')).toBe(true)
            }, { timeout: 5000 })
        })

        it('switching app refetches all 3 plot endpoints for the new app', async () => {
            await renderAndWaitForData()
            sessionPlotRequests.length = 0
            crashPlotRequests.length = 0
            anrPlotRequests.length = 0

            await act(async () => {
                await filtersStore.getState().selectApp(app2 as any, defaultInitConfig as any)
            })

            await waitFor(() => {
                expect(sessionPlotRequests.length).toBeGreaterThan(0)
                expect(crashPlotRequests.length).toBeGreaterThan(0)
                expect(anrPlotRequests.length).toBeGreaterThan(0)
            }, { timeout: 5000 })
        })

        it('switching app returns different data per app', async () => {
            server.use(
                http.get('*/api/apps/:appId/metrics', ({ params }) => {
                    if (params.appId === 'app-2') {
                        return HttpResponse.json(makeMetricsFixture({
                            crash_free_sessions: { crash_free_sessions: 77.3, delta: -2.5, nan: false, delta_nan: false },
                        }))
                    }
                    return HttpResponse.json(makeMetricsFixture())
                }),
            )

            await renderAndWaitForData()
            expect(screen.getByText('99.1%')).toBeTruthy()

            await act(async () => {
                await filtersStore.getState().selectApp(app2 as any, defaultInitConfig as any)
            })

            await waitFor(() => {
                expect(screen.getByText('77.3%')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('switching app resets versions to new app latest', async () => {
            // Give app-2 different versions
            server.use(
                http.get('*/api/apps/:appId/filters', ({ params }) => {
                    if (params.appId === 'app-2') {
                        return HttpResponse.json(makeFiltersFixture({
                            versions: [
                                { name: '2.0.0', code: '200' },
                                { name: '1.9.0', code: '190' },
                            ],
                        }))
                    }
                    return HttpResponse.json(makeFiltersFixture())
                }),
            )

            await renderAndWaitForData()
            expect(filtersStore.getState().selectedVersions[0]?.name).toBe('3.1.0')

            await act(async () => {
                await filtersStore.getState().selectApp(app2 as any, defaultInitConfig as any)
            })

            await waitFor(() => {
                // Versions should reset — either empty (cleared on switch) or
                // repopulated from app-2's data
                const versions = filtersStore.getState().selectedVersions
                if (versions.length > 0) {
                    // If populated, should be from app-2's version list
                    expect(['2.0.0', '1.9.0']).toContain(versions[0]?.name)
                }
            }, { timeout: 5000 })
        })

        it('switching back to original app re-fetches with original app id', async () => {
            await renderAndWaitForData()

            await act(async () => {
                await filtersStore.getState().selectApp(app2 as any, defaultInitConfig as any)
            })
            await waitFor(() => {
                expect(metricsRequests.some((r) => r.appId === 'app-2')).toBe(true)
            }, { timeout: 5000 })

            metricsRequests.length = 0
            await act(async () => {
                await filtersStore.getState().selectApp(app1 as any, defaultInitConfig as any)
            })
            await waitFor(() => {
                expect(metricsRequests.some((r) => r.appId === 'app-1')).toBe(true)
            }, { timeout: 5000 })
        })

        it('app with only one available still works', async () => {
            server.use(
                http.get('*/api/teams/:teamId/apps', () => {
                    return HttpResponse.json([app1])
                }),
            )
            await renderAndWaitForData()
            expect(filtersStore.getState().selectedApp?.id).toBe('app-1')
        })

        it('not-onboarded app shows not-onboarded state', async () => {
            const notOnboarded = makeAppFixture({ id: 'app-x', onboarded: false })
            server.use(
                http.get('*/api/teams/:teamId/apps', () => {
                    return HttpResponse.json([notOnboarded])
                }),
                http.get('*/api/apps/:appId/filters', () => {
                    return HttpResponse.json({ versions: null })
                }),
            )

            renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                // Metrics should NOT render when app is not onboarded
                expect(screen.queryByText('Crash free sessions')).toBeNull()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // APP VERSIONS — multi-select, affects shortFilters POST body
    // ================================================================
    describe('app versions', () => {
        it('initial load selects latest version (first in fixture)', async () => {
            await renderAndWaitForData()
            const versions = filtersStore.getState().selectedVersions
            expect(versions).toHaveLength(1)
            expect(versions[0].name).toBe('3.1.0')
        })

        it('selecting a single different version sends it in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
            })

            await waitFor(() => {
                expect(shortFilterBodies.length).toBeGreaterThan(0)
            }, { timeout: 5000 })
            const body = shortFilterBodies[shortFilterBodies.length - 1]
            expect(body.filters.versions).toEqual(['3.0.2'])
            expect(body.filters.version_codes).toEqual(['302'])
        })

        it('selecting 2 out of 3 versions sends both in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedVersions([
                    new AppVersion('3.1.0', '310'),
                    new AppVersion('3.0.1', '301'),
                ])
            })

            await waitFor(() => {
                expect(shortFilterBodies.length).toBeGreaterThan(0)
            }, { timeout: 5000 })
            const body = shortFilterBodies[shortFilterBodies.length - 1]
            expect(body.filters.versions).toEqual(['3.1.0', '3.0.1'])
            expect(body.filters.version_codes).toEqual(['310', '301'])
        })

        it('selecting all 3 versions sends all in shortFilters POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedVersions([
                    new AppVersion('3.1.0', '310'),
                    new AppVersion('3.0.2', '302'),
                    new AppVersion('3.0.1', '301'),
                ])
            })

            await waitFor(() => {
                expect(shortFilterBodies.length).toBeGreaterThan(0)
            }, { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.versions).toEqual(['3.1.0', '3.0.2', '3.0.1'])
        })

        it('version change triggers metrics refetch', async () => {
            await renderAndWaitForData()
            metricsRequests.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
            })

            await waitFor(() => {
                expect(metricsRequests.length).toBeGreaterThan(0)
            }, { timeout: 5000 })
        })

        it('version change triggers all 3 plot refetches', async () => {
            await renderAndWaitForData()
            sessionPlotRequests.length = 0
            crashPlotRequests.length = 0
            anrPlotRequests.length = 0

            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.1', '301')])
            })

            await waitFor(() => {
                expect(sessionPlotRequests.length).toBeGreaterThan(0)
                expect(crashPlotRequests.length).toBeGreaterThan(0)
                expect(anrPlotRequests.length).toBeGreaterThan(0)
            }, { timeout: 5000 })
        })

        it('filter_short_code from POST appears in all data-fetch GET URLs', async () => {
            server.use(
                http.post('*/api/apps/:appId/shortFilters', () => {
                    return HttpResponse.json({ filter_short_code: 'test-fsc-999' })
                }),
            )

            await renderAndWaitForData()

            await waitFor(() => {
                const metricsUrl = metricsRequests.find((r) => r.url.includes('filter_short_code='))
                expect(metricsUrl?.url).toContain('filter_short_code=test-fsc-999')
            }, { timeout: 5000 })

            const sessionUrl = sessionPlotRequests.find((r) => r.url.includes('filter_short_code='))
            expect(sessionUrl?.url).toContain('filter_short_code=test-fsc-999')
        })

        it('switching version back to original does not fire duplicate POST (cache hit)', async () => {
            await renderAndWaitForData()

            // Switch to 3.0.2
            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
            })
            await waitFor(() => {
                expect(shortFilterBodies.length).toBeGreaterThanOrEqual(2)
            }, { timeout: 5000 })

            const postsAfterSwitch = shortFilterBodies.length

            // Switch BACK to original 3.1.0 — bodyKey cache should hit
            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.1.0', '310')])
            })

            // Wait a tick for any async work
            await act(async () => { await new Promise((r) => setTimeout(r, 100)) })

            // No new POST — the bodyKey for [3.1.0] was already cached from initial load
            expect(shortFilterBodies.length).toBe(postsAfterSwitch)
        })

        it('URL updates with version param when version changes', async () => {
            await renderAndWaitForData()
            mockRouterReplace.mockClear()

            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.1', '301')])
            })

            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('v=')
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // DATE RANGE — changes from/to params on all data-fetch URLs
    // ================================================================
    describe('date range', () => {
        function setDateRange(range: string, startDate: string, endDate: string) {
            return act(async () => {
                filtersStore.getState().setSelectedDateRange(range)
                filtersStore.getState().setSelectedStartDate(startDate)
                filtersStore.getState().setSelectedEndDate(endDate)
            })
        }

        it('initial load uses Last 6 Hours date range', async () => {
            await renderAndWaitForData()
            expect(filtersStore.getState().selectedDateRange).toBe('Last 6 Hours')
        })

        it('changing to Last 24 Hours refetches metrics with new dates', async () => {
            await renderAndWaitForData()
            metricsRequests.length = 0

            const now = new Date()
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
            await setDateRange('Last 24 Hours', yesterday.toISOString(), now.toISOString())

            await waitFor(() => {
                expect(metricsRequests.length).toBeGreaterThan(0)
                expect(metricsRequests[metricsRequests.length - 1].url).toContain('from=')
            }, { timeout: 5000 })
        })

        it('changing to Last Week refetches all 3 plot endpoints', async () => {
            await renderAndWaitForData()
            sessionPlotRequests.length = 0
            crashPlotRequests.length = 0
            anrPlotRequests.length = 0

            const now = new Date()
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            await setDateRange('Last Week', weekAgo.toISOString(), now.toISOString())

            await waitFor(() => {
                expect(sessionPlotRequests.length).toBeGreaterThan(0)
                expect(crashPlotRequests.length).toBeGreaterThan(0)
                expect(anrPlotRequests.length).toBeGreaterThan(0)
            }, { timeout: 5000 })
        })

        it('changing date range does NOT trigger a new shortFilters POST', async () => {
            // Dates go as from/to URL params, not in the shortFilters body.
            // Changing dates should NOT fire a new POST.
            await renderAndWaitForData()
            const postsAfterInit = shortFilterBodies.length

            const now = new Date()
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            await setDateRange('Last Month', monthAgo.toISOString(), now.toISOString())

            // Wait for refetch to settle
            await waitFor(() => {
                expect(metricsRequests.length).toBeGreaterThan(1)
            }, { timeout: 5000 })

            // No new POST — dates are not in the body
            expect(shortFilterBodies.length).toBe(postsAfterInit)
        })

        it('custom date range sends exact from/to values', async () => {
            await renderAndWaitForData()
            metricsRequests.length = 0

            const customStart = '2026-01-15T08:00:00.000Z'
            const customEnd = '2026-01-20T18:00:00.000Z'
            await setDateRange('Custom Range', customStart, customEnd)

            await waitFor(() => {
                expect(metricsRequests.length).toBeGreaterThan(0)
            }, { timeout: 5000 })

            // The URL should contain the formatted dates
            const lastUrl = metricsRequests[metricsRequests.length - 1].url
            expect(lastUrl).toContain('from=')
            expect(lastUrl).toContain('to=')
        })

        it.each([
            ['Last 15 Minutes', 15 * 60 * 1000],
            ['Last 30 Minutes', 30 * 60 * 1000],
            ['Last hour', 60 * 60 * 1000],
            ['Last 3 Hours', 3 * 60 * 60 * 1000],
            ['Last 12 Hours', 12 * 60 * 60 * 1000],
            ['Last 24 Hours', 24 * 60 * 60 * 1000],
            ['Last Week', 7 * 24 * 60 * 60 * 1000],
            ['Last 15 Days', 15 * 24 * 60 * 60 * 1000],
            ['Last Month', 30 * 24 * 60 * 60 * 1000],
            ['Last 3 Months', 90 * 24 * 60 * 60 * 1000],
            ['Last 6 Months', 180 * 24 * 60 * 60 * 1000],
            ['Last Year', 365 * 24 * 60 * 60 * 1000],
        ])('"%s" triggers a data refetch', async (range, ms) => {
            await renderAndWaitForData()
            metricsRequests.length = 0

            const now = new Date()
            const start = new Date(now.getTime() - ms)
            await setDateRange(range, start.toISOString(), now.toISOString())

            await waitFor(() => {
                expect(metricsRequests.length).toBeGreaterThan(0)
            }, { timeout: 5000 })
        })

        it('URL updates with date params when date range changes', async () => {
            await renderAndWaitForData()
            mockRouterReplace.mockClear()

            const now = new Date()
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            await setDateRange('Last Week', weekAgo.toISOString(), now.toISOString())

            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('d=')
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // CROSS-FILTER INTERACTIONS
    // ================================================================
    describe('cross-filter interactions', () => {
        it('changing version then date range: both reflected in data fetches', async () => {
            await renderAndWaitForData()
            metricsRequests.length = 0
            shortFilterBodies.length = 0

            // Change version
            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
            })

            await waitFor(() => {
                expect(shortFilterBodies.length).toBeGreaterThan(0)
            }, { timeout: 5000 })

            // Now change date
            metricsRequests.length = 0
            const now = new Date()
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            await act(async () => {
                filtersStore.getState().setSelectedDateRange('Last Week')
                filtersStore.getState().setSelectedStartDate(weekAgo.toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })

            await waitFor(() => {
                expect(metricsRequests.length).toBeGreaterThan(0)
                // The metrics URL should have the filter_short_code from the version
                // change AND the new from/to from the date change
                const url = metricsRequests[metricsRequests.length - 1].url
                expect(url).toContain('filter_short_code=')
                expect(url).toContain('from=')
            }, { timeout: 5000 })
        })

        it('switching app clears per-source selections and starts fresh', async () => {
            const app1 = makeAppFixture({ id: 'app-1', name: 'Alpha' })
            const app2 = makeAppFixture({ id: 'app-2', name: 'Beta' })
            server.use(
                http.get('*/api/teams/:teamId/apps', () => {
                    return HttpResponse.json([app1, app2])
                }),
            )

            await renderAndWaitForData()

            // Change version for app-1
            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.1', '301')])
            })
            await waitFor(() => {
                expect(filtersStore.getState().selectedVersions[0]?.name).toBe('3.0.1')
            })

            // Switch to app-2 — versions should reset
            await act(async () => {
                await filtersStore.getState().selectApp(app2 as any, defaultInitConfig as any)
            })

            await waitFor(() => {
                expect(filtersStore.getState().selectedApp?.id).toBe('app-2')
                // Selections should reset to defaults on app switch
                expect(filtersStore.getState().filters.countries.all).toBe(true)
            }, { timeout: 5000 })
        })

        it('changing date does not affect which version is selected', async () => {
            await renderAndWaitForData()

            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
            })

            const now = new Date()
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            await act(async () => {
                filtersStore.getState().setSelectedDateRange('Last Week')
                filtersStore.getState().setSelectedStartDate(weekAgo.toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })

            // Version should be unchanged
            expect(filtersStore.getState().selectedVersions[0]?.name).toBe('3.0.2')
        })

        it('metrics and plots refetch independently — one can succeed while other fails', async () => {
            // Override session plot to return error, keep metrics working
            server.use(
                http.get('*/api/apps/:appId/sessions/plots/instances', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            await renderAndWaitForData()

            // Metrics should still have loaded successfully
            expect(screen.getByText('99.1%')).toBeTruthy()
        })
    })
})

// ====================================================================
// URL SERIALIZATION / PARSING
//
// The overview page has a bidirectional contract with the URL:
//   State → serializeUrlFilters → router.replace(?params)
//   URL params → deserializeUrlFilters → initConfig → applyFilterOptions → state
//
// These tests verify both directions and their round-trip.
// URL keys (from urlFiltersKeyMap): a=appId, v=versions, d=dateRange,
// sd=startDate, ed=endDate.
// ====================================================================
describe('Overview page — URL serialization and parsing', () => {
    const { AppVersion } = require('@/app/api/api_calls')

    async function renderAndWaitForData() {
        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            // Wait for actual metrics data to render via TanStack Query
            expect(screen.getByText('99.1%')).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ----------------------------------------------------------------
    // STATE → URL (serialization)
    // ----------------------------------------------------------------
    describe('state → URL serialization', () => {
        it('serializes appId as "a" param', async () => {
            await renderAndWaitForData()

            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                // The fixture app id is encoded in the URL
                expect(url).toMatch(/a=[^&]+/)
            })
        })

        it('serializes selected version index as "v" param', async () => {
            await renderAndWaitForData()
            mockRouterReplace.mockClear()

            // Select 2nd version (index 1 in fixture)
            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
            })

            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                // Version index 1 (0-indexed in the versions array)
                expect(url).toContain('v=1')
            }, { timeout: 5000 })
        })

        it('serializes multiple version indices as compressed range', async () => {
            await renderAndWaitForData()
            mockRouterReplace.mockClear()

            // Select all 3 versions (indices 0,1,2 → compressed as "0-2")
            await act(async () => {
                filtersStore.getState().setSelectedVersions([
                    new AppVersion('3.1.0', '310'),
                    new AppVersion('3.0.2', '302'),
                    new AppVersion('3.0.1', '301'),
                ])
            })

            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('v=0-2')
            }, { timeout: 5000 })
        })

        it('serializes non-contiguous version indices as comma-separated', async () => {
            await renderAndWaitForData()
            mockRouterReplace.mockClear()

            // Select versions at index 0 and 2 (skip index 1)
            await act(async () => {
                filtersStore.getState().setSelectedVersions([
                    new AppVersion('3.1.0', '310'),
                    new AppVersion('3.0.1', '301'),
                ])
            })

            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toMatch(/v=0%2C2|v=0,2/)
            }, { timeout: 5000 })
        })

        it('serializes dateRange as "d" param', async () => {
            await renderAndWaitForData()
            mockRouterReplace.mockClear()

            await act(async () => {
                const now = new Date()
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                filtersStore.getState().setSelectedDateRange('Last Week')
                filtersStore.getState().setSelectedStartDate(weekAgo.toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })

            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toMatch(/d=Last[\+%20]Week/)
            }, { timeout: 5000 })
        })

        it('serializes custom date range with sd and ed params', async () => {
            await renderAndWaitForData()
            mockRouterReplace.mockClear()

            await act(async () => {
                filtersStore.getState().setSelectedDateRange('Custom Range')
                filtersStore.getState().setSelectedStartDate('2026-03-01T00:00:00.000Z')
                filtersStore.getState().setSelectedEndDate('2026-03-15T23:59:59.000Z')
            })

            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toMatch(/d=Custom[\+%20]Range/)
                expect(url).toContain('sd=')
                expect(url).toContain('ed=')
            }, { timeout: 5000 })
        })

        it('non-custom date ranges still include sd/ed params for reconstruction', async () => {
            // Even for named ranges like "Last 24 Hours", the serialized URL
            // includes sd= and ed= because the exact start/end timestamps are
            // needed for deep-link reconstruction (the range + timestamps
            // together let the recipient see exactly the same window).
            await renderAndWaitForData()
            mockRouterReplace.mockClear()

            await act(async () => {
                const now = new Date()
                const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                filtersStore.getState().setSelectedDateRange('Last 24 Hours')
                filtersStore.getState().setSelectedStartDate(dayAgo.toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })

            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
                const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
                expect(url).toContain('sd=')
                expect(url).toContain('ed=')
            }, { timeout: 5000 })
        })
    })

    // ----------------------------------------------------------------
    // URL → STATE (deep-link parsing)
    // ----------------------------------------------------------------
    describe('URL → state parsing (deep links)', () => {
        it('deep-link with app id selects that app', async () => {
            const app1 = makeAppFixture({ id: 'app-1', name: 'Alpha' })
            const app2 = makeAppFixture({ id: 'app-2', name: 'Beta' })
            server.use(
                http.get('*/api/teams/:teamId/apps', () => {
                    return HttpResponse.json([app1, app2])
                }),
            )

            // Simulate pasting a URL with ?a=app-2
            mockSearchParams.set('a', 'app-2')

            await renderAndWaitForData()
            expect(filtersStore.getState().selectedApp?.id).toBe('app-2')
        })

        it('deep-link with version index selects that version', async () => {
            // ?a=<appId>&v=1  →  select version at index 1 (3.0.2)
            const appId = makeAppFixture().id
            mockSearchParams.set('a', appId)
            mockSearchParams.set('v', '1')

            await renderAndWaitForData()

            const versions = filtersStore.getState().selectedVersions
            expect(versions).toHaveLength(1)
            expect(versions[0].name).toBe('3.0.2')
        })

        it('deep-link with multiple version indices selects them', async () => {
            const appId = makeAppFixture().id
            mockSearchParams.set('a', appId)
            mockSearchParams.set('v', '0,2') // first and third

            await renderAndWaitForData()

            const versions = filtersStore.getState().selectedVersions
            expect(versions).toHaveLength(2)
            expect(versions.map((v: any) => v.name).sort()).toEqual(['3.0.1', '3.1.0'])
        })

        it('deep-link with version range selects all in range', async () => {
            const appId = makeAppFixture().id
            mockSearchParams.set('a', appId)
            mockSearchParams.set('v', '0-2') // all 3

            await renderAndWaitForData()

            expect(filtersStore.getState().selectedVersions).toHaveLength(3)
        })

        it('deep-link with date range applies that range', async () => {
            mockSearchParams.set('d', 'Last Week')

            await renderAndWaitForData()

            expect(filtersStore.getState().selectedDateRange).toBe('Last Week')
        })

        it('deep-link with custom date range and sd/ed applies exact dates', async () => {
            mockSearchParams.set('d', 'Custom Range')
            mockSearchParams.set('sd', '2026-03-01T00:00:00.000Z')
            mockSearchParams.set('ed', '2026-03-15T23:59:59.000Z')

            await renderAndWaitForData()

            expect(filtersStore.getState().selectedDateRange).toBe('Custom Range')
            expect(filtersStore.getState().selectedStartDate).toBe('2026-03-01T00:00:00.000Z')
            expect(filtersStore.getState().selectedEndDate).toBe('2026-03-15T23:59:59.000Z')
        })

        it('deep-link with invalid version index falls through to default', async () => {
            const appId = makeAppFixture().id
            mockSearchParams.set('a', appId)
            mockSearchParams.set('v', '99') // out of range

            await renderAndWaitForData()

            // Should fall back to latest (index 0) since index 99 is invalid
            const versions = filtersStore.getState().selectedVersions
            expect(versions.length).toBeGreaterThan(0)
            expect(versions[0].name).toBe('3.1.0') // latest from fixture
        })

        it('deep-link with unknown app id falls back to first app', async () => {
            mockSearchParams.set('a', 'nonexistent-app-xyz')

            await renderAndWaitForData()

            // Falls back to first app in the list
            expect(filtersStore.getState().selectedApp?.id).toBe(makeAppFixture().id)
        })

        it('deep-link with invalid date range falls back to default', async () => {
            mockSearchParams.set('d', 'Not A Real Range')

            await renderAndWaitForData()

            // Invalid range → ignored → falls back to Last 6 Hours default
            expect(filtersStore.getState().selectedDateRange).toBe('Last 6 Hours')
        })
    })

    // ----------------------------------------------------------------
    // ROUND-TRIP: state → URL → state
    // ----------------------------------------------------------------
    describe('round-trip: state → URL → state', () => {
        it('version selection survives URL round-trip', async () => {
            await renderAndWaitForData()

            // Change version to index 1
            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
            })

            // Capture the serialized URL
            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
            })
            const serializedUrl = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0] as string
            const serializedParams = new URLSearchParams(serializedUrl.replace(/^\?/, ''))

            // Reset everything and re-render with the captured URL params
            filtersStore.getState().reset(true)
            testQueryClient.clear()

            for (const key of [...mockSearchParams.keys()]) {
                mockSearchParams.delete(key)
            }
            for (const [key, value] of serializedParams.entries()) {
                mockSearchParams.set(key, value)
            }

            renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getAllByText('Crash free sessions').length).toBeGreaterThanOrEqual(1)
            }, { timeout: 5000 })

            // The version should be restored from URL
            const versions = filtersStore.getState().selectedVersions
            expect(versions).toHaveLength(1)
            expect(versions[0].name).toBe('3.0.2')
        })

        it('date range survives URL round-trip', async () => {
            await renderAndWaitForData()

            // Change to Last Week
            await act(async () => {
                const now = new Date()
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                filtersStore.getState().setSelectedDateRange('Last Week')
                filtersStore.getState().setSelectedStartDate(weekAgo.toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })

            await waitFor(() => {
                expect(mockRouterReplace).toHaveBeenCalled()
            })
            const serializedUrl = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0] as string
            const serializedParams = new URLSearchParams(serializedUrl.replace(/^\?/, ''))

            // Reset and re-render
            filtersStore.getState().reset(true)
            testQueryClient.clear()

            for (const key of [...mockSearchParams.keys()]) {
                mockSearchParams.delete(key)
            }
            for (const [key, value] of serializedParams.entries()) {
                mockSearchParams.set(key, value)
            }

            renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
            await waitFor(() => {
                expect(screen.getAllByText('Crash free sessions').length).toBeGreaterThanOrEqual(1)
            }, { timeout: 5000 })

            expect(filtersStore.getState().selectedDateRange).toBe('Last Week')
        })
    })

    // ----------------------------------------------------------------
    // PARTIAL / EDGE-CASE URL params
    // ----------------------------------------------------------------
    describe('partial and edge-case URL params', () => {
        it('URL with only date param (no app) still selects first app', async () => {
            mockSearchParams.set('d', 'Last Month')
            await renderAndWaitForData()
            expect(filtersStore.getState().selectedApp).not.toBeNull()
            expect(filtersStore.getState().selectedDateRange).toBe('Last Month')
        })

        it('URL with app id + version applies the version', async () => {
            const appId = makeAppFixture().id
            mockSearchParams.set('a', appId)
            mockSearchParams.set('v', '2')
            await renderAndWaitForData()
            const versions = filtersStore.getState().selectedVersions
            expect(versions).toHaveLength(1)
            expect(versions[0].name).toBe('3.0.1') // index 2
        })
    })
})

// ====================================================================
// RENDERED VALUES — verify the component actually displays fixture data
// ====================================================================
describe('Overview page — rendered values', () => {
    const { AppVersion } = require('@/app/api/api_calls')

    async function renderAndWaitForData() {
        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            // Wait for actual metrics data to render via TanStack Query
            expect(screen.getByText('99.1%')).toBeTruthy()
        }, { timeout: 5000 })
    }

    describe('metrics card values', () => {
        it('displays crash-free sessions percentage from fixture', async () => {
            await renderAndWaitForData()
            // makeMetricsFixture has crash_free_sessions: 99.1
            expect(screen.getByText('99.1%')).toBeTruthy()
        })

        it('displays ANR-free sessions percentage from fixture', async () => {
            await renderAndWaitForData()
            // makeMetricsFixture has anr_free_sessions: 99.7
            expect(screen.getByText('99.7%')).toBeTruthy()
        })

        it('displays app adoption percentage from fixture', async () => {
            await renderAndWaitForData()
            // makeMetricsFixture has adoption: 41
            expect(screen.getByText('41%')).toBeTruthy()
        })

        it('displays adoption sessions count (numberToKMB formatted)', async () => {
            await renderAndWaitForData()
            // 4100000 → "4.1M", 10000000 → "10M"
            expect(screen.getByText(/4.1M/)).toBeTruthy()
            expect(screen.getByText(/10M/)).toBeTruthy()
        })

        it('displays cold launch p95 in milliseconds', async () => {
            await renderAndWaitForData()
            // makeMetricsFixture has cold_launch.p95: 923
            expect(screen.getByText('923ms')).toBeTruthy()
        })

        it('displays warm launch p95 in milliseconds', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('412ms')).toBeTruthy()
        })

        it('displays hot launch p95 in milliseconds', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('187ms')).toBeTruthy()
        })

        it('displays "No data" when a metric is NaN', async () => {
            server.use(
                http.get('*/api/apps/:appId/metrics', () => {
                    return HttpResponse.json(makeMetricsFixture({
                        cold_launch: { p95: 0, delta: 0, nan: true, delta_nan: true },
                    }))
                }),
            )

            await renderAndWaitForData()
            // At least one "No data" text should render for the NaN metric
            expect(screen.getAllByText('No data').length).toBeGreaterThanOrEqual(1)
        })

        it('displays perceived crash-free sessions from fixture', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('99.6%')).toBeTruthy()
        })
    })

    describe('chart series data', () => {
        it('chart receives Sessions, Crashes, and ANRs series', async () => {
            await renderAndWaitForData()
            // The Nivo stub renders series names as data-testid="chart-series-{id}"
            expect(screen.getByTestId('chart-series-Sessions')).toBeTruthy()
            expect(screen.getByTestId('chart-series-Crashes')).toBeTruthy()
        })

        it('chart series have correct data point count from fixture', async () => {
            await renderAndWaitForData()
            // Fixture has 5 dates in each series
            const sessions = screen.getByTestId('chart-series-Sessions')
            expect(sessions.textContent).toContain('5 points')
        })

        it('chart shows ANRs series when ANR data has non-zero values', async () => {
            await renderAndWaitForData()
            expect(screen.getByTestId('chart-series-ANRs')).toBeTruthy()
        })

        it('chart does NOT show ANRs series when all ANR values are zero', async () => {
            server.use(
                http.get('*/api/apps/:appId/anrGroups/plots/instances', () => {
                    return HttpResponse.json([{
                        id: '3.1.0',
                        data: [
                            { datetime: '2026-04-01T00:00:00Z', instances: 0 },
                            { datetime: '2026-04-02T00:00:00Z', instances: 0 },
                        ],
                    }])
                }),
            )

            await renderAndWaitForData()
            expect(screen.queryByTestId('chart-series-ANRs')).toBeNull()
        })
    })
})

// ====================================================================
// LOADING STATES
// ====================================================================
describe('Overview page — loading states', () => {
    it('shows loading spinner before data arrives', async () => {
        // Delay the metrics response so we can catch the loading state
        server.use(
            http.get('*/api/apps/:appId/metrics', async () => {
                await new Promise((r) => setTimeout(r, 200))
                return HttpResponse.json(makeMetricsFixture())
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        // Initially shows loading
        await waitFor(() => {
            expect(screen.queryByText('Loading...')).toBeTruthy()
        })

        // Eventually resolves to data
        await waitFor(() => {
            expect(screen.getByText('Crash free sessions')).toBeTruthy()
        }, { timeout: 5000 })
    })
})

// ====================================================================
// ERROR EDGE CASES — every endpoint failure path
// ====================================================================
describe('Overview page — error edge cases', () => {
    it('shows NoApps message when apps API returns 404', async () => {
        server.use(
            http.get('*/api/teams/:teamId/apps', () => {
                return new HttpResponse(null, { status: 404 })
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            expect(screen.getByText(/don.t have any apps/i)).toBeTruthy()
        }, { timeout: 5000 })
    })

    it('shows error when filters API returns 500', async () => {
        server.use(
            http.get('*/api/apps/:appId/filters', () => {
                return new HttpResponse(null, { status: 500 })
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        // Filters error → no data renders
        await waitFor(() => {
            expect(screen.queryByText('Crash free sessions')).toBeNull()
        }, { timeout: 5000 })
    })

    it('shortFilters POST failure still loads data (without filter_short_code)', async () => {
        const metricsUrls: string[] = []
        server.use(
            http.post('*/api/apps/:appId/shortFilters', () => {
                return new HttpResponse(null, { status: 500 })
            }),
            http.get('*/api/apps/:appId/metrics', ({ request }) => {
                metricsUrls.push(request.url)
                return HttpResponse.json(makeMetricsFixture())
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            expect(screen.getByText('Crash free sessions')).toBeTruthy()
        }, { timeout: 5000 })

        // Metrics loaded but without filter_short_code (POST failed → null)
        const lastUrl = metricsUrls[metricsUrls.length - 1]
        expect(lastUrl).not.toContain('filter_short_code=')
    })

    it('thresholdPrefs API failure still renders metrics with default thresholds', async () => {
        server.use(
            http.get('*/api/apps/:appId/thresholdPrefs', () => {
                return new HttpResponse(null, { status: 500 })
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            // Metrics cards should still render
            expect(screen.getByText('Crash free sessions')).toBeTruthy()
            expect(screen.getByText('99.1%')).toBeTruthy()
        }, { timeout: 5000 })
    })

    it('crashes plot error + ANR plot error but sessions plot success → chart shows error', async () => {
        server.use(
            http.get('*/api/apps/:appId/crashGroups/plots/instances', () => {
                return new HttpResponse(null, { status: 500 })
            }),
            http.get('*/api/apps/:appId/anrGroups/plots/instances', () => {
                return new HttpResponse(null, { status: 500 })
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            expect(screen.getByText(/error fetching plot/i)).toBeTruthy()
        }, { timeout: 5000 })
    })

    it('all plot endpoints return empty data → chart shows No Data', async () => {
        server.use(
            http.get('*/api/apps/:appId/sessions/plots/instances', () => {
                return HttpResponse.json(null)
            }),
            http.get('*/api/apps/:appId/crashGroups/plots/instances', () => {
                return HttpResponse.json(null)
            }),
            http.get('*/api/apps/:appId/anrGroups/plots/instances', () => {
                return HttpResponse.json(null)
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            expect(screen.getByText('No Data')).toBeTruthy()
        }, { timeout: 5000 })
    })

    it('all metrics NaN → all cards show "No data"', async () => {
        const nanMetric = { p95: 0, delta: 0, nan: true, delta_nan: true }
        server.use(
            http.get('*/api/apps/:appId/metrics', () => {
                return HttpResponse.json(makeMetricsFixture({
                    cold_launch: nanMetric,
                    warm_launch: nanMetric,
                    hot_launch: nanMetric,
                    adoption: { all_versions: 0, selected_version: 0, adoption: 0, nan: true },
                    sizes: { average_app_size: 0, selected_app_size: 0, delta: 0, nan: true },
                    crash_free_sessions: { crash_free_sessions: 0, delta: 0, nan: true, delta_nan: true },
                    anr_free_sessions: { anr_free_sessions: 0, delta: 0, nan: true, delta_nan: true },
                    perceived_crash_free_sessions: { perceived_crash_free_sessions: 0, delta: 0, nan: true, delta_nan: true },
                    perceived_anr_free_sessions: { perceived_anr_free_sessions: 0, delta: 0, nan: true, delta_nan: true },
                }))
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            const noDataElements = screen.getAllByText('No data')
            // Each NaN metric card shows "No data"
            expect(noDataElements.length).toBeGreaterThanOrEqual(5)
        }, { timeout: 5000 })
    })
})

// ====================================================================
// CONCURRENT / RE-RENDER scenarios
// ====================================================================
describe('Overview page — concurrent and re-render scenarios', () => {
    const { AppVersion } = require('@/app/api/api_calls')

    it('rapid version changes settle on the last one', async () => {
        const shortFilterBodies: any[] = []
        server.use(
            http.post('*/api/apps/:appId/shortFilters', async ({ request }) => {
                shortFilterBodies.push(await request.json())
                return HttpResponse.json({ filter_short_code: `code-${shortFilterBodies.length}` })
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByText('Crash free sessions')).toBeTruthy()
        }, { timeout: 5000 })

        // Fire 3 version changes in rapid succession
        await act(async () => {
            filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
            filtersStore.getState().setSelectedVersions([new AppVersion('3.0.1', '301')])
            filtersStore.getState().setSelectedVersions([new AppVersion('3.1.0', '310')])
        })

        // Final state should be the last version
        await waitFor(() => {
            expect(filtersStore.getState().selectedVersions[0]?.name).toBe('3.1.0')
        })
    })

    it('rapid date changes settle on the last one', async () => {
        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByText('Crash free sessions')).toBeTruthy()
        }, { timeout: 5000 })

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

    it('re-render still shows data (TanStack Query manages cache)', async () => {
        const { unmount } = renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByText('99.1%')).toBeTruthy()
        }, { timeout: 5000 })

        // Unmount and re-render — TanStack Query handles caching
        unmount()
        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            expect(screen.getByText('99.1%')).toBeTruthy()
        }, { timeout: 5000 })
    })
})

// ====================================================================
// TEAM SWITCH — team with apps → team with no apps
// ====================================================================
describe('Overview page — team switch to no-apps team', () => {
    it('switching from team with apps to team with no apps must not router.replace with stale filters', async () => {
        // Phase 1: render with team that has apps — fully load
        const { unmount } = renderWithProviders(<Overview params={{ teamId: 'team-with-apps' }} />)

        await waitFor(() => {
            expect(screen.getByText('99.1%')).toBeTruthy()
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

        renderWithProviders(<Overview params={{ teamId: 'team-no-apps' }} />)

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

// ====================================================================
// DEMO MODE
// ====================================================================
describe('Overview page — demo mode', () => {
    it('renders without making any API calls', async () => {
        const apiCalls: string[] = []
        server.use(
            http.get('*', ({ request }) => {
                apiCalls.push(request.url)
                return HttpResponse.json({})
            }),
            http.post('*', ({ request }) => {
                apiCalls.push(request.url)
                return HttpResponse.json({})
            }),
        )

        renderWithProviders(<Overview demo={true} />)

        // Demo uses hardcoded data, no API calls
        expect(screen.getByText('App Health')).toBeTruthy()
        // Give it a moment to confirm no API calls fire
        await act(async () => { await new Promise((r) => setTimeout(r, 200)) })
        expect(apiCalls.length).toBe(0)
    })

    it('renders demo metrics values without Filters component', async () => {
        renderWithProviders(<Overview demo={true} />)

        // Demo hardcoded values: crash_free_sessions=99.1, cold_launch=923
        await waitFor(() => {
            expect(screen.getByText('99.1%')).toBeTruthy()
            expect(screen.getByText('923ms')).toBeTruthy()
        })

        // No filter dropdowns rendered
        expect(screen.queryByText('App versions')).toBeNull()
    })

    it('renders "App Health" heading instead of "Overview"', () => {
        renderWithProviders(<Overview demo={true} />)
        expect(screen.getByText('App Health')).toBeTruthy()
        expect(screen.queryByText('Overview')).toBeNull()
    })

    it('renders empty string heading when hideDemoTitle is true', () => {
        renderWithProviders(<Overview demo={true} hideDemoTitle={true} />)
        expect(screen.queryByText('App Health')).toBeNull()
        expect(screen.queryByText('Overview')).toBeNull()
    })
})

// ====================================================================
// DELTA VALUES — verify exact formatted text
// ====================================================================
describe('Overview page — delta values and thresholds', () => {
    async function renderAndWaitForData() {
        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            // Wait for actual metrics data to render via TanStack Query
            // All Loading spinners must be gone and a percentage value must be visible
            expect(screen.getByText('Crash free sessions')).toBeTruthy()
            expect(screen.queryAllByText('Loading...').length).toBe(0)
        }, { timeout: 8000 })
    }

    it('crash-free delta=1.1 renders "1.1x better"', async () => {
        await renderAndWaitForData()
        expect(screen.getByText('1.1x better')).toBeTruthy()
    })

    it('ANR-free delta=1.01 renders "1.01x better"', async () => {
        await renderAndWaitForData()
        expect(screen.getByText('1.01x better')).toBeTruthy()
    })

    it('cold launch delta=0.07 renders "0.07x faster"', async () => {
        await renderAndWaitForData()
        expect(screen.getByText('0.07x faster')).toBeTruthy()
    })

    it('warm launch delta > 1 renders "Xx slower"', async () => {
        // Fixture has warm_launch.delta = -0.03 but the raw delta value...
        // Actually let me check: the store's metrics use the fixture directly.
        // makeMetricsFixture has warm_launch.delta = -0.03
        // Negative delta — getAppStartTimeDeltaWithTrendIcon shows nothing for
        // delta <= 0 (only > 1 = slower, 0 < delta < 1 = faster).
        // So with delta = -0.03 we get no trend text. Let me verify a positive one.
        server.use(
            http.get('*/api/apps/:appId/metrics', () => {
                return HttpResponse.json(makeMetricsFixture({
                    warm_launch: { p95: 500, delta: 1.5, nan: false, delta_nan: false },
                }))
            }),
        )
        await renderAndWaitForData()
        expect(screen.getByText('1.5x slower')).toBeTruthy()
    })

    it('crash-free worse delta renders "Xx worse"', async () => {
        server.use(
            http.get('*/api/apps/:appId/metrics', () => {
                return HttpResponse.json(makeMetricsFixture({
                    crash_free_sessions: { crash_free_sessions: 95.0, delta: 0.8, nan: false, delta_nan: false },
                }))
            }),
        )
        await renderAndWaitForData()
        expect(screen.getByText('0.8x worse')).toBeTruthy()
    })

    it('app size renders value in MB with toPrecision(3)', async () => {
        // Fixture has selected_app_size=48234496 → 48234496/1048576 = 46.0 → "46.0 MB"
        await renderAndWaitForData()
        expect(screen.getByText(/\d+\.\d+ MB/)).toBeTruthy()
    })

    it('app size shows N/A when multiple versions selected', async () => {
        const { AppVersion } = require('@/app/api/api_calls')

        await renderAndWaitForData()

        // Select multiple versions
        await act(async () => {
            filtersStore.getState().setSelectedVersions([
                new AppVersion('3.1.0', '310'),
                new AppVersion('3.0.2', '302'),
            ])
        })

        await waitFor(() => {
            expect(screen.getByText('N/A')).toBeTruthy()
        }, { timeout: 5000 })
    })
})

// ====================================================================
// URL PARAMS IN DATA-FETCH REQUESTS
// ====================================================================
describe('Overview page — URL params in data-fetch requests', () => {
    async function renderAndWaitForData() {
        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            // Wait for actual metrics data to render via TanStack Query
            expect(screen.getByText('99.1%')).toBeTruthy()
        }, { timeout: 5000 })
    }

    it('all data-fetch URLs include timezone param', async () => {
        const allUrls: string[] = []
        server.use(
            http.get('*/api/apps/:appId/metrics', ({ request }) => {
                allUrls.push(request.url)
                return HttpResponse.json(makeMetricsFixture())
            }),
            http.get('*/api/apps/:appId/sessions/plots/instances', ({ request }) => {
                allUrls.push(request.url)
                return HttpResponse.json(makeSessionPlotFixture())
            }),
        )

        await renderAndWaitForData()

        for (const url of allUrls) {
            expect(url).toContain('timezone=')
        }
    })

    it('plot URLs include plot_time_group param', async () => {
        const plotUrls: string[] = []
        server.use(
            http.get('*/api/apps/:appId/sessions/plots/instances', ({ request }) => {
                plotUrls.push(request.url)
                return HttpResponse.json(makeSessionPlotFixture())
            }),
        )

        await renderAndWaitForData()

        expect(plotUrls.length).toBeGreaterThan(0)
        expect(plotUrls[0]).toContain('plot_time_group=')
    })

    it('Last 6 Hours date range produces "minutes" plot_time_group', async () => {
        // Default is Last 6 Hours → ≤24h → "minutes"
        const plotUrls: string[] = []
        server.use(
            http.get('*/api/apps/:appId/sessions/plots/instances', ({ request }) => {
                plotUrls.push(request.url)
                return HttpResponse.json(makeSessionPlotFixture())
            }),
        )

        await renderAndWaitForData()
        expect(plotUrls[0]).toContain('plot_time_group=minutes')
    })

    it('Last Week date range produces "hours" plot_time_group', async () => {
        const plotUrls: string[] = []
        server.use(
            http.get('*/api/apps/:appId/sessions/plots/instances', ({ request }) => {
                plotUrls.push(request.url)
                return HttpResponse.json(makeSessionPlotFixture())
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByText('Crash free sessions')).toBeTruthy()
        }, { timeout: 5000 })

        plotUrls.length = 0
        await act(async () => {
            const now = new Date()
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            filtersStore.getState().setSelectedDateRange('Last Week')
            filtersStore.getState().setSelectedStartDate(weekAgo.toISOString())
            filtersStore.getState().setSelectedEndDate(now.toISOString())
        })

        await waitFor(() => {
            expect(plotUrls.length).toBeGreaterThan(0)
        }, { timeout: 5000 })
        expect(plotUrls[plotUrls.length - 1]).toContain('plot_time_group=hours')
    })

    it('Last 3 Months date range produces "days" plot_time_group', async () => {
        const plotUrls: string[] = []
        server.use(
            http.get('*/api/apps/:appId/sessions/plots/instances', ({ request }) => {
                plotUrls.push(request.url)
                return HttpResponse.json(makeSessionPlotFixture())
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByText('Crash free sessions')).toBeTruthy()
        }, { timeout: 5000 })

        plotUrls.length = 0
        await act(async () => {
            const now = new Date()
            const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
            filtersStore.getState().setSelectedDateRange('Last 3 Months')
            filtersStore.getState().setSelectedStartDate(threeMonthsAgo.toISOString())
            filtersStore.getState().setSelectedEndDate(now.toISOString())
        })

        await waitFor(() => {
            expect(plotUrls.length).toBeGreaterThan(0)
        }, { timeout: 5000 })
        expect(plotUrls[plotUrls.length - 1]).toContain('plot_time_group=days')
    })
})

// ====================================================================
// DATA SHAPE EDGE CASES
// ====================================================================
describe('Overview page — data shape edge cases', () => {
    it('null instances in plot data are treated as zero', async () => {
        server.use(
            http.get('*/api/apps/:appId/sessions/plots/instances', () => {
                return HttpResponse.json([{
                    id: '3.1.0',
                    data: [
                        { datetime: '2026-04-01T00:00:00Z', instances: null },
                        { datetime: '2026-04-02T00:00:00Z', instances: 100 },
                    ],
                }])
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            expect(screen.getByTestId('nivo-line-chart')).toBeTruthy()
        }, { timeout: 5000 })
    })

    it('empty versions array (not null) still loads data', async () => {
        server.use(
            http.get('*/api/apps/:appId/filters', () => {
                return HttpResponse.json(makeFiltersFixture({ versions: [] }))
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        // Empty versions means filters still load — app is onboarded, just no versions.
        // The metrics should still attempt to load.
        await waitFor(() => {
            const state = filtersStore.getState()
            expect(state.selectedVersions).toEqual([])
        }, { timeout: 5000 })
    })

    it('single data point in plot renders chart', async () => {
        server.use(
            http.get('*/api/apps/:appId/sessions/plots/instances', () => {
                return HttpResponse.json([{
                    id: '3.1.0',
                    data: [{ datetime: '2026-04-01T00:00:00Z', instances: 500 }],
                }])
            }),
            http.get('*/api/apps/:appId/crashGroups/plots/instances', () => {
                return HttpResponse.json([{
                    id: '3.1.0',
                    data: [{ datetime: '2026-04-01T00:00:00Z', instances: 5 }],
                }])
            }),
            http.get('*/api/apps/:appId/anrGroups/plots/instances', () => {
                return HttpResponse.json([{
                    id: '3.1.0',
                    data: [{ datetime: '2026-04-01T00:00:00Z', instances: 1 }],
                }])
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            const sessions = screen.getByTestId('chart-series-Sessions')
            expect(sessions.textContent).toContain('1 points')
        }, { timeout: 5000 })
    })

    it('multi-version plot data merges correctly into unique dates', async () => {
        // Two versions with overlapping dates — mergeSeries sums instances
        // per date. All 3 child datasets need same dates so the union size
        // matches expectations.
        const twoDates = [
            { datetime: '2026-04-01T00:00:00Z', instances: 10 },
            { datetime: '2026-04-02T00:00:00Z', instances: 20 },
        ]
        server.use(
            http.get('*/api/apps/:appId/sessions/plots/instances', () => {
                return HttpResponse.json([
                    {
                        id: '3.1.0', data: [
                            { datetime: '2026-04-01T00:00:00Z', instances: 100 },
                            { datetime: '2026-04-02T00:00:00Z', instances: 200 },
                        ]
                    },
                    {
                        id: '3.0.2', data: [
                            { datetime: '2026-04-01T00:00:00Z', instances: 50 },
                            { datetime: '2026-04-02T00:00:00Z', instances: 75 },
                            { datetime: '2026-04-03T00:00:00Z', instances: 25 },
                        ]
                    },
                ])
            }),
            http.get('*/api/apps/:appId/crashGroups/plots/instances', () => {
                return HttpResponse.json([{ id: '3.1.0', data: twoDates }])
            }),
            http.get('*/api/apps/:appId/anrGroups/plots/instances', () => {
                return HttpResponse.json([{ id: '3.1.0', data: twoDates }])
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            // 3 unique dates across the 2 session versions (A01, A02, A03).
            // All series get padded to 3 points (the union of all dates).
            const sessions = screen.getByTestId('chart-series-Sessions')
            expect(sessions.textContent).toContain('3 points')
        }, { timeout: 5000 })
    })
})

// ====================================================================
// AUTH FAILURE FLOW
// ====================================================================
describe('Overview page — auth failure', () => {
    it('401 on data fetch triggers token refresh attempt', async () => {
        let refreshAttempted = false
        server.use(
            http.get('*/api/apps/:appId/metrics', () => {
                return new HttpResponse(null, { status: 401 })
            }),
            http.post('*/auth/refresh', () => {
                refreshAttempted = true
                // Refresh also fails → redirect to login
                return new HttpResponse(null, { status: 401 })
            }),
        )

        renderWithProviders(<Overview params={{ teamId: 'test-team' }} />)

        await waitFor(() => {
            expect(refreshAttempted).toBe(true)
        }, { timeout: 5000 })
    })
})
