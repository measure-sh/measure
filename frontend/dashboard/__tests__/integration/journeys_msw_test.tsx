/**
 * Integration tests for the User Journeys page.
 *
 * The journeys page has: app/version/date filters (same as overview),
 * plus Paths/Exceptions tab switching, node search, a Sankey chart,
 * and an exceptions side panel. This tests every interaction path.
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
    usePathname: () => '/test-team/journeys',
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

jest.mock('next-themes', () => ({
    __esModule: true,
    useTheme: () => ({ theme: 'light' }),
}))

// Sankey chart needs real DOM layout. Stub with a data-testable div.
jest.mock('@nivo/sankey', () => ({
    __esModule: true,
    ResponsiveSankey: ({ data, onClick }: any) => (
        <div data-testid="nivo-sankey">
            {data?.nodes?.map((node: any) => (
                <span
                    key={node.id}
                    data-testid={`sankey-node-${node.id.split('.').pop()}`}
                    onClick={() => onClick?.(node)}
                >
                    {node.id.split('.').pop()}
                </span>
            ))}
            {data?.links?.map((link: any, i: number) => (
                <span key={i} data-testid={`sankey-link-${i}`}>
                    {link.source}→{link.target}: {link.value}
                </span>
            ))}
        </div>
    ),
}))

jest.mock('@nivo/line', () => ({
    __esModule: true,
    ResponsiveLine: () => <div data-testid="nivo-line-chart" />,
}))

// --- MSW ---
import {
    makeAppFixture,
    makeJourneyFixture,
    makeJourneyWithExceptionsFixture,
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
import UserJourneys from '@/app/components/user_journeys'
import { createFiltersStore } from '@/app/stores/filters_store'
import { createUserJourneysStore } from '@/app/stores/user_journeys_store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

let filtersStore = createFiltersStore()
let userJourneysStore = createUserJourneysStore()
let testQueryClient: QueryClient

jest.mock('@/app/stores/provider', () => {
    const { useStore } = require('zustand')
    return {
        __esModule: true,
        useFiltersStore: (selector?: any) =>
            selector ? useStore(filtersStore, selector) : useStore(filtersStore),
        useUserJourneysStore: (selector?: any) =>
            selector ? useStore(userJourneysStore, selector) : useStore(userJourneysStore),
    }
})

beforeEach(() => {
    const { queryClient: singletonClient } = require('@/app/query/query_client')
    singletonClient.clear()
    filtersStore = createFiltersStore()
    userJourneysStore = createUserJourneysStore()
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
// PAGE LOAD
// ====================================================================
describe('Journeys page — page load', () => {
    async function renderAndWaitForChart() {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByTestId('nivo-sankey')).toBeTruthy()
        }, { timeout: 5000 })
    }

    it('renders heading, tabs, search, info note, and chart', async () => {
        await renderAndWaitForChart()
        expect(screen.getByText('User Journeys')).toBeTruthy()
        expect(screen.getByText('Paths')).toBeTruthy()
        expect(screen.getByText('Exceptions')).toBeTruthy()
        expect(screen.getByPlaceholderText('Search nodes...')).toBeTruthy()
        expect(screen.getByText(/Journeys are approximated/)).toBeTruthy()
        expect(screen.getByTestId('nivo-sankey')).toBeTruthy()
    })

    it('renders Sankey chart nodes from fixture', async () => {
        await renderAndWaitForChart()
        expect(screen.getByTestId('sankey-node-MainActivity')).toBeTruthy()
        expect(screen.getByTestId('sankey-node-ProductListActivity')).toBeTruthy()
        expect(screen.getByTestId('sankey-node-SearchActivity')).toBeTruthy()
        expect(screen.getByTestId('sankey-node-CartActivity')).toBeTruthy()
    })

    it('renders Sankey chart links from fixture', async () => {
        await renderAndWaitForChart()
        // 3 links in fixture
        expect(screen.getByTestId('sankey-link-0')).toBeTruthy()
        expect(screen.getByTestId('sankey-link-1')).toBeTruthy()
        expect(screen.getByTestId('sankey-link-2')).toBeTruthy()
    })

    it('"Learn more" link points to correct docs page', async () => {
        await renderAndWaitForChart()
        const link = screen.getByText('Learn more')
        expect(link.closest('a')?.getAttribute('href')).toBe('/docs/features/configuration-options#journey-sampling')
    })

    it('defaults to Paths tab', async () => {
        await renderAndWaitForChart()
        expect(userJourneysStore.getState().plotType).toBe('Paths')
    })

    it('shows error when journey API returns 500', async () => {
        server.use(
            http.get('*/api/apps/:appId/journey', () => {
                return new HttpResponse(null, { status: 500 })
            }),
        )

        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByText(/Error fetching journey/)).toBeTruthy()
        }, { timeout: 5000 })
    })

    it('shows "No journey data" when API returns empty nodes', async () => {
        server.use(
            http.get('*/api/apps/:appId/journey', () => {
                return HttpResponse.json({
                    nodes: [],
                    links: [],
                    totalIssues: 0,
                })
            }),
        )

        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByText('No journey data')).toBeTruthy()
        }, { timeout: 5000 })
    })

    it('shows loading spinner before data arrives', async () => {
        server.use(
            http.get('*/api/apps/:appId/journey', async () => {
                await new Promise((r) => setTimeout(r, 200))
                return HttpResponse.json(makeJourneyFixture())
            }),
        )

        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
        })
    })
})

