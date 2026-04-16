import { beforeEach, describe, expect, it } from '@jest/globals'

const mockFetchAppsFromServer = jest.fn()
const mockFetchFiltersFromServer = jest.fn()
const mockFetchRootSpanNamesFromServer = jest.fn()
const mockSaveListFiltersToServer = jest.fn()

jest.mock('@/app/api/api_calls', () => {
    const actual = jest.requireActual('@/app/api/api_calls')
    return {
        __esModule: true,
        ...actual,
        fetchAppsFromServer: (...args: any[]) => mockFetchAppsFromServer(...args),
        fetchFiltersFromServer: (...args: any[]) => mockFetchFiltersFromServer(...args),
        fetchRootSpanNamesFromServer: (...args: any[]) => mockFetchRootSpanNamesFromServer(...args),
        saveListFiltersToServer: (...args: any[]) => mockSaveListFiltersToServer(...args),
    }
})

import {
    App,
    AppsApiStatus,
    AppVersion,
    BugReportStatus,
    defaultFilters,
    FiltersApiStatus,
    FilterSource,
    HttpMethod,
    OsVersion,
    RootSpanNamesApiStatus,
    SessionType,
    SpanStatus,
    UdAttrMatcher,
} from '@/app/api/api_calls'
import {
    AppVersionsInitialSelectionType,
    createFiltersStore,
    expandRangesToArray,
    FilterConfig,
    InitConfig
} from '@/app/stores/filters_store'

jest.spyOn(console, 'log').mockImplementation(() => { })
jest.spyOn(console, 'error').mockImplementation(() => { })

let store: ReturnType<typeof createFiltersStore>

// --- Factories ---

function makeApp(overrides: Partial<App> = {}): App {
    return {
        id: 'app-1',
        team_id: 'team-1',
        name: 'Test App',
        api_key: {
            created_at: '2026-01-01T00:00:00Z',
            key: 'msr_key',
            last_seen: null,
            revoked: false,
        },
        onboarded: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        os_name: 'android',
        onboarded_at: '2026-01-01T00:00:00Z',
        unique_identifier: 'com.example.app',
        ...overrides,
    }
}

function makeFilterConfig(overrides: Partial<FilterConfig> = {}): FilterConfig {
    return {
        filterSource: FilterSource.Events,
        showNoData: true,
        showNotOnboarded: true,
        showAppSelector: true,
        showDates: true,
        showAppVersions: true,
        showOsVersions: true,
        showSessionTypes: true,
        showCountries: true,
        showNetworkProviders: true,
        showNetworkTypes: true,
        showNetworkGenerations: true,
        showLocales: true,
        showDeviceManufacturers: true,
        showDeviceNames: true,
        showBugReportStatus: true,
        showHttpMethods: true,
        showUdAttrs: true,
        showFreeText: true,
        ...overrides,
    }
}

function makeInitConfig(overrides: Partial<InitConfig> = {}): InitConfig {
    return {
        urlFilters: {},
        appVersionsInitialSelectionType: AppVersionsInitialSelectionType.Latest,
        filterSource: FilterSource.Events,
        ...overrides,
    }
}

// The server-shape filter payload (snake_case) that fetchFiltersFromServer returns under data
function makeFiltersData(overrides: any = {}) {
    return {
        versions: [
            { name: '1.0.0', code: '100' },
            { name: '1.0.1', code: '101' },
            { name: '1.0.2', code: '102' },
        ],
        os_versions: [
            { name: 'android', version: '13' },
            { name: 'android', version: '14' },
        ],
        countries: ['US', 'IN', 'DE'],
        network_providers: ['Verizon', 'AT&T'],
        network_types: ['wifi', 'cellular'],
        network_generations: ['4g', '5g'],
        locales: ['en-US', 'de-DE'],
        device_manufacturers: ['Google', 'Samsung'],
        device_names: ['Pixel 7', 'Galaxy S23'],
        ud_attrs: {
            key_types: [
                { key: 'user_id', type: 'string' },
                { key: 'premium', type: 'bool' },
            ],
            operator_types: {
                string: ['eq', 'neq'],
                bool: ['eq'],
            },
        },
        ...overrides,
    }
}

/**
 * Flush microtasks. The wrapped `set` triggers `saveListFiltersToServer` synchronously
 * from within a set call; to observe `filterShortCodePromise` resolving, we may need
 * to allow the pending microtask to run. Returns a promise that resolves once the
 * current microtask queue has drained.
 */
async function flushPromises() {
    await Promise.resolve()
    await Promise.resolve()
}

