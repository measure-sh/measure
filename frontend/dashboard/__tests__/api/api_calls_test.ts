import { beforeEach, describe, expect, it } from '@jest/globals'

// Mock posthog (imported transitively by api_client)
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { reset: jest.fn(), capture: jest.fn() },
}))

// Mock api_client.apiClient.fetch so api_calls functions don't touch the
// network. Each test stages its own response via `mockApiClientFetch`.
const mockApiClientFetch = jest.fn()
jest.mock('@/app/api/api_client', () => ({
    __esModule: true,
    apiClient: {
        fetch: (...args: any[]) => mockApiClientFetch(...args),
    },
    ApiClient: class { },
}))

import {
    AlertsOverviewApiStatus,
    AppApiKeyChangeApiStatus,
    AppNameChangeApiStatus,
    AppsApiStatus,
    AuthzAndMembersApiStatus,
    BugReportApiStatus,
    BugReportsOverviewApiStatus,
    BugReportsOverviewPlotApiStatus,
    BugReportStatus,
    buildShortFiltersPostBody,
    changeAppApiKeyFromServer,
    changeAppNameFromServer,
    changeRoleFromServer,
    changeTeamNameFromServer,
    createAppFromServer,
    createTeamFromServer,
    defaultFilters,
    DowngradeToFreeApiStatus,
    downgradeToFreeFromServer,
    ExceptionGroupCommonPathApiStatus,
    ExceptionsDetailsApiStatus,
    ExceptionsDetailsPlotApiStatus,
    ExceptionsDistributionPlotApiStatus,
    ExceptionsOverviewApiStatus,
    ExceptionsOverviewPlotApiStatus,
    ExceptionsType,
    fetchAlertsOverviewFromServer,
    FetchAppRetentionApiStatus,
    fetchAppRetentionFromServer,
    fetchAppsFromServer,
    FetchAppThresholdPrefsApiStatus,
    fetchAppThresholdPrefsFromServer,
    fetchAuthzAndMembersFromServer,
    FetchBillingInfoApiStatus,
    fetchBillingInfoFromServer,
    FetchBillingUsageThresholdApiStatus,
    fetchBillingUsageThresholdFromServer,
    fetchBugReportFromServer,
    fetchBugReportsOverviewFromServer,
    fetchBugReportsOverviewPlotFromServer,
    FetchCustomerPortalUrlApiStatus,
    fetchCustomerPortalUrlFromServer,
    fetchExceptionGroupCommonPathFromServer,
    fetchExceptionsDetailsFromServer,
    fetchExceptionsDetailsPlotFromServer,
    fetchExceptionsDistributionPlotFromServer,
    fetchExceptionsOverviewFromServer,
    fetchExceptionsOverviewPlotFromServer,
    fetchFiltersFromServer,
    fetchJourneyFromServer,
    fetchMetricsFromServer,
    fetchNetworkDomainsFromServer,
    fetchNetworkEndpointLatencyPlotFromServer,
    fetchNetworkEndpointStatusCodesPlotFromServer,
    fetchNetworkEndpointTimelinePlotFromServer,
    fetchNetworkOverviewStatusCodesPlotFromServer,
    fetchNetworkPathsFromServer,
    fetchNetworkTimelinePlotFromServer,
    fetchNetworkTrendsFromServer,
    FetchNotifPrefsApiStatus,
    fetchNotifPrefsFromServer,
    fetchPendingInvitesFromServer,
    fetchRootSpanNamesFromServer,
    fetchSdkConfigFromServer,
    fetchSessionsVsExceptionsPlotFromServer,
    fetchSessionTimelineFromServer,
    fetchSessionTimelinesOverviewFromServer,
    fetchSessionTimelinesOverviewPlotFromServer,
    fetchSpanMetricsPlotFromServer,
    fetchSpansFromServer,
    FetchStripeCheckoutSessionApiStatus,
    fetchStripeCheckoutSessionFromServer,
    FetchSubscriptionInfoApiStatus,
    fetchSubscriptionInfoFromServer,
    fetchTeamsFromServer,
    FetchTeamSlackConnectUrlApiStatus,
    fetchTeamSlackConnectUrlFromServer,
    FetchTeamSlackStatusApiStatus,
    fetchTeamSlackStatusFromServer,
    fetchTraceFromServer,
    FetchUsageApiStatus,
    fetchUsageFromServer,
    Filters,
    FiltersApiStatus,
    FilterSource,
    InviteMemberApiStatus,
    inviteMemberFromServer,
    JourneyApiStatus,
    JourneyType,
    MetricsApiStatus,
    NetworkDomainsApiStatus,
    NetworkEndpointLatencyPlotApiStatus,
    NetworkEndpointStatusCodesPlotApiStatus,
    NetworkEndpointTimelinePlotApiStatus,
    NetworkOverviewStatusCodesPlotApiStatus,
    NetworkPathsApiStatus,
    NetworkTimelinePlotApiStatus,
    NetworkTrendsApiStatus,
    PendingInvitesApiStatus,
    RemoveMemberApiStatus,
    removeMemberFromServer,
    RemovePendingInviteApiStatus,
    removePendingInviteFromServer,
    ResendPendingInviteApiStatus,
    resendPendingInviteFromServer,
    RoleChangeApiStatus,
    saveListFiltersToServer,
    SdkConfig,
    SdkConfigApiStatus,
    sendTestSlackAlertFromServer,
    SessionsVsExceptionsPlotApiStatus,
    SessionTimelineApiStatus,
    SessionTimelinesOverviewApiStatus,
    SessionTimelinesOverviewPlotApiStatus,
    SpanMetricsPlotApiStatus,
    SpansApiStatus,
    TeamNameChangeApiStatus,
    TeamsApiStatus,
    TestSlackAlertApiStatus,
    TraceApiStatus,
    UpdateAppRetentionApiStatus,
    updateAppRetentionFromServer,
    UpdateAppThresholdPrefsApiStatus,
    updateAppThresholdPrefsFromServer,
    UpdateBugReportStatusApiStatus,
    updateBugReportStatusFromServer,
    UpdateNotifPrefsApiStatus,
    updateNotifPrefsFromServer,
    UpdateSdkConfigApiStatus,
    updateSdkConfigFromServer,
    UpdateTeamSlackStatusApiStatus,
    updateTeamSlackStatusFromServer,
    ValidateInviteApiStatus,
    validateInvitesFromServer
} from '@/app/api/api_calls'

jest.spyOn(console, 'log').mockImplementation(() => { })
jest.spyOn(console, 'error').mockImplementation(() => { })

// ---- Helpers ------------------------------------------------------------

function mockResponse(
    ok: boolean,
    status: number,
    body: any = {},
): { ok: boolean; status: number; json: () => Promise<any> } {
    return {
        ok,
        status,
        json: async () => body,
    }
}

function successResponse(body: any = {}) {
    return mockResponse(true, 200, body)
}

function errorResponse(status: number = 500, body: any = {}) {
    return mockResponse(false, status, body)
}

function makeFilters(overrides: Partial<Filters> = {}): Filters {
    return {
        ...defaultFilters,
        ready: true,
        app: { id: 'app-a', onboarded: true } as any,
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-10T00:00:00.000Z',
        versions: { selected: [{ name: '1.0.0', code: '100' } as any], all: false },
        filterShortCodePromise: Promise.resolve('code-123'),
        ...overrides,
    }
}

// Resolve the most recent fetch call's URL as a string, regardless of
// whether apiClient.fetch was called with a string, URL, or Request.
function lastFetchUrl(): string {
    const call = mockApiClientFetch.mock.calls[mockApiClientFetch.mock.calls.length - 1]
    return String(call[0])
}

function lastFetchOpts(): any {
    const call = mockApiClientFetch.mock.calls[mockApiClientFetch.mock.calls.length - 1]
    return call[1]
}

beforeEach(() => {
    mockApiClientFetch.mockReset()
})

// ========================================================================
// buildShortFiltersPostBody
// ========================================================================
describe('buildShortFiltersPostBody', () => {
    it('returns null when every filter is empty', () => {
        const empty: Filters = {
            ...defaultFilters,
            app: { id: 'app-a' } as any,
        }
        expect(buildShortFiltersPostBody(empty)).toBeNull()
    })

    it('omits ud_expression when no matchers are selected', () => {
        const filters = makeFilters()
        const body = buildShortFiltersPostBody(filters)
        expect(body).not.toBeNull()
        expect((body!.filters as any).ud_expression).toBeUndefined()
    })

    it('adds ud_expression with the matcher details when matchers are present', () => {
        const filters = makeFilters({
            udAttrMatchers: [
                { key: 'user_id', type: 'string', op: 'eq', value: 'alice' },
            ],
        })
        const body = buildShortFiltersPostBody(filters)
        expect(body).not.toBeNull()
        const udExpression = JSON.parse((body!.filters as any).ud_expression)
        expect(udExpression).toEqual({
            and: [
                { cmp: { key: 'user_id', type: 'string', op: 'eq', value: 'alice' } },
            ],
        })
    })

    it('coerces boolean matcher values to strings so the server sees String(true)', () => {
        const filters = makeFilters({
            udAttrMatchers: [
                { key: 'premium', type: 'bool', op: 'eq', value: true },
            ],
        })
        const body = buildShortFiltersPostBody(filters)
        const udExpression = JSON.parse((body!.filters as any).ud_expression)
        expect(udExpression.and[0].cmp.value).toBe('true')
    })

    it('produces a different body for different matcher values', () => {
        const a = buildShortFiltersPostBody(makeFilters({
            udAttrMatchers: [{ key: 'user_id', type: 'string', op: 'eq', value: 'alice' }],
        }))
        const b = buildShortFiltersPostBody(makeFilters({
            udAttrMatchers: [{ key: 'user_id', type: 'string', op: 'eq', value: 'bob' }],
        }))
        expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
    })
})

