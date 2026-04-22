/**
 * Response fixture factories matching the Go backend struct shapes.
 *
 * Each factory returns a structurally valid API response with realistic
 * data. Override individual fields via the `overrides` parameter.
 *
 * Source of truth: the Go struct definitions in backend/api/measure/.
 * If a backend struct changes, update the corresponding factory here.
 */

// --- Apps (GET /teams/:teamId/apps) ---
// Go struct: measure.App in backend/api/measure/app.go

export function makeAppFixture(overrides: Record<string, any> = {}) {
    return {
        id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
        team_id: 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        name: 'measure demo',
        unique_identifier: 'sh.measure.demo',
        os_name: 'android',
        api_key: {
            key: 'msw-test-api-key-0000',
            revoked: false,
            created_at: '2026-01-01T00:00:00Z',
            last_seen: '2026-04-10T12:00:00Z',
        },
        retention: 90,
        first_version: '1.0.0',
        onboarded: true,
        onboarded_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-04-10T00:00:00Z',
        ...overrides,
    }
}

// --- Filters (GET /apps/:appId/filters?ud_attr_keys=1) ---
// Go struct: assembled in GetAppFilters handler, backend/api/measure/app.go

export function makeFiltersFixture(overrides: Record<string, any> = {}) {
    return {
        versions: [
            { name: '3.1.0', code: '310' },
            { name: '3.0.2', code: '302' },
            { name: '3.0.1', code: '301' },
        ],
        os_versions: [
            { name: 'android', version: '14' },
            { name: 'android', version: '13' },
        ],
        countries: ['US', 'IN', 'DE'],
        network_providers: ['T-Mobile', 'Jio'],
        network_types: ['wifi', 'cellular'],
        network_generations: ['4g', '5g'],
        locales: ['en-US', 'hi-IN', 'de-DE'],
        device_manufacturers: ['Google', 'Samsung'],
        device_names: ['Pixel 8', 'Galaxy S24'],
        ud_attrs: {
            key_types: [
                { key: 'user_id', type: 'string' },
                { key: 'premium', type: 'bool' },
            ],
            operator_types: {
                string: ['eq', 'neq', 'contains', 'starts_with'],
                bool: ['eq'],
            },
        },
        ...overrides,
    }
}

// --- Short Filters (POST /apps/:appId/shortFilters) ---
// Go struct: response from CreateShortFilters, backend/api/measure/app.go

export function makeShortFiltersFixture(overrides: Record<string, any> = {}) {
    return {
        filter_short_code: 'msw-test-code-abc123',
        ...overrides,
    }
}

// --- Session Plot (GET /apps/:appId/sessions/plots/instances) ---
// Go struct: session.SessionInstance in backend/api/session/plot.go
// Response is array of { id, data: [{ datetime, instances }] }

export function makeSessionPlotFixture() {
    return [
        {
            id: '3.1.0',
            data: [
                { datetime: '2026-04-01T00:00:00Z', instances: 1200 },
                { datetime: '2026-04-02T00:00:00Z', instances: 1350 },
                { datetime: '2026-04-03T00:00:00Z', instances: 1100 },
                { datetime: '2026-04-04T00:00:00Z', instances: 1400 },
                { datetime: '2026-04-05T00:00:00Z', instances: 1250 },
            ],
        },
    ]
}

// --- Crash Plot (GET /apps/:appId/crashGroups/plots/instances) ---
// Go struct: event.IssueInstance in backend/api/event/plot.go
// Response is array of { id, data: [{ datetime, instances, issue_free_sessions }] }

export function makeCrashPlotFixture() {
    return [
        {
            id: '3.1.0',
            data: [
                { datetime: '2026-04-01T00:00:00Z', instances: 15, issue_free_sessions: 98.7 },
                { datetime: '2026-04-02T00:00:00Z', instances: 12, issue_free_sessions: 99.1 },
                { datetime: '2026-04-03T00:00:00Z', instances: 18, issue_free_sessions: 98.3 },
                { datetime: '2026-04-04T00:00:00Z', instances: 10, issue_free_sessions: 99.3 },
                { datetime: '2026-04-05T00:00:00Z', instances: 14, issue_free_sessions: 98.9 },
            ],
        },
    ]
}

// --- ANR Plot (GET /apps/:appId/anrGroups/plots/instances) ---
// Same shape as crash plot but for ANRs