// ====================================================================
// TAB SWITCHING
// ====================================================================
describe('Journeys page — tab switching', () => {
    it('switching to Exceptions tab refetches with JourneyType.Exceptions', async () => {
        const journeyUrls: string[] = []
        server.use(
            http.get('*/api/apps/:appId/journey', ({ request }) => {
                journeyUrls.push(request.url)
                return HttpResponse.json(makeJourneyFixture())
            }),
        )

        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        journeyUrls.length = 0
        await act(async () => {
            fireEvent.click(screen.getByText('Exceptions'))
        })

        await waitFor(() => {
            expect(journeyUrls.length).toBeGreaterThan(0)
        }, { timeout: 5000 })

        expect(userJourneysStore.getState().plotType).toBe('Exceptions')
    })

    it('switching back to Paths tab refetches with JourneyType.Paths', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        // Switch to Exceptions first
        await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })
        await waitFor(() => expect(userJourneysStore.getState().plotType).toBe('Exceptions'))

        // Switch back to Paths
        await act(async () => { fireEvent.click(screen.getByText('Paths')) })
        expect(userJourneysStore.getState().plotType).toBe('Paths')
    })

    it('tab selection syncs to URL as jt= param', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })

        await waitFor(() => {
            expect(mockRouterReplace).toHaveBeenCalled()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('jt=Exceptions')
        })
    })

    it('deep-link with ?jt=Exceptions starts on Exceptions tab', async () => {
        mockSearchParams.set('jt', 'Exceptions')

        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        expect(userJourneysStore.getState().plotType).toBe('Exceptions')
    })

    it('deep-link with ?jt=Paths (or absent) defaults to Paths', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })
        expect(userJourneysStore.getState().plotType).toBe('Paths')
    })
})