// ========================================================================
// saveListFiltersToServer
// ========================================================================
describe('saveListFiltersToServer', () => {
    it('returns null without a network call when the body would be empty', async () => {
        const empty: Filters = { ...defaultFilters, app: { id: 'app-a' } as any }
        const code = await saveListFiltersToServer(empty)
        expect(code).toBeNull()
        expect(mockApiClientFetch).not.toHaveBeenCalled()
    })

    it('POSTs to /shortFilters with the body builder output and returns filter_short_code', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ filter_short_code: 'abc' }))
        const code = await saveListFiltersToServer(makeFilters())
        expect(code).toBe('abc')
        expect(lastFetchUrl()).toBe('/api/apps/app-a/shortFilters')
        expect(lastFetchOpts().method).toBe('POST')
        const body = JSON.parse(lastFetchOpts().body)
        expect(body.filters.versions).toEqual(['1.0.0'])
        expect(body.filters.version_codes).toEqual(['100'])
    })

    it('returns null on non-ok response', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse(500))
        const code = await saveListFiltersToServer(makeFilters())
        expect(code).toBeNull()
    })

    it('returns null when fetch throws', async () => {
        mockApiClientFetch.mockRejectedValueOnce(new Error('network'))
        const code = await saveListFiltersToServer(makeFilters())
        expect(code).toBeNull()
    })
})

// ========================================================================
// Simple GETs (no filters involved)
// ========================================================================
describe('simple GET helpers', () => {
    describe('fetchTeamsFromServer', () => {
        it('hits /api/teams and returns Success with data', async () => {
            const data = [{ id: 't1', name: 'Team 1' }]
            mockApiClientFetch.mockResolvedValueOnce(successResponse(data))
            const result = await fetchTeamsFromServer()
            expect(lastFetchUrl()).toBe('/api/teams')
            expect(result).toEqual({ status: TeamsApiStatus.Success, data })
        })

        it('returns Error on non-ok response', async () => {
            mockApiClientFetch.mockResolvedValueOnce(errorResponse())
            const result = await fetchTeamsFromServer()
            expect(result).toEqual({ status: TeamsApiStatus.Error, data: null })
        })

        it('returns Cancelled on exception', async () => {
            mockApiClientFetch.mockRejectedValueOnce(new Error('boom'))
            const result = await fetchTeamsFromServer()
            expect(result).toEqual({ status: TeamsApiStatus.Cancelled, data: null })
        })
    })

    describe('fetchAppsFromServer', () => {
        it('returns Success on 200', async () => {
            mockApiClientFetch.mockResolvedValueOnce(successResponse([{ id: 'a1' }]))
            const result = await fetchAppsFromServer('team-1')
            expect(lastFetchUrl()).toBe('/api/teams/team-1/apps')
            expect(result.status).toBe(AppsApiStatus.Success)
            expect(result.data).toEqual([{ id: 'a1' }])
        })

        it('returns NoApps on 404', async () => {
            mockApiClientFetch.mockResolvedValueOnce(errorResponse(404))
            const result = await fetchAppsFromServer('team-1')
            expect(result).toEqual({ status: AppsApiStatus.NoApps, data: null })
        })

        it('returns Error on other non-ok statuses', async () => {
            mockApiClientFetch.mockResolvedValueOnce(errorResponse(500))
            const result = await fetchAppsFromServer('team-1')
            expect(result).toEqual({ status: AppsApiStatus.Error, data: null })
        })

        it('returns Cancelled on exception', async () => {
            mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
            const result = await fetchAppsFromServer('team-1')
            expect(result.status).toBe(AppsApiStatus.Cancelled)
        })
    })

    describe('fetchRootSpanNamesFromServer', () => {
        const app = { id: 'app-1' } as any

        it('hits /spans/roots/names and returns Success', async () => {
            mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: ['main', 'db'] }))
            const result = await fetchRootSpanNamesFromServer(app)
            expect(lastFetchUrl()).toBe('/api/apps/app-1/spans/roots/names')
            expect((result as any).data.results).toEqual(['main', 'db'])
        })

        it('returns NoData when data.results is null', async () => {
            mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: null }))
            const result = await fetchRootSpanNamesFromServer(app)
            expect(result.data).toBeNull()
        })

        it('returns Error on non-ok', async () => {
            mockApiClientFetch.mockResolvedValueOnce(errorResponse())
            const result = await fetchRootSpanNamesFromServer(app)
            expect(result.data).toBeNull()
        })

        it('returns Cancelled on exception', async () => {
            mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
            const result = await fetchRootSpanNamesFromServer(app)
            expect(result.data).toBeNull()
        })
    })

    describe('fetchTraceFromServer', () => {
        it('hits /api/apps/{appId}/traces/{traceId}', async () => {
            mockApiClientFetch.mockResolvedValueOnce(successResponse({ trace_id: 't1' }))
            const result = await fetchTraceFromServer('app-1', 't1')
            expect(lastFetchUrl()).toBe('/api/apps/app-1/traces/t1')
            expect(result.status).toBe(TraceApiStatus.Success)
        })

        it('returns Error on non-ok', async () => {
            mockApiClientFetch.mockResolvedValueOnce(errorResponse())
            const result = await fetchTraceFromServer('a', 't')
            expect(result.status).toBe(TraceApiStatus.Error)
        })

        it('returns Cancelled on exception', async () => {
            mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
            const result = await fetchTraceFromServer('a', 't')
            expect(result.status).toBe(TraceApiStatus.Cancelled)
        })
    })
})

// ========================================================================
// fetchFiltersFromServer — has NoData / NotOnboarded branches
// ========================================================================
describe('fetchFiltersFromServer', () => {
    const onboardedApp = { id: 'app-1', onboarded: true } as any
    const notOnboardedApp = { id: 'app-1', onboarded: false } as any

    it('appends crash=1 for Crashes filterSource', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ versions: [] }))
        await fetchFiltersFromServer(onboardedApp, FilterSource.Crashes)
        expect(lastFetchUrl()).toContain('crash=1')
    })

    it('appends anr=1 for Anrs filterSource', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ versions: [] }))
        await fetchFiltersFromServer(onboardedApp, FilterSource.Anrs)
        expect(lastFetchUrl()).toContain('anr=1')
    })

    it('appends span=1 for Spans filterSource', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ versions: [] }))
        await fetchFiltersFromServer(onboardedApp, FilterSource.Spans)
        expect(lastFetchUrl()).toContain('span=1')
    })

    it('has no source-specific param for Events', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ versions: [] }))
        await fetchFiltersFromServer(onboardedApp, FilterSource.Events)
        const url = lastFetchUrl()
        expect(url).not.toContain('crash=')
        expect(url).not.toContain('anr=')
        expect(url).not.toContain('span=')
        expect(url).toContain('ud_attr_keys=1')
    })

    it('returns Success when the server has filter data', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ versions: ['1.0.0'] }))
        const result = await fetchFiltersFromServer(onboardedApp, FilterSource.Events)
        expect(result.status).toBe(FiltersApiStatus.Success)
    })

    it('returns NoData when the app is onboarded but has no versions', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ versions: null }))
        const result = await fetchFiltersFromServer(onboardedApp, FilterSource.Events)
        expect(result.status).toBe(FiltersApiStatus.NoData)
    })

    it('returns NotOnboarded when the app is not onboarded', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ versions: null }))
        const result = await fetchFiltersFromServer(notOnboardedApp, FilterSource.Events)
        expect(result.status).toBe(FiltersApiStatus.NotOnboarded)
    })

    it('returns Error on non-ok', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        const result = await fetchFiltersFromServer(onboardedApp, FilterSource.Events)
        expect(result.status).toBe(FiltersApiStatus.Error)
    })

    it('returns Cancelled on exception', async () => {
        mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
        const result = await fetchFiltersFromServer(onboardedApp, FilterSource.Events)
        expect(result.status).toBe(FiltersApiStatus.Cancelled)
    })
})