export function makeAnrPlotFixture() {
    return [
        {
            id: '3.1.0',
            data: [
                { datetime: '2026-04-01T00:00:00Z', instances: 3, issue_free_sessions: 99.7 },
                { datetime: '2026-04-02T00:00:00Z', instances: 2, issue_free_sessions: 99.8 },
                { datetime: '2026-04-03T00:00:00Z', instances: 5, issue_free_sessions: 99.6 },
                { datetime: '2026-04-04T00:00:00Z', instances: 1, issue_free_sessions: 99.9 },
                { datetime: '2026-04-05T00:00:00Z', instances: 4, issue_free_sessions: 99.7 },
            ],
        },
    ]
}

// --- Metrics (GET /apps/:appId/metrics) ---
// Go structs: metrics.LaunchMetric, metrics.SessionAdoption, etc.
// in backend/api/metrics/metrics.go

export function makeMetricsFixture(overrides: Record<string, any> = {}) {
    return {
        cold_launch: { p95: 923, delta: 0.07, nan: false, delta_nan: false },
        warm_launch: { p95: 412, delta: -0.03, nan: false, delta_nan: false },
        hot_launch: { p95: 187, delta: 0.02, nan: false, delta_nan: false },
        adoption: {
            all_versions: 10000000,
            selected_version: 4100000,
            adoption: 41,
            nan: false,
        },
        sizes: {
            average_app_size: 52428800,
            selected_app_size: 48234496,
            delta: -0.08,
            nan: false,
        },
        crash_free_sessions: {
            crash_free_sessions: 99.1,
            delta: 1.1,
            nan: false,
            delta_nan: false,
        },
        anr_free_sessions: {
            anr_free_sessions: 99.7,
            delta: 1.01,
            nan: false,
            delta_nan: false,
        },
        perceived_crash_free_sessions: {
            perceived_crash_free_sessions: 99.6,
            delta: 1.05,
            nan: false,
            delta_nan: false,
        },
        perceived_anr_free_sessions: {
            perceived_anr_free_sessions: 99.8,
            delta: 1.05,
            nan: false,
            delta_nan: false,
        },
        ...overrides,
    }
}

// --- Threshold Prefs (GET /apps/:appId/thresholdPrefs) ---
// Go struct: measure.AppThresholdPrefs in backend/api/measure/app_threshold_prefs.go

export function makeThresholdPrefsFixture(overrides: Record<string, any> = {}) {
    return {
        app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
        error_good_threshold: 99.0,
        error_caution_threshold: 98.0,
        error_spike_min_count_threshold: 50,
        error_spike_min_rate_threshold: 2.0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-04-10T00:00:00Z',
        ...overrides,
    }
}

// --- Session Timelines Overview (GET /apps/:appId/sessions) ---
// Go struct: assembled in handler, backend/api/measure/app.go

export function makeSessionTimelinesOverviewFixture(overrides: Record<string, any> = {}) {
    return {
        meta: { next: true, previous: false },
        results: [
            {
                session_id: 'sess-001',
                app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                first_event_time: '2026-04-10T10:00:00Z',
                last_event_time: '2026-04-10T10:05:30Z',
                duration: '330000',
                matched_free_text: '',
                attribute: {
                    app_version: '3.1.0',
                    app_build: '310',
                    user_id: 'user-123',
                    device_name: 'Pixel 8',
                    device_model: 'Pixel 8',
                    device_manufacturer: 'Google',
                    os_name: 'android',
                    os_version: '14',
                },
            },
            {
                session_id: 'sess-002',
                app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                first_event_time: '2026-04-10T09:00:00Z',
                last_event_time: '2026-04-10T09:02:15Z',
                duration: '135000',
                matched_free_text: '',
                attribute: {
                    app_version: '3.0.2',
                    app_build: '302',
                    user_id: 'user-456',
                    device_name: 'Galaxy S24',
                    device_model: 'SM-S921B',
                    device_manufacturer: 'Samsung',
                    os_name: 'android',
                    os_version: '14',
                },
            },
        ],
        ...overrides,
    }
}

export function makeSessionTimelinesOverviewPage2Fixture() {
    return {
        meta: { next: false, previous: true },
        results: [
            {
                session_id: 'sess-006',
                app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                first_event_time: '2026-04-09T15:00:00Z',
                last_event_time: '2026-04-09T15:01:00Z',
                duration: '60000',
                matched_free_text: '',
                attribute: {
                    app_version: '3.0.1',
                    app_build: '301',
                    user_id: 'user-789',
                    device_name: 'Pixel 7',
                    device_model: 'Pixel 7',
                    device_manufacturer: 'Google',
                    os_name: 'android',
                    os_version: '13',
                },
            },
        ],
    }
}

// --- Session Timeline Detail (GET /apps/:appId/sessions/:sessionId) ---

// --- Journey (GET /apps/:appId/journey) ---
// Go struct: assembled in handler, backend/api/measure/app.go

