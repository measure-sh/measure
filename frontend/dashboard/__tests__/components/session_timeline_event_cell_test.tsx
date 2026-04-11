import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/app/utils/time_utils', () => ({
    formatDateToHumanReadableDateTime: (ts: string) => `formatted:${ts}`,
}))

jest.mock('@/app/utils/string_utils', () => ({
    formatToCamelCase: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
}))

import SessionTimelineEventCell from '@/app/components/session_timeline_event_cell'

function renderCell(overrides: Partial<{
    eventType: string; eventDetails: any; threadName: string;
    timestamp: string; index: number; selected: boolean; onClick: (i: number) => void
}> = {}) {
    const props = {
        eventType: 'custom',
        eventDetails: { name: 'Test Event' },
        threadName: 'main',
        timestamp: '2024-01-01T00:00:00Z',
        index: 0,
        selected: false,
        onClick: jest.fn(),
        ...overrides,
    }
    return { ...render(<SessionTimelineEventCell {...props} />), props }
}

describe('SessionTimelineEventCell', () => {
    describe('Click handling', () => {
        it('calls onClick with index when clicked', () => {
            const onClick = jest.fn()
            renderCell({ index: 5, onClick })
            fireEvent.click(screen.getByRole('button'))
            expect(onClick).toHaveBeenCalledWith(5)
        })
    })

    describe('Selected state', () => {
        it('applies selected style when selected is true', () => {
            renderCell({ selected: true })
            expect(screen.getByRole('button').className).toContain('bg-accent')
        })

        it('applies unselected style when selected is false', () => {
            renderCell({ selected: false })
            expect(screen.getByRole('button').className).toContain('bg-background')
        })
    })

    describe('Thread and timestamp display', () => {
        it('displays thread name', () => {
            renderCell({ threadName: 'worker-1' })
            expect(screen.getByText('worker-1')).toBeInTheDocument()
        })

        it('displays formatted timestamp', () => {
            renderCell({ timestamp: '2024-01-01T00:00:00Z' })
            expect(screen.getByText('formatted:2024-01-01T00:00:00Z')).toBeInTheDocument()
        })
    })

    describe('Color coding', () => {
        it.each([
            ['exception', { type: 'NPE', user_triggered: false }, 'bg-red-300'],
            ['anr', { type: 'ANR', user_triggered: false }, 'bg-red-300'],
            ['exception', { type: 'NPE', user_triggered: true }, 'bg-orange-300'],
            ['anr', { type: 'ANR', user_triggered: true }, 'bg-orange-300'],
            ['bug_report', { description: 'Bug' }, 'bg-red-300'],
            ['gesture_click', { target: 'Button' }, 'bg-emerald-300'],
            ['gesture_long_click', { target: 'View' }, 'bg-emerald-300'],
            ['gesture_scroll', { target: 'List' }, 'bg-emerald-300'],
            ['navigation', { to: '/home' }, 'bg-fuchsia-300'],
            ['screen_view', { name: 'Home' }, 'bg-fuchsia-300'],
            ['http', { method: 'get', status_code: 200, url: '/api' }, 'bg-cyan-300'],
            ['trace', { trace_name: 'checkout' }, 'bg-pink-300'],
            ['custom', { name: 'event' }, 'bg-purple-300'],
            ['cold_launch', {}, 'bg-indigo-300'],
        ])('applies %s color correctly', (eventType, eventDetails, expectedColor) => {
            const { container } = renderCell({ eventType, eventDetails })
            const dot = container.querySelector('.rounded-full.w-2')
            expect(dot?.className).toContain(expectedColor)
        })
    })

    describe('Title generation', () => {
        it('shows type and message for exceptions', () => {
            renderCell({ eventType: 'exception', eventDetails: { type: 'NullPointerException', message: 'object is null' } })
            expect(screen.getByText('NullPointerException: object is null')).toBeInTheDocument()
        })

        it('shows type without message when message is empty', () => {
            renderCell({ eventType: 'exception', eventDetails: { type: 'NullPointerException', message: '' } })
            expect(screen.getByText('NullPointerException')).toBeInTheDocument()
        })

        it('shows bug report description', () => {
            renderCell({ eventType: 'bug_report', eventDetails: { description: 'Login broken', bug_report_id: 'br-1' } })
            expect(screen.getByText('Bug Report: Login broken')).toBeInTheDocument()
        })

        it('shows bug report id when no description', () => {
            renderCell({ eventType: 'bug_report', eventDetails: { description: '', bug_report_id: 'br-1' } })
            expect(screen.getByText('Bug Report: br-1')).toBeInTheDocument()
        })

        it('shows click with short class name', () => {
            renderCell({ eventType: 'gesture_click', eventDetails: { target: 'com.example.views.LoginButton' } })
            expect(screen.getByText('Click: LoginButton')).toBeInTheDocument()
        })

        it('shows click with simple target', () => {
            renderCell({ eventType: 'gesture_click', eventDetails: { target: 'LoginButton' } })
            expect(screen.getByText('Click: LoginButton')).toBeInTheDocument()
        })

        it('shows long click', () => {
            renderCell({ eventType: 'gesture_long_click', eventDetails: { target: 'com.example.Card' } })
            expect(screen.getByText('Long Click: Card')).toBeInTheDocument()
        })

        it('shows scroll', () => {
            renderCell({ eventType: 'gesture_scroll', eventDetails: { target: 'RecyclerView' } })
            expect(screen.getByText('Scroll: RecyclerView')).toBeInTheDocument()
        })

        it('shows HTTP method, status and URL', () => {
            renderCell({ eventType: 'http', eventDetails: { method: 'get', status_code: 200, url: 'https://api.example.com/users' } })
            expect(screen.getByText('HTTP: GET 200 https://api.example.com/users')).toBeInTheDocument()
        })

        it('shows activity lifecycle', () => {
            renderCell({ eventType: 'lifecycle_activity', eventDetails: { class_name: 'com.example.MainActivity', type: 'created' } })
            expect(screen.getByText('Activity Created: MainActivity')).toBeInTheDocument()
        })

        it('shows fragment lifecycle', () => {
            renderCell({ eventType: 'lifecycle_fragment', eventDetails: { class_name: 'com.example.HomeFragment', type: 'resumed' } })
            expect(screen.getByText('Fragment Resumed: HomeFragment')).toBeInTheDocument()
        })

        it('shows view controller lifecycle', () => {
            renderCell({ eventType: 'lifecycle_view_controller', eventDetails: { class_name: 'HomeViewController', type: 'viewDidLoad' } })
            expect(screen.getByText('HomeViewController: viewDidLoad')).toBeInTheDocument()
        })

        it('shows swift ui lifecycle', () => {
            renderCell({ eventType: 'lifecycle_swift_ui', eventDetails: { class_name: 'ContentView', type: 'onAppear' } })
            expect(screen.getByText('ContentView: onAppear')).toBeInTheDocument()
        })

        it('shows app lifecycle', () => {
            renderCell({ eventType: 'lifecycle_app', eventDetails: { type: 'background' } })
            expect(screen.getByText('App Background')).toBeInTheDocument()
        })

        it('shows app exit', () => {
            renderCell({ eventType: 'app_exit', eventDetails: { reason: 'USER_REQUEST' } })
            expect(screen.getByText('App Exit: USER_REQUEST')).toBeInTheDocument()
        })

        it('shows navigation', () => {
            renderCell({ eventType: 'navigation', eventDetails: { to: '/settings' } })
            expect(screen.getByText('Navigation: /settings')).toBeInTheDocument()
        })

        it('shows cold launch', () => {
            renderCell({ eventType: 'cold_launch', eventDetails: {} })
            expect(screen.getByText('App Cold Launch')).toBeInTheDocument()
        })

        it('shows warm launch', () => {
            renderCell({ eventType: 'warm_launch', eventDetails: {} })
            expect(screen.getByText('App Warm Launch')).toBeInTheDocument()
        })

        it('shows hot launch', () => {
            renderCell({ eventType: 'hot_launch', eventDetails: {} })
            expect(screen.getByText('App Hot Launch')).toBeInTheDocument()
        })

        it('shows low memory', () => {
            renderCell({ eventType: 'low_memory', eventDetails: {} })
            expect(screen.getByText('System: Low Memory')).toBeInTheDocument()
        })

        it('shows trim memory', () => {
            renderCell({ eventType: 'trim_memory', eventDetails: {} })
            expect(screen.getByText('System: Trim Memory')).toBeInTheDocument()
        })

        it('shows screen view', () => {
            renderCell({ eventType: 'screen_view', eventDetails: { name: 'SettingsScreen' } })
            expect(screen.getByText('Screen View: SettingsScreen')).toBeInTheDocument()
        })

        it('shows trace start', () => {
            renderCell({ eventType: 'trace', eventDetails: { trace_name: 'checkout_flow' } })
            expect(screen.getByText('Trace start: checkout_flow')).toBeInTheDocument()
        })

        it('shows custom event name', () => {
            renderCell({ eventType: 'custom', eventDetails: { name: 'purchase_completed' } })
            expect(screen.getByText('purchase_completed')).toBeInTheDocument()
        })

        it('falls back to event type for unknown types', () => {
            renderCell({ eventType: 'unknown_event', eventDetails: {} })
            expect(screen.getByText('unknown_event')).toBeInTheDocument()
        })
    })
})