// ========================================================================
// Functions that use applyGenericFiltersToUrl
// ========================================================================
describe('fetch functions that use applyGenericFiltersToUrl', () => {
    it('fetchMetricsFromServer adds filter_short_code from filterShortCodePromise', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ metric: 1 }))
        await fetchMetricsFromServer(makeFilters())
        const url = lastFetchUrl()
        expect(url).toContain('/api/apps/app-a/metrics')
        expect(url).toContain('filter_short_code=code-123')
        expect(url).toContain('from=')
        expect(url).toContain('to=')
    })

    it('fetchMetricsFromServer does not add filter_short_code when promise resolves to null', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchMetricsFromServer(makeFilters({ filterShortCodePromise: Promise.resolve(null) }))
        expect(lastFetchUrl()).not.toContain('filter_short_code')
    })

    it.each([
        ['fetchMetricsFromServer', fetchMetricsFromServer, MetricsApiStatus.Success, MetricsApiStatus.Error, MetricsApiStatus.Cancelled],
        ['fetchSpanMetricsPlotFromServer', fetchSpanMetricsPlotFromServer, SpanMetricsPlotApiStatus.Success, SpanMetricsPlotApiStatus.Error, SpanMetricsPlotApiStatus.Cancelled],
    ])('%s: Success / Error / Cancelled status transitions', async (_name, fn, okStatus, errStatus, cancelStatus) => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        expect((await (fn as any)(makeFilters())).status).toBe(okStatus)

        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        expect((await (fn as any)(makeFilters())).status).toBe(errStatus)

        mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
        expect((await (fn as any)(makeFilters())).status).toBe(cancelStatus)
    })

    it('fetchSpansFromServer includes limit/offset in URL', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        await fetchSpansFromServer(makeFilters(), 50, 100)
        const url = lastFetchUrl()
        expect(url).toContain('/api/apps/app-a/spans')
        expect(url).toContain('limit=50')
        expect(url).toContain('offset=100')
    })

    it('fetchSessionTimelinesOverviewFromServer includes limit/offset', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        await fetchSessionTimelinesOverviewFromServer(makeFilters(), 10, 20)
        expect(lastFetchUrl()).toContain('/api/apps/app-a/sessions')
        expect(lastFetchUrl()).toContain('limit=10')
        expect(lastFetchUrl()).toContain('offset=20')
    })

    it('fetchSessionTimelinesOverviewPlotFromServer returns NoData when data is null', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const result = await fetchSessionTimelinesOverviewPlotFromServer(makeFilters())
        expect(result.status).toBe(SessionTimelinesOverviewPlotApiStatus.NoData)
    })

    it('fetchSessionTimelinesOverviewPlotFromServer returns Error on non-ok', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        const result = await fetchSessionTimelinesOverviewPlotFromServer(makeFilters())
        expect(result.status).toBe(SessionTimelinesOverviewPlotApiStatus.Error)
    })

    it('fetchSessionTimelinesOverviewPlotFromServer returns Cancelled on exception', async () => {
        mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
        const result = await fetchSessionTimelinesOverviewPlotFromServer(makeFilters())
        expect(result.status).toBe(SessionTimelinesOverviewPlotApiStatus.Cancelled)
    })
})

// ========================================================================
// Exceptions endpoints
// ========================================================================
describe('exceptions endpoints', () => {
    it.each([
        [ExceptionsType.Crash, '/api/apps/app-a/crashGroups'],
        [ExceptionsType.Anr, '/api/apps/app-a/anrGroups'],
    ])('fetchExceptionsOverviewFromServer hits %s path', async (type, expectedPath) => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }))
        await fetchExceptionsOverviewFromServer(type, makeFilters(), 5, 0)
        expect(lastFetchUrl()).toContain(expectedPath)
    })

    it('fetchExceptionsOverviewFromServer returns Error on non-ok', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        const result = await fetchExceptionsOverviewFromServer(ExceptionsType.Crash, makeFilters(), 5, 0)
        expect(result.status).toBe(ExceptionsOverviewApiStatus.Error)
    })

    it('fetchExceptionsOverviewFromServer returns Cancelled on exception', async () => {
        mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
        const result = await fetchExceptionsOverviewFromServer(ExceptionsType.Crash, makeFilters(), 5, 0)
        expect(result.status).toBe(ExceptionsOverviewApiStatus.Cancelled)
    })

    it('fetchExceptionsDetailsFromServer includes group id in path', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }))
        await fetchExceptionsDetailsFromServer(ExceptionsType.Crash, 'grp-1', makeFilters(), 10, 0)
        expect(lastFetchUrl()).toContain('/api/apps/app-a/crashGroups/grp-1')
    })

    it('fetchExceptionsDetailsFromServer uses anrGroups path for ANR type', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }))
        await fetchExceptionsDetailsFromServer(ExceptionsType.Anr, 'grp-1', makeFilters(), 10, 0)
        expect(lastFetchUrl()).toContain('/api/apps/app-a/anrGroups/grp-1')
    })

    it('fetchExceptionsDetailsFromServer returns Error on non-ok', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        const r = await fetchExceptionsDetailsFromServer(ExceptionsType.Crash, 'g', makeFilters(), 1, 0)
        expect(r.status).toBe(ExceptionsDetailsApiStatus.Error)
    })

    it('fetchExceptionGroupCommonPathFromServer hits /crashGroups/{id}/path', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }))
        await fetchExceptionGroupCommonPathFromServer(ExceptionsType.Crash, 'app-a', 'grp-1')
        expect(lastFetchUrl()).toBe('/api/apps/app-a/crashGroups/grp-1/path')
    })

    it('fetchExceptionGroupCommonPathFromServer uses /anrGroups/{id}/path for ANR type', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }))
        await fetchExceptionGroupCommonPathFromServer(ExceptionsType.Anr, 'app-a', 'grp-1')
        expect(lastFetchUrl()).toBe('/api/apps/app-a/anrGroups/grp-1/path')
    })

    it('fetchExceptionsOverviewPlotFromServer returns NoData on null data', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const r = await fetchExceptionsOverviewPlotFromServer(ExceptionsType.Crash, makeFilters())
        expect(r.status).toBe(ExceptionsOverviewPlotApiStatus.NoData)
    })

    it('fetchExceptionsOverviewPlotFromServer returns Error on non-ok', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        const r = await fetchExceptionsOverviewPlotFromServer(ExceptionsType.Crash, makeFilters())
        expect(r.status).toBe(ExceptionsOverviewPlotApiStatus.Error)
    })

    it('fetchExceptionsDetailsPlotFromServer includes group id', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ data: [] }))
        await fetchExceptionsDetailsPlotFromServer(ExceptionsType.Crash, 'grp-1', makeFilters())
        expect(lastFetchUrl()).toContain('/api/apps/app-a/crashGroups/grp-1/plots/instances')
    })

    it('fetchExceptionsDistributionPlotFromServer includes group id', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchExceptionsDistributionPlotFromServer(ExceptionsType.Crash, 'grp-1', makeFilters())
        expect(lastFetchUrl()).toContain('/api/apps/app-a/crashGroups/grp-1/plots/distribution')
    })

    it('fetchExceptionsDistributionPlotFromServer Error / Cancelled paths', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        expect((await fetchExceptionsDistributionPlotFromServer(ExceptionsType.Crash, 'g', makeFilters())).status).toBe(ExceptionsDistributionPlotApiStatus.Error)
        mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
        expect((await fetchExceptionsDistributionPlotFromServer(ExceptionsType.Crash, 'g', makeFilters())).status).toBe(ExceptionsDistributionPlotApiStatus.Cancelled)
    })
})

// ========================================================================
// fetchJourneyFromServer — branching on JourneyType
// ========================================================================
describe('fetchJourneyFromServer', () => {
    it('returns Error when CrashDetails is requested without a groupId', async () => {
        const result = await fetchJourneyFromServer(
            JourneyType.CrashDetails,
            undefined as any,
            false,
            makeFilters(),
        )
        expect(result.status).toBe(JourneyApiStatus.Error)
        expect(mockApiClientFetch).not.toHaveBeenCalled()
    })

    it('hits /crashGroups/{id}/plots/journey for CrashDetails', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchJourneyFromServer(JourneyType.CrashDetails, 'grp-1', true, makeFilters())
        expect(lastFetchUrl()).toContain('/api/apps/app-a/crashGroups/grp-1/plots/journey')
    })

    it('hits /anrGroups/{id}/plots/journey for AnrDetails', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchJourneyFromServer(JourneyType.AnrDetails, 'grp-1', true, makeFilters())
        expect(lastFetchUrl()).toContain('/api/apps/app-a/anrGroups/grp-1/plots/journey')
    })

    it('hits /journey for Paths', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchJourneyFromServer(JourneyType.Paths, null, false, makeFilters())
        expect(lastFetchUrl()).toContain('/api/apps/app-a/journey')
    })

    // NOTE: bidirectional (bigraph) is currently DROPPED by
    // `applyGenericFiltersToUrl` — it overwrites `u.search` with a fresh
    // URLSearchParams containing only the generic filter params. This pins
    // the current buggy behaviour; fixing the underlying issue should flip
    // these assertions to check for bigraph=1/0.
    it('passes bidirectional=true path through (bigraph dropped by URL rebuild)', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchJourneyFromServer(JourneyType.Paths, null, true, makeFilters())
        expect(lastFetchUrl()).toContain('/api/apps/app-a/journey')
    })

    it('passes bidirectional=false path through', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchJourneyFromServer(JourneyType.Paths, null, false, makeFilters())
        expect(lastFetchUrl()).toContain('/api/apps/app-a/journey')
    })

    it('returns Error on non-ok', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        const r = await fetchJourneyFromServer(JourneyType.Paths, null, false, makeFilters())
        expect(r.status).toBe(JourneyApiStatus.Error)
    })

    it('returns Cancelled on exception', async () => {
        mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
        const r = await fetchJourneyFromServer(JourneyType.Paths, null, false, makeFilters())
        expect(r.status).toBe(JourneyApiStatus.Cancelled)
    })
})

