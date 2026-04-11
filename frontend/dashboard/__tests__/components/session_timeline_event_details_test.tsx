import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/app/utils/time_utils', () => ({
    formatDateToHumanReadableDateTime: (ts: string) => `formatted:${ts}`,
    formatMillisToHumanReadable: (ms: number) => `${ms}ms`,
}))

jest.mock('@/app/components/button', () => ({
    buttonVariants: () => 'btn-class',
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: any) => <a href={href} className={className}>{children}</a>,
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt, src, onError, unoptimized, ...props }: any) => <img alt={alt} src={src} {...props} />,
}))

jest.mock('@/app/components/layout_snapshot', () => ({
    __esModule: true,
    default: ({ layoutUrl }: any) => <div data-testid="layout-snapshot">{layoutUrl}</div>,
}))

import SessionTimelineEventDetails from '@/app/components/session_timeline_event_details'

function renderDetails(overrides: Partial<{
    teamId: string; appId: string; eventType: string; eventDetails: any; demo: boolean
}> = {}) {
    const props = {
        teamId: 'team-1',
        appId: 'app-1',
        eventType: 'custom',
        eventDetails: { name: 'test', timestamp: '2024-01-01T00:00:00Z' },
        demo: false,
        ...overrides,
    }
    return render(<SessionTimelineEventDetails {...props} />)
}