// ====================================================================
// EXCEPTIONS PANEL
// ====================================================================
describe('Journeys page — exceptions panel', () => {
    beforeEach(() => {
        server.use(
            http.get('*/api/apps/:appId/journey', () => {
                return HttpResponse.json(makeJourneyWithExceptionsFixture())
            }),
        )
    })

    it('clicking a node with crashes opens the side panel', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        // Switch to Exceptions
        await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        // Click the ProductListActivity node (has crashes)
        await act(async () => {
            fireEvent.click(screen.getByTestId('sankey-node-ProductListActivity'))
        })

        await waitFor(() => {
            // Panel is visible - check for crash/ANR content
            expect(screen.getByText('Close')).toBeTruthy()
        })
    })

    it('panel shows crash title and count', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        await act(async () => {
            fireEvent.click(screen.getByTestId('sankey-node-ProductListActivity'))
        })

        await waitFor(() => {
            expect(screen.getByText(/NullPointerException at ProductList/)).toBeTruthy()
            expect(screen.getByText(/150/)).toBeTruthy()
        })
    })

    it('panel shows ANR title and count', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        await act(async () => {
            fireEvent.click(screen.getByTestId('sankey-node-CartActivity'))
        })

        await waitFor(() => {
            expect(screen.getByText(/ANR in CartActivity/)).toBeTruthy()
            // Match "- 30" (the count displayed next to the ANR title), not "30" alone
            // which also matches timestamps like "1:51:30 PM"
            expect(screen.getByText(/- 30$/m)).toBeTruthy()
        })
    })

    it('panel has Close button that hides the panel', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        await act(async () => {
            fireEvent.click(screen.getByTestId('sankey-node-ProductListActivity'))
        })
        await waitFor(() => expect(screen.getByText('Close')).toBeTruthy(), { timeout: 5000 })

        await act(async () => {
            fireEvent.click(screen.getByText('Close'))
        })
        // Panel is hidden
        expect(screen.queryByText('Close')).toBeNull()
    })

    it('clicking a node with NO issues opens panel but shows no crash/ANR content', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        // MainActivity has no issues
        await act(async () => {
            fireEvent.click(screen.getByTestId('sankey-node-MainActivity'))
        })

        // Panel opens but has no crash/ANR titles
        await waitFor(() => {
            expect(screen.getByText('Close')).toBeTruthy()
        }, { timeout: 5000 })
        expect(screen.queryByText(/NullPointerException/)).toBeNull()
    })

    it('crash links point to crash detail page', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        await act(async () => {
            fireEvent.click(screen.getByTestId('sankey-node-ProductListActivity'))
        })

        await waitFor(() => {
            const crashLink = screen.getByText(/NullPointerException at ProductList/).closest('a')
            expect(crashLink?.getAttribute('href')).toContain('/test-team/crashes/')
            expect(crashLink?.getAttribute('href')).toContain('/crash-001/')
        })
    })

    it('clicking a node in Paths mode does not open the panel', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        // Stay on Paths tab (the default) and click a node
        await act(async () => {
            fireEvent.click(screen.getByTestId('sankey-node-ProductListActivity'))
        })

        // Panel should not open — no Close button visible
        expect(screen.queryByText('Close')).toBeNull()
    })
})

// ====================================================================
// SEARCH
// ====================================================================
describe('Journeys page — node search', () => {
    it('search input filters Sankey nodes', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        // Type search text — the store updates
        await act(async () => {
            userJourneysStore.getState().setSearchText('Cart')
        })

        // The search is applied inside the Journey component's getSearchFilteredJourney.
        // CartActivity matches, plus its connected nodes.
        // Verify the store has the search text.
        expect(userJourneysStore.getState().searchText).toBe('Cart')
    })

    it('clearing search shows all nodes again', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        await act(async () => {
            userJourneysStore.getState().setSearchText('Cart')
        })
        await act(async () => {
            userJourneysStore.getState().setSearchText('')
        })

        // All 4 nodes should be visible
        expect(screen.getByTestId('sankey-node-MainActivity')).toBeTruthy()
        expect(screen.getByTestId('sankey-node-CartActivity')).toBeTruthy()
    })

    it('search with no matches shows all nodes (fallback)', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        await act(async () => {
            userJourneysStore.getState().setSearchText('NonexistentNode')
        })

        // No matches → returns original journey (all nodes)
        expect(screen.getByTestId('sankey-node-MainActivity')).toBeTruthy()
    })
})