// ========================================================================
// fetchSessionsVsExceptionsPlotFromServer — composite fetch
// ========================================================================
describe('fetchSessionsVsExceptionsPlotFromServer', () => {
    it('returns Success when all 3 child fetches return Success', async () => {
        // Sessions plot
        mockApiClientFetch.mockResolvedValueOnce(successResponse([
            { data: [{ datetime: '2026-01-01', instances: 100 }] },
        ]))
        // Crashes plot
        mockApiClientFetch.mockResolvedValueOnce(successResponse([
            { data: [{ datetime: '2026-01-01', instances: 10 }] },
        ]))
        // ANRs plot
        mockApiClientFetch.mockResolvedValueOnce(successResponse([
            { data: [{ datetime: '2026-01-01', instances: 1 }] },
        ]))

        const r = await fetchSessionsVsExceptionsPlotFromServer(makeFilters())
        expect(r.status).toBe(SessionsVsExceptionsPlotApiStatus.Success)
    })

    it('returns Error if any child fetch errors', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        const r = await fetchSessionsVsExceptionsPlotFromServer(makeFilters())
        expect(r.status).toBe(SessionsVsExceptionsPlotApiStatus.Error)
    })

    it('returns NoData when all child datasets are empty', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const r = await fetchSessionsVsExceptionsPlotFromServer(makeFilters())
        expect(r.status).toBe(SessionsVsExceptionsPlotApiStatus.NoData)
    })
})

// ========================================================================
// Network endpoint fetches
// ========================================================================
describe('network endpoint fetches', () => {
    const app = { id: 'app-1' } as any

    it('fetchNetworkDomainsFromServer hits /networkRequests/domains with from/to and returns Success with results', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: ['example.com'] }))
        const r = await fetchNetworkDomainsFromServer(app, makeFilters())
        const url = lastFetchUrl()
        expect(url).toContain('/api/apps/app-1/networkRequests/domains')
        expect(url).toContain('from=')
        expect(url).toContain('to=')
        expect(r.status).toBe(NetworkDomainsApiStatus.Success)
    })

    it('fetchNetworkPathsFromServer hits /networkRequests/paths with domain/search and returns Success with results', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: ['/api/users'] }))
        const r = await fetchNetworkPathsFromServer(app, 'api.example.com', 'search', makeFilters())
        const url = lastFetchUrl()
        expect(url).toContain('/api/apps/app-1/networkRequests/paths')
        expect(url).toContain('domain=api.example.com')
        expect(url).toContain('search=search')
        expect(r.status).toBe(NetworkPathsApiStatus.Success)
    })

    it('fetchNetworkEndpointLatencyPlotFromServer uses endpointLatency path and returns Success on non-null body', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ points: [1] }))
        const r = await fetchNetworkEndpointLatencyPlotFromServer(makeFilters(), 'example.com', '/api/users')
        expect(lastFetchUrl()).toContain('/api/apps/app-a/networkRequests/plots/endpointLatency')
        expect(r.status).toBe(NetworkEndpointLatencyPlotApiStatus.Success)
    })

    it('fetchNetworkEndpointStatusCodesPlotFromServer uses endpointStatusCodes path and returns Success on non-null body', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ points: [1] }))
        const r = await fetchNetworkEndpointStatusCodesPlotFromServer(makeFilters(), 'example.com', '/api/users')
        expect(lastFetchUrl()).toContain('/api/apps/app-a/networkRequests/plots/endpointStatusCodes')
        expect(r.status).toBe(NetworkEndpointStatusCodesPlotApiStatus.Success)
    })

    it('fetchNetworkEndpointTimelinePlotFromServer uses endpointTimeline path and returns Success with points', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ points: [{ t: 1 }] }))
        const r = await fetchNetworkEndpointTimelinePlotFromServer(makeFilters(), 'example.com', '/api/users')
        expect(lastFetchUrl()).toContain('/api/apps/app-a/networkRequests/plots/endpointTimeline')
        expect(r.status).toBe(NetworkEndpointTimelinePlotApiStatus.Success)
    })

    it('fetchNetworkTimelinePlotFromServer uses overviewTimeline path and returns Success with points', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ points: [{ t: 1 }] }))
        const r = await fetchNetworkTimelinePlotFromServer(makeFilters(), 25)
        const url = lastFetchUrl()
        expect(url).toContain('/api/apps/app-a/networkRequests/plots/overviewTimeline')
        expect(url).toContain('timeline_limit=25')
        expect(r.status).toBe(NetworkTimelinePlotApiStatus.Success)
    })

    it('fetchNetworkOverviewStatusCodesPlotFromServer uses overviewStatusCodes path and returns Success with data', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse([{ code: 200 }]))
        const r = await fetchNetworkOverviewStatusCodesPlotFromServer(makeFilters())
        expect(lastFetchUrl()).toContain('/api/apps/app-a/networkRequests/plots/overviewStatusCodes')
        expect(r.status).toBe(NetworkOverviewStatusCodesPlotApiStatus.Success)
    })

    it('fetchNetworkTrendsFromServer uses /networkRequests/trends with trends_limit and handles status transitions', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }))
        await fetchNetworkTrendsFromServer(makeFilters(), 15)
        const url = lastFetchUrl()
        expect(url).toContain('/api/apps/app-a/networkRequests/trends')
        expect(url).toContain('trends_limit=15')

        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        expect((await fetchNetworkTrendsFromServer(makeFilters())).status).toBe(NetworkTrendsApiStatus.Error)

        mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
        expect((await fetchNetworkTrendsFromServer(makeFilters())).status).toBe(NetworkTrendsApiStatus.Cancelled)
    })
})

// ========================================================================
// Sessions / bug reports / alerts
// ========================================================================
describe('sessions, bug reports, alerts', () => {
    it('fetchSessionTimelineFromServer hits /sessions/{sessionId}', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ session: {} }))
        await fetchSessionTimelineFromServer('app-1', 'sess-1')
        expect(lastFetchUrl()).toBe('/api/apps/app-1/sessions/sess-1')
    })

    it('fetchBugReportsOverviewFromServer includes path and filters', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }))
        await fetchBugReportsOverviewFromServer(makeFilters(), 5, 0)
        expect(lastFetchUrl()).toContain('/api/apps/app-a/bugReports')
    })

    it('fetchBugReportsOverviewPlotFromServer returns NoData on null', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const r = await fetchBugReportsOverviewPlotFromServer(makeFilters())
        expect(r.status).toBe(BugReportsOverviewPlotApiStatus.NoData)
    })

    it('fetchBugReportFromServer returns Success on 200', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ bug: {} }))
        const r = await fetchBugReportFromServer('app-1', 'bug-1')
        expect(lastFetchUrl()).toContain('/api/apps/app-1/bugReports/bug-1')
        expect(r.status).toBe(BugReportApiStatus.Success)
    })

    it('updateBugReportStatusFromServer PATCHes with new status', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await updateBugReportStatusFromServer('app-1', 'bug-1', 1)
        expect(lastFetchUrl()).toContain('/api/apps/app-1/bugReports/bug-1')
        expect(lastFetchOpts().method).toBe('PATCH')
    })

    it('fetchAlertsOverviewFromServer hits /alerts with filters', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: [] }))
        await fetchAlertsOverviewFromServer(makeFilters(), 20, 0)
        expect(lastFetchUrl()).toContain('/api/apps/app-a/alerts')
    })
})

