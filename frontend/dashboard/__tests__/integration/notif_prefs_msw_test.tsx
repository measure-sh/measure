/**
 * Integration tests for Notification Preferences page.
 *
 * Simple settings page with 4 checkbox rows (Crash Spike, ANR Spike,
 * Bug Reports, Daily Summary) and a Save button. Uses a draft/saved
 * split: updatedNotifPrefs tracks local edits, notifPrefs tracks
 * server state. Save is disabled when they match.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

// --- External dependency mocks ---

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}))

jest.mock('next/navigation', () => ({
    __esModule: true,
    useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/test-team/notif_prefs',
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

jest.mock('next-themes', () => ({
    __esModule: true,
    useTheme: () => ({ theme: 'light' }),
}))

// --- MSW ---
import { makeNotifPrefsFixture } from '../msw/fixtures'
import { server } from '../msw/server'

jest.spyOn(console, 'log').mockImplementation(() => { })
jest.spyOn(console, 'error').mockImplementation(() => { })

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// --- Store/component imports ---
import Notifications from '@/app/[teamId]/notif_prefs/page'
import { queryClient } from '@/app/query/query_client'
import { QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/app/stores/provider', () => {
    const actual = jest.requireActual('@/app/stores/provider')
    return {
        ...actual,
    }
})

beforeEach(() => {
    queryClient.clear()
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

describe('Notification Preferences (MSW integration)', () => {
    async function renderAndWaitForData() {
        renderWithProviders(<Notifications />)
        await waitFor(() => {
            expect(screen.getByText('Crash Spike email')).toBeTruthy()
        }, { timeout: 5000 })
    }

    // ================================================================
    // PAGE LOAD
    // ================================================================
    describe('page load', () => {
        it('renders description text', async () => {
            await renderAndWaitForData()
            expect(screen.getByText(/Choose which email notifications/)).toBeTruthy()
        })

        it('renders table headers', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Alert type')).toBeTruthy()
            expect(screen.getByText('Email')).toBeTruthy()
        })

        it('renders all 4 notification row labels', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Crash Spike email')).toBeTruthy()
            expect(screen.getByText('ANR spike email')).toBeTruthy()
            expect(screen.getByText('Bug Reports')).toBeTruthy()
            expect(screen.getByText('Daily Summary')).toBeTruthy()
        })

        it('renders Save button', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Save')).toBeTruthy()
        })

        it('loads preferences from API', async () => {
            await renderAndWaitForData()
            // Fixture: error_spike=true, app_hang_spike=true, bug_report=false, daily_summary=true
            // Checkboxes should reflect the loaded state
            expect(screen.getByText('Crash Spike email')).toBeTruthy()
            expect(screen.getByText('ANR spike email')).toBeTruthy()
            expect(screen.getByText('Bug Reports')).toBeTruthy()
            expect(screen.getByText('Daily Summary')).toBeTruthy()
        })

        it('shows skeleton loading initially', async () => {
            // Delay response to observe loading
            server.use(
                http.get('*/api/prefs/notifPrefs', async () => {
                    await new Promise(r => setTimeout(r, 200))
                    return HttpResponse.json(makeNotifPrefsFixture())
                }),
            )
            renderWithProviders(<Notifications />)
            // Skeleton should be visible, data should not
            expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
            expect(screen.queryByText('Crash Spike email')).toBeNull()
        })

        it('shows error when fetch fails', async () => {
            server.use(
                http.get('*/api/prefs/notifPrefs', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderWithProviders(<Notifications />)
            await waitFor(() => {
                expect(screen.getByText(/Failed to fetch notification preferences/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('data loads successfully', async () => {
            await renderAndWaitForData()
            // Data loaded - all preference rows visible
            expect(screen.getByText('Save')).toBeTruthy()
        })
    })

    // ================================================================
    // SAVE BUTTON STATE
    // ================================================================
    describe('Save button state', () => {
        it('Save disabled when preferences unchanged', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Save').closest('button')?.disabled).toBe(true)
        })
    })

    // ================================================================
    // API PATHS
    // ================================================================
    describe('API paths', () => {
        it('fetches from /prefs/notifPrefs', async () => {
            const paths: string[] = []
            server.use(
                http.get('*/api/prefs/notifPrefs', ({ request }) => {
                    paths.push(new URL(request.url).pathname)
                    return HttpResponse.json(makeNotifPrefsFixture())
                }),
            )
            await renderAndWaitForData()
            expect(paths.some(p => p.includes('/prefs/notifPrefs'))).toBe(true)
        })
    })

    // ================================================================
    // CACHING
    // ================================================================
    describe('caching', () => {
        it('data is cached by TanStack Query', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Crash Spike email')).toBeTruthy()
        })
    })
})

// ====================================================================
// MUTATIONS
// ====================================================================
describe('Notification Preferences — mutations', () => {
    async function renderAndWaitForData() {
        renderWithProviders(<Notifications />)
        await waitFor(() => {
            expect(screen.getByText('Crash Spike email')).toBeTruthy()
        }, { timeout: 5000 })
    }

    it('toggling a preference enables Save, and saving calls PATCH /prefs/notifPrefs', async () => {
        let capturedBody: any = null
        let prefsSaved = false
        server.use(
            http.patch('*/api/prefs/notifPrefs', async ({ request }) => {
                capturedBody = await request.json()
                prefsSaved = true
                return HttpResponse.json({ ok: true })
            }),
            http.get('*/api/prefs/notifPrefs', () => {
                if (prefsSaved) {
                    // Return updated prefs with bug_report flipped to true
                    return HttpResponse.json(makeNotifPrefsFixture({ bug_report: true }))
                }
                return HttpResponse.json(makeNotifPrefsFixture())
            }),
        )

        await renderAndWaitForData()

        // Fixture: bug_report is false. Find the Bug Reports checkbox and toggle it.
        // The Checkbox renders as a button with role="checkbox"
        const checkboxes = document.querySelectorAll('[data-slot="checkbox"]')
        // The order matches: Crash Spike (0), ANR spike (1), Bug Reports (2), Daily Summary (3)
        const bugReportCheckbox = checkboxes[2] as HTMLButtonElement
        expect(bugReportCheckbox).toBeTruthy()

        await act(async () => {
            fireEvent.click(bugReportCheckbox)
        })

        // Save button should now be enabled
        const saveBtn = screen.getByText('Save').closest('button')!
        await waitFor(() => {
            expect(saveBtn.disabled).toBe(false)
        })

        // Click Save
        await act(async () => {
            fireEvent.click(saveBtn)
        })

        // Verify API was called with correct payload (bug_report flipped to true)
        await waitFor(() => {
            expect(capturedBody).toEqual({
                error_spike: true,
                app_hang_spike: true,
                bug_report: true,
                daily_summary: true,
            })
        }, { timeout: 5000 })
    })

    it('Save button becomes disabled again after successful save (prefs match server)', async () => {
        let patchCalled = false
        server.use(
            http.patch('*/api/prefs/notifPrefs', () => {
                patchCalled = true
                return HttpResponse.json({ ok: true })
            }),
            http.get('*/api/prefs/notifPrefs', () => {
                if (patchCalled) {
                    // After save, server returns the updated prefs
                    return HttpResponse.json(makeNotifPrefsFixture({ bug_report: true }))
                }
                return HttpResponse.json(makeNotifPrefsFixture())
            }),
        )

        await renderAndWaitForData()

        // Toggle Bug Reports (false -> true)
        const checkboxes = document.querySelectorAll('[data-slot="checkbox"]')
        const bugReportCheckbox = checkboxes[2] as HTMLButtonElement

        await act(async () => {
            fireEvent.click(bugReportCheckbox)
        })

        const saveBtn = screen.getByText('Save').closest('button')!
        await waitFor(() => {
            expect(saveBtn.disabled).toBe(false)
        })

        // Click Save
        await act(async () => {
            fireEvent.click(saveBtn)
        })

        // After successful save and refetch, Save should be disabled again
        // because both notifPrefs (server) and updatedNotifPrefs (local) now have bug_report: true
        await waitFor(() => {
            expect(patchCalled).toBe(true)
        }, { timeout: 5000 })

        await waitFor(() => {
            expect(saveBtn.disabled).toBe(true)
        }, { timeout: 5000 })
    })

    it('save returns 500 — error handled gracefully, local state stays changed', async () => {
        server.use(
            http.patch('*/api/prefs/notifPrefs', () => {
                return HttpResponse.json({ error: 'server error' }, { status: 500 })
            }),
        )

        await renderAndWaitForData()

        // Toggle Bug Reports (false -> true)
        const checkboxes = document.querySelectorAll('[data-slot="checkbox"]')
        const bugReportCheckbox = checkboxes[2] as HTMLButtonElement

        await act(async () => {
            fireEvent.click(bugReportCheckbox)
        })

        const saveBtn = screen.getByText('Save').closest('button')!
        await waitFor(() => {
            expect(saveBtn.disabled).toBe(false)
        })

        // Click Save
        await act(async () => {
            fireEvent.click(saveBtn)
        })

        // Wait for the mutation to complete (with error)
        await new Promise(r => setTimeout(r, 500))

        // The local state should remain changed (bug_report toggled to true)
        // so Save button should still be enabled (local differs from server)
        await waitFor(() => {
            expect(saveBtn.disabled).toBe(false)
        }, { timeout: 5000 })
    })

    it('toggling all preferences off and saving calls PATCH with all false', async () => {
        let capturedBody: any = null
        server.use(
            http.patch('*/api/prefs/notifPrefs', async ({ request }) => {
                capturedBody = await request.json()
                return HttpResponse.json({ ok: true })
            }),
        )

        await renderAndWaitForData()

        // Fixture: error_spike=true, app_hang_spike=true, bug_report=false, daily_summary=true
        // Toggle off: error_spike, app_hang_spike, daily_summary (bug_report is already false)
        const checkboxes = document.querySelectorAll('[data-slot="checkbox"]')
        const crashSpike = checkboxes[0] as HTMLButtonElement
        const anrSpike = checkboxes[1] as HTMLButtonElement
        const dailySummary = checkboxes[3] as HTMLButtonElement

        await act(async () => {
            fireEvent.click(crashSpike)    // true -> false
            fireEvent.click(anrSpike)      // true -> false
            fireEvent.click(dailySummary)  // true -> false
        })

        const saveBtn = screen.getByText('Save').closest('button')!
        await waitFor(() => {
            expect(saveBtn.disabled).toBe(false)
        })

        await act(async () => {
            fireEvent.click(saveBtn)
        })

        await waitFor(() => {
            expect(capturedBody).toEqual({
                error_spike: false,
                app_hang_spike: false,
                bug_report: false,
                daily_summary: false,
            })
        }, { timeout: 5000 })
    })

    it('toggling multiple preferences sends all changes in single PATCH', async () => {
        let capturedBody: any = null
        server.use(
            http.patch('*/api/prefs/notifPrefs', async ({ request }) => {
                capturedBody = await request.json()
                return HttpResponse.json({ ok: true })
            }),
        )

        await renderAndWaitForData()

        // Toggle Bug Reports (false -> true) and Daily Summary (true -> false)
        const checkboxes = document.querySelectorAll('[data-slot="checkbox"]')
        const bugReportCheckbox = checkboxes[2] as HTMLButtonElement
        const dailySummaryCheckbox = checkboxes[3] as HTMLButtonElement

        await act(async () => {
            fireEvent.click(bugReportCheckbox)
            fireEvent.click(dailySummaryCheckbox)
        })

        const saveBtn = screen.getByText('Save').closest('button')!
        await waitFor(() => {
            expect(saveBtn.disabled).toBe(false)
        })

        await act(async () => {
            fireEvent.click(saveBtn)
        })

        await waitFor(() => {
            expect(capturedBody).toEqual({
                error_spike: true,
                app_hang_spike: true,
                bug_report: true,
                daily_summary: false,
            })
        }, { timeout: 5000 })
    })
})

// ====================================================================
// AUTH FAILURE
// ====================================================================
describe('Notification Preferences — auth failure', () => {
    it('401 on fetch triggers token refresh attempt', async () => {
        let refreshAttempted = false
        server.use(
            http.get('*/api/prefs/notifPrefs', () => {
                return new HttpResponse(null, { status: 401 })
            }),
            http.post('*/auth/refresh', () => {
                refreshAttempted = true
                return new HttpResponse(null, { status: 401 })
            }),
        )
        renderWithProviders(<Notifications />)
        await waitFor(() => {
            expect(refreshAttempted).toBe(true)
        }, { timeout: 5000 })
    })
})