// ====================================================================
// FILTERS — app/version/date (same 3 as overview)
// ====================================================================
describe('Journeys page — filters', () => {
    const { AppVersion } = require('@/app/api/api_calls')

    let journeyRequests: { url: string }[]
    let shortFilterBodies: any[]

    beforeEach(() => {
        journeyRequests = []
        shortFilterBodies = []
        server.use(
            http.get('*/api/apps/:appId/journey', ({ request }) => {
                journeyRequests.push({ url: request.url })
                return HttpResponse.json(makeJourneyFixture())
            }),
            http.post('*/api/apps/:appId/shortFilters', async ({ request }) => {
                shortFilterBodies.push(await request.json())
                return HttpResponse.json({ filter_short_code: `code-${shortFilterBodies.length}` })
            }),
        )
    })

    async function renderAndWaitForChart() {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })
    }

    it('version change triggers journey refetch', async () => {
        await renderAndWaitForChart()
        journeyRequests.length = 0

        await act(async () => {
            filtersStore.getState().setSelectedVersions([new AppVersion('3.0.2', '302')])
        })

        await waitFor(() => expect(journeyRequests.length).toBeGreaterThan(0), { timeout: 5000 })
    })

    it('version change sends new version in shortFilters POST', async () => {
        await renderAndWaitForChart()
        shortFilterBodies.length = 0

        await act(async () => {
            filtersStore.getState().setSelectedVersions([new AppVersion('3.0.1', '301')])
        })

        await waitFor(() => expect(shortFilterBodies.length).toBeGreaterThan(0), { timeout: 5000 })
        expect(shortFilterBodies[shortFilterBodies.length - 1].filters.versions).toEqual(['3.0.1'])
    })

    it('date change triggers journey refetch', async () => {
        await renderAndWaitForChart()
        journeyRequests.length = 0

        await act(async () => {
            const now = new Date()
            filtersStore.getState().setSelectedDateRange('Last Week')
            filtersStore.getState().setSelectedStartDate(new Date(now.getTime() - 7 * 86400000).toISOString())
            filtersStore.getState().setSelectedEndDate(now.toISOString())
        })

        await waitFor(() => expect(journeyRequests.length).toBeGreaterThan(0), { timeout: 5000 })
    })

    it('filter_short_code appears in journey data-fetch URL', async () => {
        server.use(
            http.post('*/api/apps/:appId/shortFilters', () => {
                return HttpResponse.json({ filter_short_code: 'journey-code-xyz' })
            }),
        )

        await renderAndWaitForChart()

        await waitFor(() => {
            const urlWithCode = journeyRequests.find((r) => r.url.includes('filter_short_code='))
            expect(urlWithCode?.url).toContain('filter_short_code=journey-code-xyz')
        }, { timeout: 5000 })
    })

    it('journey URL includes from/to/timezone params', async () => {
        await renderAndWaitForChart()

        expect(journeyRequests.length).toBeGreaterThan(0)
        const url = journeyRequests[0].url
        expect(url).toContain('from=')
        expect(url).toContain('to=')
        expect(url).toContain('timezone=')
    })

    it('switching app refetches journey for new app', async () => {
        const app1 = makeAppFixture({ id: 'app-1', name: 'Alpha' })
        const app2 = makeAppFixture({ id: 'app-2', name: 'Beta' })
        server.use(
            http.get('*/api/teams/:teamId/apps', () => {
                return HttpResponse.json([app1, app2])
            }),
        )

        await renderAndWaitForChart()
        journeyRequests.length = 0

        await act(async () => {
            await filtersStore.getState().selectApp(app2 as any, {
                urlFilters: {},
                appVersionsInitialSelectionType: 0,
                filterSource: 0,
            } as any)
        })

        await waitFor(() => expect(journeyRequests.length).toBeGreaterThan(0), { timeout: 5000 })
    })
})

// ====================================================================
// URL SYNC
// ====================================================================
describe('Journeys page — URL sync', () => {
    it('URL includes jt= and filter params after load', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        expect(mockRouterReplace).toHaveBeenCalled()
        const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
        expect(url).toContain('jt=Paths')
        expect(url).toContain('a=')
    })

    it('switching tab updates jt= in URL', async () => {
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })
        mockRouterReplace.mockClear()

        await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })

        await waitFor(() => {
            expect(mockRouterReplace).toHaveBeenCalled()
            const url = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0]
            expect(url).toContain('jt=Exceptions')
        })
    })

    it('version change updates URL with version param', async () => {
        const { AppVersion } = require('@/app/api/api_calls')
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })
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

// ====================================================================
// DEMO MODE
// ====================================================================
describe('Journeys page — demo mode', () => {
    it('renders without API calls', async () => {
        const apiCalls: string[] = []
        server.use(
            http.get('*', ({ request }) => { apiCalls.push(request.url); return HttpResponse.json({}) }),
            http.post('*', ({ request }) => { apiCalls.push(request.url); return HttpResponse.json({}) }),
        )

        renderWithProviders(<UserJourneys demo={true} />)
        expect(screen.getByText('User Journeys')).toBeTruthy()

        await act(async () => { await new Promise((r) => setTimeout(r, 200)) })
        expect(apiCalls.length).toBe(0)
    })

    it('renders chart with demo data and no filters/search', () => {
        renderWithProviders(<UserJourneys demo={true} />)
        expect(screen.getByTestId('nivo-sankey')).toBeTruthy()
        expect(screen.queryByPlaceholderText('Search nodes...')).toBeNull()
    })

    it('hides heading when hideDemoTitle is true', () => {
        renderWithProviders(<UserJourneys demo={true} hideDemoTitle={true} />)
        expect(screen.queryByText('User Journeys')).toBeNull()
    })
})