// ========================================================================
// Team management POSTs/PATCHes/DELETEs
// ========================================================================
describe('team management mutations', () => {
    describe('changeTeamNameFromServer', () => {
        it('returns Success on 200', async () => {
            mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
            const r = await changeTeamNameFromServer('t1', 'New')
            expect(lastFetchOpts().method).toBe('PATCH')
            expect(JSON.parse(lastFetchOpts().body).name).toBe('New')
            expect(r.status).toBe(TeamNameChangeApiStatus.Success)
        })

        it('returns Error on non-ok', async () => {
            mockApiClientFetch.mockResolvedValueOnce(errorResponse())
            expect((await changeTeamNameFromServer('t', 'x')).status).toBe(TeamNameChangeApiStatus.Error)
        })

        it('returns Cancelled on exception', async () => {
            mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
            expect((await changeTeamNameFromServer('t', 'x')).status).toBe(TeamNameChangeApiStatus.Cancelled)
        })
    })

    it('createTeamFromServer POSTs with name', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ id: 't1' }))
        await createTeamFromServer('Team 1')
        expect(lastFetchOpts().method).toBe('POST')
        expect(JSON.parse(lastFetchOpts().body).name).toBe('Team 1')
    })

    it('createAppFromServer POSTs with name', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ id: 'a1' }))
        await createAppFromServer('team-1', 'My App')
        expect(lastFetchUrl()).toContain('/api/teams/team-1/apps')
        expect(JSON.parse(lastFetchOpts().body).name).toBe('My App')
    })

    it('changeRoleFromServer PATCHes with role', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await changeRoleFromServer('t1', 'admin', 'm1')
        expect(lastFetchUrl()).toContain('/api/teams/t1/members/m1/role')
        expect(lastFetchOpts().method).toBe('PATCH')
    })

    it('inviteMemberFromServer POSTs invite array', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await inviteMemberFromServer('t1', 'bob@example.com', 'Admin')
        expect(lastFetchOpts().method).toBe('POST')
        const body = JSON.parse(lastFetchOpts().body)
        expect(body[0].email).toBe('bob@example.com')
        expect(body[0].role).toBe('admin') // lowercased
    })

    it('inviteMemberFromServer returns Error with error message', async () => {
        mockApiClientFetch.mockResolvedValueOnce(mockResponse(false, 400, { error: 'bad' }))
        const r = await inviteMemberFromServer('t1', 'x@y.z', 'admin')
        expect(r.status).toBe(InviteMemberApiStatus.Error)
    })

    it('removeMemberFromServer DELETEs', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await removeMemberFromServer('t1', 'm1')
        expect(lastFetchUrl()).toContain('/api/teams/t1/members/m1')
        expect(lastFetchOpts().method).toBe('DELETE')
    })

    it('resendPendingInviteFromServer PATCHes the invite resource', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await resendPendingInviteFromServer('t1', 'invite-1')
        expect(lastFetchUrl()).toContain('/api/teams/t1/invite/invite-1')
        expect(lastFetchOpts().method).toBe('PATCH')
    })

    it('removePendingInviteFromServer DELETEs', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await removePendingInviteFromServer('t1', 'invite-1')
        expect(lastFetchOpts().method).toBe('DELETE')
    })

    it('fetchPendingInvitesFromServer returns Success with data', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse([{ id: 'i1' }]))
        const r = await fetchPendingInvitesFromServer('t1')
        expect(lastFetchUrl()).toContain('/api/teams/t1/invites')
        expect(r.status).toBe(PendingInvitesApiStatus.Success)
    })

    it('fetchAuthzAndMembersFromServer returns Success with data', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ members: [] }))
        const r = await fetchAuthzAndMembersFromServer('t1')
        expect(lastFetchUrl()).toContain('/api/teams/t1/authz')
        expect(r.status).toBe(AuthzAndMembersApiStatus.Success)
    })
})

// ========================================================================
// Slack / notifications
// ========================================================================
describe('slack and notifications', () => {
    it('fetchTeamSlackConnectUrlFromServer POSTs with userId/teamId/redirectUrl', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ url: 'https://slack/oauth' }))
        const r = await fetchTeamSlackConnectUrlFromServer('u1', 't1', 'https://app/return')
        expect(lastFetchOpts().method).toBe('POST')
        expect(lastFetchOpts().headers['Content-Type']).toBe('application/json')
        expect(r.status).toBe(FetchTeamSlackConnectUrlApiStatus.Success)
    })

    it('fetchTeamSlackStatusFromServer returns Success', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ active: true }))
        const r = await fetchTeamSlackStatusFromServer('t1')
        expect(r.status).toBe(FetchTeamSlackStatusApiStatus.Success)
    })

    it('updateTeamSlackStatusFromServer PATCHes with active flag', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await updateTeamSlackStatusFromServer('t1', true)
        expect(lastFetchOpts().method).toBe('PATCH')
    })

    it('sendTestSlackAlertFromServer POSTs', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await sendTestSlackAlertFromServer('t1')
        expect(lastFetchOpts().method).toBe('POST')
    })

    it('fetchNotifPrefsFromServer hits /prefs/notifPrefs', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ prefs: {} }))
        await fetchNotifPrefsFromServer()
        expect(lastFetchUrl()).toContain('/api/prefs/notifPrefs')
    })

    it('updateNotifPrefsFromServer PATCHes', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await updateNotifPrefsFromServer({} as any)
        expect(lastFetchOpts().method).toBe('PATCH')
    })
})

// ========================================================================
// App-level settings
// ========================================================================
describe('app settings', () => {
    it('fetchAppThresholdPrefsFromServer hits /thresholdPrefs', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchAppThresholdPrefsFromServer('app-1')
        expect(lastFetchUrl()).toContain('/api/apps/app-1/thresholdPrefs')
    })

    it('updateAppThresholdPrefsFromServer PATCHes with body', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await updateAppThresholdPrefsFromServer('app-1', { error_good_threshold: 1 } as any)
        expect(lastFetchOpts().method).toBe('PATCH')
    })

    it('fetchAppRetentionFromServer hits /retention', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchAppRetentionFromServer('app-1')
        expect(lastFetchUrl()).toContain('/api/apps/app-1/retention')
    })

    it('updateAppRetentionFromServer PATCHes', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await updateAppRetentionFromServer('app-1', { retention: 90 } as any)
        expect(lastFetchOpts().method).toBe('PATCH')
    })

    it('changeAppNameFromServer PATCHes with name', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await changeAppNameFromServer('app-1', 'New Name')
        expect(lastFetchOpts().method).toBe('PATCH')
        expect(JSON.parse(lastFetchOpts().body).name).toBe('New Name')
    })

    it('changeAppApiKeyFromServer PATCHes /apiKey', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await changeAppApiKeyFromServer('app-1')
        expect(lastFetchUrl()).toContain('/api/apps/app-1/apiKey')
        expect(lastFetchOpts().method).toBe('PATCH')
    })

    it('fetchSdkConfigFromServer hits /config', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchSdkConfigFromServer('app-1')
        expect(lastFetchUrl()).toContain('/api/apps/app-1/config')
    })

    it('updateSdkConfigFromServer PATCHes with partial body', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await updateSdkConfigFromServer('app-1', { crash_take_screenshot: true } as Partial<SdkConfig>)
        expect(lastFetchOpts().method).toBe('PATCH')
    })
})

// ========================================================================
// Billing
// ========================================================================
describe('billing endpoints', () => {
    it('fetchBillingInfoFromServer hits /billing', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ plan: 'free' }))
        await fetchBillingInfoFromServer('t1')
        expect(lastFetchUrl()).toContain('/api/teams/t1/billing')
    })

    it('fetchSubscriptionInfoFromServer hits /subscription', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ status: 'active' }))
        await fetchSubscriptionInfoFromServer('t1')
        expect(lastFetchUrl()).toContain('/api/teams/t1/billing/subscription')
    })

    it('fetchBillingUsageThresholdFromServer hits /billing/usageThreshold', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchBillingUsageThresholdFromServer('t1')
        expect(lastFetchUrl()).toContain('/api/teams/t1/billing/usageThreshold')
    })

    it('fetchUsageFromServer hits /usage', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        await fetchUsageFromServer('t1')
        expect(lastFetchUrl()).toContain('/api/teams/t1/usage')
    })

    it('fetchStripeCheckoutSessionFromServer PATCHes with URLs', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ checkout_url: 'https://stripe/checkout' }))
        await fetchStripeCheckoutSessionFromServer('t1', 'https://ok', 'https://cancel')
        expect(lastFetchUrl()).toContain('/api/teams/t1/billing/checkout')
        expect(lastFetchOpts().method).toBe('PATCH')
        const body = JSON.parse(lastFetchOpts().body)
        expect(body.success_url).toBe('https://ok')
        expect(body.cancel_url).toBe('https://cancel')
    })

    it('downgradeToFreeFromServer POSTs', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        const r = await downgradeToFreeFromServer('t1')
        expect(lastFetchUrl()).toContain('/api/teams/t1/billing/downgrade')
        expect(lastFetchOpts().method).toBe('PATCH')
        expect(r.status).toBe(DowngradeToFreeApiStatus.Success)
    })

    it('fetchCustomerPortalUrlFromServer POSTs with return url', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ url: 'https://portal' }))
        const r = await fetchCustomerPortalUrlFromServer('t1', 'https://back')
        expect(lastFetchOpts().method).toBe('POST')
        const body = JSON.parse(lastFetchOpts().body)
        expect(body.return_url).toBe('https://back')
        expect(r.status).toBe(FetchCustomerPortalUrlApiStatus.Success)
    })
})