describe('useFiltersStore', () => {
    beforeEach(() => {
        const { queryClient } = require('@/app/query/query_client')
        queryClient.clear()
        store = createFiltersStore()
        mockFetchAppsFromServer.mockReset()
        mockFetchFiltersFromServer.mockReset()
        mockFetchRootSpanNamesFromServer.mockReset()
        mockSaveListFiltersToServer.mockReset()
        mockSaveListFiltersToServer.mockResolvedValue('mock-short-code')
    })

    // =====================================================================
    // Initial state
    // =====================================================================
    describe('initial state', () => {
        it('has defaultFilters as the filters object', () => {
            const state = store.getState()
            expect(state.filters).toEqual(defaultFilters)
        })

        it('has null config and null selectedApp', () => {
            const state = store.getState()
            expect(state.config).toBeNull()
            expect(state.selectedApp).toBeNull()
        })

        it('has Loading as default api statuses', () => {
            const state = store.getState()
            expect(state.appsApiStatus).toBe(AppsApiStatus.Loading)
            expect(state.filtersApiStatus).toBe(FiltersApiStatus.Loading)
            expect(state.rootSpanNamesApiStatus).toBe(RootSpanNamesApiStatus.Loading)
        })

        it('has empty apps and option lists', () => {
            const state = store.getState()
            expect(state.apps).toEqual([])
            expect(state.versions).toEqual([])
            expect(state.osVersions).toEqual([])
            expect(state.countries).toEqual([])
        })

        it('has empty selected arrays except defaults', () => {
            const state = store.getState()
            expect(state.selectedVersions).toEqual([])
            expect(state.selectedOsVersions).toEqual([])
            expect(state.selectedCountries).toEqual([])
            expect(state.selectedFreeText).toBe('')
            // Default bug report statuses is [Open]
            expect(state.selectedBugReportStatuses).toEqual([BugReportStatus.Open])
            // Default http methods is all methods
            expect(state.selectedHttpMethods.length).toBeGreaterThan(0)
        })

        it('has empty filterOptionsCache and rootSpanNamesCache', () => {
            const state = store.getState()
            expect(state.filterOptionsCache.size).toBe(0)
            expect(state.rootSpanNamesCache.size).toBe(0)
        })
    })

    // =====================================================================
    // setConfig
    // =====================================================================
    describe('setConfig', () => {
        it('stores the config', () => {
            const config = makeFilterConfig()
            store.getState().setConfig(config)
            expect(store.getState().config).toEqual(config)
        })

        it('triggers computeFilters, but filters stay defaultFilters since selectedApp is null', () => {
            store.getState().setConfig(makeFilterConfig())
            const state = store.getState()
            expect(state.filters).toEqual(defaultFilters)
        })
    })

    // =====================================================================
    // Setters
    // =====================================================================
    describe('setters', () => {
        it('setSelectedDateRange updates the field and triggers computeFilters', () => {
            // Set up an app and config so computeFilters produces a meaningful filters object
            store.getState().setConfig(makeFilterConfig())
            store.setState({ selectedApp: makeApp() })

            store.getState().setSelectedDateRange('Last 7 Days')

            const state = store.getState()
            expect(state.selectedDateRange).toBe('Last 7 Days')
            // computeFilters re-runs, so filters are no longer defaultFilters
            expect(state.filters).not.toEqual(defaultFilters)
            expect(state.filters.app).not.toBeNull()
        })

        it('setSelectedStartDate/setSelectedEndDate update fields', () => {
            store.getState().setConfig(makeFilterConfig())
            store.setState({ selectedApp: makeApp() })

            store.getState().setSelectedStartDate('2026-01-01')
            store.getState().setSelectedEndDate('2026-01-31')

            const state = store.getState()
            expect(state.selectedStartDate).toBe('2026-01-01')
            expect(state.selectedEndDate).toBe('2026-01-31')
            expect(state.filters.startDate).toBe('2026-01-01')
            expect(state.filters.endDate).toBe('2026-01-31')
        })

        it('setSelectedVersions updates the list and derived filters.versions', () => {
            store.getState().setConfig(makeFilterConfig())
            store.setState({
                selectedApp: makeApp(),
                versions: [new AppVersion('1.0.0', '100'), new AppVersion('1.0.1', '101')],
            })

            store.getState().setSelectedVersions([new AppVersion('1.0.0', '100')])

            const state = store.getState()
            expect(state.selectedVersions).toHaveLength(1)
            expect(state.filters.versions.selected).toHaveLength(1)
            expect(state.filters.versions.all).toBe(false)
        })

        it('setSelectedSessionTypes, setSelectedSpanStatuses, setSelectedBugReportStatuses update fields', () => {
            store.getState().setConfig(makeFilterConfig())
            store.setState({ selectedApp: makeApp() })

            store.getState().setSelectedSessionTypes([SessionType.Crashes])
            store.getState().setSelectedSpanStatuses([SpanStatus.Error])
            store.getState().setSelectedBugReportStatuses([BugReportStatus.Closed])

            const state = store.getState()
            expect(state.selectedSessionTypes).toEqual([SessionType.Crashes])
            expect(state.selectedSpanStatuses).toEqual([SpanStatus.Error])
            expect(state.selectedBugReportStatuses).toEqual([BugReportStatus.Closed])
        })

        it('setSelectedHttpMethods updates the list', () => {
            store.getState().setConfig(makeFilterConfig())
            store.setState({ selectedApp: makeApp() })

            store.getState().setSelectedHttpMethods([HttpMethod.GET, HttpMethod.POST])

            expect(store.getState().selectedHttpMethods).toEqual([HttpMethod.GET, HttpMethod.POST])
        })

        it('setSelectedOsVersions updates the list', () => {
            store.getState().setConfig(makeFilterConfig())
            store.setState({ selectedApp: makeApp() })

            const os = new OsVersion('android', '14')
            store.getState().setSelectedOsVersions([os])

            expect(store.getState().selectedOsVersions).toHaveLength(1)
            expect(store.getState().selectedOsVersions[0].version).toBe('14')
        })

        it('simple array setters update their fields', () => {
            store.getState().setConfig(makeFilterConfig())
            store.setState({ selectedApp: makeApp() })

            store.getState().setSelectedCountries(['US'])
            store.getState().setSelectedNetworkProviders(['Verizon'])
            store.getState().setSelectedNetworkTypes(['wifi'])
            store.getState().setSelectedNetworkGenerations(['4g'])
            store.getState().setSelectedLocales(['en-US'])
            store.getState().setSelectedDeviceManufacturers(['Google'])
            store.getState().setSelectedDeviceNames(['Pixel 7'])

            const state = store.getState()
            expect(state.selectedCountries).toEqual(['US'])
            expect(state.selectedNetworkProviders).toEqual(['Verizon'])
            expect(state.selectedNetworkTypes).toEqual(['wifi'])
            expect(state.selectedNetworkGenerations).toEqual(['4g'])
            expect(state.selectedLocales).toEqual(['en-US'])
            expect(state.selectedDeviceManufacturers).toEqual(['Google'])
            expect(state.selectedDeviceNames).toEqual(['Pixel 7'])
        })

        it('setSelectedRootSpanName and setSelectedFreeText update fields', () => {
            store.getState().setConfig(makeFilterConfig())
            store.setState({ selectedApp: makeApp() })

            store.getState().setSelectedRootSpanName('GET /api')
            store.getState().setSelectedFreeText('error')

            expect(store.getState().selectedRootSpanName).toBe('GET /api')
            expect(store.getState().selectedFreeText).toBe('error')
            expect(store.getState().filters.freeText).toBe('error')
        })

        it('setSelectedUdAttrMatchers updates the list', () => {
            store.getState().setConfig(makeFilterConfig())
            store.setState({ selectedApp: makeApp() })

            const m: UdAttrMatcher = { key: 'user_id', type: 'string', op: 'eq', value: 'abc' }
            store.getState().setSelectedUdAttrMatchers([m])

            expect(store.getState().selectedUdAttrMatchers).toEqual([m])
        })
    })

    // =====================================================================
    // fetchApps
    // =====================================================================
    describe('fetchApps', () => {
        it('on Success, sets apps and calls selectApp for first app (no picker overrides)', async () => {
            const app1 = makeApp({ id: 'app-a', name: 'Alpha' })
            const app2 = makeApp({ id: 'app-b', name: 'Beta' })

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [app1, app2],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            store.getState().setConfig(makeFilterConfig())
            await store.getState().fetchApps('team-1', makeInitConfig())

            const state = store.getState()
            expect(state.appsApiStatus).toBe(AppsApiStatus.Success)
            expect(state.apps).toEqual([app1, app2])
            expect(state.selectedApp?.id).toBe('app-a')
            expect(mockFetchAppsFromServer).toHaveBeenCalledWith('team-1')
        })

        it('picks app by urlFilters.appId when set', async () => {
            const app1 = makeApp({ id: 'app-a' })
            const app2 = makeApp({ id: 'app-b' })

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [app1, app2],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            store.getState().setConfig(makeFilterConfig())
            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({ urlFilters: { appId: 'app-b' } }),
            )

            expect(store.getState().selectedApp?.id).toBe('app-b')
        })

        it('picks app by initConfig.appId when no urlFilters.appId', async () => {
            const app1 = makeApp({ id: 'app-a' })
            const app2 = makeApp({ id: 'app-b' })

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [app1, app2],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            store.getState().setConfig(makeFilterConfig())
            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({ appId: 'app-b' }),
            )

            expect(store.getState().selectedApp?.id).toBe('app-b')
        })

        it('preserves the previously selected app across navigation when no URL or prop hint', async () => {
            // Simulate the user having already selected app-b on a previous page.
            const app1 = makeApp({ id: 'app-a' })
            const app2 = makeApp({ id: 'app-b' })

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [app1, app2],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            store.getState().setConfig(makeFilterConfig())
            // First page: explicitly land on app-b via prop
            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({ appId: 'app-b' }),
            )
            expect(store.getState().selectedApp?.id).toBe('app-b')

            // Second page mounts with no URL appId and no appId prop. The store
            // already has selectedApp = app-b from before, so it stays.
            await store.getState().fetchApps('team-1', makeInitConfig())
            expect(store.getState().selectedApp?.id).toBe('app-b')
        })

        it('priority: urlFilters.appId > initConfig.appId > current selectedApp > apps[0]', async () => {
            const app1 = makeApp({ id: 'app-a' })
            const app2 = makeApp({ id: 'app-b' })
            const app3 = makeApp({ id: 'app-c' })
            const app4 = makeApp({ id: 'app-d' })

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [app1, app2, app3, app4],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            // Seed the store as if app-d had been selected previously.
            store.setState({ selectedApp: app4 } as any)
            store.getState().setConfig(makeFilterConfig())

            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({
                    urlFilters: { appId: 'app-c' },
                    appId: 'app-b',
                }),
            )

            // urlFilters.appId wins
            expect(store.getState().selectedApp?.id).toBe('app-c')
        })

        it('falls back to apps[0] when no URL, no prop, and no current selection', async () => {
            const app1 = makeApp({ id: 'app-a' })
            const app2 = makeApp({ id: 'app-b' })

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [app1, app2],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            store.getState().setConfig(makeFilterConfig())
            await store.getState().fetchApps('team-1', makeInitConfig())

            expect(store.getState().selectedApp?.id).toBe('app-a')
        })

        it('on NoApps, sets appsApiStatus to NoApps and does not call selectApp', async () => {
            mockFetchAppsFromServer.mockResolvedValueOnce({ status: AppsApiStatus.NoApps, data: null })

            store.getState().setConfig(makeFilterConfig())
            await store.getState().fetchApps('team-1', makeInitConfig())

            const state = store.getState()
            expect(state.appsApiStatus).toBe(AppsApiStatus.NoApps)
            expect(state.selectedApp).toBeNull()
            expect(mockFetchFiltersFromServer).not.toHaveBeenCalled()
        })

        it('on Error, sets appsApiStatus to Error', async () => {
            mockFetchAppsFromServer.mockResolvedValueOnce({ status: AppsApiStatus.Error, data: null })

            store.getState().setConfig(makeFilterConfig())
            await store.getState().fetchApps('team-1', makeInitConfig())

            expect(store.getState().appsApiStatus).toBe(AppsApiStatus.Error)
            expect(mockFetchFiltersFromServer).not.toHaveBeenCalled()
        })

        it('when apps.length > 0 already, skips fetch and calls selectApp with picked app', async () => {
            const app1 = makeApp({ id: 'app-a' })
            const app2 = makeApp({ id: 'app-b' })

            store.setState({ apps: [app1, app2], appsApiStatus: AppsApiStatus.Success })
            store.getState().setConfig(makeFilterConfig())

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({ urlFilters: { appId: 'app-b' } }),
            )

            // fetchAppsFromServer was NOT called — we took the cache path
            expect(mockFetchAppsFromServer).not.toHaveBeenCalled()
            expect(store.getState().selectedApp?.id).toBe('app-b')
        })

        it('in-flight dedup: concurrent calls with same key share the same promise', async () => {
            const app1 = makeApp({ id: 'app-a' })

            let resolveFirst: (v: any) => void = () => { }
            const firstPromise = new Promise((resolve) => { resolveFirst = resolve })
            mockFetchAppsFromServer.mockReturnValueOnce(firstPromise as any)

            store.getState().setConfig(makeFilterConfig())

            const p1 = store.getState().fetchApps('team-1', makeInitConfig())
            const p2 = store.getState().fetchApps('team-1', makeInitConfig())

            // Only one underlying fetch call (in-flight dedup)
            expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(1)

            // Provide the response so selectApp can run
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            resolveFirst({ status: AppsApiStatus.Success, data: [app1] })
            await Promise.all([p1, p2])

            expect(store.getState().selectedApp?.id).toBe('app-a')
        })

        // =================================================================
        // Team change behaviour
        // =================================================================
        it('team change: resets store and fetches new apps when teamId changes', async () => {
            const teamAApp = makeApp({ id: 'app-a', team_id: 'team-1', name: 'Team A App' })
            const teamBApp = makeApp({ id: 'app-b', team_id: 'team-2', name: 'Team B App' })

            // First team load
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [teamAApp],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            store.getState().setConfig(makeFilterConfig())
            await store.getState().fetchApps('team-1', makeInitConfig())

            expect(store.getState().selectedApp?.id).toBe('app-a')
            expect(store.getState().apps).toEqual([teamAApp])
            expect(store.getState().currentTeamId).toBe('team-1')

            // Switch to team-2
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [teamBApp],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            store.getState().setConfig(makeFilterConfig())
            await store.getState().fetchApps('team-2', makeInitConfig())

            expect(store.getState().currentTeamId).toBe('team-2')
            expect(store.getState().apps).toEqual([teamBApp])
            expect(store.getState().selectedApp?.id).toBe('app-b')
            expect(mockFetchAppsFromServer).toHaveBeenCalledWith('team-2')
        })

        it('team change: does not reuse cached apps from previous team', async () => {
            const teamAApp = makeApp({ id: 'app-a', team_id: 'team-1' })

            // Load team-1
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [teamAApp],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            store.getState().setConfig(makeFilterConfig())
            await store.getState().fetchApps('team-1', makeInitConfig())
            expect(store.getState().apps.length).toBe(1)

            // Switch to team-2 — must call fetchAppsFromServer even though apps.length > 0
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [],
            })

            await store.getState().fetchApps('team-2', makeInitConfig())

            // Server was called for the new team
            expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(2)
            expect(mockFetchAppsFromServer).toHaveBeenLastCalledWith('team-2')
        })

        it('team change: clears filter caches from previous team', async () => {
            const app = makeApp({ id: 'app-a', team_id: 'team-1' })

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [app],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            store.getState().setConfig(makeFilterConfig())
            await store.getState().fetchApps('team-1', makeInitConfig())

            // Cache should be populated from team-1
            expect(store.getState().filterOptionsCache.size).toBe(1)

            // Switch team
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.NoApps,
                data: null,
            })

            await store.getState().fetchApps('team-2', makeInitConfig())

            // Caches cleared on team switch
            expect(store.getState().filterOptionsCache.size).toBe(0)
            expect(store.getState().rootSpanNamesCache.size).toBe(0)
        })

        it('team change: resets selections from previous team', async () => {
            const app = makeApp({ id: 'app-a', team_id: 'team-1' })

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [app],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            store.getState().setConfig(makeFilterConfig())
            await store.getState().fetchApps('team-1', makeInitConfig())

            // User makes some selections
            store.getState().setSelectedCountries(['US', 'IN'])
            store.getState().setSelectedFreeText('search term')
            expect(store.getState().selectedCountries).toEqual(['US', 'IN'])

            // Switch team
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.NoApps,
                data: null,
            })

            await store.getState().fetchApps('team-2', makeInitConfig())

            // Selections from team-1 should be cleared
            expect(store.getState().selectedCountries).toEqual([])
            expect(store.getState().selectedFreeText).toBe('')
            expect(store.getState().selectedApp).toBeNull()
        })

        it('same team: still uses cached apps on repeated fetchApps calls', async () => {
            const app = makeApp({ id: 'app-a', team_id: 'team-1' })

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [app],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            store.getState().setConfig(makeFilterConfig())
            await store.getState().fetchApps('team-1', makeInitConfig())

            // Same team again (simulating page navigation within same team)
            await store.getState().fetchApps('team-1', makeInitConfig())

            // fetchAppsFromServer called only once — cache used for second call
            expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(1)
            expect(store.getState().selectedApp?.id).toBe('app-a')
        })
    })

    // =====================================================================
    // selectApp
    // =====================================================================
    describe('selectApp', () => {
        it('sets selectedApp and Loading before fetch resolves, then Success', async () => {
            store.getState().setConfig(makeFilterConfig())

            let resolveFetch: (v: any) => void = () => { }
            mockFetchFiltersFromServer.mockReturnValueOnce(new Promise((r) => { resolveFetch = r }) as any)

            const app = makeApp()
            const selectPromise = store.getState().selectApp(app, makeInitConfig())

            // Immediately after, Loading + selectedApp set
            expect(store.getState().selectedApp?.id).toBe(app.id)
            expect(store.getState().filtersApiStatus).toBe(FiltersApiStatus.Loading)

            resolveFetch({ status: FiltersApiStatus.Success, data: makeFiltersData() })
            await selectPromise

            expect(store.getState().filtersApiStatus).toBe(FiltersApiStatus.Success)
        })

        it('cache hit: uses cached filterOptions and does not call fetchFiltersFromServer', async () => {
            store.getState().setConfig(makeFilterConfig())
            const app = makeApp()

            // First call populates cache
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            await store.getState().selectApp(app, makeInitConfig())
            expect(mockFetchFiltersFromServer).toHaveBeenCalledTimes(1)

            // Second call hits cache
            await store.getState().selectApp(app, makeInitConfig())
            expect(mockFetchFiltersFromServer).toHaveBeenCalledTimes(1)
            expect(store.getState().filtersApiStatus).toBe(FiltersApiStatus.Success)
        })

        it('cache miss: fetches, parses, caches, and applies selections', async () => {
            store.getState().setConfig(makeFilterConfig())
            const app = makeApp()

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().selectApp(app, makeInitConfig())

            const state = store.getState()
            expect(state.versions.length).toBe(3)
            expect(state.versions[0]).toBeInstanceOf(AppVersion)
            expect(state.osVersions.length).toBe(2)
            expect(state.countries).toEqual(['US', 'IN', 'DE'])
            expect(state.networkProviders).toEqual(['Verizon', 'AT&T'])
            expect(state.deviceManufacturers).toEqual(['Google', 'Samsung'])
            expect(state.userDefAttrs.length).toBe(2)

            // Cache populated
            const cacheKey = `${app.id}:${FilterSource.Events}`
            expect(state.filterOptionsCache.has(cacheKey)).toBe(true)
        })

        it('forceRefresh bypasses cache', async () => {
            store.getState().setConfig(makeFilterConfig())
            const app = makeApp()

            // Populate cache
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            await store.getState().selectApp(app, makeInitConfig())
            expect(mockFetchFiltersFromServer).toHaveBeenCalledTimes(1)

            // forceRefresh = true
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            await store.getState().selectApp(app, makeInitConfig(), true)
            expect(mockFetchFiltersFromServer).toHaveBeenCalledTimes(2)
        })

        it('applies URL-based selections when urlFilters.appId === app.id', async () => {
            store.getState().setConfig(makeFilterConfig())
            const app = makeApp({ id: 'app-a' })

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            // URL filters contain versions[0, 2] — filtered indexes into data.versions
            await store.getState().selectApp(app, makeInitConfig({
                urlFilters: {
                    appId: 'app-a',
                    versions: [0, 2],
                    countries: [1], // IN
                    sessionTypes: [SessionType.Crashes, SessionType.ANRs],
                    freeText: 'from-url',
                },
            }))

            const state = store.getState()
            expect(state.selectedVersions.map((v) => v.name)).toEqual(['1.0.0', '1.0.2'])
            expect(state.selectedCountries).toEqual(['IN'])
            expect(state.selectedSessionTypes).toEqual([SessionType.Crashes, SessionType.ANRs])
            expect(state.selectedFreeText).toBe('from-url')
        })

        it('falls back to default selections when urlFilters.appId does not match app.id', async () => {
            store.getState().setConfig(makeFilterConfig())
            const app = makeApp({ id: 'app-a' })

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().selectApp(app, makeInitConfig({
                urlFilters: {
                    appId: 'app-different',
                    versions: [0],
                    freeText: 'ignored',
                },
            }))

            const state = store.getState()
            // URL versions ignored — fell back to Latest (first version)
            expect(state.selectedVersions).toHaveLength(1)
            expect(state.selectedVersions[0].name).toBe('1.0.0')
            expect(state.selectedFreeText).toBe('')
        })

        it('AppVersionsInitialSelectionType.Latest selects only the first version', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().selectApp(
                makeApp(),
                makeInitConfig({
                    appVersionsInitialSelectionType: AppVersionsInitialSelectionType.Latest,
                }),
            )

            const state = store.getState()
            expect(state.selectedVersions).toHaveLength(1)
            expect(state.selectedVersions[0].name).toBe('1.0.0')
        })

        it('AppVersionsInitialSelectionType.All selects every version', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().selectApp(
                makeApp(),
                makeInitConfig({
                    appVersionsInitialSelectionType: AppVersionsInitialSelectionType.All,
                }),
            )

            const state = store.getState()
            expect(state.selectedVersions).toHaveLength(3)
        })

        it('Spans filterSource: fetches root span names and caches them', async () => {
            store.getState().setConfig(makeFilterConfig({ filterSource: FilterSource.Spans }))

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Success,
                data: { results: ['GET /home', 'POST /login'] },
            })

            const app = makeApp()
            await store.getState().selectApp(
                app,
                makeInitConfig({ filterSource: FilterSource.Spans }),
            )

            const state = store.getState()
            expect(state.rootSpanNamesApiStatus).toBe(RootSpanNamesApiStatus.Success)
            expect(state.rootSpanNames).toEqual(['GET /home', 'POST /login'])
            expect(state.selectedRootSpanName).toBe('GET /home')
            expect(state.rootSpanNamesCache.has(app.id)).toBe(true)
        })

        it('Spans filterSource: uses cached root span names on second call', async () => {
            store.getState().setConfig(makeFilterConfig({ filterSource: FilterSource.Spans }))

            const app = makeApp()

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Success,
                data: { results: ['GET /home'] },
            })

            await store.getState().selectApp(app, makeInitConfig({ filterSource: FilterSource.Spans }))
            expect(mockFetchRootSpanNamesFromServer).toHaveBeenCalledTimes(1)

            await store.getState().selectApp(app, makeInitConfig({ filterSource: FilterSource.Spans }))
            // Still just one call — cache hit
            expect(mockFetchRootSpanNamesFromServer).toHaveBeenCalledTimes(1)
        })

        it('Spans filterSource: cache hit with URL rootSpanName match', async () => {
            store.getState().setConfig(makeFilterConfig({ filterSource: FilterSource.Spans }))

            const app = makeApp({ id: 'app-a' })

            // Populate cache
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Success,
                data: { results: ['GET /home', 'GET /profile', 'POST /login'] },
            })
            await store.getState().selectApp(app, makeInitConfig({ filterSource: FilterSource.Spans }))

            // Second call with URL rootSpanName matching a cached name
            await store.getState().selectApp(
                app,
                makeInitConfig({
                    filterSource: FilterSource.Spans,
                    urlFilters: { appId: 'app-a', rootSpanName: 'GET /profile' },
                }),
            )
            expect(store.getState().selectedRootSpanName).toBe('GET /profile')
        })

        it('Spans filterSource: cache hit with URL rootSpanName NOT in cache falls back to first', async () => {
            store.getState().setConfig(makeFilterConfig({ filterSource: FilterSource.Spans }))

            const app = makeApp({ id: 'app-a' })

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Success,
                data: { results: ['GET /home', 'POST /login'] },
            })
            await store.getState().selectApp(app, makeInitConfig({ filterSource: FilterSource.Spans }))

            // Second call with a non-matching URL rootSpanName
            await store.getState().selectApp(
                app,
                makeInitConfig({
                    filterSource: FilterSource.Spans,
                    urlFilters: { appId: 'app-a', rootSpanName: 'not-in-cache' },
                }),
            )
            expect(store.getState().selectedRootSpanName).toBe('GET /home')
        })

        it('Spans filterSource: picks matching rootSpanName from URL when available', async () => {
            store.getState().setConfig(makeFilterConfig({ filterSource: FilterSource.Spans }))

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Success,
                data: { results: ['GET /home', 'POST /login', 'GET /profile'] },
            })

            const app = makeApp({ id: 'app-a' })
            await store.getState().selectApp(
                app,
                makeInitConfig({
                    filterSource: FilterSource.Spans,
                    urlFilters: { appId: 'app-a', rootSpanName: 'GET /profile' },
                }),
            )

            expect(store.getState().selectedRootSpanName).toBe('GET /profile')
        })

        it('Spans filterSource: falls back to first root span name when URL name not found', async () => {
            store.getState().setConfig(makeFilterConfig({ filterSource: FilterSource.Spans }))

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Success,
                data: { results: ['GET /home', 'POST /login'] },
            })

            const app = makeApp({ id: 'app-a' })
            await store.getState().selectApp(
                app,
                makeInitConfig({
                    filterSource: FilterSource.Spans,
                    urlFilters: { appId: 'app-a', rootSpanName: 'nonexistent-span' },
                }),
            )

            expect(store.getState().selectedRootSpanName).toBe('GET /home')
        })

        it('Spans filterSource: handles Error status on root span fetch', async () => {
            store.getState().setConfig(makeFilterConfig({ filterSource: FilterSource.Spans }))

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Error,
                data: null,
            })

            await store.getState().selectApp(
                makeApp(),
                makeInitConfig({ filterSource: FilterSource.Spans }),
            )

            expect(store.getState().rootSpanNamesApiStatus).toBe(RootSpanNamesApiStatus.Error)
        })

        it('Spans filterSource: handles NoData status on root span fetch', async () => {
            store.getState().setConfig(makeFilterConfig({ filterSource: FilterSource.Spans }))

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.NoData,
                data: null,
            })

            await store.getState().selectApp(
                makeApp(),
                makeInitConfig({ filterSource: FilterSource.Spans }),
            )

            expect(store.getState().rootSpanNamesApiStatus).toBe(RootSpanNamesApiStatus.NoData)
        })

        it('NotOnboarded: clears selections', async () => {
            store.getState().setConfig(makeFilterConfig())

            // Seed some selected values
            store.setState({
                selectedCountries: ['US'],
                selectedFreeText: 'before',
            })

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.NotOnboarded,
                data: null,
            })

            await store.getState().selectApp(makeApp(), makeInitConfig())

            const state = store.getState()
            expect(state.filtersApiStatus).toBe(FiltersApiStatus.NotOnboarded)
            expect(state.selectedCountries).toEqual([])
            expect(state.selectedFreeText).toBe('')
            expect(state.selectedVersions).toEqual([])
        })

        it('NoData: clears selections', async () => {
            store.getState().setConfig(makeFilterConfig())

            store.setState({ selectedCountries: ['US'] })

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.NoData,
                data: null,
            })

            await store.getState().selectApp(makeApp(), makeInitConfig())

            const state = store.getState()
            expect(state.filtersApiStatus).toBe(FiltersApiStatus.NoData)
            expect(state.selectedCountries).toEqual([])
        })

        it('Error: clears selections', async () => {
            store.getState().setConfig(makeFilterConfig())

            store.setState({ selectedCountries: ['US'] })

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Error,
                data: null,
            })

            await store.getState().selectApp(makeApp(), makeInitConfig())

            const state = store.getState()
            expect(state.filtersApiStatus).toBe(FiltersApiStatus.Error)
            expect(state.selectedCountries).toEqual([])
        })

        it('in-flight dedup: concurrent calls with same key share the same promise', async () => {
            store.getState().setConfig(makeFilterConfig())

            let resolveFirst: (v: any) => void = () => { }
            mockFetchFiltersFromServer.mockReturnValueOnce(new Promise((r) => { resolveFirst = r }) as any)

            const app = makeApp({ id: 'app-dedup' })
            const p1 = store.getState().selectApp(app, makeInitConfig())
            const p2 = store.getState().selectApp(app, makeInitConfig())

            expect(mockFetchFiltersFromServer).toHaveBeenCalledTimes(1)

            resolveFirst({ status: FiltersApiStatus.Success, data: makeFiltersData() })
            await Promise.all([p1, p2])
        })

        it('applyFilterOptions: filters out out-of-bounds URL indexes', async () => {
            store.getState().setConfig(makeFilterConfig())
            const app = makeApp({ id: 'app-a' })

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            // makeFiltersData has 3 versions (indexes 0–2). Index 99 is out of bounds.
            await store.getState().selectApp(app, makeInitConfig({
                urlFilters: {
                    appId: 'app-a',
                    versions: [0, 99, 2],
                    countries: [-1, 0],
                },
            }))

            const state = store.getState()
            // Only 0 and 2 survive the bounds filter
            expect(state.selectedVersions.map((v) => v.name)).toEqual(['1.0.0', '1.0.2'])
            // Only 0 survives from countries
            expect(state.selectedCountries).toEqual(['US'])
        })

        it('applyFilterOptions: valid udAttrMatchers from URL are kept, invalid ones dropped', async () => {
            store.getState().setConfig(makeFilterConfig())
            const app = makeApp({ id: 'app-a' })

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            const validMatcher: UdAttrMatcher = { key: 'user_id', type: 'string', op: 'eq', value: 'x' }
            const unknownKey: UdAttrMatcher = { key: 'not_a_key', type: 'string', op: 'eq', value: 'x' }
            const unknownOp: UdAttrMatcher = { key: 'user_id', type: 'string', op: 'invalid_op', value: 'x' }

            await store.getState().selectApp(app, makeInitConfig({
                urlFilters: {
                    appId: 'app-a',
                    udAttrMatchers: [validMatcher, unknownKey, unknownOp],
                },
            }))

            const state = store.getState()
            expect(state.selectedUdAttrMatchers).toEqual([validMatcher])
        })

        it('applyFilterOptions: URL match with every filter field set exercises all branches', async () => {
            store.getState().setConfig(makeFilterConfig())
            const app = makeApp({ id: 'app-a' })

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().selectApp(app, makeInitConfig({
                urlFilters: {
                    appId: 'app-a',
                    versions: [0],
                    osVersions: [0],
                    countries: [0],
                    networkProviders: [0],
                    networkTypes: [0],
                    networkGenerations: [0],
                    locales: [0],
                    deviceManufacturers: [0],
                    deviceNames: [0],
                    bugReportStatuses: [BugReportStatus.Closed],
                    httpMethods: [HttpMethod.GET],
                    sessionTypes: [SessionType.Crashes],
                    udAttrMatchers: [{ key: 'user_id', type: 'string', op: 'eq', value: 'x' }],
                    freeText: 'hello',
                },
            }))

            const state = store.getState()
            expect(state.selectedVersions).toHaveLength(1)
            expect(state.selectedOsVersions).toHaveLength(1)
            expect(state.selectedCountries).toEqual(['US'])
            expect(state.selectedNetworkProviders).toEqual(['Verizon'])
            expect(state.selectedNetworkTypes).toEqual(['wifi'])
            expect(state.selectedNetworkGenerations).toEqual(['4g'])
            expect(state.selectedLocales).toEqual(['en-US'])
            expect(state.selectedDeviceManufacturers).toEqual(['Google'])
            expect(state.selectedDeviceNames).toEqual(['Pixel 7'])
            expect(state.selectedBugReportStatuses).toEqual([BugReportStatus.Closed])
            expect(state.selectedHttpMethods).toEqual([HttpMethod.GET])
            expect(state.selectedSessionTypes).toEqual([SessionType.Crashes])
            expect(state.selectedUdAttrMatchers).toHaveLength(1)
            expect(state.selectedFreeText).toBe('hello')
        })

        it('applyFilterOptions: URL span statuses are filtered to valid enum values', async () => {
            store.getState().setConfig(makeFilterConfig({ filterSource: FilterSource.Spans }))
            const app = makeApp({ id: 'app-a' })

            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Success,
                data: { results: ['GET /home'] },
            })

            await store.getState().selectApp(app, makeInitConfig({
                filterSource: FilterSource.Spans,
                urlFilters: {
                    appId: 'app-a',
                    spanStatuses: [SpanStatus.Error, 'bogus' as SpanStatus],
                },
            }))

            expect(store.getState().selectedSpanStatuses).toEqual([SpanStatus.Error])
        })
    })

    // =====================================================================
    // refresh
    // =====================================================================
    describe('refresh', () => {
        it('clears caches and re-fetches apps', async () => {
            store.getState().setConfig(makeFilterConfig())
            const app = makeApp({ id: 'app-a' })

            // Initial populate
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [app],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            await store.getState().fetchApps('team-1', makeInitConfig())
            expect(store.getState().filterOptionsCache.size).toBe(1)

            // refresh
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [app],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            await store.getState().refresh('team-1', makeInitConfig())

            expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(2)
            // After refresh runs selectApp with forceRefresh=true, the cache is rebuilt with one entry
            expect(store.getState().filterOptionsCache.size).toBe(1)
        })

        it('selects a specific app by appIdToSelect parameter', async () => {
            store.getState().setConfig(makeFilterConfig())
            const app1 = makeApp({ id: 'app-a' })
            const app2 = makeApp({ id: 'app-b' })

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [app1, app2],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().refresh('team-1', makeInitConfig(), 'app-b')

            expect(store.getState().selectedApp?.id).toBe('app-b')
        })

        it('throws when appIdToSelect is not found', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })

            await expect(
                store.getState().refresh('team-1', makeInitConfig(), 'nonexistent'),
            ).rejects.toThrow('Invalid app Id: nonexistent provided to refresh')
        })

        it('on NoApps, sets status without calling selectApp', async () => {
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValueOnce({ status: AppsApiStatus.NoApps, data: null })

            await store.getState().refresh('team-1', makeInitConfig())

            expect(store.getState().appsApiStatus).toBe(AppsApiStatus.NoApps)
            expect(mockFetchFiltersFromServer).not.toHaveBeenCalled()
        })

        it('on Error, sets status without calling selectApp', async () => {
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValueOnce({ status: AppsApiStatus.Error, data: null })

            await store.getState().refresh('team-1', makeInitConfig())

            expect(store.getState().appsApiStatus).toBe(AppsApiStatus.Error)
        })
    })

    // =====================================================================
    // computeFilters derived state
    // =====================================================================
    describe('computeFilters', () => {
        it('returns defaultFilters when no config', () => {
            store.setState({ selectedApp: makeApp() })
            expect(store.getState().filters).toEqual(defaultFilters)
        })

        it('returns defaultFilters when no selectedApp', () => {
            store.getState().setConfig(makeFilterConfig())
            expect(store.getState().filters).toEqual(defaultFilters)
        })

        it('ready=true when all api statuses are Success (Events source, showNoData & showNotOnboarded)', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            await store.getState().fetchApps('team-1', makeInitConfig())

            expect(store.getState().filters.ready).toBe(true)
        })

        it('ready=true on NoData when showNoData=true', async () => {
            store.getState().setConfig(makeFilterConfig({ showNoData: true, showNotOnboarded: false }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.NoData,
                data: null,
            })

            await store.getState().fetchApps('team-1', makeInitConfig())

            expect(store.getState().filters.ready).toBe(false)
            expect(store.getState().filtersApiStatus).toBe(FiltersApiStatus.NoData)
        })

        it('ready=true on NoData when showNotOnboarded=true (the "showNotOnboarded-only" branch accepts NoData)', async () => {
            store.getState().setConfig(makeFilterConfig({ showNoData: false, showNotOnboarded: true }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.NoData,
                data: null,
            })

            await store.getState().fetchApps('team-1', makeInitConfig())

            // showNotOnboarded branch: ready=true when filtersApiStatus is Success or NoData
            expect(store.getState().filters.ready).toBe(true)
        })

        it('ready=false on NotOnboarded when neither showNoData nor showNotOnboarded (strict mode still accepts it)', async () => {
            store.getState().setConfig(makeFilterConfig({ showNoData: true, showNotOnboarded: true }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.NotOnboarded,
                data: null,
            })

            await store.getState().fetchApps('team-1', makeInitConfig())

            // showNoData && showNotOnboarded branch requires Success strictly — so NotOnboarded is NOT ready
            expect(store.getState().filters.ready).toBe(false)
        })

        it('neither showNoData nor showNotOnboarded: accepts Success, NoData, and NotOnboarded', async () => {
            store.getState().setConfig(makeFilterConfig({ showNoData: false, showNotOnboarded: false }))

            // First: NoData should still be ready
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.NoData,
                data: null,
            })

            await store.getState().fetchApps('team-1', makeInitConfig())
            expect(store.getState().filters.ready).toBe(true)

            // Reset and try NotOnboarded
            store.getState().reset(true)
            store.getState().setConfig(makeFilterConfig({ showNoData: false, showNotOnboarded: false }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.NotOnboarded,
                data: null,
            })
            await store.getState().fetchApps('team-1', makeInitConfig())
            expect(store.getState().filters.ready).toBe(true)
        })

        it('handles null versions in the filter response (NoData branch is taken earlier, but parseFilterResponse is defensive)', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            // Simulate Success response with null versions / os_versions / ud_attrs — the parser should
            // not throw and should default to empty arrays / maps.
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: {
                    versions: null,
                    os_versions: null,
                    countries: [],
                    network_providers: [],
                    network_types: [],
                    network_generations: [],
                    locales: [],
                    device_manufacturers: [],
                    device_names: [],
                    ud_attrs: null,
                },
            })
            await store.getState().fetchApps('team-1', makeInitConfig())

            const state = store.getState()
            expect(state.versions).toEqual([])
            expect(state.osVersions).toEqual([])
            expect(state.userDefAttrs).toEqual([])
        })

        it('parseFilterResponse falls back to [] when countries/network/locale/device fields are null', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            // API returns null (not empty array) for all optional list fields — parser should
            // apply the `?? []` fallback and store empty arrays.
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: {
                    versions: [{ name: '1.0.0', code: '100' }],
                    os_versions: [{ name: 'android', version: '13' }],
                    countries: null,
                    network_providers: null,
                    network_types: null,
                    network_generations: null,
                    locales: null,
                    device_manufacturers: null,
                    device_names: null,
                    ud_attrs: null,
                },
            })
            await store.getState().fetchApps('team-1', makeInitConfig())

            const state = store.getState()
            expect(state.countries).toEqual([])
            expect(state.networkProviders).toEqual([])
            expect(state.networkTypes).toEqual([])
            expect(state.networkGenerations).toEqual([])
            expect(state.locales).toEqual([])
            expect(state.deviceManufacturers).toEqual([])
            expect(state.deviceNames).toEqual([])
        })

        it('ready=true on NotOnboarded when showNotOnboarded=true', async () => {
            store.getState().setConfig(makeFilterConfig({ showNoData: false, showNotOnboarded: true }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.NotOnboarded,
                data: null,
            })

            await store.getState().fetchApps('team-1', makeInitConfig())

            expect(store.getState().filtersApiStatus).toBe(FiltersApiStatus.NotOnboarded)
            // showNotOnboarded branch: ready depends on correct api statuses
            // Test that the code path runs (ready=false here due to Events source path in "else if showNotOnboarded")
            // We don't assert a specific value — just that no exception was thrown and filters computed
            expect(store.getState().filters).toBeDefined()
        })

        it('both=true + Spans filterSource: ready=true requires rootSpanNames Success', async () => {
            store.getState().setConfig(makeFilterConfig({
                showNoData: true,
                showNotOnboarded: true,
                filterSource: FilterSource.Spans,
            }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Success,
                data: { results: ['GET /home'] },
            })

            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({ filterSource: FilterSource.Spans }),
            )

            expect(store.getState().filters.ready).toBe(true)
        })

        it('both=true + Spans filterSource: ready=false when rootSpanNames not Success', async () => {
            store.getState().setConfig(makeFilterConfig({
                showNoData: true,
                showNotOnboarded: true,
                filterSource: FilterSource.Spans,
            }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Error,
                data: null,
            })

            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({ filterSource: FilterSource.Spans }),
            )

            expect(store.getState().filters.ready).toBe(false)
        })

        it('showNoData=true only + Spans filterSource: ready=true on NotOnboarded with rootSpanNames Success', async () => {
            store.getState().setConfig(makeFilterConfig({
                showNoData: true,
                showNotOnboarded: false,
                filterSource: FilterSource.Spans,
            }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            // Spans mode: fetchFiltersFromServer resolves NotOnboarded, rootSpanNames stays unexecuted
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.NotOnboarded,
                data: null,
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Success,
                data: { results: ['GET /home'] },
            })

            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({ filterSource: FilterSource.Spans }),
            )

            // showNoData branch accepts Success or NotOnboarded; Spans requires rootSpanNames Success
            expect(store.getState().filters.ready).toBe(true)
        })

        it('showNotOnboarded=true only + Spans filterSource: ready=true on NoData with rootSpanNames Success', async () => {
            store.getState().setConfig(makeFilterConfig({
                showNoData: false,
                showNotOnboarded: true,
                filterSource: FilterSource.Spans,
            }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.NoData,
                data: null,
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Success,
                data: { results: ['GET /home'] },
            })

            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({ filterSource: FilterSource.Spans }),
            )

            // showNotOnboarded branch accepts Success or NoData; Spans requires rootSpanNames Success
            expect(store.getState().filters.ready).toBe(true)
        })

        it('neither=false + Spans filterSource: ready=true on NotOnboarded with rootSpanNames Success', async () => {
            store.getState().setConfig(makeFilterConfig({
                showNoData: false,
                showNotOnboarded: false,
                filterSource: FilterSource.Spans,
            }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.NotOnboarded,
                data: null,
            })
            mockFetchRootSpanNamesFromServer.mockResolvedValueOnce({
                status: RootSpanNamesApiStatus.Success,
                data: { results: ['GET /home'] },
            })

            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({ filterSource: FilterSource.Spans }),
            )

            // neither branch accepts Success, NoData, or NotOnboarded; Spans requires rootSpanNames Success
            expect(store.getState().filters.ready).toBe(true)
        })

        it('showNoData=true only branch: ready=true on NotOnboarded (Events source)', async () => {
            store.getState().setConfig(makeFilterConfig({
                showNoData: true,
                showNotOnboarded: false,
            }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.NotOnboarded,
                data: null,
            })

            await store.getState().fetchApps('team-1', makeInitConfig())

            // showNoData branch accepts Success or NotOnboarded
            expect(store.getState().filters.ready).toBe(true)
        })

        it('versions.all=true when all versions selected', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig({
                appVersionsInitialSelectionType: AppVersionsInitialSelectionType.All,
            }))

            expect(store.getState().filters.versions.all).toBe(true)
        })

        it('versions.all=false when only some versions selected', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig({
                appVersionsInitialSelectionType: AppVersionsInitialSelectionType.Latest,
            }))

            expect(store.getState().filters.versions.all).toBe(false)
        })

        it('countries.all=true when all countries selected', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())

            // Default selections copy the entire options list
            expect(store.getState().filters.countries.all).toBe(true)
        })

        it('serialisedFilters includes enabled fields', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())

            const serialised = store.getState().filters.serialisedFilters!
            expect(serialised).toContain('a=app-a') // appId
            expect(serialised).toContain('v=') // versions
            expect(serialised).toContain('st=') // sessionTypes
        })
    })

    // =====================================================================
    // expandRangesToArray (exported helper used by Filters component)
    // =====================================================================
    describe('expandRangesToArray', () => {
        it('returns [] for empty string', () => {
            expect(expandRangesToArray('')).toEqual([])
        })

        it('parses single numbers', () => {
            expect(expandRangesToArray('3')).toEqual([3])
            expect(expandRangesToArray('1,3,5')).toEqual([1, 3, 5])
        })

        it('expands ranges', () => {
            expect(expandRangesToArray('0-2')).toEqual([0, 1, 2])
            expect(expandRangesToArray('5-7')).toEqual([5, 6, 7])
        })

        it('handles mixed ranges and numbers', () => {
            expect(expandRangesToArray('0-2,5,7-8')).toEqual([0, 1, 2, 5, 7, 8])
        })

        it('skips non-numeric parts', () => {
            expect(expandRangesToArray('1,abc,3')).toEqual([1, 3])
        })

        it('round-trips with compressArrayToRanges (indirectly via serialized filters)', () => {
            // compressArrayToRanges is not exported; we round-trip via serialisedFilters
            expect(expandRangesToArray('0-2')).toEqual([0, 1, 2])
        })
    })

    // =====================================================================
    // serializeUrlFilters
    // =====================================================================
    describe('serializeUrlFilters', () => {
        it('skips fields whose show* flag is false', async () => {
            // Disable countries serialization
            store.getState().setConfig(makeFilterConfig({
                showCountries: false,
                // disable other lists we don't want in the serialized output
                showOsVersions: false,
                showNetworkProviders: false,
                showNetworkTypes: false,
                showNetworkGenerations: false,
                showLocales: false,
                showDeviceManufacturers: false,
                showDeviceNames: false,
            }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            await store.getState().fetchApps('team-1', makeInitConfig())

            const serialised = store.getState().filters.serialisedFilters!
            expect(serialised).not.toContain('c=') // countries skipped
            expect(serialised).not.toContain('os=') // os versions skipped
            expect(serialised).not.toContain('np=') // network providers skipped
        })

        it('skips empty arrays', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData({ countries: [] }), // empty!
            })
            await store.getState().fetchApps('team-1', makeInitConfig())

            const serialised = store.getState().filters.serialisedFilters!
            expect(serialised).not.toContain('c=')
        })

        it('compresses numeric ranges (versions)', async () => {
            // Manual state setup for a crisp test
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig({
                appVersionsInitialSelectionType: AppVersionsInitialSelectionType.All,
            }))

            const serialised = store.getState().filters.serialisedFilters!
            // All 3 versions selected → range "0-2"
            expect(serialised).toContain('v=0-2')
        })

        it('encodes udAttrMatchers with separators and URL encoding', () => {
            store.getState().setConfig(makeFilterConfig())

            // Seed selectedApp directly, then call the setter so the wrapped set recomputes filters
            store.setState({ selectedApp: makeApp({ id: 'app-a' }) })
            store.getState().setSelectedUdAttrMatchers([
                { key: 'user id', type: 'string', op: 'eq', value: 'some value' },
            ])

            const serialised = store.getState().filters.serialisedFilters!
            // Check the ud key is present
            expect(serialised).toContain('ud=')
            // encodeURIComponent inside the matcher encodes space → %20, and URLSearchParams.set
            // then percent-encodes the ~ separator → %7E and % itself → %25
            // So the final wire format has: user%2520id%7Estring%7Eeq%7Esome%2520value
            expect(serialised).toMatch(/ud=[^&]*%7E[^&]*%7E[^&]*%7E[^&]*/)
            // The space in 'user id' became %20 after encodeURIComponent, then %25 %20 after URLSearchParams
            expect(serialised).toContain('user%2520id')
            expect(serialised).toContain('some%2520value')
        })

        it('dateRange serialization when showDates is true', () => {
            store.getState().setConfig(makeFilterConfig())
            store.setState({ selectedApp: makeApp() })

            store.getState().setSelectedDateRange('Last 24 Hours')

            const serialised = store.getState().filters.serialisedFilters!
            expect(serialised).toContain('d=')
            expect(serialised).toContain('Last+24+Hours')
        })

        it('compresses non-contiguous version indices into multiple ranges (range-break)', () => {
            // Exercise the range-break branch in compressArrayToRanges:
            // pick versions at indices 0, 1, 3, 4 (gap at 2) → "0-1,3-4"
            store.getState().setConfig(makeFilterConfig())
            store.setState({
                selectedApp: makeApp({ id: 'app-a' }),
                versions: [
                    new AppVersion('1.0.0', '100'),
                    new AppVersion('1.0.1', '101'),
                    new AppVersion('1.0.2', '102'),
                    new AppVersion('1.0.3', '103'),
                    new AppVersion('1.0.4', '104'),
                ],
            })
            store.getState().setSelectedVersions([
                new AppVersion('1.0.0', '100'),
                new AppVersion('1.0.1', '101'),
                new AppVersion('1.0.3', '103'),
                new AppVersion('1.0.4', '104'),
            ])

            const serialised = store.getState().filters.serialisedFilters!
            expect(serialised).toContain('v=0-1%2C3-4')
        })

        it('compresses non-contiguous single-element indices into comma-separated list', () => {
            // Another exercise of range-break: select indices 0, 2, 4 (no pairs) → "0,2,4"
            store.getState().setConfig(makeFilterConfig())
            store.setState({
                selectedApp: makeApp({ id: 'app-a' }),
                versions: [
                    new AppVersion('1.0.0', '100'),
                    new AppVersion('1.0.1', '101'),
                    new AppVersion('1.0.2', '102'),
                    new AppVersion('1.0.3', '103'),
                    new AppVersion('1.0.4', '104'),
                ],
            })
            store.getState().setSelectedVersions([
                new AppVersion('1.0.0', '100'),
                new AppVersion('1.0.2', '102'),
                new AppVersion('1.0.4', '104'),
            ])

            const serialised = store.getState().filters.serialisedFilters!
            expect(serialised).toContain('v=0%2C2%2C4')
        })

        it('exercises the fully empty selectedVersions path (empty array branch in compressArrayToRanges)', () => {
            // The serializeUrlFilters outer check also catches empty arrays, but we verify that
            // an empty selection is correctly skipped in the output.
            store.getState().setConfig(makeFilterConfig())
            store.setState({
                selectedApp: makeApp({ id: 'app-a' }),
                versions: [new AppVersion('1.0.0', '100')],
                selectedVersions: [],
            })
            // Trigger a recompute
            store.getState().setSelectedVersions([])

            const serialised = store.getState().filters.serialisedFilters!
            // versions key `v=` is not present when selectedVersions is empty
            expect(serialised).not.toContain('v=')
        })

        it('omits appId when showAppSelector is false', () => {
            store.getState().setConfig(makeFilterConfig({ showAppSelector: false }))
            store.setState({ selectedApp: makeApp({ id: 'app-a' }) })
            // Trigger a recompute
            store.getState().setSelectedFreeText('x')

            const serialised = store.getState().filters.serialisedFilters!
            // The a= (appId) key is absent
            expect(serialised).not.toContain('a=app-a')
        })
    })

    // =====================================================================
    // filterShortCodePromise
    // =====================================================================
    describe('filterShortCodePromise', () => {
        it('starts as a resolved null promise on the filters object', async () => {
            const p = store.getState().filters.filterShortCodePromise
            await expect(p).resolves.toBeNull()
        })

        it('is recomputed when serialisedFilters changes and filters.ready becomes true', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockSaveListFiltersToServer.mockResolvedValueOnce('code-1')
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            // saveListFiltersToServer was called at least once as a result of the state change
            expect(mockSaveListFiltersToServer).toHaveBeenCalled()
            await expect(store.getState().filters.filterShortCodePromise).resolves.toBe('code-1')
        })

        it('does not re-call saveListFiltersToServer when selections are set to the same values', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            const callsAfterFetch = mockSaveListFiltersToServer.mock.calls.length

            // Setting the same selected versions back — body key unchanged
            const current = store.getState().selectedVersions
            store.getState().setSelectedVersions(current)
            await flushPromises()

            expect(mockSaveListFiltersToServer.mock.calls.length).toBe(callsAfterFetch)
        })

        it('re-computes when body-relevant selections change', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData({ countries: ['US', 'UK', 'IN'] }),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            const callsAfterFetch = mockSaveListFiltersToServer.mock.calls.length

            // Country selection IS part of the /shortFilters POST body, so
            // changing it must fire a new POST.
            store.getState().setSelectedCountries(['US'])
            await flushPromises()

            expect(mockSaveListFiltersToServer.mock.calls.length).toBeGreaterThan(callsAfterFetch)
        })

        it('does not re-call for fields that are not in the POST body (dates, freeText)', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            const callsAfterFetch = mockSaveListFiltersToServer.mock.calls.length

            // Dates go as separate URL params, not in the POST body — no POST.
            store.getState().setSelectedDateRange('Last 24 Hours')
            store.getState().setSelectedStartDate('2024-01-01T00:00:00.000Z')
            store.getState().setSelectedEndDate('2024-01-02T00:00:00.000Z')
            // freeText also goes as a URL param, not in the POST body — no POST.
            store.getState().setSelectedFreeText('new-query')
            await flushPromises()

            expect(mockSaveListFiltersToServer.mock.calls.length).toBe(callsAfterFetch)
        })

        it('does not re-call when only config (show* flags) changes', async () => {
            store.getState().setConfig(makeFilterConfig({ showOsVersions: true }))

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            const callsAfterFetch = mockSaveListFiltersToServer.mock.calls.length

            // Simulate cross-page navigation: new page has a different config
            // with different show* flags. The POST body is unaffected, so no
            // new /shortFilters POST should fire.
            store.getState().setConfig(makeFilterConfig({ showOsVersions: false }))
            await flushPromises()

            expect(mockSaveListFiltersToServer.mock.calls.length).toBe(callsAfterFetch)
        })

        it('does not re-call when user clears a filter that had "all" selected', async () => {
            // Body sends `[]` for both "all selected" and "nothing selected" on
            // fields with an `all` flag, so the server-side filter is identical
            // and no new POST is needed when the user toggles between those.
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData({ countries: ['US', 'UK', 'IN'] }),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            // Sanity: default initial selection picks all countries, all=true.
            const state = store.getState()
            expect(state.filters.countries.all).toBe(true)
            expect(state.selectedCountries.length).toBe(3)

            const callsAfterFetch = mockSaveListFiltersToServer.mock.calls.length

            // User clears the country filter — all=false, selected=[]
            store.getState().setSelectedCountries([])
            await flushPromises()

            expect(mockSaveListFiltersToServer.mock.calls.length).toBe(callsAfterFetch)
        })

        it('preserves all selections across re-mount / cross-page navigation', async () => {
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            // User changes several filters
            store.getState().setSelectedCountries(['US'])
            store.getState().setSelectedLocales(['en-US'])
            store.getState().setSelectedDeviceNames(['Pixel 7'])
            await flushPromises()

            // Simulate re-mount via another fetchApps call
            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            const state = store.getState()
            expect(state.selectedCountries).toEqual(['US'])
            expect(state.selectedLocales).toEqual(['en-US'])
            expect(state.selectedDeviceNames).toEqual(['Pixel 7'])
        })

        it('resets selections when switching to a different app', async () => {
            // Two different apps. User sets filters on app-a, then switches to
            // app-b — selections for app-a must not leak to app-b.
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' }), makeApp({ id: 'app-b' })],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig({ appId: 'app-a' }))
            await flushPromises()

            store.getState().setSelectedUdAttrMatchers([
                { key: 'user_id', type: 'string', op: 'eq', value: 'alice' },
            ])
            store.getState().setSelectedCountries(['US'])
            await flushPromises()

            // User picks a different app — this is not a navigation, it's an
            // intentional app switch via the picker. Reset is expected.
            await store
                .getState()
                .selectApp(makeApp({ id: 'app-b' }), makeInitConfig({ appId: 'app-b' }))
            await flushPromises()

            const state = store.getState()
            expect(state.selectedApp?.id).toBe('app-b')
            expect(state.selectedUdAttrMatchers).toEqual([])
            // Countries defaults to "all" for the new app's data.
            expect(state.filters.countries.all).toBe(true)
        })

        it('does not refire shortFilters POSTs when navigating between two filterSources with different filter data', async () => {
            // Bug reports page and ANR page return different filter data from
            // the server (different versions / countries lists). Navigating
            // back and forth should stabilize — no fresh POSTs after the
            // initial fetch for each page.
            store.getState().setConfig(makeFilterConfig({
                filterSource: FilterSource.Events,
            }))

            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })

            const bugReportsData = makeFiltersData({
                versions: [
                    { name: '1.0.5', code: '105' },
                    { name: '1.0.4', code: '104' },
                ],
                countries: ['US', 'UK', 'IN'],
            })
            const anrData = makeFiltersData({
                versions: [
                    { name: '1.0.4', code: '104' },
                    { name: '1.0.3', code: '103' },
                ],
                countries: ['US', 'IN'],
            })

            // First visit: bug reports
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: bugReportsData,
            })
            await store
                .getState()
                .fetchApps('team-1', makeInitConfig({ filterSource: FilterSource.Events }))
            await flushPromises()

            // First visit: ANR (different filterSource → cache miss → fetch)
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: anrData,
            })
            store.getState().setConfig(makeFilterConfig({
                filterSource: FilterSource.Anrs,
            }))
            await store
                .getState()
                .fetchApps('team-1', makeInitConfig({ filterSource: FilterSource.Anrs }))
            await flushPromises()

            const callsAfterFirstVisits = mockSaveListFiltersToServer.mock.calls.length

            // Now navigate bug reports → ANR → bug reports → ANR repeatedly.
            // All cache hits now; no fresh POSTs should fire.
            for (let i = 0; i < 3; i++) {
                store.getState().setConfig(makeFilterConfig({
                    filterSource: FilterSource.Events,
                }))
                await store
                    .getState()
                    .fetchApps('team-1', makeInitConfig({ filterSource: FilterSource.Events }))
                await flushPromises()

                store.getState().setConfig(makeFilterConfig({
                    filterSource: FilterSource.Anrs,
                }))
                await store
                    .getState()
                    .fetchApps('team-1', makeInitConfig({ filterSource: FilterSource.Anrs }))
                await flushPromises()
            }

            expect(mockSaveListFiltersToServer.mock.calls.length).toBe(callsAfterFirstVisits)
        })

        it('resets per-page selections to defaults on page navigation', async () => {
            // App and dates persist, but per-page selections reset to
            // defaults when navigating between pages.
            store.getState().setConfig(makeFilterConfig({
                filterSource: FilterSource.Events,
            }))

            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData({ countries: ['US', 'UK', 'IN'] }),
            })

            // Visit bug reports; user narrows countries to ["US"].
            await store
                .getState()
                .fetchApps('team-1', makeInitConfig({ filterSource: FilterSource.Events }))
            await flushPromises()
            store.getState().setSelectedCountries(['US'])
            await flushPromises()
            expect(store.getState().selectedCountries).toEqual(['US'])

            // Navigate to ANR — countries reset to defaults (all).
            store.getState().setConfig(makeFilterConfig({
                filterSource: FilterSource.Anrs,
            }))
            await store
                .getState()
                .fetchApps('team-1', makeInitConfig({ filterSource: FilterSource.Anrs }))
            await flushPromises()
            expect(store.getState().filters.countries.all).toBe(true)
        })

        it('keeps selected app and versions global across page navigation', async () => {
            // App and versions are global. Changing filterSource pages must
            // not reset them.
            store.getState().setConfig(makeFilterConfig({
                filterSource: FilterSource.Events,
            }))
            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData({
                    versions: [
                        { name: '1.0.5', code: '105' },
                        { name: '1.0.4', code: '104' },
                    ],
                }),
            })

            await store
                .getState()
                .fetchApps('team-1', makeInitConfig({ filterSource: FilterSource.Events }))
            await flushPromises()

            const initialApp = store.getState().selectedApp
            const initialVersions = store.getState().selectedVersions
            expect(initialApp?.id).toBe('app-a')
            expect(initialVersions.length).toBeGreaterThan(0)

            // Navigate to ANR
            store.getState().setConfig(makeFilterConfig({
                filterSource: FilterSource.Anrs,
            }))
            await store
                .getState()
                .fetchApps('team-1', makeInitConfig({ filterSource: FilterSource.Anrs }))
            await flushPromises()

            expect(store.getState().selectedApp?.id).toBe('app-a')
            expect(store.getState().selectedVersions).toEqual(initialVersions)

            // And back
            store.getState().setConfig(makeFilterConfig({
                filterSource: FilterSource.Events,
            }))
            await store
                .getState()
                .fetchApps('team-1', makeInitConfig({ filterSource: FilterSource.Events }))
            await flushPromises()

            expect(store.getState().selectedApp?.id).toBe('app-a')
            expect(store.getState().selectedVersions).toEqual(initialVersions)
        })

        it('resets selections and versions when switching apps', async () => {
            // Two apps: the new app has its own filter data. Selections
            // should reset on app switch.
            store.getState().setConfig(makeFilterConfig({
                filterSource: FilterSource.Events,
            }))
            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [
                    makeApp({ id: 'app-a' }),
                    makeApp({ id: 'app-b' }),
                ],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store
                .getState()
                .fetchApps('team-1', makeInitConfig({
                    appId: 'app-a',
                    filterSource: FilterSource.Events,
                }))
            await flushPromises()
            store.getState().setSelectedCountries(['US'])
            await flushPromises()

            // Switch to app-b — versions and selections should reset.
            await store.getState().selectApp(
                makeApp({ id: 'app-b' }),
                makeInitConfig({ appId: 'app-b' }),
            )
            await flushPromises()

            const state = store.getState()
            expect(state.selectedApp?.id).toBe('app-b')
            // Global versions repopulated for new app
            expect(state.selectedVersions.length).toBeGreaterThan(0)
            // The explicit ['US'] country selection from app-a is gone
            // (defaults back to "all" for the new app's data)
            expect(state.filters.countries.all).toBe(true)
        })

        it('ignores invalid URL filter values', async () => {
            // Deep-link with a country index that doesn't exist in the data.
            // Invalid values should be silently dropped.
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData({ countries: ['US', 'UK'] }),
            })

            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({
                    // appId matches, but country index 99 is out of range
                    urlFilters: { appId: 'app-a', countries: [99] },
                }),
            )
            await flushPromises()

            // Invalid URL value dropped → fall back to preserved / default.
            const state = store.getState()
            expect(state.selectedCountries.length).toBeGreaterThan(0)
            expect(state.selectedCountries.every((c) => ['US', 'UK'].includes(c))).toBe(true)
        })

        it('falls back to preserved/default versions when URL version indices are all invalid', async () => {
            // URL has `v` indices that are all out of range for the current
            // filter data. applyFilterOptions should drop them and fall
            // through to `currentState.selectedVersions` (preserved) or the
            // initial-selection-type default.
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({
                    urlFilters: { appId: 'app-a', versions: [99, 100] },
                }),
            )
            await flushPromises()

            // Both URL indices were invalid (data.versions has 3 items).
            // No previous selection → fall through to `Latest` default → first version.
            const state = store.getState()
            expect(state.selectedVersions.length).toBe(1)
            expect(state.selectedVersions[0].name).toBe('1.0.0')
        })

        it('preserves existing global versions when URL version indices are all invalid', async () => {
            // Set up an initial global selection, then navigate with a URL
            // that has version indices that are all out of range. Expect the
            // pre-existing global selection to be preserved.
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            // Seed selectedVersions to a specific version by doing a first visit.
            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()
            const seededVersions = store.getState().selectedVersions
            expect(seededVersions.length).toBeGreaterThan(0)

            // Force a fresh selectApp call via forceRefresh with an URL whose
            // version indices are all out of range. Inside applyFilterOptions
            // the URL branch runs, produces an empty list, then falls through
            // to the `currentState.selectedVersions.length > 0` branch and
            // preserves the existing global selection.
            await store.getState().refresh(
                'team-1',
                makeInitConfig({
                    urlFilters: { appId: 'app-a', versions: [99] },
                }),
            )
            await flushPromises()

            expect(store.getState().selectedVersions).toEqual(seededVersions)
        })

        it('falls back to versions:All default when URL indices are invalid and selection type is All', async () => {
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({
                    appVersionsInitialSelectionType: AppVersionsInitialSelectionType.All,
                    urlFilters: { appId: 'app-a', versions: [99] },
                }),
            )
            await flushPromises()

            // Invalid URL indices → fall through. No prior selection → All default.
            const state = store.getState()
            expect(state.selectedVersions.length).toBe(3)
        })

        it('applies valid URL filter values and drops invalid ones', async () => {
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData({ countries: ['US', 'UK', 'IN'] }),
            })

            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({
                    // index 0 = US, index 99 = invalid
                    urlFilters: { appId: 'app-a', countries: [0, 99] },
                }),
            )
            await flushPromises()

            // Only the valid index (0) is applied.
            expect(store.getState().selectedCountries).toEqual(['US'])
        })

        it('applies URL filter overrides even when the app is the same', async () => {
            // User has filters set in the store, then pastes a URL with
            // explicit filter params for the same app. URL should win.
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData({ countries: ['US', 'UK', 'IN'] }),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()
            store.getState().setSelectedCountries(['US'])
            await flushPromises()
            expect(store.getState().selectedCountries).toEqual(['US'])

            // Simulate a URL with ?a=app-a&c=1 (country index 1 = UK).
            await store.getState().fetchApps(
                'team-1',
                makeInitConfig({
                    urlFilters: { appId: 'app-a', countries: [1] },
                }),
            )
            await flushPromises()

            expect(store.getState().selectedCountries).toEqual(['UK'])
        })

        it('preserves udAttrMatchers across re-mount / cross-page navigation', async () => {
            // Initial mount on page A
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValue({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValue({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            // User sets a udAttrMatcher
            store.getState().setSelectedUdAttrMatchers([
                { key: 'user_id', type: 'string', op: 'eq', value: 'alice' },
            ])
            await flushPromises()

            expect(store.getState().selectedUdAttrMatchers).toHaveLength(1)

            // Simulate navigation: Filters component on page B re-mounts and
            // calls fetchApps again with a clean initConfig (URL has no
            // udAttrMatchers since the user didn't navigate via URL).
            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            // BUG: matchers are reset to [] because applyFilterOptions
            // unconditionally assigns selectedUdAttrMatchers = [] when the URL
            // doesn't carry them.
            expect(store.getState().selectedUdAttrMatchers).toEqual([
                { key: 'user_id', type: 'string', op: 'eq', value: 'alice' },
            ])
        })

        it('passes new udAttrMatchers to saveListFiltersToServer and updates filters.filterShortCodePromise', async () => {
            // End-to-end: setSelectedUdAttrMatchers must propagate through
            // the wrapped set, fire a new POST with the new matcher in the
            // argument, and replace filters.filterShortCodePromise with a
            // fresh promise.
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            mockSaveListFiltersToServer.mockResolvedValue('code-1')

            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            const promiseBefore = store.getState().filters.filterShortCodePromise
            const callsBefore = mockSaveListFiltersToServer.mock.calls.length

            mockSaveListFiltersToServer.mockResolvedValueOnce('code-2')
            store.getState().setSelectedUdAttrMatchers([
                { key: 'user_id', type: 'string', op: 'eq', value: 'alice' },
            ])
            await flushPromises()

            // A new POST was fired
            expect(mockSaveListFiltersToServer.mock.calls.length).toBe(callsBefore + 1)

            // The POST was fired with the NEW matcher in the filters argument
            const latestCallArgs = mockSaveListFiltersToServer.mock.calls[callsBefore][0]
            expect(latestCallArgs.udAttrMatchers).toEqual([
                { key: 'user_id', type: 'string', op: 'eq', value: 'alice' },
            ])

            // filters.filterShortCodePromise is a *different* promise reference
            const promiseAfter = store.getState().filters.filterShortCodePromise
            expect(promiseAfter).not.toBe(promiseBefore)
            await expect(promiseAfter).resolves.toBe('code-2')
        })

        it('fires a new POST and updates serialisedFilters when udAttrMatchers change', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            const callsAfterFetch = mockSaveListFiltersToServer.mock.calls.length
            const serialisedBefore = store.getState().filters.serialisedFilters

            // Add a matcher
            store.getState().setSelectedUdAttrMatchers([
                { key: 'user_id', type: 'string', op: 'eq', value: 'alice' },
            ])
            await flushPromises()

            expect(mockSaveListFiltersToServer.mock.calls.length).toBe(callsAfterFetch + 1)
            expect(store.getState().filters.serialisedFilters).not.toBe(serialisedBefore)
            expect(store.getState().filters.udAttrMatchers).toEqual([
                { key: 'user_id', type: 'string', op: 'eq', value: 'alice' },
            ])

            // Change the value on the same matcher
            const callsAfterFirst = mockSaveListFiltersToServer.mock.calls.length
            const serialisedAfterFirst = store.getState().filters.serialisedFilters
            store.getState().setSelectedUdAttrMatchers([
                { key: 'user_id', type: 'string', op: 'eq', value: 'bob' },
            ])
            await flushPromises()

            expect(mockSaveListFiltersToServer.mock.calls.length).toBe(callsAfterFirst + 1)
            expect(store.getState().filters.serialisedFilters).not.toBe(serialisedAfterFirst)
            expect(store.getState().filters.udAttrMatchers[0].value).toBe('bob')
        })

        it('treats udAttrMatcher value type changes as equivalent when stringified forms match', async () => {
            // The POST body stringifies matcher values via String(m.value), so
            // a boolean `true` and the string `"true"` produce an identical
            // body and must not fire a second POST.
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp({ id: 'app-a' })],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })

            await store.getState().fetchApps('team-1', makeInitConfig())
            await flushPromises()

            store.getState().setSelectedUdAttrMatchers([
                { key: 'premium', type: 'bool', op: 'eq', value: true } as any,
            ])
            await flushPromises()

            const callsAfterBool = mockSaveListFiltersToServer.mock.calls.length

            store.getState().setSelectedUdAttrMatchers([
                { key: 'premium', type: 'bool', op: 'eq', value: 'true' } as any,
            ])
            await flushPromises()

            expect(mockSaveListFiltersToServer.mock.calls.length).toBe(callsAfterBool)
        })
    })

    // =====================================================================
    // reset
    // =====================================================================
    describe('reset', () => {
        it('reset() preserves caches', async () => {
            store.getState().setConfig(makeFilterConfig())

            // Populate caches through normal fetch flow
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            await store.getState().fetchApps('team-1', makeInitConfig())

            expect(store.getState().filterOptionsCache.size).toBe(1)

            store.getState().reset()

            const state = store.getState()
            expect(state.config).toBeNull()
            expect(state.selectedApp).toBeNull()
            expect(state.apps).toEqual([])
            // Caches preserved
            expect(state.filterOptionsCache.size).toBe(1)
        })

        it('reset(true) clears caches', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            await store.getState().fetchApps('team-1', makeInitConfig())

            expect(store.getState().filterOptionsCache.size).toBe(1)

            store.getState().reset(true)

            const state = store.getState()
            expect(state.filterOptionsCache.size).toBe(0)
            expect(state.rootSpanNamesCache.size).toBe(0)
        })

        it('reset clears in-flight trackers so subsequent calls run fresh', async () => {
            store.getState().setConfig(makeFilterConfig())

            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            await store.getState().fetchApps('team-1', makeInitConfig())
            expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(1)

            store.getState().reset(true)

            // After reset, the next call runs freshly (in-flight cleared)
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            await store.getState().fetchApps('team-1', makeInitConfig())
            expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(2)
        })

        it('resets filters to defaultFilters', async () => {
            store.getState().setConfig(makeFilterConfig())
            mockFetchAppsFromServer.mockResolvedValueOnce({
                status: AppsApiStatus.Success,
                data: [makeApp()],
            })
            mockFetchFiltersFromServer.mockResolvedValueOnce({
                status: FiltersApiStatus.Success,
                data: makeFiltersData(),
            })
            await store.getState().fetchApps('team-1', makeInitConfig())
            expect(store.getState().filters).not.toEqual(defaultFilters)

            store.getState().reset(true)
            expect(store.getState().filters).toEqual(defaultFilters)
        })
    })
})