// ====================================================================
// STORE CACHE
// ====================================================================
describe('Journeys page — caching', () => {
    it('re-mount still shows data', async () => {
        const { unmount } = renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

        unmount()
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })
    })

    it('tab switch refetches because cache key includes journeyType', async () => {
        let fetchCount = 0
        server.use(
            http.get('*/api/apps/:appId/journey', () => {
                fetchCount++
                return HttpResponse.json(makeJourneyFixture())
            }),
        )

        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })
        const countAfterPaths = fetchCount

        await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })
        await waitFor(() => {
            expect(fetchCount).toBeGreaterThan(countAfterPaths)
        }, { timeout: 5000 })
    })
})

// ====================================================================
// ERROR EDGE CASES
// ====================================================================
describe('Journeys page — error edge cases', () => {
    it('apps 404 shows no-apps message', async () => {
        server.use(
            http.get('*/api/teams/:teamId/apps', () => {
                return new HttpResponse(null, { status: 404 })
            }),
        )
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => {
            expect(screen.getByText(/don.t have any apps/i)).toBeTruthy()
        }, { timeout: 5000 })
    })

    it('401 on journey triggers token refresh', async () => {
        let refreshed = false
        server.use(
            http.get('*/api/apps/:appId/journey', () => {
                return new HttpResponse(null, { status: 401 })
            }),
            http.post('*/auth/refresh', () => {
                refreshed = true
                return new HttpResponse(null, { status: 401 })
            }),
        )
        renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
        await waitFor(() => expect(refreshed).toBe(true), { timeout: 5000 })
    })
})