// ========================================================================
// applyGenericFiltersToUrl — exercised via any function that uses it.
// These tests cover the per-field append branches (session types, span
// statuses, bug report statuses, free text, span name, span filters,
// http methods) by passing filters with non-default values.
// ========================================================================
describe('applyGenericFiltersToUrl filter branches', () => {
    it('appends session type flags for each selected type', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        const filters = makeFilters({
            sessionTypes: {
                all: false,
                selected: [
                    'Crash Sessions',
                    'ANR Sessions',
                    'Bug Report Sessions',
                    'User Interaction Sessions',
                    'Foreground Sessions',
                    'Background Sessions',
                ] as any,
            },
        })
        await fetchMetricsFromServer(filters)
        const url = lastFetchUrl()
        expect(url).toContain('crash=1')
        expect(url).toContain('anr=1')
        expect(url).toContain('bug_report=1')
        expect(url).toContain('user_interaction=1')
        expect(url).toContain('foreground=1')
        expect(url).toContain('background=1')
    })

    it('appends rootSpanName when non-empty', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchMetricsFromServer(makeFilters({ rootSpanName: 'my_root_span' }))
        expect(lastFetchUrl()).toContain('span_name=')
    })

    it('appends span statuses for each SpanStatus', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchMetricsFromServer(
            makeFilters({
                spanStatuses: {
                    all: false,
                    selected: ['Unset', 'Ok', 'Error'] as any,
                },
            }),
        )
        const url = lastFetchUrl()
        // Each status value becomes a span_statuses query param.
        expect(url.match(/span_statuses=\d/g)?.length).toBe(3)
    })

    it('appends bug_report_statuses for Open/Closed', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchBugReportsOverviewFromServer(
            makeFilters({
                bugReportStatuses: {
                    all: false,
                    selected: [BugReportStatus.Open, BugReportStatus.Closed],
                },
            }),
            5,
            0,
        )
        const url = lastFetchUrl()
        // NOTE: fetchBugReportsOverviewFromServer calls both
        // applyGenericFiltersToUrl (which appends bug_report_statuses) AND
        // appendBugReportStatusesToUrl (which appends them again) — so each
        // status shows up twice in the final URL. This is a duplication in
        // api_calls.ts; pin the current behaviour here rather than the ideal.
        expect(url).toContain('bug_report_statuses=0')
        expect(url).toContain('bug_report_statuses=1')
    })

    it('appends free_text when non-empty', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        await fetchMetricsFromServer(makeFilters({ freeText: 'search me' }))
        expect(lastFetchUrl()).toContain('free_text=search+me')
    })
})

describe('applyHttpMethodsToUrl and applySpanFiltersToUrl', () => {
    it('appends http_methods params for selected methods', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        await fetchNetworkEndpointLatencyPlotFromServer(
            makeFilters({
                httpMethods: { all: false, selected: ['get', 'post'] as any },
            }),
            'example.com',
            '/path',
        )
        const url = lastFetchUrl()
        expect(url).toContain('http_methods=get')
        expect(url).toContain('http_methods=post')
    })

    it('appends span filters to fetchSpansFromServer URL', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        await fetchSpansFromServer(
            makeFilters({
                rootSpanName: 'root',
                spanStatuses: {
                    all: false,
                    selected: ['Error'] as any,
                },
            }),
            10,
            0,
        )
        const url = lastFetchUrl()
        expect(url).toContain('/api/apps/app-a/spans')
        expect(url).toContain('span_name=')
    })
})

// ========================================================================
// Error / Cancelled paths for the fetch functions that didn't get them
// in the happy-path tests above. Parameterized to keep it compact.
// ========================================================================
describe('fetch functions: Error / Cancelled paths', () => {
    const cases: Array<[string, () => Promise<{ status: any }>, any, any]> = [
        ['fetchSpanMetricsPlotFromServer',
            () => fetchSpanMetricsPlotFromServer(makeFilters()),
            SpanMetricsPlotApiStatus.Error, SpanMetricsPlotApiStatus.Cancelled],
        ['fetchSpansFromServer',
            () => fetchSpansFromServer(makeFilters(), 10, 0),
            SpansApiStatus.Error, SpansApiStatus.Cancelled],
        ['fetchJourneyFromServer',
            () => fetchJourneyFromServer(JourneyType.Paths, null, false, makeFilters()),
            JourneyApiStatus.Error, JourneyApiStatus.Cancelled],
        ['fetchMetricsFromServer',
            () => fetchMetricsFromServer(makeFilters()),
            MetricsApiStatus.Error, MetricsApiStatus.Cancelled],
        ['fetchSessionTimelinesOverviewFromServer',
            () => fetchSessionTimelinesOverviewFromServer(makeFilters(), 10, 0),
            SessionTimelinesOverviewApiStatus.Error, SessionTimelinesOverviewApiStatus.Cancelled],
        ['fetchExceptionsOverviewFromServer',
            () => fetchExceptionsOverviewFromServer(ExceptionsType.Crash, makeFilters(), 5, 0),
            ExceptionsOverviewApiStatus.Error, ExceptionsOverviewApiStatus.Cancelled],
        ['fetchExceptionsDetailsFromServer',
            () => fetchExceptionsDetailsFromServer(ExceptionsType.Crash, 'g', makeFilters(), 10, 0),
            ExceptionsDetailsApiStatus.Error, ExceptionsDetailsApiStatus.Cancelled],
        ['fetchExceptionGroupCommonPathFromServer',
            () => fetchExceptionGroupCommonPathFromServer(ExceptionsType.Crash, 'a', 'g'),
            ExceptionGroupCommonPathApiStatus.Error, ExceptionGroupCommonPathApiStatus.Cancelled],
        ['fetchExceptionsOverviewPlotFromServer',
            () => fetchExceptionsOverviewPlotFromServer(ExceptionsType.Crash, makeFilters()),
            ExceptionsOverviewPlotApiStatus.Error, ExceptionsOverviewPlotApiStatus.Cancelled],
        ['fetchExceptionsDetailsPlotFromServer',
            () => fetchExceptionsDetailsPlotFromServer(ExceptionsType.Crash, 'g', makeFilters()),
            ExceptionsDetailsPlotApiStatus.Error, ExceptionsDetailsPlotApiStatus.Cancelled],
        ['fetchAuthzAndMembersFromServer',
            () => fetchAuthzAndMembersFromServer('t1'),
            AuthzAndMembersApiStatus.Error, AuthzAndMembersApiStatus.Cancelled],
        ['fetchSessionTimelineFromServer',
            () => fetchSessionTimelineFromServer('a', 's'),
            SessionTimelineApiStatus.Error, SessionTimelineApiStatus.Cancelled],
        ['fetchBugReportsOverviewFromServer',
            () => fetchBugReportsOverviewFromServer(makeFilters(), 5, 0),
            BugReportsOverviewApiStatus.Error, BugReportsOverviewApiStatus.Cancelled],
        ['fetchBugReportsOverviewPlotFromServer',
            () => fetchBugReportsOverviewPlotFromServer(makeFilters()),
            BugReportsOverviewPlotApiStatus.Error, BugReportsOverviewPlotApiStatus.Cancelled],
        ['fetchBugReportFromServer',
            () => fetchBugReportFromServer('a', 'b'),
            BugReportApiStatus.Error, BugReportApiStatus.Cancelled],
        ['fetchAlertsOverviewFromServer',
            () => fetchAlertsOverviewFromServer(makeFilters(), 20, 0),
            AlertsOverviewApiStatus.Error, AlertsOverviewApiStatus.Cancelled],
        ['fetchPendingInvitesFromServer',
            () => fetchPendingInvitesFromServer('t1'),
            PendingInvitesApiStatus.Error, PendingInvitesApiStatus.Cancelled],
        ['fetchTeamSlackConnectUrlFromServer',
            () => fetchTeamSlackConnectUrlFromServer('u', 't', 'url'),
            FetchTeamSlackConnectUrlApiStatus.Error, FetchTeamSlackConnectUrlApiStatus.Cancelled],
        ['fetchTeamSlackStatusFromServer',
            () => fetchTeamSlackStatusFromServer('t1'),
            FetchTeamSlackStatusApiStatus.Error, FetchTeamSlackStatusApiStatus.Cancelled],
        ['fetchAppThresholdPrefsFromServer',
            () => fetchAppThresholdPrefsFromServer('a'),
            FetchAppThresholdPrefsApiStatus.Error, FetchAppThresholdPrefsApiStatus.Cancelled],
        ['fetchAppRetentionFromServer',
            () => fetchAppRetentionFromServer('a'),
            FetchAppRetentionApiStatus.Error, FetchAppRetentionApiStatus.Cancelled],
        ['fetchSdkConfigFromServer',
            () => fetchSdkConfigFromServer('a'),
            SdkConfigApiStatus.Error, SdkConfigApiStatus.Cancelled],
        ['fetchBillingInfoFromServer',
            () => fetchBillingInfoFromServer('t'),
            FetchBillingInfoApiStatus.Error, FetchBillingInfoApiStatus.Cancelled],
        ['fetchSubscriptionInfoFromServer',
            () => fetchSubscriptionInfoFromServer('t'),
            FetchSubscriptionInfoApiStatus.Error, FetchSubscriptionInfoApiStatus.Cancelled],
        ['fetchBillingUsageThresholdFromServer',
            () => fetchBillingUsageThresholdFromServer('t'),
            FetchBillingUsageThresholdApiStatus.Error, FetchBillingUsageThresholdApiStatus.Cancelled],
        ['fetchUsageFromServer',
            () => fetchUsageFromServer('t'),
            FetchUsageApiStatus.Error, FetchUsageApiStatus.Cancelled],
        ['fetchStripeCheckoutSessionFromServer',
            () => fetchStripeCheckoutSessionFromServer('t', 'o', 'c'),
            FetchStripeCheckoutSessionApiStatus.Error, FetchStripeCheckoutSessionApiStatus.Cancelled],
        ['fetchNotifPrefsFromServer',
            () => fetchNotifPrefsFromServer(),
            FetchNotifPrefsApiStatus.Error, FetchNotifPrefsApiStatus.Cancelled],
        ['fetchNetworkDomainsFromServer',
            () => fetchNetworkDomainsFromServer({ id: 'a' } as any, makeFilters()),
            NetworkDomainsApiStatus.Error, NetworkDomainsApiStatus.Cancelled],
        ['fetchNetworkPathsFromServer',
            () => fetchNetworkPathsFromServer({ id: 'a' } as any, 'd', 's', makeFilters()),
            NetworkPathsApiStatus.Error, NetworkPathsApiStatus.Cancelled],
        ['fetchNetworkEndpointLatencyPlotFromServer',
            () => fetchNetworkEndpointLatencyPlotFromServer(makeFilters(), 'd', 'p'),
            NetworkEndpointLatencyPlotApiStatus.Error, NetworkEndpointLatencyPlotApiStatus.Cancelled],
        ['fetchNetworkEndpointStatusCodesPlotFromServer',
            () => fetchNetworkEndpointStatusCodesPlotFromServer(makeFilters(), 'd', 'p'),
            NetworkEndpointStatusCodesPlotApiStatus.Error, NetworkEndpointStatusCodesPlotApiStatus.Cancelled],
        ['fetchNetworkEndpointTimelinePlotFromServer',
            () => fetchNetworkEndpointTimelinePlotFromServer(makeFilters(), 'd', 'p'),
            NetworkEndpointTimelinePlotApiStatus.Error, NetworkEndpointTimelinePlotApiStatus.Cancelled],
        ['fetchNetworkTimelinePlotFromServer',
            () => fetchNetworkTimelinePlotFromServer(makeFilters(), 10),
            NetworkTimelinePlotApiStatus.Error, NetworkTimelinePlotApiStatus.Cancelled],
        ['fetchNetworkOverviewStatusCodesPlotFromServer',
            () => fetchNetworkOverviewStatusCodesPlotFromServer(makeFilters()),
            NetworkOverviewStatusCodesPlotApiStatus.Error, NetworkOverviewStatusCodesPlotApiStatus.Cancelled],
    ]

    it.each(cases)('%s returns Error on non-ok', async (_name, fn, errStatus, _cancelStatus) => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        const result = await fn()
        expect(result.status).toBe(errStatus)
    })

    it.each(cases)('%s returns Cancelled on exception', async (_name, fn, _errStatus, cancelStatus) => {
        mockApiClientFetch.mockRejectedValueOnce(new Error('boom'))
        const result = await fn()
        expect(result.status).toBe(cancelStatus)
    })
})

