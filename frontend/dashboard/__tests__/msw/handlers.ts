/**
 * MSW request handlers for the overview page's API endpoints.
 *
 * These serve the fixture data from ./fixtures.ts by default. Individual
 * tests can override specific handlers via `server.use(...)` to test
 * error states, empty data, etc.
 *
 * URL paths use the /api/* prefix that the frontend sends. The Next.js
 * middleware strips /api and proxies to the Go backend in production,
 * but in tests MSW intercepts before that happens.
 */
import { http, HttpResponse } from 'msw'
import {
    makeAlertsOverviewFixture,
    makeAnrPlotFixture,
    makeAppFixture,
    makeAppRetentionFixture,
    makeAuthzAndMembersFixture,
    makeBillingInfoFixture,
    makeBugReportDetailFixture,
    makeBugReportsOverviewFixture,
    makeBugReportsPlotFixture,
    makeCommonPathFixture,
    makeCrashPlotFixture,
    makeExceptionDistributionFixture,
    makeExceptionInstanceFixture,
    makeExceptionsOverviewFixture,
    makeFiltersFixture,
    makeJourneyFixture,
    makeMetricsFixture,
    makeNetworkDomainsFixture,
    makeNetworkEndpointLatencyFixture,
    makeNetworkEndpointStatusCodesFixture,
    makeNetworkEndpointTimelineFixture,
    makeNetworkOverviewStatusCodesFixture,
    makeNetworkPathsFixture,
    makeNetworkTimelineFixture,
    makeNetworkTrendsFixture,
    makeNotifPrefsFixture,
    makePendingInvitesFixture,
    makeSdkConfigFixture,
    makeSessionPlotFixture,
    makeSessionTimelineDetailFixture,
    makeSessionTimelinesOverviewFixture,
    makeShortFiltersFixture,
    makeSlackConnectUrlFixture,
    makeSlackStatusFixture,
    makeSpanMetricsPlotFixture,
    makeSpansOverviewFixture,
    makeTeamsFixture,
    makeThresholdPrefsFixture,
    makeTraceDetailFixture,
    makeUsageFixture
} from './fixtures'