export function makeJourneyFixture(overrides: Record<string, any> = {}) {
    return {
        nodes: [
            {
                id: 'sh.measure.demo.MainActivity',
                issues: { crashes: [], anrs: [] },
            },
            {
                id: 'sh.measure.demo.ProductListActivity',
                issues: { crashes: [], anrs: [] },
            },
            {
                id: 'sh.measure.demo.SearchActivity',
                issues: { crashes: [], anrs: [] },
            },
            {
                id: 'sh.measure.demo.CartActivity',
                issues: { crashes: [], anrs: [] },
            },
        ],
        links: [
            { source: 'sh.measure.demo.MainActivity', target: 'sh.measure.demo.ProductListActivity', value: 5000 },
            { source: 'sh.measure.demo.MainActivity', target: 'sh.measure.demo.SearchActivity', value: 2800 },
            { source: 'sh.measure.demo.ProductListActivity', target: 'sh.measure.demo.CartActivity', value: 1200 },
        ],
        totalIssues: 0,
        ...overrides,
    }
}

export function makeJourneyWithExceptionsFixture() {
    return {
        nodes: [
            {
                id: 'sh.measure.demo.MainActivity',
                issues: { crashes: [], anrs: [] },
            },
            {
                id: 'sh.measure.demo.ProductListActivity',
                issues: {
                    crashes: [
                        { id: 'crash-001', title: 'NullPointerException at ProductList', count: 150 },
                    ],
                    anrs: [],
                },
            },
            {
                id: 'sh.measure.demo.CartActivity',
                issues: {
                    crashes: [],
                    anrs: [
                        { id: 'anr-001', title: 'ANR in CartActivity', count: 30 },
                    ],
                },
            },
        ],
        links: [
            { source: 'sh.measure.demo.MainActivity', target: 'sh.measure.demo.ProductListActivity', value: 5000 },
            { source: 'sh.measure.demo.ProductListActivity', target: 'sh.measure.demo.CartActivity', value: 1200 },
        ],
        totalIssues: 180,
    }
}

// --- Exceptions Overview (GET /apps/:appId/crashGroups or /anrGroups) ---
// Go struct: assembled in handler, backend/api/measure/app.go

export function makeExceptionsOverviewFixture(overrides: Record<string, any> = {}) {
    return {
        meta: { next: true, previous: false },
        results: [
            {
                id: 'crash-group-001',
                app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                type: 'java.lang.NullPointerException',
                message: 'Attempt to invoke virtual method on null object reference',
                method_name: 'onClick',
                file_name: 'CheckoutActivity.kt',
                line_number: 42,
                count: 1523,
                percentage_contribution: 45.2,
                updated_at: '2026-04-10T12:00:00Z',
            },
            {
                id: 'crash-group-002',
                app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                type: 'java.lang.IllegalStateException',
                message: 'Fragment not attached to context',
                method_name: 'onResume',
                file_name: 'ProductFragment.kt',
                line_number: 88,
                count: 847,
                percentage_contribution: 25.1,
                updated_at: '2026-04-09T18:00:00Z',
            },
        ],
        ...overrides,
    }
}

// --- Exception Instance Detail (GET /apps/:appId/crashGroups/:id/crashes) ---

// Pass `variant: 'anr'` to get an ANR instance (with `anr` field instead of `exception`)
export function makeExceptionInstanceFixture(overrides: Record<string, any> & { variant?: 'crash' | 'anr' } = {}) {
    const { variant = 'crash', ...rest } = overrides
    const exceptionField = variant === 'anr'
        ? {
            anr: {
                title: 'ANR at CheckoutActivity.onClick',
                stacktrace: 'ANR in sh.measure.demo.CheckoutActivity.onClick(CheckoutActivity.kt:42)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)',
            },
        }
        : {
            exception: {
                title: 'NullPointerException at CheckoutActivity.onClick',
                stacktrace: 'java.lang.NullPointerException: Attempt to invoke virtual method\n\tat sh.measure.demo.CheckoutActivity.onClick(CheckoutActivity.kt:42)\n\tat android.view.View.performClick(View.java:7448)',
                message: 'Attempt to invoke virtual method on null object reference',
            },
        }
    return {
        meta: { next: true, previous: false },
        results: [
            {
                id: 'instance-001',
                session_id: 'sess-crash-001',
                timestamp: '2026-04-10T10:30:00Z',
                type: 'java.lang.NullPointerException',
                thread_name: 'main',
                ...exceptionField,
                attribute: {
                    installation_id: 'inst-001',
                    app_version: '3.1.0',
                    app_build: '310',
                    app_unique_id: 'sh.measure.demo',
                    measure_sdk_version: '0.9.0',
                    platform: 'android',
                    thread_name: 'main',
                    user_id: 'user-crash-123',
                    device_name: 'Pixel 8',
                    device_model: 'Pixel 8',
                    device_manufacturer: 'Google',
                    device_type: 'phone',
                    device_is_foldable: false,
                    device_is_physical: true,
                    device_density_dpi: 420,
                    device_width_px: 1440,
                    device_height_px: 3120,
                    device_density: 2.75,
                    device_locale: 'en-US',
                    os_name: 'android',
                    os_version: '14',
                    network_type: 'wifi',
                    network_provider: 'Comcast',
                    network_generation: '',
                },
                attachments: [],
                threads: [
                    {
                        name: 'main',
                        frames: [
                            'sh.measure.demo.CheckoutActivity.onClick(CheckoutActivity.kt:42)',
                            'android.view.View.performClick(View.java:7448)',
                        ],
                    },
                    {
                        name: 'AsyncTask #1',
                        frames: [
                            'java.lang.Thread.run(Thread.java:920)',
                        ],
                    },
                ],
                ...rest,
            },
        ],
    }
}