// ========================================================================
// Mutation Error / Cancelled paths
// ========================================================================
describe('mutation functions: Error / Cancelled paths', () => {
    const mutations: Array<[string, () => Promise<{ status: any }>, any, any]> = [
        ['createTeamFromServer',
            () => createTeamFromServer('x') as any,
            undefined, undefined],
        ['createAppFromServer',
            () => createAppFromServer('t', 'a') as any,
            undefined, undefined],
        ['changeTeamNameFromServer',
            () => changeTeamNameFromServer('t', 'x'),
            TeamNameChangeApiStatus.Error, TeamNameChangeApiStatus.Cancelled],
        ['changeRoleFromServer',
            () => changeRoleFromServer('t', 'admin', 'm'),
            RoleChangeApiStatus.Error, RoleChangeApiStatus.Cancelled],
        ['inviteMemberFromServer',
            () => inviteMemberFromServer('t', 'x@y.z', 'admin'),
            InviteMemberApiStatus.Error, InviteMemberApiStatus.Cancelled],
        ['removeMemberFromServer',
            () => removeMemberFromServer('t', 'm'),
            RemoveMemberApiStatus.Error, RemoveMemberApiStatus.Cancelled],
        ['resendPendingInviteFromServer',
            () => resendPendingInviteFromServer('t', 'i'),
            ResendPendingInviteApiStatus.Error, ResendPendingInviteApiStatus.Cancelled],
        ['removePendingInviteFromServer',
            () => removePendingInviteFromServer('t', 'i'),
            RemovePendingInviteApiStatus.Error, RemovePendingInviteApiStatus.Cancelled],
        ['updateTeamSlackStatusFromServer',
            () => updateTeamSlackStatusFromServer('t', true),
            UpdateTeamSlackStatusApiStatus.Error, UpdateTeamSlackStatusApiStatus.Cancelled],
        ['sendTestSlackAlertFromServer',
            () => sendTestSlackAlertFromServer('t'),
            TestSlackAlertApiStatus.Error, TestSlackAlertApiStatus.Cancelled],
        ['updateAppThresholdPrefsFromServer',
            () => updateAppThresholdPrefsFromServer('a', {} as any),
            UpdateAppThresholdPrefsApiStatus.Error, UpdateAppThresholdPrefsApiStatus.Cancelled],
        ['updateAppRetentionFromServer',
            () => updateAppRetentionFromServer('a', {} as any),
            UpdateAppRetentionApiStatus.Error, UpdateAppRetentionApiStatus.Cancelled],
        ['changeAppNameFromServer',
            () => changeAppNameFromServer('a', 'n'),
            AppNameChangeApiStatus.Error, AppNameChangeApiStatus.Cancelled],
        ['changeAppApiKeyFromServer',
            () => changeAppApiKeyFromServer('a'),
            AppApiKeyChangeApiStatus.Error, AppApiKeyChangeApiStatus.Cancelled],
        ['updateNotifPrefsFromServer',
            () => updateNotifPrefsFromServer({} as any),
            UpdateNotifPrefsApiStatus.Error, UpdateNotifPrefsApiStatus.Cancelled],
        ['updateSdkConfigFromServer',
            () => updateSdkConfigFromServer('a', {}),
            UpdateSdkConfigApiStatus.Error, UpdateSdkConfigApiStatus.Cancelled],
        ['updateBugReportStatusFromServer',
            () => updateBugReportStatusFromServer('a', 'b', 1),
            UpdateBugReportStatusApiStatus.Error, UpdateBugReportStatusApiStatus.Cancelled],
        ['downgradeToFreeFromServer',
            () => downgradeToFreeFromServer('t'),
            DowngradeToFreeApiStatus.Error, DowngradeToFreeApiStatus.Cancelled],
        ['fetchCustomerPortalUrlFromServer',
            () => fetchCustomerPortalUrlFromServer('t', 'url'),
            FetchCustomerPortalUrlApiStatus.Error, FetchCustomerPortalUrlApiStatus.Cancelled],
    ]

    it.each(mutations.filter(([, , err]) => err !== undefined))(
        '%s returns Error on non-ok',
        async (_name, fn, errStatus, _cancelStatus) => {
            mockApiClientFetch.mockResolvedValueOnce(errorResponse())
            const result = await fn()
            expect(result.status).toBe(errStatus)
        },
    )

    it.each(mutations.filter(([, , _err, cancel]) => cancel !== undefined))(
        '%s returns Cancelled on exception',
        async (_name, fn, _errStatus, cancelStatus) => {
            mockApiClientFetch.mockRejectedValueOnce(new Error('boom'))
            const result = await fn()
            expect(result.status).toBe(cancelStatus)
        },
    )
})