export const handlers = [
    // 1. GET /api/teams/:teamId/apps
    http.get('*/api/teams/:teamId/apps', () => {
        return HttpResponse.json([makeAppFixture()])
    }),

    // 2. GET /api/apps/:appId/filters
    http.get('*/api/apps/:appId/filters', () => {
        return HttpResponse.json(makeFiltersFixture())
    }),

    // 3. POST /api/apps/:appId/shortFilters
    http.post('*/api/apps/:appId/shortFilters', () => {
        return HttpResponse.json(makeShortFiltersFixture())
    }),

    // 4. GET /api/apps/:appId/sessions/plots/instances
    http.get('*/api/apps/:appId/sessions/plots/instances', () => {
        return HttpResponse.json(makeSessionPlotFixture())
    }),

    // 5. GET /api/apps/:appId/crashGroups/plots/instances
    http.get('*/api/apps/:appId/crashGroups/plots/instances', () => {
        return HttpResponse.json(makeCrashPlotFixture())
    }),

    // 6. GET /api/apps/:appId/anrGroups/plots/instances
    http.get('*/api/apps/:appId/anrGroups/plots/instances', () => {
        return HttpResponse.json(makeAnrPlotFixture())
    }),

    // 7. GET /api/apps/:appId/metrics
    http.get('*/api/apps/:appId/metrics', () => {
        return HttpResponse.json(makeMetricsFixture())
    }),

    // 8. GET /api/apps/:appId/thresholdPrefs
    http.get('*/api/apps/:appId/thresholdPrefs', () => {
        return HttpResponse.json(makeThresholdPrefsFixture())
    }),

    // 9. GET /api/apps/:appId/sessions (paginated list)
    http.get('*/api/apps/:appId/sessions', ({ request }) => {
        // Only match the list endpoint, not /sessions/:sessionId
        const url = new URL(request.url)
        const pathParts = url.pathname.split('/')
        // /api/apps/:appId/sessions has 4 parts after split
        // /api/apps/:appId/sessions/:sessionId has 5 parts
        if (pathParts.filter(Boolean).length > 4) {
            return
        }
        return HttpResponse.json(makeSessionTimelinesOverviewFixture())
    }),

    // 10. GET /api/apps/:appId/sessions/:sessionId (single session detail)
    http.get('*/api/apps/:appId/sessions/:sessionId', () => {
        return HttpResponse.json(makeSessionTimelineDetailFixture())
    }),

    // 11. GET /api/apps/:appId/journey (user journeys)
    http.get('*/api/apps/:appId/journey', () => {
        return HttpResponse.json(makeJourneyFixture())
    }),

    // 12. GET /api/apps/:appId/crashGroups (crashes overview)
    http.get('*/api/apps/:appId/crashGroups', ({ request }) => {
        const url = new URL(request.url)
        // Don't match sub-paths like /crashGroups/:id/crashes
        if (url.pathname.includes('/plots/') || url.pathname.match(/crashGroups\/[^/]+\//)) return
        return HttpResponse.json(makeExceptionsOverviewFixture())
    }),

    // 13. GET /api/apps/:appId/anrGroups (ANRs overview)
    http.get('*/api/apps/:appId/anrGroups', ({ request }) => {
        const url = new URL(request.url)
        if (url.pathname.includes('/plots/') || url.pathname.match(/anrGroups\/[^/]+\//)) return
        return HttpResponse.json(makeExceptionsOverviewFixture())
    }),

    // 14. GET /api/apps/:appId/crashGroups/:id/crashes (crash instances)
    http.get('*/api/apps/:appId/crashGroups/:groupId/crashes', () => {
        return HttpResponse.json(makeExceptionInstanceFixture())
    }),

    // 15. GET /api/apps/:appId/anrGroups/:id/anrs (ANR instances)
    http.get('*/api/apps/:appId/anrGroups/:groupId/anrs', () => {
        return HttpResponse.json(makeExceptionInstanceFixture({ variant: 'anr' }))
    }),

    // 16. GET /api/apps/:appId/crashGroups/:id/plots/instances (crash detail plot)
    http.get('*/api/apps/:appId/crashGroups/:groupId/plots/instances', () => {
        return HttpResponse.json(makeCrashPlotFixture())
    }),

    // 17. GET /api/apps/:appId/anrGroups/:id/plots/instances (ANR detail plot)
    http.get('*/api/apps/:appId/anrGroups/:groupId/plots/instances', () => {
        return HttpResponse.json(makeAnrPlotFixture())
    }),

    // 18. GET /api/apps/:appId/crashGroups/:id/plots/distribution
    http.get('*/api/apps/:appId/crashGroups/:groupId/plots/distribution', () => {
        return HttpResponse.json(makeExceptionDistributionFixture())
    }),

    // 19. GET /api/apps/:appId/anrGroups/:id/plots/distribution
    http.get('*/api/apps/:appId/anrGroups/:groupId/plots/distribution', () => {
        return HttpResponse.json(makeExceptionDistributionFixture())
    }),

    // 20. GET /api/apps/:appId/crashGroups/:id/path (common path)
    http.get('*/api/apps/:appId/crashGroups/:groupId/path', () => {
        return HttpResponse.json(makeCommonPathFixture())
    }),

    // 21. GET /api/apps/:appId/anrGroups/:id/path (common path)
    http.get('*/api/apps/:appId/anrGroups/:groupId/path', () => {
        return HttpResponse.json(makeCommonPathFixture())
    }),

    // 22. GET /api/apps/:appId/bugReports (bug reports list)
    http.get('*/api/apps/:appId/bugReports', ({ request }) => {
        const url = new URL(request.url)
        // Only match the exact /bugReports path, not /bugReports/:id or /bugReports/plots/*
        const pathParts = url.pathname.split('/').filter(Boolean)
        if (pathParts.length > 4) return
        return HttpResponse.json(makeBugReportsOverviewFixture())
    }),

    // 23. GET /api/apps/:appId/bugReports/plots/instances (bug reports plot)
    http.get('*/api/apps/:appId/bugReports/plots/instances', () => {
        return HttpResponse.json(makeBugReportsPlotFixture())
    }),

    // 24. GET /api/apps/:appId/bugReports/:bugReportId (single bug report detail)
    http.get('*/api/apps/:appId/bugReports/:bugReportId', () => {
        return HttpResponse.json(makeBugReportDetailFixture())
    }),

    // 25. PATCH /api/apps/:appId/bugReports/:bugReportId (toggle bug report status)
    http.patch('*/api/apps/:appId/bugReports/:bugReportId', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 26. GET /api/apps/:appId/alerts (alerts list)
    http.get('*/api/apps/:appId/alerts', () => {
        return HttpResponse.json(makeAlertsOverviewFixture())
    }),

    // 27. GET /api/apps/:appId/spans/plots/metrics (span metrics plot — before /spans catch-all)
    http.get('*/api/apps/:appId/spans/plots/metrics', () => {
        return HttpResponse.json(makeSpanMetricsPlotFixture())
    }),

    // 28. GET /api/apps/:appId/spans/roots/names (root span names — before /spans catch-all)
    http.get('*/api/apps/:appId/spans/roots/names', () => {
        return HttpResponse.json({ results: ['checkout_full_display', 'api_fetch_payments', 'render_ui'] })
    }),

    // 29. GET /api/apps/:appId/spans (spans list for traces overview)
    http.get('*/api/apps/:appId/spans', () => {
        return HttpResponse.json(makeSpansOverviewFixture())
    }),

    // 30. GET /api/apps/:appId/traces/:traceId (single trace detail)
    http.get('*/api/apps/:appId/traces/:traceId', () => {
        return HttpResponse.json(makeTraceDetailFixture())
    }),

    // --- Network endpoints (31-38) ---

    // 31. GET /api/apps/:appId/networkRequests/domains
    http.get('*/api/apps/:appId/networkRequests/domains', () => {
        return HttpResponse.json(makeNetworkDomainsFixture())
    }),

    // 32. GET /api/apps/:appId/networkRequests/paths
    http.get('*/api/apps/:appId/networkRequests/paths', () => {
        return HttpResponse.json(makeNetworkPathsFixture())
    }),

    // 33. GET /api/apps/:appId/networkRequests/plots/overviewStatusCodes
    http.get('*/api/apps/:appId/networkRequests/plots/overviewStatusCodes', () => {
        return HttpResponse.json(makeNetworkOverviewStatusCodesFixture())
    }),

    // 34. GET /api/apps/:appId/networkRequests/trends
    http.get('*/api/apps/:appId/networkRequests/trends', () => {
        return HttpResponse.json(makeNetworkTrendsFixture())
    }),

    // 35. GET /api/apps/:appId/networkRequests/plots/overviewTimeline
    http.get('*/api/apps/:appId/networkRequests/plots/overviewTimeline', () => {
        return HttpResponse.json(makeNetworkTimelineFixture())
    }),

    // 36. GET /api/apps/:appId/networkRequests/plots/endpointLatency
    http.get('*/api/apps/:appId/networkRequests/plots/endpointLatency', () => {
        return HttpResponse.json(makeNetworkEndpointLatencyFixture())
    }),

    // 37. GET /api/apps/:appId/networkRequests/plots/endpointStatusCodes
    http.get('*/api/apps/:appId/networkRequests/plots/endpointStatusCodes', () => {
        return HttpResponse.json(makeNetworkEndpointStatusCodesFixture())
    }),

    // 38. GET /api/apps/:appId/networkRequests/plots/endpointTimeline
    http.get('*/api/apps/:appId/networkRequests/plots/endpointTimeline', () => {
        return HttpResponse.json(makeNetworkEndpointTimelineFixture())
    }),

    // --- Apps settings endpoints (39-47) ---

    // 39. GET /api/teams/:teamId/authz (returns full authz+members for team page)
    http.get('*/api/teams/:teamId/authz', () => {
        return HttpResponse.json(makeAuthzAndMembersFixture())
    }),

    // 40. GET /api/teams/:teamId/billing/info
    http.get('*/api/teams/:teamId/billing/info', () => {
        return HttpResponse.json(makeBillingInfoFixture())
    }),

    // 41. GET /api/apps/:appId/retention
    http.get('*/api/apps/:appId/retention', () => {
        return HttpResponse.json(makeAppRetentionFixture())
    }),

    // 42. GET /api/apps/:appId/config
    http.get('*/api/apps/:appId/config', () => {
        return HttpResponse.json(makeSdkConfigFixture())
    }),

    // 43. PATCH /api/apps/:appId/thresholdPrefs
    http.patch('*/api/apps/:appId/thresholdPrefs', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 44. PATCH /api/apps/:appId/retention
    http.patch('*/api/apps/:appId/retention', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 45. PATCH /api/apps/:appId/rename
    http.patch('*/api/apps/:appId/rename', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 46. PATCH /api/apps/:appId/apiKey
    http.patch('*/api/apps/:appId/apiKey', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 47. PATCH /api/apps/:appId/config (SDK config update)
    http.patch('*/api/apps/:appId/config', () => {
        return HttpResponse.json(makeSdkConfigFixture())
    }),

    // --- Team page endpoints (48-58) ---

    // 48. GET /api/teams (list all teams)
    http.get('*/api/teams', ({ request }) => {
        const url = new URL(request.url)
        // Don't match sub-paths like /teams/:teamId/authz
        const pathParts = url.pathname.split('/').filter(Boolean)
        if (pathParts.length > 2) return
        return HttpResponse.json(makeTeamsFixture())
    }),

    // 49. GET /api/teams/:teamId/invites
    http.get('*/api/teams/:teamId/invites', () => {
        return HttpResponse.json(makePendingInvitesFixture())
    }),

    // 50. POST /auth/slack/url
    http.post('*/auth/slack/url', () => {
        return HttpResponse.json(makeSlackConnectUrlFixture())
    }),

    // 51. GET /api/teams/:teamId/slack
    http.get('*/api/teams/:teamId/slack', () => {
        return HttpResponse.json(makeSlackStatusFixture())
    }),

    // 52. PATCH /api/teams/:teamId/rename
    http.patch('*/api/teams/:teamId/rename', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 53. PATCH /api/teams/:teamId/members/:memberId/role
    http.patch('*/api/teams/:teamId/members/:memberId/role', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 54. DELETE /api/teams/:teamId/members/:memberId
    http.delete('*/api/teams/:teamId/members/:memberId', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 55. POST /api/teams/:teamId/invite
    http.post('*/api/teams/:teamId/invite', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 56. PATCH /api/teams/:teamId/invite/:inviteId (resend)
    http.patch('*/api/teams/:teamId/invite/:inviteId', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 57. DELETE /api/teams/:teamId/invite/:inviteId (revoke)
    http.delete('*/api/teams/:teamId/invite/:inviteId', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 58. PATCH /api/teams/:teamId/slack/status
    http.patch('*/api/teams/:teamId/slack/status', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 59. POST /api/teams/:teamId/slack/test
    http.post('*/api/teams/:teamId/slack/test', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 60. GET /api/prefs/notifPrefs
    http.get('*/api/prefs/notifPrefs', () => {
        return HttpResponse.json(makeNotifPrefsFixture())
    }),

    // 61. PATCH /api/prefs/notifPrefs
    http.patch('*/api/prefs/notifPrefs', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 62a. GET /api/auth/session (for UserAvatar component)
    http.get('*/api/auth/session', () => {
        return HttpResponse.json({
            user: {
                id: 'user-001',
                own_team_id: 'team-001',
                name: 'Test User',
                email: 'test@example.com',
                avatar_url: 'https://example.com/avatar.png',
                confirmed_at: '2026-01-01T00:00:00Z',
                last_sign_in_at: '2026-04-10T12:00:00Z',
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-04-10T00:00:00Z',
            },
        })
    }),

    // 62. GET /api/teams/:teamId/usage
    http.get('*/api/teams/:teamId/usage', () => {
        return HttpResponse.json(makeUsageFixture())
    }),

    // 63. PATCH /api/teams/:teamId/billing/checkout
    http.patch('*/api/teams/:teamId/billing/checkout', () => {
        return HttpResponse.json({ checkout_url: 'https://checkout.stripe.com/test' })
    }),

    // 65. PATCH /api/teams/:teamId/billing/downgrade
    http.patch('*/api/teams/:teamId/billing/downgrade', () => {
        return HttpResponse.json({ ok: true })
    }),

    // 66. POST /api/teams/:teamId/billing/portal
    http.post('*/api/teams/:teamId/billing/portal', () => {
        return HttpResponse.json({ url: 'https://billing.stripe.com/portal/test' })
    }),
]