// --- Exception Distribution Plot ---

export function makeExceptionDistributionFixture() {
    return {
        os_version: { 'android 14': 800, 'android 13': 400 },
        device_manufacturer: { 'Google': 600, 'Samsung': 400, 'OnePlus': 200 },
        country: { 'US': 700, 'IN': 300, 'DE': 200 },
    }
}

// --- Common Path ---

export function makeCommonPathFixture(overrides: Record<string, any> = {}) {
    return {
        sessions_analyzed: 250,
        steps: [
            { description: 'App launched', thread_name: 'main', confidence_pct: 95 },
            { description: 'MainActivity.onCreate', thread_name: 'main', confidence_pct: 92 },
            { description: 'CheckoutActivity.onClick', thread_name: 'main', confidence_pct: 85 },
            { description: 'NetworkCall.execute', thread_name: 'OkHttp', confidence_pct: 60 },
        ],
        ...overrides,
    }
}

// --- Bug Reports Overview (GET /apps/:appId/bugReports) ---

export function makeBugReportsOverviewFixture(overrides: Record<string, any> = {}) {
    return {
        meta: { next: true, previous: false },
        results: [
            {
                session_id: 'sess-br-001',
                app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                event_id: 'evt-br-001',
                status: 0, // Open
                description: 'App crashes when tapping checkout button',
                timestamp: '2026-04-10T14:30:00Z',
                attribute: {
                    installation_id: 'inst-001',
                    app_version: '3.1.0',
                    app_build: '310',
                    app_unique_id: 'sh.measure.demo',
                    measure_sdk_version: '0.9.0',
                    platform: 'android',
                    thread_name: 'main',
                    user_id: 'user-br-123',
                    device_name: 'Pixel 8',
                    device_model: 'Pixel 8',
                    device_manufacturer: 'Google',
                    device_type: 'phone',
                    device_is_foldable: false,
                    device_is_physical: true,
                    device_density_dpi: 420,
                    device_width_px: 1440,
                    device_height_px: 3120,
                    device_density: 2.75,
                    device_locale: 'en-US',
                    os_name: 'android',
                    os_version: '14',
                    network_type: 'wifi',
                    network_provider: 'Comcast',
                    network_generation: '',
                },
                user_defined_attribute: null,
                attachments: null,
                matched_free_text: '',
            },
            {
                session_id: 'sess-br-002',
                app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                event_id: 'evt-br-002',
                status: 1, // Closed
                description: '',
                timestamp: '2026-04-09T09:15:00Z',
                attribute: {
                    installation_id: 'inst-002',
                    app_version: '3.0.2',
                    app_build: '302',
                    app_unique_id: 'sh.measure.demo',
                    measure_sdk_version: '0.9.0',
                    platform: 'android',
                    thread_name: 'main',
                    user_id: '',
                    device_name: 'Galaxy S24',
                    device_model: 'SM-S921B',
                    device_manufacturer: 'Samsung',
                    device_type: 'phone',
                    device_is_foldable: false,
                    device_is_physical: true,
                    device_density_dpi: 480,
                    device_width_px: 1440,
                    device_height_px: 3120,
                    device_density: 3.0,
                    device_locale: 'de-DE',
                    os_name: 'android',
                    os_version: '14',
                    network_type: 'cellular',
                    network_provider: 'T-Mobile',
                    network_generation: '5g',
                },
                user_defined_attribute: null,
                attachments: null,
                matched_free_text: '',
            },
        ],
        ...overrides,
    }
}