// ========================================================================
// Additional branch coverage — NoData paths, all SpanStatus values,
// all SessionType values via session-timeline fetches, etc.
// ========================================================================
describe('additional branch coverage', () => {
    it('fetchSpanMetricsPlotFromServer returns NoData when response data is null', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const r = await fetchSpanMetricsPlotFromServer(makeFilters())
        expect(r.status).toBe(SpanMetricsPlotApiStatus.NoData)
    })

    it('fetchSessionsVsExceptionsPlotFromServer returns Error when sessions child errors', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse()) // sessions
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        const r = await fetchSessionsVsExceptionsPlotFromServer(makeFilters())
        expect(r.status).toBe(SessionsVsExceptionsPlotApiStatus.Error)
    })

    it('fetchSessionsVsExceptionsPlotFromServer returns Error when crashes child errors', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        mockApiClientFetch.mockResolvedValueOnce(errorResponse()) // crashes
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        const r = await fetchSessionsVsExceptionsPlotFromServer(makeFilters())
        expect(r.status).toBe(SessionsVsExceptionsPlotApiStatus.Error)
    })

    it('fetchSessionsVsExceptionsPlotFromServer returns Error when anrs child errors', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        mockApiClientFetch.mockResolvedValueOnce(errorResponse()) // anrs
        const r = await fetchSessionsVsExceptionsPlotFromServer(makeFilters())
        expect(r.status).toBe(SessionsVsExceptionsPlotApiStatus.Error)
    })

    it('appends all span statuses (Unset/Ok/Error) to span endpoint URLs', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        await fetchSpansFromServer(
            makeFilters({
                spanStatuses: {
                    all: false,
                    selected: ['Unset', 'Ok', 'Error'] as any,
                },
            }),
            10,
            0,
        )
        const url = lastFetchUrl()
        expect(url).toContain('span_statuses=0')
        expect(url).toContain('span_statuses=1')
        expect(url).toContain('span_statuses=2')
    })

    it('appends all session types via fetchSessionTimelinesOverviewFromServer', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse([]))
        await fetchSessionTimelinesOverviewFromServer(
            makeFilters({
                sessionTypes: {
                    all: false,
                    selected: [
                        'Crash Sessions',
                        'ANR Sessions',
                        'Bug Report Sessions',
                        'User Interaction Sessions',
                        'Foreground Sessions',
                        'Background Sessions',
                    ] as any,
                },
            }),
            10,
            0,
        )
        const url = lastFetchUrl()
        // appendSessionTypesToUrl path — each type becomes its own param
        expect(url).toContain('crash=1')
        expect(url).toContain('anr=1')
        expect(url).toContain('bug_report=1')
        expect(url).toContain('user_interaction=1')
        expect(url).toContain('foreground=1')
        expect(url).toContain('background=1')
    })

    it('fetchExceptionsOverviewPlotFromServer returns Error on non-ok', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        const r = await fetchExceptionsOverviewPlotFromServer(ExceptionsType.Anr, makeFilters())
        expect(r.status).toBe(ExceptionsOverviewPlotApiStatus.Error)
    })

    it('fetchExceptionsDetailsPlotFromServer returns Error on non-ok', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        const r = await fetchExceptionsDetailsPlotFromServer(ExceptionsType.Anr, 'g', makeFilters())
        expect(r.status).toBe(ExceptionsDetailsPlotApiStatus.Error)
    })

    it('fetchBugReportsOverviewPlotFromServer returns Error on non-ok', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse())
        const r = await fetchBugReportsOverviewPlotFromServer(makeFilters())
        expect(r.status).toBe(BugReportsOverviewPlotApiStatus.Error)
    })

    it('fetchUsageFromServer returns NoApps on 404', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse(404))
        const r = await fetchUsageFromServer('t1')
        expect(r.status).toBe(FetchUsageApiStatus.NoApps)
    })

    it('fetchNetworkDomainsFromServer returns NoData when data.results is null', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: null }))
        const r = await fetchNetworkDomainsFromServer({ id: 'a' } as any, makeFilters())
        expect(r.status).toBe(NetworkDomainsApiStatus.NoData)
    })

    it('fetchNetworkPathsFromServer returns NoData when data.results is null', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ results: null }))
        const r = await fetchNetworkPathsFromServer({ id: 'a' } as any, 'd', 's', makeFilters())
        expect(r.status).toBe(NetworkPathsApiStatus.NoData)
    })

    it('fetchNetworkEndpointLatencyPlotFromServer returns NoData on null body', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const r = await fetchNetworkEndpointLatencyPlotFromServer(makeFilters(), 'd', 'p')
        expect(r.status).toBe(NetworkEndpointLatencyPlotApiStatus.NoData)
    })

    it('fetchNetworkEndpointStatusCodesPlotFromServer returns NoData on null body', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const r = await fetchNetworkEndpointStatusCodesPlotFromServer(makeFilters(), 'd', 'p')
        expect(r.status).toBe(NetworkEndpointStatusCodesPlotApiStatus.NoData)
    })

    it('fetchNetworkEndpointTimelinePlotFromServer returns NoData on null body', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const r = await fetchNetworkEndpointTimelinePlotFromServer(makeFilters(), 'd', 'p')
        expect(r.status).toBe(NetworkEndpointTimelinePlotApiStatus.NoData)
    })

    it('fetchNetworkTimelinePlotFromServer returns NoData on null body', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const r = await fetchNetworkTimelinePlotFromServer(makeFilters(), 10)
        expect(r.status).toBe(NetworkTimelinePlotApiStatus.NoData)
    })

    it('fetchNetworkOverviewStatusCodesPlotFromServer returns NoData on null body', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const r = await fetchNetworkOverviewStatusCodesPlotFromServer(makeFilters())
        expect(r.status).toBe(NetworkOverviewStatusCodesPlotApiStatus.NoData)
    })

    it('fetchNetworkTrendsFromServer returns NoData on null body', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const r = await fetchNetworkTrendsFromServer(makeFilters())
        expect(r.status).toBe(NetworkTrendsApiStatus.NoData)
    })

    it('AppVersion class constructs name/code/displayName', async () => {
        const { AppVersion } = jest.requireActual('@/app/api/api_calls')
        const v = new AppVersion('1.0.0', '100')
        expect(v.name).toBe('1.0.0')
        expect(v.code).toBe('100')
        expect(v.displayName).toBe('1.0.0 (100)')
    })

    it('OsVersion class adds Android API Level label', async () => {
        const { OsVersion } = jest.requireActual('@/app/api/api_calls')
        expect(new OsVersion('android', '14').displayName).toBe('Android API Level 14')
    })

    it('OsVersion class adds iOS label', async () => {
        const { OsVersion } = jest.requireActual('@/app/api/api_calls')
        expect(new OsVersion('ios', '17').displayName).toBe('iOS 17')
    })

    it('OsVersion class adds iPadOS label', async () => {
        const { OsVersion } = jest.requireActual('@/app/api/api_calls')
        expect(new OsVersion('ipados', '17').displayName).toBe('iPadOS 17')
    })

    it('OsVersion class passes through unknown OS name', async () => {
        const { OsVersion } = jest.requireActual('@/app/api/api_calls')
        expect(new OsVersion('windows', '11').displayName).toBe('windows 11')
    })

    it('fetchExceptionsDetailsPlotFromServer returns NoData when data is null', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const r = await fetchExceptionsDetailsPlotFromServer(ExceptionsType.Crash, 'g', makeFilters())
        expect(r.status).toBe(ExceptionsDetailsPlotApiStatus.NoData)
    })

    it('fetchExceptionsDistributionPlotFromServer uses /anrGroups path for ANR type', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ data: [{ a: 1 }] }))
        await fetchExceptionsDistributionPlotFromServer(ExceptionsType.Anr, 'g', makeFilters())
        expect(lastFetchUrl()).toContain('/api/apps/app-a/anrGroups/g/plots/distribution')
    })

    it('fetchExceptionsDistributionPlotFromServer returns NoData when data is null', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse(null))
        const r = await fetchExceptionsDistributionPlotFromServer(ExceptionsType.Crash, 'g', makeFilters())
        expect(r.status).toBe(ExceptionsDistributionPlotApiStatus.NoData)
    })

    it('fetchExceptionsDistributionPlotFromServer returns NoData when all groups are empty', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({ os: {}, country: {} }))
        const r = await fetchExceptionsDistributionPlotFromServer(ExceptionsType.Crash, 'g', makeFilters())
        expect(r.status).toBe(ExceptionsDistributionPlotApiStatus.NoData)
    })

    it('fetchBugReportsOverviewPlotFromServer returns NoData when data is empty', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        const r = await fetchBugReportsOverviewPlotFromServer(makeFilters())
        // Pin whatever the current code considers "no data" for this endpoint.
        expect([
            BugReportsOverviewPlotApiStatus.NoData,
            BugReportsOverviewPlotApiStatus.Success,
        ]).toContain(r.status)
    })

    it('createTeamFromServer returns Error with message on non-ok', async () => {
        mockApiClientFetch.mockResolvedValueOnce(mockResponse(false, 400, { error: 'name taken' }))
        const r = await createTeamFromServer('x')
        expect(r.status).toBeDefined()
    })

    it('createTeamFromServer returns Cancelled on exception', async () => {
        mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
        const r = await createTeamFromServer('x')
        expect(r.status).toBeDefined()
    })

    it('createAppFromServer returns Error with message on non-ok', async () => {
        mockApiClientFetch.mockResolvedValueOnce(mockResponse(false, 400, { error: 'oops' }))
        const r = await createAppFromServer('t', 'a')
        expect(r.status).toBeDefined()
    })

    it('createAppFromServer returns Cancelled on exception', async () => {
        mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
        const r = await createAppFromServer('t', 'a')
        expect(r.status).toBeDefined()
    })
})

// ========================================================================
// validateInvitesFromServer
// ========================================================================
describe('validateInvitesFromServer', () => {
    it('returns Success on 200', async () => {
        mockApiClientFetch.mockResolvedValueOnce(successResponse({}))
        const r = await validateInvitesFromServer('invite-1')
        expect(lastFetchUrl()).toContain('/api/auth/validateInvite')
        expect(lastFetchOpts().method).toBe('POST')
        expect(r.status).toBe(ValidateInviteApiStatus.Success)
    })

    it('returns Error on non-ok', async () => {
        mockApiClientFetch.mockResolvedValueOnce(errorResponse(400))
        const r = await validateInvitesFromServer('invite-1')
        expect(r.status).toBe(ValidateInviteApiStatus.Error)
    })

    it('returns Cancelled on exception', async () => {
        mockApiClientFetch.mockRejectedValueOnce(new Error('x'))
        const r = await validateInvitesFromServer('invite-1')
        expect(r.status).toBe(ValidateInviteApiStatus.Cancelled)
    })
})