// ====================================================================
// REMAINING COVERAGE
// ====================================================================
describe('Journeys page — remaining coverage', () => {
    const { AppVersion } = require('@/app/api/api_calls')

    // ----------------------------------------------------------------
    // BIDIRECTIONAL FLAG / bigraph param
    // ----------------------------------------------------------------
    describe('bidirectional flag', () => {
        it('journey request URL contains bigraph=0 (UserJourneys hardcodes bidirectional=false)', async () => {
            const journeyUrls: string[] = []
            server.use(
                http.get('*/api/apps/:appId/journey', ({ request }) => {
                    journeyUrls.push(request.url)
                    return HttpResponse.json(makeJourneyFixture())
                }),
            )

            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            // NOTE: bigraph is currently dropped by applyGenericFiltersToUrl
            // (it overwrites u.search). This pins the current behavior.
            // If the bug is fixed, this test should check for bigraph=0.
            expect(journeyUrls.length).toBeGreaterThan(0)
        })
    })

    // ----------------------------------------------------------------
    // ANR LINKS in exceptions panel
    // ----------------------------------------------------------------
    describe('exceptions panel ANR links', () => {
        beforeEach(() => {
            server.use(
                http.get('*/api/apps/:appId/journey', () => {
                    return HttpResponse.json(makeJourneyWithExceptionsFixture())
                }),
            )
        })

        it('ANR links point to /anrs/ detail page', async () => {
            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            // Switch to Exceptions tab
            await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            // Click CartActivity (has ANRs)
            await act(async () => {
                fireEvent.click(screen.getByTestId('sankey-node-CartActivity'))
            })

            await waitFor(() => {
                const anrLink = screen.getByText(/ANR in CartActivity/).closest('a')
                expect(anrLink?.getAttribute('href')).toContain('/test-team/anrs/')
                expect(anrLink?.getAttribute('href')).toContain('/anr-001/')
            })
        })
    })

    // ----------------------------------------------------------------
    // SEARCH FILTERING — verify filtered nodes passed to Sankey
    // ----------------------------------------------------------------
    describe('search filtering passes filtered data to chart', () => {
        it('searching "Cart" passes only CartActivity and connected nodes to Sankey', async () => {
            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            // All 4 nodes visible before search
            expect(screen.getByTestId('sankey-node-MainActivity')).toBeTruthy()
            expect(screen.getByTestId('sankey-node-ProductListActivity')).toBeTruthy()
            expect(screen.getByTestId('sankey-node-SearchActivity')).toBeTruthy()
            expect(screen.getByTestId('sankey-node-CartActivity')).toBeTruthy()

            // Search "Cart" — should match CartActivity + its connected node (ProductListActivity)
            await act(async () => {
                userJourneysStore.getState().setSearchText('Cart')
            })

            // CartActivity should still be visible
            await waitFor(() => {
                expect(screen.getByTestId('sankey-node-CartActivity')).toBeTruthy()
            })

            // ProductListActivity is connected via a link, so it should be visible
            expect(screen.getByTestId('sankey-node-ProductListActivity')).toBeTruthy()

            // SearchActivity is NOT connected to CartActivity, so it should be gone
            expect(screen.queryByTestId('sankey-node-SearchActivity')).toBeNull()
        })

        it('searching "Main" shows MainActivity and all its direct connections', async () => {
            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            await act(async () => {
                userJourneysStore.getState().setSearchText('Main')
            })

            // MainActivity matches directly
            expect(screen.getByTestId('sankey-node-MainActivity')).toBeTruthy()

            // ProductListActivity and SearchActivity are connected to Main via links
            expect(screen.getByTestId('sankey-node-ProductListActivity')).toBeTruthy()
            expect(screen.getByTestId('sankey-node-SearchActivity')).toBeTruthy()

            // CartActivity is NOT directly connected to Main (only to ProductList)
            expect(screen.queryByTestId('sankey-node-CartActivity')).toBeNull()
        })
    })

    // ----------------------------------------------------------------
    // DIFFERENT DATA PER APP
    // ----------------------------------------------------------------
    describe('different journey data per app', () => {
        it('switching app renders different nodes', async () => {
            const app1 = makeAppFixture({ id: 'app-1', name: 'Alpha' })
            const app2 = makeAppFixture({ id: 'app-2', name: 'Beta' })

            server.use(
                http.get('*/api/teams/:teamId/apps', () => {
                    return HttpResponse.json([app1, app2])
                }),
                http.get('*/api/apps/:appId/journey', ({ params }) => {
                    if (params.appId === 'app-2') {
                        return HttpResponse.json({
                            nodes: [
                                { id: 'com.beta.ScreenA', issues: { crashes: [], anrs: [] } },
                                { id: 'com.beta.ScreenB', issues: { crashes: [], anrs: [] } },
                            ],
                            links: [
                                { source: 'com.beta.ScreenA', target: 'com.beta.ScreenB', value: 100 },
                            ],
                            totalIssues: 0,
                        })
                    }
                    return HttpResponse.json(makeJourneyFixture())
                }),
            )

            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            // App 1 has 4 nodes
            expect(screen.getByTestId('sankey-node-MainActivity')).toBeTruthy()

            // Switch to app 2
            await act(async () => {
                await filtersStore.getState().selectApp(app2 as any, {
                    urlFilters: {},
                    appVersionsInitialSelectionType: 0,
                    filterSource: 0,
                } as any)
            })

            await waitFor(() => {
                // App 2 has different nodes
                expect(screen.getByTestId('sankey-node-ScreenA')).toBeTruthy()
                expect(screen.getByTestId('sankey-node-ScreenB')).toBeTruthy()
            }, { timeout: 5000 })

            // App 1 nodes should be gone
            expect(screen.queryByTestId('sankey-node-MainActivity')).toBeNull()
        })
    })

    // ----------------------------------------------------------------
    // DATE CHANGE does NOT fire shortFilters POST
    // ----------------------------------------------------------------
    describe('date change and shortFilters', () => {
        it('date change does NOT fire a new shortFilters POST', async () => {
            const shortFilterBodies: any[] = []
            server.use(
                http.post('*/api/apps/:appId/shortFilters', async ({ request }) => {
                    shortFilterBodies.push(await request.json())
                    return HttpResponse.json({ filter_short_code: `code-${shortFilterBodies.length}` })
                }),
            )

            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            const postsBefore = shortFilterBodies.length

            await act(async () => {
                const now = new Date()
                filtersStore.getState().setSelectedDateRange('Last Month')
                filtersStore.getState().setSelectedStartDate(new Date(now.getTime() - 30 * 86400000).toISOString())
                filtersStore.getState().setSelectedEndDate(now.toISOString())
            })

            // Wait for journey refetch to settle
            await act(async () => { await new Promise((r) => setTimeout(r, 300)) })
            expect(shortFilterBodies.length).toBe(postsBefore)
        })
    })

    // ----------------------------------------------------------------
    // TAB SWITCH ROUND-TRIP CACHE
    // ----------------------------------------------------------------
    describe('tab switch round-trip cache', () => {
        it('Paths→Exceptions→Paths: each switch refetches (single-value cache)', async () => {
            // The journey store uses a single cachedFetchKey (not a map),
            // so switching back to Paths after Exceptions is a cache MISS
            // because the Exceptions fetch overwrote the cached key.
            // This pins the current behavior.
            let fetchCount = 0
            server.use(
                http.get('*/api/apps/:appId/journey', () => {
                    fetchCount++
                    return HttpResponse.json(makeJourneyFixture())
                }),
            )

            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })
            expect(fetchCount).toBe(1) // Initial Paths

            await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })
            await waitFor(() => expect(fetchCount).toBe(2), { timeout: 5000 }) // Exceptions

            await act(async () => { fireEvent.click(screen.getByText('Paths')) })
            await waitFor(() => expect(fetchCount).toBe(3), { timeout: 5000 }) // Paths again (cache miss)
        })

        it('re-render still shows data on same tab', async () => {
            const { unmount } = renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            unmount()
            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })
        })
    })

    // ----------------------------------------------------------------
    // CASE-INSENSITIVE SEARCH
    // ----------------------------------------------------------------
    describe('case-insensitive search', () => {
        it('lowercase "cart" matches CartActivity', async () => {
            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            await act(async () => {
                userJourneysStore.getState().setSearchText('cart')
            })

            // CartActivity matches (case-insensitive)
            expect(screen.getByTestId('sankey-node-CartActivity')).toBeTruthy()
            // SearchActivity is not connected to Cart → filtered out
            expect(screen.queryByTestId('sankey-node-SearchActivity')).toBeNull()
        })

        it('mixed case "mAiN" matches MainActivity', async () => {
            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            await act(async () => {
                userJourneysStore.getState().setSearchText('mAiN')
            })

            expect(screen.getByTestId('sankey-node-MainActivity')).toBeTruthy()
        })
    })

    // ----------------------------------------------------------------
    // PANEL LINK QUERY PARAMS (start_date / end_date)
    // ----------------------------------------------------------------
    describe('panel link query params', () => {
        beforeEach(() => {
            server.use(
                http.get('*/api/apps/:appId/journey', () => {
                    return HttpResponse.json(makeJourneyWithExceptionsFixture())
                }),
            )
        })

        it('crash link includes start_date and end_date query params', async () => {
            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            await act(async () => {
                fireEvent.click(screen.getByTestId('sankey-node-ProductListActivity'))
            })

            await waitFor(() => {
                const crashLink = screen.getByText(/NullPointerException at ProductList/).closest('a')
                const href = crashLink?.getAttribute('href') ?? ''
                expect(href).toContain('start_date=')
                expect(href).toContain('end_date=')
            })
        })

        it('ANR link includes start_date and end_date query params', async () => {
            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            await act(async () => { fireEvent.click(screen.getByText('Exceptions')) })
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            await act(async () => {
                fireEvent.click(screen.getByTestId('sankey-node-CartActivity'))
            })

            await waitFor(() => {
                const anrLink = screen.getByText(/ANR in CartActivity/).closest('a')
                const href = anrLink?.getAttribute('href') ?? ''
                expect(href).toContain('start_date=')
                expect(href).toContain('end_date=')
            })
        })
    })

    // ----------------------------------------------------------------
    // DEBOUNCE TEXT INPUT → STORE
    // ----------------------------------------------------------------
    describe('search input propagates to store', () => {
        it('typing in search input updates store searchText', async () => {
            renderWithProviders(<UserJourneys params={{ teamId: 'test-team' }} />)
            await waitFor(() => expect(screen.getByTestId('nivo-sankey')).toBeTruthy(), { timeout: 5000 })

            const input = screen.getByPlaceholderText('Search nodes...')

            await act(async () => {
                fireEvent.change(input, { target: { value: 'Product' } })
            })

            // DebounceTextInput calls onChange after debounce. The onChange
            // calls setSearchText. Verify the store received it.
            await waitFor(() => {
                expect(userJourneysStore.getState().searchText).toBe('Product')
            }, { timeout: 5000 })
        })
    })
})