// --- Bug Report Detail (GET /apps/:appId/bugReports/:bugReportId) ---

export function makeBugReportDetailFixture(overrides: Record<string, any> = {}) {
    return {
        session_id: 'sess-br-001',
        app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
        event_id: 'evt-br-001',
        status: 0,
        description: 'App crashes when tapping checkout button',
        timestamp: '2026-04-10T14:30:00Z',
        updated_at: '2026-04-10T14:30:00Z',
        attribute: {
            installation_id: 'inst-001',
            app_version: '3.1.0',
            app_build: '310',
            app_unique_id: 'sh.measure.demo',
            measure_sdk_version: '0.9.0',
            platform: 'android',
            thread_name: 'main',
            user_id: 'user-br-123',
            device_name: 'Pixel 8',
            device_model: 'Pixel 8',
            device_manufacturer: 'Google',
            device_type: 'phone',
            device_is_foldable: false,
            device_is_physical: true,
            device_density_dpi: 420,
            device_width_px: 1440,
            device_height_px: 3120,
            device_density: 2.75,
            device_locale: 'en-US',
            os_name: 'android',
            os_version: '14',
            network_type: 'wifi',
            network_provider: 'Comcast',
            network_generation: '',
        },
        user_defined_attribute: { premium: true, plan: 'pro' },
        attachments: [
            { id: 'att-br-1', name: 'screenshot.png', type: 'screenshot', key: 'att-key-br-1', location: 'https://example.com/bug-screenshot.png' },
        ],
        ...overrides,
    }
}

// --- Bug Reports Overview Plot ---

export function makeBugReportsPlotFixture() {
    return [
        {
            id: '3.1.0',
            data: [
                { datetime: '2026-04-01T00:00:00Z', instances: 8 },
                { datetime: '2026-04-02T00:00:00Z', instances: 12 },
                { datetime: '2026-04-03T00:00:00Z', instances: 5 },
            ],
        },
    ]
}

export function makeSessionTimelineDetailFixture(overrides: Record<string, any> = {}) {
    return {
        app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
        session_id: 'sess-001',
        attribute: {
            installation_id: 'inst-001',
            app_version: '3.1.0',
            app_build: '310',
            app_unique_id: 'sh.measure.demo',
            measure_sdk_version: '0.9.0',
            platform: 'android',
            thread_name: 'main',
            user_id: 'user-123',
            device_name: 'Pixel 8',
            device_model: 'Pixel 8',
            device_manufacturer: 'Google',
            device_type: 'phone',
            device_is_foldable: false,
            device_is_physical: true,
            device_density_dpi: 420,
            device_width_px: 1440,
            device_height_px: 3120,
            device_density: 2.75,
            device_locale: 'en-US',
            os_name: 'android',
            os_version: '14',
            network_type: 'cellular',
            network_provider: 'Verizon',
            network_generation: '5g',
        },
        cpu_usage: [
            { timestamp: '2026-04-10T10:00:00Z', value: 12.5 },
            { timestamp: '2026-04-10T10:00:01Z', value: 18.3 },
            { timestamp: '2026-04-10T10:00:02Z', value: 15.1 },
        ],
        memory_usage: [
            {
                java_max_heap: 262144, java_total_heap: 65536,
                java_free_heap: 58391, total_pss: 57572, rss: 135240,
                native_total_heap: 17752, native_free_heap: 1229,
                interval: 0, timestamp: '2026-04-10T10:00:00Z',
            },
        ],
        memory_usage_absolute: [
            { max_memory: 1024000, used_memory: 512000, interval: 0, timestamp: '2026-04-10T10:00:00Z' },
        ],
        duration: 330000,
        threads: {
            main: [
                {
                    event_type: 'lifecycle_activity', thread_name: 'main',
                    type: 'created', class_name: 'sh.measure.demo.MainActivity',
                    intent: '', saved_instance_state: false,
                    timestamp: '2026-04-10T10:00:00Z',
                },
            ],
        },
        traces: [
            {
                trace_id: 'trace-001', trace_name: 'activity.onCreate',
                thread_name: 'main', start_time: '2026-04-10T10:00:00Z',
                end_time: '2026-04-10T10:00:00.280Z', duration: 280,
            },
        ],
        ...overrides,
    }
}

// --- Alerts Overview (GET /apps/:appId/alerts) ---
// Go struct: assembled in handler, backend/api/measure/alert.go

// --- Spans Overview (GET /apps/:appId/spans) ---
// Go struct: assembled in handler, backend/api/measure/span.go