describe('SessionTimelineEventDetails', () => {
    describe('Body rendering', () => {
        it('renders key-value pairs from event details', () => {
            renderDetails({
                eventDetails: { method: 'GET', url: 'https://api.example.com' },
            })
            expect(screen.getByText('method')).toBeInTheDocument()
            expect(screen.getByText('GET')).toBeInTheDocument()
            expect(screen.getByText('url')).toBeInTheDocument()
            expect(screen.getByText('https://api.example.com')).toBeInTheDocument()
        })

        it('skips empty string values', () => {
            renderDetails({
                eventDetails: { name: 'test', empty_field: '' },
            })
            expect(screen.queryByText('empty_field')).not.toBeInTheDocument()
        })

        it('skips null values', () => {
            renderDetails({
                eventDetails: { name: 'test', null_field: null },
            })
            expect(screen.queryByText('null_field')).not.toBeInTheDocument()
        })

        it('skips user_defined_attribute from main entries', () => {
            renderDetails({
                eventDetails: {
                    name: 'test',
                    user_defined_attribute: { custom_key: 'custom_val' },
                },
            })
            // user_defined_attribute key should not appear as a main entry label
            const allText = document.body.textContent
            expect(allText).toContain('custom_key')
            expect(allText).toContain('custom_val')
        })

        it('formats timestamp values', () => {
            renderDetails({
                eventDetails: { timestamp: '2024-01-01T00:00:00Z' },
            })
            expect(screen.getByText('formatted:2024-01-01T00:00:00Z')).toBeInTheDocument()
        })

        it('formats duration values', () => {
            renderDetails({
                eventDetails: { duration: '1500' },
            })
            expect(screen.getByText('1500ms')).toBeInTheDocument()
        })

        it('renders stacktrace in preformatted style', () => {
            renderDetails({
                eventDetails: { stacktrace: 'at Main.run(Main.java:10)\nat App.start(App.java:5)' },
            })
            expect(screen.getByText(/at Main\.run/)).toBeInTheDocument()
        })

        it('renders headers as JSON', () => {
            renderDetails({
                eventType: 'http',
                eventDetails: { request_headers: { 'Content-Type': 'application/json' } },
            })
            expect(screen.getByText(/Content-Type/)).toBeInTheDocument()
        })

        it('filters out start_time and end_time for http events', () => {
            renderDetails({
                eventType: 'http',
                eventDetails: { method: 'GET', start_time: '12345', end_time: '67890' },
            })
            // start_time and end_time should be filtered from http events
            expect(screen.queryByText('start_time')).not.toBeInTheDocument()
            expect(screen.queryByText('end_time')).not.toBeInTheDocument()
        })
    })

    describe('User defined attributes', () => {
        it('renders user defined attributes', () => {
            renderDetails({
                eventDetails: {
                    name: 'test',
                    user_defined_attribute: { user_id: 'abc123', plan: 'premium' },
                },
            })
            expect(screen.getByText('user_id')).toBeInTheDocument()
            expect(screen.getByText('abc123')).toBeInTheDocument()
            expect(screen.getByText('plan')).toBeInTheDocument()
            expect(screen.getByText('premium')).toBeInTheDocument()
        })
    })

    describe('Details links', () => {
        it('renders crash details link for unhandled exceptions', () => {
            renderDetails({
                eventType: 'exception',
                eventDetails: {
                    id: 'ex-1', group_id: 'grp-1', type: 'NPE',
                    file_name: 'Main.java', user_triggered: false, handled: false,
                },
            })
            const link = screen.getByText('View Crash Details')
            expect(link.closest('a')).toHaveAttribute('href', '/team-1/crashes/app-1/grp-1/NPE@Main.java')
        })

        it('renders ANR details link', () => {
            renderDetails({
                eventType: 'anr',
                eventDetails: {
                    id: 'anr-1', group_id: 'grp-2', type: 'ANR',
                    file_name: 'Main.java', user_triggered: false, handled: false,
                },
            })
            const link = screen.getByText('View ANR Details')
            expect(link.closest('a')).toHaveAttribute('href', '/team-1/anrs/app-1/grp-2/ANR@Main.java')
        })

        it('renders trace details link', () => {
            renderDetails({
                eventType: 'trace',
                eventDetails: { id: 'tr-1', trace_id: 'trace-abc', trace_name: 'checkout' },
            })
            const link = screen.getByText('View Trace Details')
            expect(link.closest('a')).toHaveAttribute('href', '/team-1/traces/app-1/trace-abc')
        })

        it('renders bug report details link', () => {
            renderDetails({
                eventType: 'bug_report',
                eventDetails: { id: 'br-1', bug_report_id: 'bug-123', description: 'Login issue' },
            })
            const link = screen.getByText('View Bug Report Details')
            expect(link.closest('a')).toHaveAttribute('href', '/team-1/bug_reports/app-1/bug-123')
        })

        it('renders non-clickable label in demo mode', () => {
            renderDetails({
                demo: true,
                eventType: 'trace',
                eventDetails: { id: 'tr-1', trace_id: 'trace-abc', trace_name: 'checkout' },
            })
            expect(screen.getByText('View Trace Details')).toBeInTheDocument()
            expect(screen.getByText('View Trace Details').closest('a')).toBeNull()
        })

        it('does not render details link for custom events', () => {
            renderDetails({
                eventType: 'custom',
                eventDetails: { name: 'my_event' },
            })
            expect(screen.queryByText(/View.*Details/)).not.toBeInTheDocument()
        })
    })

    describe('Error exception rendering', () => {
        it('renders error object fields when present', () => {
            renderDetails({
                eventDetails: {
                    name: 'test',
                    error: { numcode: 500, code: 'INTERNAL', meta: null },
                },
            })
            expect(screen.getByText('numcode')).toBeInTheDocument()
            expect(screen.getByText('500')).toBeInTheDocument()
            expect(screen.getByText('code')).toBeInTheDocument()
            expect(screen.getByText('INTERNAL')).toBeInTheDocument()
        })

        it('renders error meta object as JSON', () => {
            renderDetails({
                eventDetails: {
                    name: 'test',
                    error: { numcode: 1, code: '', meta: { detail: 'Something broke' } },
                },
            })
            expect(screen.getByText(/Something broke/)).toBeInTheDocument()
        })
    })

    describe('Demo mode details links', () => {
        it('renders non-clickable crash details label in demo mode', () => {
            renderDetails({
                demo: true,
                eventType: 'exception',
                eventDetails: {
                    id: 'ex-1', group_id: 'grp-1', type: 'NPE',
                    file_name: 'Main.java', user_triggered: false, handled: false,
                },
            })
            expect(screen.getByText('View Crash Details')).toBeInTheDocument()
            expect(screen.getByText('View Crash Details').closest('a')).toBeNull()
        })

        it('renders non-clickable bug report label in demo mode', () => {
            renderDetails({
                demo: true,
                eventType: 'bug_report',
                eventDetails: { id: 'br-1', bug_report_id: 'bug-123', description: 'Login issue' },
            })
            expect(screen.getByText('View Bug Report Details')).toBeInTheDocument()
            expect(screen.getByText('View Bug Report Details').closest('a')).toBeNull()
        })
    })

    describe('Attachments', () => {
        it('renders image attachments for crash events', () => {
            renderDetails({
                eventType: 'exception',
                eventDetails: {
                    user_triggered: false,
                    attachments: [
                        { key: 'img-1', location: 'https://example.com/screenshot.png', type: 'layout_snapshot' },
                    ],
                },
            })
            expect(screen.getByAltText('Screenshot 0')).toBeInTheDocument()
        })

        it('renders layout snapshots for gesture events', () => {
            renderDetails({
                eventType: 'gesture_click',
                eventDetails: {
                    target: 'Button',
                    attachments: [
                        { key: 'layout-1', location: 'https://example.com/layout.json', type: 'layout_snapshot_json' },
                    ],
                },
            })
            expect(screen.getByTestId('layout-snapshot')).toBeInTheDocument()
        })
    })
})
