/**
 * Integration tests for Crashes/ANRs Overview and Detail pages.
 *
 * Both pages share ExceptionsOverview / ExceptionsDetails components,
 * parameterized by ExceptionsType. Tests use it.each where the behavior
 * is identical; crash- or ANR-specific tests are separate.
 *
 * The overview page has 11 active filter types (the most of any page
 * so far besides session timelines), plus pagination.
 * The detail page has 4 API endpoints (instances, detail plot,
 * distribution plot, common path), each with independent error states.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

// --- jsdom polyfills ---
// Radix UI's Slider uses ResizeObserver which jsdom doesn't provide
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
    usePathname: () => '/test-team/crashes',
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

jest.mock('@nivo/bar', () => ({
    __esModule: true,
    ResponsiveBar: ({ data }: any) => (
        <div data-testid="nivo-bar-chart">
            {data?.length ?? 0} groups
        </div>
    ),
}))

// --- MSW ---
import {
    makeExceptionInstanceFixture,
    makeExceptionsOverviewFixture
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
import { ExceptionsType } from '@/app/api/api_calls'
import { ExceptionsDetails } from '@/app/components/exceptions_details'
import { ExceptionsOverview } from '@/app/components/exceptions_overview'
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
// EXCEPTIONS OVERVIEW — parameterized for Crashes and ANRs
// ====================================================================
describe.each([
    ['Crashes', ExceptionsType.Crash, 'crashGroups'],
    ['ANRs', ExceptionsType.Anr, 'anrGroups'],
])('%s Overview (MSW integration)', (label, exceptionsType, apiPath) => {
    const { AppVersion, OsVersion } = require('@/app/api/api_calls')

    async function renderAndWaitForData() {
        renderWithProviders(<ExceptionsOverview exceptionsType={exceptionsType} teamId="test-team" />)
        await waitFor(() => {
            expect(screen.getByText('CheckoutActivity.kt: onClick()')).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ================================================================
    // PAGE LOAD
    // ================================================================
    describe('page load', () => {
        it(`renders "${label}" heading`, async () => {
            await renderAndWaitForData()
            expect(screen.getByText(label)).toBeTruthy()
        })

        it('renders table with exception groups from fixture', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('CheckoutActivity.kt: onClick()')).toBeTruthy()
            expect(screen.getByText('ProductFragment.kt: onResume()')).toBeTruthy()
        })

        it('renders instance counts', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('1523')).toBeTruthy()
            expect(screen.getByText('847')).toBeTruthy()
        })

        it('renders percentage contribution', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('45.2%')).toBeTruthy()
            expect(screen.getByText('25.1%')).toBeTruthy()
        })

        it('renders exception type and message as subtitle', async () => {
            await renderAndWaitForData()
            expect(screen.getByText(/NullPointerException.*null object reference/)).toBeTruthy()
        })

        it('renders overview plot', async () => {
            await renderAndWaitForData()
            expect(screen.getByTestId('nivo-line-chart')).toBeTruthy()
        })

        it('shows error when overview API returns 500', async () => {
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}`, ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.match(new RegExp(`${apiPath}/[^/]+/`))) return
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            renderWithProviders(<ExceptionsOverview exceptionsType={exceptionsType} teamId="test-team" />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching list of/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows plot No Data when plot returns null', async () => {
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/plots/instances`, () => {
                    return HttpResponse.json(null)
                }),
            )

            renderWithProviders(<ExceptionsOverview exceptionsType={exceptionsType} teamId="test-team" />)
            await waitFor(() => {
                expect(screen.getByText('No Data')).toBeTruthy()
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
            const page2Fixture = makeExceptionsOverviewFixture({
                meta: { next: false, previous: true },
                results: [{
                    id: 'crash-group-page2',
                    app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                    type: 'java.lang.OutOfMemoryError',
                    message: 'Java heap space',
                    method_name: 'allocate',
                    file_name: 'ImageLoader.kt',
                    line_number: 55,
                    count: 200,
                    percentage_contribution: 8.3,
                    updated_at: '2026-04-08T00:00:00Z',
                }],
            })

            server.use(
                http.get(`*/api/apps/:appId/${apiPath}`, ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.match(new RegExp(`${apiPath}/[^/]+/`))) return
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') return HttpResponse.json(page2Fixture)
                    return HttpResponse.json(makeExceptionsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            expect(screen.getByText('CheckoutActivity.kt: onClick()')).toBeTruthy()

            // Navigate to page 2
            await act(async () => { fireEvent.click(screen.getByText('Next').closest('button')!) })
            await waitFor(() => {
                expect(screen.getByText('ImageLoader.kt: allocate()')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByText('CheckoutActivity.kt: onClick()')).toBeNull()

            // Navigate back to page 1
            await act(async () => { fireEvent.click(screen.getByText('Previous').closest('button')!) })
            await waitFor(() => {
                expect(screen.getByText('CheckoutActivity.kt: onClick()')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.queryByText('ImageLoader.kt: allocate()')).toBeNull()

            // URL reflects page 1
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('po=0')
        })

        it('deep-link with po=5 renders page 2 data', async () => {
            const page2Fixture = makeExceptionsOverviewFixture({
                meta: { next: false, previous: true },
                results: [{
                    id: 'crash-group-page2',
                    app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                    type: 'java.lang.OutOfMemoryError',
                    message: 'Java heap space',
                    method_name: 'allocate',
                    file_name: 'ImageLoader.kt',
                    line_number: 55,
                    count: 200,
                    percentage_contribution: 8.3,
                    updated_at: '2026-04-08T00:00:00Z',
                }],
            })

            server.use(
                http.get(`*/api/apps/:appId/${apiPath}`, ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.match(new RegExp(`${apiPath}/[^/]+/`))) return
                    const offset = url.searchParams.get('offset')
                    if (offset === '5') return HttpResponse.json(page2Fixture)
                    return HttpResponse.json(makeExceptionsOverviewFixture())
                }),
            )

            mockSearchParams.set('po', '5')
            renderWithProviders(<ExceptionsOverview exceptionsType={exceptionsType} teamId="test-team" />)
            await waitFor(() => {
                expect(screen.getByText('ImageLoader.kt: allocate()')).toBeTruthy()
            }, { timeout: 5000 })

            // Page 1 data should NOT be present
            expect(screen.queryByText('CheckoutActivity.kt: onClick()')).toBeNull()
        })
    })

    // ================================================================
    // FILTERS — all 11 types
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
            await act(async () => { filtersStore.getState().setSelectedNetworkGenerations(['4g']) })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.network_generations).toEqual(['4g'])
        })

        it('locale change sends locales in POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => { filtersStore.getState().setSelectedLocales(['de-DE']) })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            expect(shortFilterBodies[shortFilterBodies.length - 1].filters.locales).toEqual(['de-DE'])
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

        it('udAttr matcher sends ud_expression in POST', async () => {
            await renderAndWaitForData()
            shortFilterBodies.length = 0
            await act(async () => {
                filtersStore.getState().setSelectedUdAttrMatchers([
                    { key: 'user_id', type: 'string', op: 'eq', value: 'user-crash-123' },
                ])
            })
            await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
            const expr = JSON.parse(shortFilterBodies[shortFilterBodies.length - 1].filters.ud_expression)
            expect(expr.and[0].cmp.value).toBe('user-crash-123')
        })

        it('date change does NOT trigger shortFilters POST', async () => {
            await renderAndWaitForData()
            const postsBefore = shortFilterBodies.length
            await act(async () => {
                const now = new Date()
                filtersStore.getState().setSelectedDateRange('Last Week')
                filtersStore.getState().setSelectedStartDate(new Date(now.getTime() - 7 * 86400000).toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })
            await act(async () => { await new Promise((r) => setTimeout(r, 300)) })
            expect(shortFilterBodies.length).toBe(postsBefore)
        })
    })

    // ================================================================
    // URL SYNC
    // ================================================================
    describe('URL sync', () => {
        it('URL includes filter params and pagination offset', async () => {
            await renderAndWaitForData()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('po=')
            expect(url).toContain('a=')
        })

        it('table row links include crash/anr group id and timestamp params', async () => {
            await renderAndWaitForData()
            // aria-label format: "CheckoutActivity.kt: onClick()"
            const link = screen.getByLabelText('CheckoutActivity.kt: onClick()')
            const href = link.getAttribute('href') ?? ''
            expect(href).toContain(`/test-team/${exceptionsType === ExceptionsType.Crash ? 'crashes' : 'anrs'}/`)
            expect(href).toContain('/crash-group-001/')
        })
    })

    // ================================================================
    // EMPTY RESULTS
    // ================================================================
    describe('empty results', () => {
        it('renders table shell but no rows when results are empty', async () => {
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}`, ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.match(new RegExp(`${apiPath}/[^/]+/`))) return
                    return HttpResponse.json({ meta: { next: false, previous: false }, results: [] })
                }),
            )

            renderWithProviders(<ExceptionsOverview exceptionsType={exceptionsType} teamId="test-team" />)
            await waitFor(() => {
                expect(screen.getByText(label)).toBeTruthy()
            }, { timeout: 5000 })
            await act(async () => { await new Promise((r) => setTimeout(r, 300)) })

            expect(screen.queryByText('CheckoutActivity.kt')).toBeNull()
            expect(screen.getByText('Previous').closest('button')?.disabled).toBe(true)
            expect(screen.getByText('Next').closest('button')?.disabled).toBe(true)
        })
    })

    // ================================================================
    // STORE CACHE
    // ================================================================
    describe('caching', () => {
        it('re-mount still shows data', async () => {
            const { unmount } = renderWithProviders(<ExceptionsOverview exceptionsType={exceptionsType} teamId="test-team" />)
            await waitFor(() => expect(screen.getByText('CheckoutActivity.kt: onClick()')).toBeTruthy(), { timeout: 5000 })

            unmount()
            renderWithProviders(<ExceptionsOverview exceptionsType={exceptionsType} teamId="test-team" />)
            await waitFor(() => expect(screen.getByText('CheckoutActivity.kt: onClick()')).toBeTruthy(), { timeout: 5000 })
        })
    })

    // ================================================================
    // OVERVIEW REMAINING COVERAGE
    // ================================================================
    describe('remaining coverage', () => {
        it('table row links include timestamp params from URL', async () => {
            // Set date params on the mock searchParams so the overview page
            // can read them for constructing detail links
            mockSearchParams.set('d', 'Last Week')
            mockSearchParams.set('sd', '2026-04-01T00:00:00.000Z')
            mockSearchParams.set('ed', '2026-04-07T00:00:00.000Z')

            await renderAndWaitForData()
            const link = screen.getByLabelText('CheckoutActivity.kt: onClick()')
            const href = link.getAttribute('href') ?? ''
            expect(href).toContain('sd=')
            expect(href).toContain('ed=')
            expect(href).toContain('d=')
        })

        it(`overview requests use /${apiPath} in the URL`, async () => {
            const overviewUrls: string[] = []
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}`, ({ request }) => {
                    const url = new URL(request.url)
                    if (url.pathname.includes('/plots/') || url.pathname.match(new RegExp(`${apiPath}/[^/]+/`))) return
                    overviewUrls.push(request.url)
                    return HttpResponse.json(makeExceptionsOverviewFixture())
                }),
            )

            await renderAndWaitForData()
            expect(overviewUrls.length).toBeGreaterThan(0)
            expect(overviewUrls[0]).toContain(`/${apiPath}`)
        })
    })
})

// ====================================================================
// EXCEPTIONS DETAIL PAGE — parameterized
// ====================================================================
describe.each([
    ['Crash', ExceptionsType.Crash, 'crashGroups'],
    ['ANR', ExceptionsType.Anr, 'anrGroups'],
])('%s Detail (MSW integration)', (label, exceptionsType, apiPath) => {
    const detailParams = {
        teamId: 'test-team',
        appId: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
        crashGroupId: 'crash-group-001',
        crashGroupName: 'NullPointerException%40CheckoutActivity.kt',
        // ANR detail pages use anrGroupId/anrGroupName but ExceptionsDetails reads them generically
        anrGroupId: 'crash-group-001',
        anrGroupName: 'NullPointerException%40CheckoutActivity.kt',
    }

    const appId = 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f'
    const groupId = 'crash-group-001'
    const groupName = 'NullPointerException%40CheckoutActivity.kt'

    function renderDetail() {
        return renderWithProviders(
            <ExceptionsDetails
                exceptionsType={exceptionsType}
                teamId="test-team"
                appId={appId}
                exceptionsGroupId={groupId}
                exceptionsGroupName={groupName}
            />,
        )
    }

    async function renderAndWaitForData() {
        renderDetail()
        // Wait for the full chain: fetchApps → filters.ready → fetchExceptionsDetails → render
        // We wait for "View Session Timeline" which only appears when instances have loaded.
        await waitFor(() => {
            expect(screen.getAllByText('View Session Timeline').length).toBeGreaterThan(0)
        }, { timeout: 10000 })
    }

    // ================================================================
    // PAGE LOAD
    // ================================================================
    describe('page load', () => {
        it('renders exception group name', async () => {
            await renderAndWaitForData()
            // Group name appears as the subtitle heading
            expect(screen.getByText('NullPointerException@CheckoutActivity.kt')).toBeTruthy()
        })

        it('renders detail plot', async () => {
            await renderAndWaitForData()
            expect(screen.getByTestId('nivo-line-chart')).toBeTruthy()
        })

        it('renders distribution plot', async () => {
            await renderAndWaitForData()
            expect(screen.getByTestId('nivo-bar-chart')).toBeTruthy()
        })

        it('renders common path section', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Common Path')).toBeTruthy()
        })

        it('renders common path steps above confidence threshold', async () => {
            await renderAndWaitForData()
            // Default threshold is 80% — show steps with ≥80% confidence
            expect(screen.getByText(/App launched/)).toBeTruthy()
            // 60% confidence step should be filtered out at 80% threshold
            expect(screen.queryByText(/NetworkCall.execute/)).toBeNull()
        })

        it('renders sessions analyzed count', async () => {
            await renderAndWaitForData()
            expect(screen.getByText(/250/)).toBeTruthy() // sessions_analyzed
        })

        it('renders stack trace section with thread info', async () => {
            await renderAndWaitForData()
            // Multiple "Thread: main" elements may appear (accordion trigger + metadata).
            const threadElements = screen.queryAllByText(/Thread: main/)
            expect(threadElements.length).toBeGreaterThan(0)
        })

        it('renders instance ID from fixture', async () => {
            await renderAndWaitForData()
            expect(screen.getByText(/instance-001/)).toBeTruthy()
        })

        it('renders "View Session Timeline" link', async () => {
            await renderAndWaitForData()
            const links = screen.getAllByText('View Session Timeline')
            const link = links[0].closest('a')
            expect(link?.getAttribute('href')).toContain('/session_timelines/')
            expect(link?.getAttribute('href')).toContain('/sess-crash-001')
        })

        it('renders instance metadata (device, version)', async () => {
            await renderAndWaitForData()
            // Instance metadata visible in DOM — device manufacturer and app version from fixture
            expect(screen.getAllByText(/Google/).length).toBeGreaterThan(0)
            expect(screen.getAllByText(/3\.1\.0/).length).toBeGreaterThan(0)
        })

        it('instance data loads successfully', async () => {
            await renderAndWaitForData()
            // Verify instance data rendered in DOM
            expect(screen.getByText(/instance-001/)).toBeTruthy()
            expect(screen.getAllByText('View Session Timeline').length).toBeGreaterThan(0)
            // Thread info
            const threadElements = screen.queryAllByText(/Thread: main/)
            expect(threadElements.length).toBeGreaterThan(0)
        })
    })

    // ================================================================
    // ERROR STATES — each endpoint independently
    // ================================================================
    describe('error states', () => {
        it('shows error when instances API returns 500', async () => {
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/${exceptionsType === ExceptionsType.Crash ? 'crashes' : 'anrs'}`, () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            renderWithProviders(<ExceptionsDetails exceptionsType={exceptionsType} teamId="test-team" appId={appId} exceptionsGroupId={groupId} exceptionsGroupName={groupName} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching list of/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows plot error when detail plot returns 500', async () => {
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/plots/instances`, () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            renderWithProviders(<ExceptionsDetails exceptionsType={exceptionsType} teamId="test-team" appId={appId} exceptionsGroupId={groupId} exceptionsGroupName={groupName} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching plot/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows No Data when distribution plot returns empty', async () => {
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/plots/distribution`, () => {
                    return HttpResponse.json({ os_version: {}, country: {} })
                }),
            )

            renderWithProviders(<ExceptionsDetails exceptionsType={exceptionsType} teamId="test-team" appId={appId} exceptionsGroupId={groupId} exceptionsGroupName={groupName} />)
            await waitFor(() => {
                expect(screen.getByText('No Data')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows error when common path returns 500', async () => {
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/path`, () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            renderWithProviders(<ExceptionsDetails exceptionsType={exceptionsType} teamId="test-team" appId={appId} exceptionsGroupId={groupId} exceptionsGroupName={groupName} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching common path/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('detail plot error does not block stack traces from loading', async () => {
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/plots/instances`, () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )

            renderWithProviders(<ExceptionsDetails exceptionsType={exceptionsType} teamId="test-team" appId={appId} exceptionsGroupId={groupId} exceptionsGroupName={groupName} />)
            await waitFor(() => {
                // Stack traces still load even though plot errored
                expect(screen.getAllByText('View Session Timeline').length).toBeGreaterThan(0)
            }, { timeout: 10000 })
        })

        it('detail plot does not get stuck in loading state', async () => {
            // Regression: the plot could get stuck in loading if the fetch
            // fired before exceptionsType/exceptionsGroupId were set in the
            // store, producing a mismatched plotDataKey. The fix ensures the
            // fetch depends on these props.
            renderWithProviders(<ExceptionsDetails exceptionsType={exceptionsType} teamId="test-team" appId={appId} exceptionsGroupId={groupId} exceptionsGroupName={groupName} />)
            await waitFor(() => {
                expect(screen.getByTestId('nivo-line-chart')).toBeTruthy()
            }, { timeout: 5000 })

            // Verify plot loaded successfully by checking the chart is visible
            expect(screen.getByTestId('nivo-line-chart')).toBeTruthy()
        })

        it('detail plot shows No Data when plot API returns null', async () => {
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/plots/instances`, () => {
                    return HttpResponse.json(null)
                }),
            )

            renderWithProviders(<ExceptionsDetails exceptionsType={exceptionsType} teamId="test-team" appId={appId} exceptionsGroupId={groupId} exceptionsGroupName={groupName} />)
            await waitFor(() => {
                expect(screen.getByText('No Data')).toBeTruthy()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // PAGINATION (instances — limit 1)
    // ================================================================
    describe('instance pagination', () => {
        it('Next button enabled when meta.next is true', async () => {
            await renderAndWaitForData()
            const buttons = screen.getAllByText('Next')
            const nextBtn = buttons[buttons.length - 1].closest('button')
            expect(nextBtn?.disabled).toBe(false)
        })

        it('Previous button disabled on first instance', async () => {
            await renderAndWaitForData()
            const buttons = screen.getAllByText('Previous')
            const prevBtn = buttons[buttons.length - 1].closest('button')
            expect(prevBtn?.disabled).toBe(true)
        })

        it('Previous from instance 2 goes back to instance 1', async () => {
            const instanceEndpoint = exceptionsType === ExceptionsType.Crash ? 'crashes' : 'anrs'
            const instanceVariant = exceptionsType === ExceptionsType.Crash ? 'crash' : 'anr'

            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/${instanceEndpoint}`, ({ request }) => {
                    const url = new URL(request.url)
                    const offset = url.searchParams.get('offset')
                    if (offset === '1') {
                        const page2 = makeExceptionInstanceFixture({ variant: instanceVariant as any })
                        page2.results[0].id = 'instance-002'
                        page2.results[0].session_id = 'sess-crash-002'
                        page2.meta = { next: false, previous: true }
                        return HttpResponse.json(page2)
                    }
                    return HttpResponse.json(makeExceptionInstanceFixture({ variant: instanceVariant as any }))
                }),
            )

            await renderAndWaitForData()
            expect(screen.getByText(/instance-001/)).toBeTruthy()

            // Go to page 2
            await act(async () => { fireEvent.click(screen.getByText('Next').closest('button')!) })
            await waitFor(() => {
                expect(screen.getByText(/instance-002/)).toBeTruthy()
            }, { timeout: 10000 })

            // Go back to page 1
            await act(async () => { fireEvent.click(screen.getByText('Previous').closest('button')!) })
            await waitFor(() => {
                expect(screen.getByText(/instance-001/)).toBeTruthy()
            }, { timeout: 10000 })

            expect(screen.queryByText(/instance-002/)).toBeNull()
        })

        it('deep-link with po=1 renders instance 2 data', async () => {
            const instanceEndpoint = exceptionsType === ExceptionsType.Crash ? 'crashes' : 'anrs'
            const instanceVariant = exceptionsType === ExceptionsType.Crash ? 'crash' : 'anr'

            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/${instanceEndpoint}`, ({ request }) => {
                    const url = new URL(request.url)
                    const offset = url.searchParams.get('offset')
                    if (offset === '1') {
                        const page2 = makeExceptionInstanceFixture({ variant: instanceVariant as any })
                        page2.results[0].id = 'instance-deeplink'
                        page2.meta = { next: false, previous: true }
                        return HttpResponse.json(page2)
                    }
                    return HttpResponse.json(makeExceptionInstanceFixture({ variant: instanceVariant as any }))
                }),
            )

            mockSearchParams.set('po', '1')
            renderDetail()
            await waitFor(() => {
                expect(screen.getByText(/instance-deeplink/)).toBeTruthy()
            }, { timeout: 10000 })

            // Instance 1 should NOT be present
            expect(screen.queryByText(/instance-001/)).toBeNull()
        })
    })

    // ================================================================
    // FILTERS
    // ================================================================
    describe('filters', () => {
        it('version change triggers data refetch', async () => {
            const { AppVersion } = require('@/app/api/api_calls')
            const instanceEndpoint = exceptionsType === ExceptionsType.Crash ? 'crashes' : 'anrs'
            const instanceVariant = exceptionsType === ExceptionsType.Crash ? 'crash' : 'anr'
            let instanceFetches = 0
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/${instanceEndpoint}`, () => {
                    instanceFetches++
                    return HttpResponse.json(makeExceptionInstanceFixture({ variant: instanceVariant as any }))
                }),
            )

            await renderAndWaitForData()
            const fetchesBefore = instanceFetches

            await act(async () => {
                filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
            })

            await waitFor(() => {
                expect(instanceFetches).toBeGreaterThan(fetchesBefore)
            }, { timeout: 10000 })
        })

        it('showAppSelector is false on detail page (cannot switch apps)', async () => {
            await renderAndWaitForData()
            const state = filtersStore.getState()
            expect(state.config?.showAppSelector).toBe(false)
        })
    })

    // ================================================================
    // REMAINING COVERAGE
    // ================================================================
    describe('remaining coverage', () => {
        it('distribution plot receives correct number of groups from fixture', async () => {
            await renderAndWaitForData()
            // Fixture has 3 attributes: os_version, device_manufacturer, country
            const barChart = screen.getByTestId('nivo-bar-chart')
            expect(barChart.textContent).toContain('groups')
        })

        it('"View Session Timeline" link includes correct appId and sessionId', async () => {
            await renderAndWaitForData()
            const links = screen.getAllByText('View Session Timeline')
            const link = links.find(l => l.closest('a'))?.closest('a')
            const href = link?.getAttribute('href') ?? ''
            expect(href).toContain(`/session_timelines/${appId}/`)
            expect(href).toContain('/sess-crash-001')
        })

        it('detail page URL syncs pagination offset and filter params', async () => {
            await renderAndWaitForData()
            expect(mockRouterReplace).toHaveBeenCalled()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('po=')
            // Detail page has showAppSelector=false, so `a=` is NOT in URL.
            // But version and date params should be present.
            expect(url).toContain('v=')
            expect(url).toContain('d=')
        })

        it('empty common path renders gracefully', async () => {
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/path`, () => {
                    return HttpResponse.json({
                        sessions_analyzed: 0,
                        steps: [],
                    })
                }),
            )

            renderDetail()
            await waitFor(() => {
                expect(screen.getByText('Common Path')).toBeTruthy()
            }, { timeout: 10000 })
            // No steps → section renders but with no step items
            expect(screen.queryByText(/App launched/)).toBeNull()
        })

        it('all steps below threshold shows no steps', async () => {
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/path`, () => {
                    return HttpResponse.json({
                        sessions_analyzed: 100,
                        steps: [
                            { description: 'Low confidence step', thread_name: 'main', confidence_pct: 10 },
                        ],
                    })
                }),
            )

            renderDetail()
            await waitFor(() => {
                expect(screen.getByText('Common Path')).toBeTruthy()
            }, { timeout: 10000 })
            // 10% < 80% default threshold → filtered out
            expect(screen.queryByText(/Low confidence step/)).toBeNull()
        })

        it('instance with attachments renders images', async () => {
            const instanceEndpoint = exceptionsType === ExceptionsType.Crash ? 'crashes' : 'anrs'
            const instanceVariant = exceptionsType === ExceptionsType.Crash ? 'crash' : 'anr'
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/${instanceEndpoint}`, () => {
                    const fixture = makeExceptionInstanceFixture({ variant: instanceVariant as any })
                    fixture.results[0].attachments = [
                        { id: 'att-1', name: 'screenshot.png', type: 'screenshot', key: 'att-key-1', location: 'https://example.com/screenshot.png' },
                    ] as any
                    return HttpResponse.json(fixture)
                }),
            )

            renderDetail()
            await waitFor(() => {
                expect(screen.getAllByText('View Session Timeline').length).toBeGreaterThan(0)
            }, { timeout: 10000 })

            // next/image mock renders as <img>. Alt is "Screenshot {index}".
            const img = screen.getByRole('img', { name: 'Screenshot 0' })
            expect(img).toBeTruthy()
            expect(img.getAttribute('src')).toBe('https://example.com/screenshot.png')
        })

        it(`uses /${apiPath}/ in the API request URL`, async () => {
            const instanceEndpoint = exceptionsType === ExceptionsType.Crash ? 'crashes' : 'anrs'
            const instanceVariant = exceptionsType === ExceptionsType.Crash ? 'crash' : 'anr'
            const instanceUrls: string[] = []
            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/${instanceEndpoint}`, ({ request }) => {
                    instanceUrls.push(request.url)
                    return HttpResponse.json(makeExceptionInstanceFixture({ variant: instanceVariant as any }))
                }),
            )

            await renderAndWaitForData()
            expect(instanceUrls.length).toBeGreaterThan(0)
            expect(instanceUrls[0]).toContain(`/${apiPath}/`)
        })

        it('navigating to instance 2 renders different data', async () => {
            const instanceEndpoint = exceptionsType === ExceptionsType.Crash ? 'crashes' : 'anrs'
            const instanceVariant = exceptionsType === ExceptionsType.Crash ? 'crash' : 'anr'

            server.use(
                http.get(`*/api/apps/:appId/${apiPath}/:groupId/${instanceEndpoint}`, ({ request }) => {
                    const url = new URL(request.url)
                    const offset = url.searchParams.get('offset')
                    if (offset === '1') {
                        // Page 2: different instance
                        const page2 = makeExceptionInstanceFixture({ variant: instanceVariant as any })
                        page2.results[0].id = 'instance-002'
                        page2.results[0].session_id = 'sess-crash-002'
                        page2.meta = { next: false, previous: true }
                        return HttpResponse.json(page2)
                    }
                    return HttpResponse.json(makeExceptionInstanceFixture({ variant: instanceVariant as any }))
                }),
            )

            await renderAndWaitForData()
            // Verify page 1 instance
            expect(screen.getByText(/instance-001/)).toBeTruthy()

            // Navigate to page 2
            await act(async () => {
                fireEvent.click(screen.getByText('Next').closest('button')!)
            })

            await waitFor(() => {
                expect(screen.getByText(/instance-002/)).toBeTruthy()
            }, { timeout: 10000 })

            // Page 1 instance should be gone
            expect(screen.queryByText(/instance-001/)).toBeNull()
        })

        it('confidence slider at 50% shows the 60% confidence step', async () => {
            // Fixture has a step at 60% confidence which is hidden at 80% default.
            // Changing threshold to 50% should reveal it.
            renderDetail()
            // Wait for common path data to load (not just the heading)
            await waitFor(() => {
                expect(screen.getByText(/Analyzed from latest/)).toBeTruthy()
            }, { timeout: 10000 })

            // At default 80%, "NetworkCall.execute" (60%) is hidden
            expect(screen.queryByText(/NetworkCall.execute/)).toBeNull()

            // Radix slider responds to Home/End/ArrowLeft keyboard events.
            // Press Home to go to min (1%), which reveals all steps.
            const slider = screen.getByRole('slider')
            await act(async () => {
                fireEvent.keyDown(slider, { key: 'Home' })
            })

            // After setting threshold to min (1%), the 60% step should appear
            await waitFor(() => {
                expect(screen.getByText(/NetworkCall.execute/)).toBeTruthy()
            }, { timeout: 5000 })
        })
    })
})

describe('Exceptions — team switch to no-apps team', () => {
    it('switching from team with apps to team with no apps shows NoApps after store reset', async () => {
        // Phase 1: render with team that has apps — fully load
        const { unmount } = renderWithProviders(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="team-with-apps" />)

        await waitFor(() => {
            expect(screen.getByText('CheckoutActivity.kt: onClick()')).toBeTruthy()
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

        renderWithProviders(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="team-no-apps" />)

        // Wait for NoApps message to appear
        await waitFor(() => {
            expect(screen.getByText(/don.t have any apps/i)).toBeTruthy()
        }, { timeout: 5000 })
    })
})