export function makeSpansOverviewFixture(overrides: Record<string, any> = {}) {
    return {
        meta: { next: true, previous: false },
        results: [
            {
                app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                span_name: 'checkout_full_display',
                span_id: 'span-001',
                trace_id: 'trace-001',
                status: 1, // Ok
                start_time: '2026-04-10T14:30:00Z',
                end_time: '2026-04-10T14:30:01.187Z',
                duration: 1187,
                app_version: '3.1.0',
                app_build: '310',
                os_name: 'android',
                os_version: '14',
                device_manufacturer: 'Google',
                device_model: 'Pixel 8',
            },
            {
                app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                span_name: 'api_fetch_payments',
                span_id: 'span-002',
                trace_id: 'trace-002',
                status: 2, // Error
                start_time: '2026-04-09T09:15:00Z',
                end_time: '2026-04-09T09:15:00.500Z',
                duration: 500,
                app_version: '3.0.2',
                app_build: '302',
                os_name: 'ios',
                os_version: '17',
                device_manufacturer: 'Apple',
                device_model: 'iPhone 15',
            },
        ],
        ...overrides,
    }
}

// --- Trace Detail (GET /apps/:appId/traces/:traceId) ---

export function makeTraceDetailFixture(overrides: Record<string, any> = {}) {
    return {
        app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
        trace_id: 'trace-001',
        session_id: 'sess-trace-001',
        user_id: 'user-trace-123',
        start_time: '2026-04-10T14:30:00Z',
        end_time: '2026-04-10T14:30:01.187Z',
        duration: 1187,
        app_version: '3.1.0 (310)',
        os_version: 'android 14',
        device_model: 'Pixel 8',
        device_manufacturer: 'Google',
        network_type: 'wifi',
        spans: [
            {
                span_name: 'checkout_full_display',
                span_id: 'span-root',
                parent_id: '',
                status: 0,
                start_time: '2026-04-10T14:30:00Z',
                end_time: '2026-04-10T14:30:01.187Z',
                duration: 1187,
                thread_name: 'main',
                user_defined_attributes: null,
                checkpoints: null,
            },
            {
                span_name: 'api_fetch_payments',
                span_id: 'span-child-1',
                parent_id: 'span-root',
                status: 1,
                start_time: '2026-04-10T14:30:00.100Z',
                end_time: '2026-04-10T14:30:00.850Z',
                duration: 750,
                thread_name: 'okhttp',
                user_defined_attributes: { endpoint: '/api/payments' },
                checkpoints: [
                    { name: 'request_sent', timestamp: '2026-04-10T14:30:00.120Z' },
                    { name: 'response_received', timestamp: '2026-04-10T14:30:00.840Z' },
                ],
            },
        ],
        ...overrides,
    }
}

// --- Span Metrics Plot (GET /apps/:appId/spans/plots/metrics) ---

export function makeSpanMetricsPlotFixture() {
    return [
        {
            id: 'checkout_full_display',
            data: [
                { datetime: '2026-04-01T00:00:00Z', p50: 800, p90: 1100, p95: 1200, p99: 1500 },
                { datetime: '2026-04-02T00:00:00Z', p50: 750, p90: 1050, p95: 1150, p99: 1400 },
                { datetime: '2026-04-03T00:00:00Z', p50: 820, p90: 1120, p95: 1250, p99: 1600 },
            ],
        },
    ]
}

export function makeAlertsOverviewFixture(overrides: Record<string, any> = {}) {
    return {
        meta: { next: true, previous: false },
        results: [
            {
                id: 'alert-001',
                team_id: 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
                app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                entity_id: 'crash-group-001',
                type: 'crash_spike',
                message: 'Crash rate spiked to 5.2% for NullPointerException in CheckoutActivity',
                url: '/test-team/crashes/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/crash-group-001',
                created_at: '2026-04-10T14:30:00Z',
                updated_at: '2026-04-10T14:30:00Z',
            },
            {
                id: 'alert-002',
                team_id: 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
                app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
                entity_id: 'anr-group-001',
                type: 'anr_spike',
                message: 'ANR rate increased above threshold in CartActivity',
                url: '/test-team/anrs/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/anr-group-001',
                created_at: '2026-04-09T09:15:00Z',
                updated_at: '2026-04-09T09:15:00Z',
            },
        ],
        ...overrides,
    }
}

// --- Network Domains (GET /apps/:appId/networkRequests/domains) ---

export function makeNetworkDomainsFixture() {
    return { results: ['api.example.com', 'cdn.example.com'] }
}

// --- Network Paths (GET /apps/:appId/networkRequests/paths) ---

export function makeNetworkPathsFixture() {
    return { results: ['/v1/users/*/profile', '/v1/orders', '/v2/search'] }
}

// --- Network Overview Status Codes Plot ---

export function makeNetworkOverviewStatusCodesFixture() {
    return [
        { datetime: '2026-04-01T00:00:00Z', total_count: 5000, count_2xx: 4700, count_3xx: 50, count_4xx: 150, count_5xx: 100 },
        { datetime: '2026-04-02T00:00:00Z', total_count: 5200, count_2xx: 4900, count_3xx: 60, count_4xx: 140, count_5xx: 100 },
        { datetime: '2026-04-03T00:00:00Z', total_count: 4800, count_2xx: 4500, count_3xx: 40, count_4xx: 160, count_5xx: 100 },
    ]
}

// --- Network Trends (GET /apps/:appId/networkRequests/trends) ---

export function makeNetworkTrendsFixture() {
    return {
        trends_latency: [
            { domain: 'api.example.com', path_pattern: '/v1/checkout', p95_latency: 2340, error_rate: 5.7, frequency: 8400 },
            { domain: 'api.example.com', path_pattern: '/v1/users/*', p95_latency: 1250, error_rate: 2.1, frequency: 84200 },
        ],
        trends_error_rate: [
            { domain: 'api.example.com', path_pattern: '/v1/checkout', p95_latency: 2340, error_rate: 5.7, frequency: 8400 },
            { domain: 'api.example.com', path_pattern: '/v1/users/*/profile', p95_latency: 560, error_rate: 4.3, frequency: 18900 },
        ],
        trends_frequency: [
            { domain: 'api.example.com', path_pattern: '/v1/events', p95_latency: 180, error_rate: 0.1, frequency: 245000 },
            { domain: 'api.example.com', path_pattern: '/v1/users/*', p95_latency: 1250, error_rate: 2.1, frequency: 84200 },
        ],
    }
}

// --- Network Overview Timeline (GET /apps/:appId/networkRequests/plots/overviewTimeline) ---

export function makeNetworkTimelineFixture() {
    return {
        interval: 5,
        points: [
            { elapsed: 0, domain: 'api.example.com', path_pattern: '/v1/auth/token', count: 2.5 },
            { elapsed: 5, domain: 'api.example.com', path_pattern: '/v1/auth/token', count: 1.8 },
            { elapsed: 10, domain: 'api.example.com', path_pattern: '/v1/users/*', count: 1.2 },
        ],
    }
}

// --- Network Endpoint Latency Plot ---

export function makeNetworkEndpointLatencyFixture() {
    return [
        { datetime: '2026-04-01T00:00:00Z', p50: 120, p90: 250, p95: 340, p99: 580, count: 1200 },
        { datetime: '2026-04-02T00:00:00Z', p50: 115, p90: 240, p95: 320, p99: 550, count: 1350 },
        { datetime: '2026-04-03T00:00:00Z', p50: 130, p90: 260, p95: 360, p99: 600, count: 1100 },
    ]
}

// --- Network Endpoint Status Codes Plot ---

export function makeNetworkEndpointStatusCodesFixture() {
    return {
        status_codes: [200, 201, 400, 500],
        data_points: [
            { datetime: '2026-04-01T00:00:00Z', total_count: 1200, count_200: 1000, count_201: 150, count_400: 30, count_500: 20 },
            { datetime: '2026-04-02T00:00:00Z', total_count: 1350, count_200: 1150, count_201: 140, count_400: 35, count_500: 25 },
        ],
    }
}

// --- Network Endpoint Timeline ---

// --- Authz (GET /teams/:teamId/authz) ---

export function makeAuthzFixture(overrides: Record<string, any> = {}) {
    return {
        can_create_app: true,
        can_rename_app: true,
        can_change_retention: true,
        can_rotate_api_key: true,
        can_write_sdk_config: true,
        can_change_app_threshold_prefs: true,
        ...overrides,
    }
}

// --- Billing Info (GET /teams/:teamId/billing/info) ---

export function makeBillingInfoFixture(overrides: Record<string, any> = {}) {
    return {
        team_id: 'team-001',
        plan: 'pro',
        autumn_customer_id: 'cust_test',
        bytes_granted: 0,
        bytes_used: 0,
        status: 'active',
        current_period_start: 0,
        current_period_end: 0,
        canceled_at: 0,
        ...overrides,
    }
}

// --- App Retention (GET /apps/:appId/retention) ---

export function makeAppRetentionFixture(overrides: Record<string, any> = {}) {
    return { retention: 90, ...overrides }
}

// --- SDK Config (GET /apps/:appId/config) ---

export function makeSdkConfigFixture(overrides: Record<string, any> = {}) {
    return {
        trace_sampling_rate: 50,
        crash_timeline_duration: 30,
        crash_take_screenshot: true,
        anr_timeline_duration: 30,
        anr_take_screenshot: true,
        bug_report_timeline_duration: 30,
        launch_sampling_rate: 100,
        journey_sampling_rate: 100,
        http_sampling_rate: 100,
        http_disable_event_for_urls: [],
        http_track_request_for_urls: [],
        http_track_response_for_urls: [],
        http_blocked_headers: [],
        screenshot_mask_level: 'all_text_and_media',
        ...overrides,
    }
}

// --- Teams (GET /teams) ---

export function makeTeamsFixture() {
    return [
        { id: 'team-001', name: 'Test Team' },
        { id: 'team-002', name: 'Other Team' },
    ]
}

// --- Authz + Members (GET /teams/:teamId/authz) ---

export function makeAuthzAndMembersFixture(overrides: Record<string, any> = {}) {
    return {
        can_invite_roles: ['owner', 'admin', 'viewer'],
        can_change_billing: true,
        can_create_app: true,
        can_rename_app: true,
        can_change_retention: true,
        can_rotate_api_key: true,
        can_write_sdk_config: true,
        can_rename_team: true,
        can_manage_slack: true,
        can_change_app_threshold_prefs: true,
        members: [
            {
                id: 'user-current',
                name: 'Current User',
                email: 'current@example.com',
                role: 'owner',
                last_sign_in_at: '2026-04-10T12:00:00Z',
                created_at: '2026-01-01T00:00:00Z',
                authz: {
                    current_user_assignable_roles_for_member: null,
                    current_user_can_remove_member: false,
                },
            },
            {
                id: 'user-member',
                name: 'Team Member',
                email: 'member@example.com',
                role: 'admin',
                last_sign_in_at: '2026-04-09T10:00:00Z',
                created_at: '2026-02-01T00:00:00Z',
                authz: {
                    current_user_assignable_roles_for_member: ['admin', 'viewer'],
                    current_user_can_remove_member: true,
                },
            },
        ],
        ...overrides,
    }
}

// --- Pending Invites (GET /teams/:teamId/invites) ---

export function makePendingInvitesFixture() {
    return [
        {
            id: 'invite-001',
            invited_by_user_id: 'user-current',
            invited_by_email: 'current@example.com',
            invited_to_team_id: 'team-001',
            role: 'viewer',
            email: 'pending@example.com',
            created_at: '2026-04-08T00:00:00Z',
            updated_at: '2026-04-08T00:00:00Z',
            valid_until: '2026-04-15T00:00:00Z',
        },
    ]
}

// --- Slack Connect URL (POST /auth/slack/url) ---

export function makeSlackConnectUrlFixture() {
    return { url: 'https://slack.com/oauth/v2/authorize?client_id=test' }
}

// --- Slack Status (GET /teams/:teamId/slack) ---

export function makeSlackStatusFixture(overrides: Record<string, any> = {}) {
    return { slack_team_name: 'Test Workspace', is_active: true, ...overrides }
}

// --- Notification Preferences (GET /prefs/notifPrefs) ---

// --- Usage (GET /teams/:teamId/usage) ---

export function makeUsageFixture() {
    return [
        {
            app_id: 'b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f',
            app_name: 'measure demo',
            monthly_app_usage: [
                { month_year: 'Mar 2026', sessions: 5000, events: 12000, spans: 8000, bytes_in: 1_000_000_000 },
                { month_year: 'Apr 2026', sessions: 6200, events: 15000, spans: 9500, bytes_in: 1_500_000_000 },
            ],
        },
        {
            app_id: 'c6f4e9b2-7d3e-5a0b-9f8c-2b3c4d5e6f7a',
            app_name: 'other app',
            monthly_app_usage: [
                { month_year: 'Mar 2026', sessions: 2000, events: 4000, spans: 3000, bytes_in: 500_000_000 },
                { month_year: 'Apr 2026', sessions: 2500, events: 5000, spans: 3500, bytes_in: 750_000_000 },
            ],
        },
    ]
}


export function makeNotifPrefsFixture(overrides: Record<string, any> = {}) {
    return {
        error_spike: true,
        app_hang_spike: true,
        bug_report: false,
        daily_summary: true,
        ...overrides,
    }
}

export function makeNetworkEndpointTimelineFixture() {
    return {
        interval: 5,
        points: [
            { elapsed: 0, domain: 'api.example.com', path_pattern: '/v1/users/*/profile', count: 1.5 },
            { elapsed: 5, domain: 'api.example.com', path_pattern: '/v1/users/*/profile', count: 2.0 },
        ],
    }
}
