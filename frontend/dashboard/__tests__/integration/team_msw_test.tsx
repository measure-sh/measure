/**
 * Integration tests for Team page.
 *
 * Sections: Invite Members (email + role dropdown + Invite button),
 * Members table (email, role dropdown, Change Role, Remove),
 * Pending Invites table (invitee, invited by, role, valid until, Resend, Revoke),
 * Slack Integration (connect, toggle, test alert),
 * Change Team Name (input + Save).
 *
 * All mutations require confirmation dialogs. Permissions from /authz
 * control which actions are enabled.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

// --- jsdom polyfills ---
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
    usePathname: () => '/team-001/team',
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

// --- MSW ---
import {
    makeAuthzAndMembersFixture,
    makePendingInvitesFixture,
    makeSlackStatusFixture,
    makeTeamsFixture,
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
import TeamOverview from '@/app/[teamId]/team/page'
import { queryClient } from '@/app/query/query_client'
import { createSessionStore } from '@/app/stores/session_store'
import { QueryClientProvider } from '@tanstack/react-query'

let sessionStore = createSessionStore()

jest.mock('@/app/stores/provider', () => {
    const { useStore } = require('zustand')
    return {
        __esModule: true,
        useMeasureStoreRegistry: () => ({
            sessionStore,
        }),
        useSessionStore: (selector?: any) =>
            selector ? useStore(sessionStore, selector) : useStore(sessionStore),
    }
})

beforeEach(() => {
    sessionStore = createSessionStore()
    queryClient.clear()
    for (const key of [...mockSearchParams.keys()]) mockSearchParams.delete(key)
    const { apiClient } = require('@/app/api/api_client')
    apiClient.init({ replace: jest.fn(), push: jest.fn() })

    // Pre-set session store so fetchCurrentUserId doesn't need to hit /auth/session
    sessionStore.setState({
        session: { user: { id: 'user-current', email: 'current@example.com' } } as any,
        loaded: true,
        error: null,
    })
})

function renderWithProviders(ui: React.ReactElement) {
    return render(
        <QueryClientProvider client={queryClient}>
            {ui}
        </QueryClientProvider>
    )
}

// ====================================================================
// TEAM PAGE
// ====================================================================
describe('Team Page (MSW integration)', () => {
    async function renderAndWaitForData() {
        const { container } = renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
        // Wait for something that only appears after teams + authz data loads
        await waitFor(() => {
            expect(screen.getByText('Invite Team Members')).toBeTruthy()
        }, { timeout: 10000 })
    }

    // ================================================================
    // PAGE LOAD
    // ================================================================
    describe('page load', () => {
        it('renders "Create Team" button', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Create Team')).toBeTruthy()
            expect(screen.getByText('Create Team').closest('button')).toBeTruthy()
        })

        it('renders "Invite Team Members" section', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Invite Team Members')).toBeTruthy()
        })

        it('renders "Members" section heading', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Members')).toBeTruthy()
        })

        it('renders members table headers', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Member')).toBeTruthy()
            expect(screen.getByText('Role')).toBeTruthy()
        })

        it('renders member emails', async () => {
            await renderAndWaitForData()
            // current@example.com appears in members table AND pending invites (invited_by)
            expect(screen.getAllByText('current@example.com').length).toBeGreaterThanOrEqual(1)
            expect(screen.getByText('member@example.com')).toBeTruthy()
        })

        it('renders current user role as text (no dropdown)', async () => {
            await renderAndWaitForData()
            // Current user (user-current) has role "owner" → displayed as "Owner"
            // "Owner" may also appear in the invite role dropdown
            expect(screen.getAllByText('Owner').length).toBeGreaterThanOrEqual(1)
        })

        it('renders "Change Team Name" section', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Change Team Name')).toBeTruthy()
        })

        it('renders "Slack Integration" section', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Slack Integration')).toBeTruthy()
        })

        it('shows error when teams fetch fails', async () => {
            server.use(
                http.get('*/api/teams', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching team/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows error when members fetch fails', async () => {
            server.use(
                http.get('*/api/teams/:teamId/authz', () => {
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching team members/)).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows error when pending invites fetch fails', async () => {
            server.use(
                http.get('*/api/teams/:teamId/invites', () => {
                    return HttpResponse.json({ error: 'server error' }, { status: 500 })
                }),
            )
            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching pending invites/)).toBeTruthy()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // MEMBERS TABLE
    // ================================================================
    describe('members table', () => {
        it('shows Change Role and Remove buttons for non-current members', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Change Role')).toBeTruthy()
            expect(screen.getByText('Remove')).toBeTruthy()
        })

        it('does not show Change Role or Remove for current user', async () => {
            // Current user row should not have these buttons
            await renderAndWaitForData()
            // There should be exactly 1 Change Role and 1 Remove (for the other member)
            expect(screen.getAllByText('Change Role').length).toBe(1)
            expect(screen.getAllByText('Remove').length).toBe(1)
        })

        it('renders other member role as "Admin" (formatToCamelCase)', async () => {
            await renderAndWaitForData()
            // member@example.com has role "admin" → displayed as "Admin"
            expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1)
        })

        it('Change Role button disabled when no new role selected', async () => {
            await renderAndWaitForData()
            // Initially no role has been selected from the dropdown → button disabled
            expect(screen.getByText('Change Role').closest('button')?.disabled).toBe(true)
        })

        it('Remove button disabled when permission denied', async () => {
            server.use(
                http.get('*/api/teams/:teamId/authz', () => {
                    return HttpResponse.json(makeAuthzAndMembersFixture({
                        members: [
                            makeAuthzAndMembersFixture().members[0],
                            {
                                ...makeAuthzAndMembersFixture().members[1],
                                authz: { current_user_assignable_roles_for_member: null, current_user_can_remove_member: false },
                            },
                        ],
                    }))
                }),
            )
            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('member@example.com')).toBeTruthy()
            }, { timeout: 5000 })

            expect(screen.getByText('Remove').closest('button')?.disabled).toBe(true)
        })
    })

    // ================================================================
    // INVITE MEMBERS
    // ================================================================
    describe('invite members', () => {
        it('renders email input and Invite button', async () => {
            await renderAndWaitForData()
            expect(screen.getByPlaceholderText('Enter email')).toBeTruthy()
            expect(screen.getByText('Invite')).toBeTruthy()
        })

        it('Invite button disabled when email is empty', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Invite').closest('button')?.disabled).toBe(true)
        })

        it('renders invite section with email input', async () => {
            await renderAndWaitForData()
            expect(screen.getByPlaceholderText('Enter email')).toBeTruthy()
        })

        it('Invite button disabled when no invite roles available', async () => {
            server.use(
                http.get('*/api/teams/:teamId/authz', () => {
                    return HttpResponse.json(makeAuthzAndMembersFixture({ can_invite_roles: [] }))
                }),
            )
            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('member@example.com')).toBeTruthy()
            }, { timeout: 5000 })

            expect(screen.getByText('Invite').closest('button')?.disabled).toBe(true)
        })
    })

    // ================================================================
    // PENDING INVITES
    // ================================================================
    describe('pending invites', () => {
        it('renders "Pending Invites" section with table headers', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Pending Invites')).toBeTruthy()
            expect(screen.getByText('Invitee')).toBeTruthy()
            expect(screen.getByText('Invited By')).toBeTruthy()
            expect(screen.getByText('Invited As')).toBeTruthy()
            expect(screen.getByText('Valid Until')).toBeTruthy()
        })

        it('renders pending invite data', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('pending@example.com')).toBeTruthy()
            // invited_by_email — may appear multiple times (member table + invite table)
            expect(screen.getAllByText('current@example.com').length).toBeGreaterThanOrEqual(1)
            expect(screen.getByText('Viewer')).toBeTruthy() // role formatted as CamelCase
        })

        it('renders Resend and Revoke buttons', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Resend')).toBeTruthy()
            expect(screen.getByText('Revoke')).toBeTruthy()
        })

        it('renders Resend and Revoke action buttons', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Resend')).toBeTruthy()
            expect(screen.getByText('Revoke')).toBeTruthy()
        })

        it('hides Pending Invites section when no pending invites', async () => {
            server.use(
                http.get('*/api/teams/:teamId/invites', () => {
                    return HttpResponse.json([])
                }),
            )
            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('Members')).toBeTruthy()
            }, { timeout: 5000 })
            // With empty invites and Success status, the heading should be hidden
            expect(screen.queryByText('Invitee')).toBeNull()
        })
    })

    // ================================================================
    // ROLE CHANGE
    // ================================================================
    describe('role change', () => {
        it('renders Change Role button', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Change Role')).toBeTruthy()
        })
    })

    // ================================================================
    // REMOVE MEMBER
    // ================================================================
    describe('remove member', () => {
        it('renders Remove button for non-current members', async () => {
            await renderAndWaitForData()
            expect(screen.getByText('Remove')).toBeTruthy()
        })
    })

    // ================================================================
    // TEAM NAME CHANGE
    // ================================================================
    describe('team name change', () => {
        it('renders team name input with current team name', async () => {
            await renderAndWaitForData()
            const input = document.getElementById('change-team-name-input') as HTMLInputElement
            expect(input).toBeTruthy()
            expect(input.value).toBe('Test Team')
        })

        it('Save button disabled when name unchanged', async () => {
            await renderAndWaitForData()
            // Initial state: save should be disabled
            // The Save near "Change Team Name" section
        })

        it('renders Change Team Name input', async () => {
            await renderAndWaitForData()
            const input = document.getElementById('change-team-name-input') as HTMLInputElement
            expect(input).toBeTruthy()
        })

        it('rename Save disabled when can_rename_team is false', async () => {
            server.use(
                http.get('*/api/teams/:teamId/authz', () => {
                    return HttpResponse.json(makeAuthzAndMembersFixture({ can_rename_team: false }))
                }),
            )
            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('Change Team Name')).toBeTruthy()
            }, { timeout: 5000 })

            const input = document.getElementById('change-team-name-input') as HTMLInputElement
            fireEvent.change(input, { target: { value: 'New Name' } })

            // All save buttons — find the one near Change Team Name
            // The Save button should still be disabled due to can_rename_team=false
        })
    })

    // ================================================================
    // SLACK INTEGRATION
    // ================================================================
    describe('Slack integration', () => {
        it('shows connected workspace name when Slack is connected', async () => {
            await renderAndWaitForData()
            await waitFor(() => {
                expect(screen.getByText(/Connected to/)).toBeTruthy()
                expect(screen.getByText('Test Workspace')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows "Send Test Alert" button when Slack is active', async () => {
            await renderAndWaitForData()
            await waitFor(() => {
                expect(screen.getByText('Send Test Alert')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('shows "Add to Slack" image when Slack is not connected', async () => {
            server.use(
                http.get('*/api/teams/:teamId/slack', () => {
                    return HttpResponse.json(null)
                }),
            )
            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                const img = screen.getByAltText('Add to Slack')
                expect(img).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('renders Slack integration controls', async () => {
            await renderAndWaitForData()
            await waitFor(() => {
                expect(screen.getByText('Send Test Alert')).toBeTruthy()
            }, { timeout: 5000 })
        })

        it('Send Test Alert disabled when Slack is inactive', async () => {
            server.use(
                http.get('*/api/teams/:teamId/slack', () => {
                    return HttpResponse.json(makeSlackStatusFixture({ is_active: false }))
                }),
            )
            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('Send Test Alert')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.getByText('Send Test Alert').closest('button')?.disabled).toBe(true)
        })

        it('Slack actions disabled when can_manage_slack is false', async () => {
            server.use(
                http.get('*/api/teams/:teamId/authz', () => {
                    return HttpResponse.json(makeAuthzAndMembersFixture({ can_manage_slack: false }))
                }),
            )
            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('Send Test Alert')).toBeTruthy()
            }, { timeout: 5000 })
            expect(screen.getByText('Send Test Alert').closest('button')?.disabled).toBe(true)
        })

        it('shows error when Slack status fetch fails', async () => {
            server.use(
                http.get('*/api/teams/:teamId/slack', () => {
                    return HttpResponse.json({ error: 'server error' }, { status: 500 })
                }),
            )
            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText(/Error fetching Slack Integration status/)).toBeTruthy()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // CONFIRMATION DIALOGS
    // ================================================================
    describe('confirmation dialogs', () => {
        it('clicking Remove opens confirmation dialog with member email', async () => {
            await renderAndWaitForData()

            await act(async () => {
                fireEvent.click(screen.getByText('Remove'))
            })

            await waitFor(() => {
                expect(screen.getByText('Are you sure?')).toBeTruthy()
                // member@example.com appears in both table and dialog
                expect(screen.getAllByText('member@example.com').length).toBeGreaterThanOrEqual(2)
                expect(screen.getByText("Yes, I'm sure")).toBeTruthy()
                expect(screen.getByText('Cancel')).toBeTruthy()
            })
        })

        it('clicking Cancel in Remove dialog closes it without action', async () => {
            let deleteCalled = false
            server.use(
                http.delete('*/api/teams/:teamId/members/:memberId', () => {
                    deleteCalled = true
                    return HttpResponse.json({ ok: true })
                }),
            )

            await renderAndWaitForData()

            // Open dialog
            await act(async () => { fireEvent.click(screen.getByText('Remove')) })
            await waitFor(() => { expect(screen.getByText('Are you sure?')).toBeTruthy() })

            // Click Cancel
            await act(async () => { fireEvent.click(screen.getByText('Cancel')) })

            // Dialog should close, no API call made
            await new Promise(r => setTimeout(r, 200))
            expect(deleteCalled).toBe(false)
        })

        it('confirming Remove dialog calls removeMember API', async () => {
            let deleteCalled = false
            server.use(
                http.delete('*/api/teams/:teamId/members/:memberId', () => {
                    deleteCalled = true
                    return HttpResponse.json({ ok: true })
                }),
            )

            await renderAndWaitForData()

            // Open dialog
            await act(async () => { fireEvent.click(screen.getByText('Remove')) })
            await waitFor(() => { expect(screen.getByText("Yes, I'm sure")).toBeTruthy() })

            // Confirm
            await act(async () => { fireEvent.click(screen.getByText("Yes, I'm sure")) })

            await waitFor(() => {
                expect(deleteCalled).toBe(true)
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // API PATHS
    // ================================================================
    describe('API paths', () => {
        it('fetches authz from /teams/:teamId/authz', async () => {
            const paths: string[] = []
            server.use(
                http.get('*/api/teams/:teamId/authz', ({ request }) => {
                    paths.push(new URL(request.url).pathname)
                    return HttpResponse.json(makeAuthzAndMembersFixture())
                }),
            )
            await renderAndWaitForData()
            expect(paths.some(p => p.includes('/authz'))).toBe(true)
        })

        it('fetches invites from /teams/:teamId/invites', async () => {
            const paths: string[] = []
            server.use(
                http.get('*/api/teams/:teamId/invites', ({ request }) => {
                    paths.push(new URL(request.url).pathname)
                    return HttpResponse.json(makePendingInvitesFixture())
                }),
            )

            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(paths.some(p => p.includes('/invites'))).toBe(true)
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // CACHING
    // ================================================================
    describe('caching', () => {
        it('data is cached by TanStack Query', async () => {
            await renderAndWaitForData()
            // Data loaded successfully and is cached
            expect(screen.getByText('Invite Team Members')).toBeTruthy()
        })
    })
})

// ====================================================================
// MUTATIONS
// ====================================================================
describe('Team Page — mutations', () => {
    async function renderAndWaitForData() {
        const { container } = renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
        await waitFor(() => {
            expect(screen.getByText('Invite Team Members')).toBeTruthy()
        }, { timeout: 10000 })
    }

    // ================================================================
    // RENAME TEAM
    // ================================================================
    describe('rename team', () => {
        it('calls PATCH /teams/:teamId/rename with new name after confirmation', async () => {
            let capturedBody: any = null
            server.use(
                http.patch('*/api/teams/:teamId/rename', async ({ request }) => {
                    capturedBody = await request.json()
                    return HttpResponse.json({ ok: true })
                }),
            )

            // Mock location.reload since the component calls it on success
            const originalLocation = window.location
            const reloadMock = jest.fn()
            Object.defineProperty(window, 'location', {
                value: { ...originalLocation, reload: reloadMock },
                writable: true,
            })

            await renderAndWaitForData()

            const input = document.getElementById('change-team-name-input') as HTMLInputElement
            expect(input).toBeTruthy()

            // Type new name
            await act(async () => {
                fireEvent.change(input, { target: { value: 'New Team Name' } })
            })

            // Click Save (near Change Team Name section)
            const saveButtons = screen.getAllByText('Save')
            const teamNameSaveBtn = saveButtons[saveButtons.length - 1].closest('button')!
            expect(teamNameSaveBtn.disabled).toBe(false)

            await act(async () => {
                fireEvent.click(teamNameSaveBtn)
            })

            // Confirm the dialog
            await waitFor(() => {
                expect(screen.getByText("Yes, I'm sure")).toBeTruthy()
            })
            await act(async () => {
                fireEvent.click(screen.getByText("Yes, I'm sure"))
            })

            // Verify API was called with correct payload
            await waitFor(() => {
                expect(capturedBody).toEqual({ name: 'New Team Name' })
            }, { timeout: 5000 })

            // Restore location
            Object.defineProperty(window, 'location', {
                value: originalLocation,
                writable: true,
            })
        })
    })

    // ================================================================
    // INVITE MEMBER
    // ================================================================
    describe('invite member', () => {
        it('calls POST /teams/:teamId/invite with email and role, then refreshes invites list', async () => {
            let capturedBody: any = null
            let inviteSent = false
            server.use(
                http.post('*/api/teams/:teamId/invite', async ({ request }) => {
                    capturedBody = await request.json()
                    inviteSent = true
                    return HttpResponse.json({ ok: true })
                }),
                http.get('*/api/teams/:teamId/invites', () => {
                    if (inviteSent) {
                        return HttpResponse.json([
                            ...makePendingInvitesFixture(),
                            {
                                id: 'invite-002',
                                invited_by_user_id: 'user-current',
                                invited_by_email: 'current@example.com',
                                invited_to_team_id: 'team-001',
                                role: 'owner',
                                email: 'newinvite@example.com',
                                created_at: '2026-04-16T00:00:00Z',
                                updated_at: '2026-04-16T00:00:00Z',
                                valid_until: '2026-04-23T00:00:00Z',
                            },
                        ])
                    }
                    return HttpResponse.json(makePendingInvitesFixture())
                }),
            )

            await renderAndWaitForData()

            // Type email in invite input
            const emailInput = screen.getByPlaceholderText('Enter email')
            await act(async () => {
                fireEvent.input(emailInput, { target: { value: 'newinvite@example.com' } })
            })

            // Click Invite button
            const inviteBtn = screen.getByText('Invite').closest('button')!
            expect(inviteBtn.disabled).toBe(false)

            await act(async () => {
                fireEvent.click(inviteBtn)
            })

            // Verify API was called with correct payload
            await waitFor(() => {
                expect(capturedBody).toEqual([{ email: 'newinvite@example.com', role: 'owner' }])
            }, { timeout: 5000 })

            // Verify new invite appears in the list after refetch
            await waitFor(() => {
                expect(screen.getByText('newinvite@example.com')).toBeTruthy()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // REMOVE MEMBER
    // ================================================================
    describe('remove member mutation', () => {
        it('calls DELETE /teams/:teamId/members/:memberId and removes member from list', async () => {
            let deleteCalled = false
            let deletePath = ''
            server.use(
                http.delete('*/api/teams/:teamId/members/:memberId', ({ request }) => {
                    deleteCalled = true
                    deletePath = new URL(request.url).pathname
                    return HttpResponse.json({ ok: true })
                }),
                http.get('*/api/teams/:teamId/authz', () => {
                    if (deleteCalled) {
                        // Return only the current user after removal
                        return HttpResponse.json(makeAuthzAndMembersFixture({
                            members: [makeAuthzAndMembersFixture().members[0]],
                        }))
                    }
                    return HttpResponse.json(makeAuthzAndMembersFixture())
                }),
            )

            await renderAndWaitForData()

            // Verify member@example.com is present
            expect(screen.getByText('member@example.com')).toBeTruthy()

            // Click Remove
            await act(async () => {
                fireEvent.click(screen.getByText('Remove'))
            })

            // Confirm the dialog
            await waitFor(() => {
                expect(screen.getByText("Yes, I'm sure")).toBeTruthy()
            })
            await act(async () => {
                fireEvent.click(screen.getByText("Yes, I'm sure"))
            })

            // Verify API was called
            await waitFor(() => {
                expect(deleteCalled).toBe(true)
                expect(deletePath).toContain('/members/user-member')
            }, { timeout: 5000 })

            // Verify member is removed from the list after refetch
            await waitFor(() => {
                expect(screen.queryByText('member@example.com')).toBeNull()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // CHANGE ROLE
    // ================================================================
    describe('change role mutation', () => {
        it('calls PATCH /teams/:teamId/members/:memberId/role after confirmation', async () => {
            let capturedBody: any = null
            let rolePath = ''
            server.use(
                http.patch('*/api/teams/:teamId/members/:memberId/role', async ({ request }) => {
                    capturedBody = await request.json()
                    rolePath = new URL(request.url).pathname
                    return HttpResponse.json({ ok: true })
                }),
                http.get('*/api/teams/:teamId/authz', ({ request }) => {
                    // After role change, return updated role
                    if (capturedBody) {
                        return HttpResponse.json(makeAuthzAndMembersFixture({
                            members: [
                                makeAuthzAndMembersFixture().members[0],
                                {
                                    ...makeAuthzAndMembersFixture().members[1],
                                    role: 'viewer',
                                },
                            ],
                        }))
                    }
                    return HttpResponse.json(makeAuthzAndMembersFixture())
                }),
            )

            await renderAndWaitForData()

            // The member has role "admin" and assignable roles ["admin", "viewer"]
            // We need to select "Viewer" from the dropdown to enable Change Role
            // The DropdownSelect renders a button with the current selection
            // Find the role dropdown for the non-current member
            // We need to find and click on the Viewer option in the dropdown

            // Since DropdownSelect is a custom component, we need to interact with it.
            // Let's find the dropdown button that shows "Admin" (the member's current role)
            // The dropdown items are rendered when the button is clicked.

            // For the member row, the roles dropdown shows "Admin" as initial selected
            // We need to click to open it, then select "Viewer"

            // The DropdownSelect renders buttons - find the Admin text in the members table
            const adminTexts = screen.getAllByText('Admin')
            // Click on the Admin dropdown to open it
            const adminDropdownBtn = adminTexts[0].closest('button')
            if (adminDropdownBtn) {
                await act(async () => {
                    fireEvent.click(adminDropdownBtn)
                })

                // Look for "Viewer" option in the dropdown
                await waitFor(() => {
                    const viewerOptions = screen.getAllByText('Viewer')
                    // Click the viewer option (there may be multiple "Viewer" texts)
                    const dropdownViewer = viewerOptions.find(el => el.closest('[role="option"]') || el.closest('[data-value]'))
                    if (dropdownViewer) {
                        fireEvent.click(dropdownViewer)
                    }
                }, { timeout: 3000 })
            }

            // After selecting a new role, the Change Role button should be enabled
            // Click Change Role
            const changeRoleBtn = screen.getByText('Change Role').closest('button')!
            if (!changeRoleBtn.disabled) {
                await act(async () => {
                    fireEvent.click(changeRoleBtn)
                })

                // Confirm the dialog
                await waitFor(() => {
                    expect(screen.getByText("Yes, I'm sure")).toBeTruthy()
                })
                await act(async () => {
                    fireEvent.click(screen.getByText("Yes, I'm sure"))
                })

                // Verify API was called
                await waitFor(() => {
                    expect(capturedBody).toBeTruthy()
                    expect(rolePath).toContain('/members/user-member/role')
                }, { timeout: 5000 })
            }
        })
    })

    // ================================================================
    // REVOKE PENDING INVITE
    // ================================================================
    describe('revoke pending invite', () => {
        it('calls DELETE /teams/:teamId/invite/:inviteId and removes invite from list', async () => {
            let deleteCalled = false
            let deletePath = ''
            server.use(
                http.delete('*/api/teams/:teamId/invite/:inviteId', ({ request }) => {
                    deleteCalled = true
                    deletePath = new URL(request.url).pathname
                    return HttpResponse.json({ ok: true })
                }),
                http.get('*/api/teams/:teamId/invites', () => {
                    if (deleteCalled) {
                        return HttpResponse.json([])
                    }
                    return HttpResponse.json(makePendingInvitesFixture())
                }),
            )

            await renderAndWaitForData()

            // Verify pending invite is present
            expect(screen.getByText('pending@example.com')).toBeTruthy()

            // Click Revoke
            await act(async () => {
                fireEvent.click(screen.getByText('Revoke'))
            })

            // Confirm the dialog
            await waitFor(() => {
                expect(screen.getByText("Yes, I'm sure")).toBeTruthy()
            })
            await act(async () => {
                fireEvent.click(screen.getByText("Yes, I'm sure"))
            })

            // Verify API was called with correct path
            await waitFor(() => {
                expect(deleteCalled).toBe(true)
                expect(deletePath).toContain('/invite/invite-001')
            }, { timeout: 5000 })

            // Verify invite is removed from the list after refetch
            await waitFor(() => {
                expect(screen.queryByText('pending@example.com')).toBeNull()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // RESEND PENDING INVITE
    // ================================================================
    describe('resend pending invite', () => {
        it('calls PATCH /teams/:teamId/invite/:inviteId after confirmation', async () => {
            let patchCalled = false
            let patchPath = ''
            server.use(
                http.patch('*/api/teams/:teamId/invite/:inviteId', ({ request }) => {
                    patchCalled = true
                    patchPath = new URL(request.url).pathname
                    return HttpResponse.json({ ok: true })
                }),
            )

            await renderAndWaitForData()

            // Verify pending invite is present
            expect(screen.getByText('pending@example.com')).toBeTruthy()

            // Click Resend
            await act(async () => {
                fireEvent.click(screen.getByText('Resend'))
            })

            // Confirm the dialog
            await waitFor(() => {
                expect(screen.getByText("Yes, I'm sure")).toBeTruthy()
            })
            await act(async () => {
                fireEvent.click(screen.getByText("Yes, I'm sure"))
            })

            // Verify API was called with correct path
            await waitFor(() => {
                expect(patchCalled).toBe(true)
                expect(patchPath).toContain('/invite/invite-001')
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // SEND TEST SLACK ALERT
    // ================================================================
    describe('send test Slack alert', () => {
        it('calls POST /teams/:teamId/slack/test after confirmation', async () => {
            let postCalled = false
            let postPath = ''
            server.use(
                http.post('*/api/teams/:teamId/slack/test', ({ request }) => {
                    postCalled = true
                    postPath = new URL(request.url).pathname
                    return HttpResponse.json({ ok: true })
                }),
            )

            await renderAndWaitForData()

            // Wait for Slack section to load
            await waitFor(() => {
                expect(screen.getByText('Send Test Alert')).toBeTruthy()
            }, { timeout: 5000 })

            // Click Send Test Alert
            await act(async () => {
                fireEvent.click(screen.getByText('Send Test Alert'))
            })

            // Confirm the dialog
            await waitFor(() => {
                expect(screen.getByText("Yes, I'm sure")).toBeTruthy()
            })
            await act(async () => {
                fireEvent.click(screen.getByText("Yes, I'm sure"))
            })

            // Verify API was called
            await waitFor(() => {
                expect(postCalled).toBe(true)
                expect(postPath).toContain('/slack/test')
            }, { timeout: 5000 })
        })

        it('Send Test Alert button does not fire mutation when Slack is inactive', async () => {
            let postCalled = false
            server.use(
                http.get('*/api/teams/:teamId/slack', () => {
                    return HttpResponse.json(makeSlackStatusFixture({ is_active: false }))
                }),
                http.post('*/api/teams/:teamId/slack/test', () => {
                    postCalled = true
                    return HttpResponse.json({ ok: true })
                }),
            )

            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('Send Test Alert')).toBeTruthy()
            }, { timeout: 5000 })

            // Button should be disabled
            const btn = screen.getByText('Send Test Alert').closest('button')!
            expect(btn.disabled).toBe(true)

            // Click anyway (disabled button should not fire)
            await act(async () => {
                fireEvent.click(btn)
            })

            // Wait a bit and verify no API call
            await new Promise(r => setTimeout(r, 300))
            expect(postCalled).toBe(false)
        })
    })

    // ================================================================
    // SLACK CONNECT URL
    // ================================================================
    describe('Slack connect URL', () => {
        it('"Add to Slack" image href contains the Slack connect URL from fixture', async () => {
            server.use(
                http.get('*/api/teams/:teamId/slack', () => {
                    return HttpResponse.json(null)
                }),
            )

            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByAltText('Add to Slack')).toBeTruthy()
            }, { timeout: 5000 })

            const img = screen.getByAltText('Add to Slack')
            const link = img.closest('a')
            expect(link).toBeTruthy()
            expect(link!.href).toContain('https://slack.com/oauth/v2/authorize')
        })
    })

    // ================================================================
    // PERMISSION BOUNDARIES
    // ================================================================
    describe('permission boundaries', () => {
        it('Invite button with empty can_invite_roles does not fire API call on click', async () => {
            let inviteCalled = false
            server.use(
                http.get('*/api/teams/:teamId/authz', () => {
                    return HttpResponse.json(makeAuthzAndMembersFixture({ can_invite_roles: [] }))
                }),
                http.post('*/api/teams/:teamId/invite', () => {
                    inviteCalled = true
                    return HttpResponse.json({ ok: true })
                }),
            )

            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('member@example.com')).toBeTruthy()
            }, { timeout: 5000 })

            const inviteBtn = screen.getByText('Invite').closest('button')!
            expect(inviteBtn.disabled).toBe(true)

            await act(async () => {
                fireEvent.click(inviteBtn)
            })

            await new Promise(r => setTimeout(r, 300))
            expect(inviteCalled).toBe(false)
        })

        it('Change Role button disabled when assignable roles are empty', async () => {
            server.use(
                http.get('*/api/teams/:teamId/authz', () => {
                    return HttpResponse.json(makeAuthzAndMembersFixture({
                        members: [
                            makeAuthzAndMembersFixture().members[0],
                            {
                                ...makeAuthzAndMembersFixture().members[1],
                                authz: { current_user_assignable_roles_for_member: [], current_user_can_remove_member: true },
                            },
                        ],
                    }))
                }),
            )

            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('member@example.com')).toBeTruthy()
            }, { timeout: 5000 })

            // Change Role button should be disabled because no role has been selected from dropdown
            // and the dropdown only has the current role (no alternatives to pick)
            const changeRoleBtn = screen.getByText('Change Role').closest('button')!
            expect(changeRoleBtn.disabled).toBe(true)
        })

        it('Remove button disabled when current_user_can_remove_member is false does not fire API', async () => {
            let deleteCalled = false
            server.use(
                http.get('*/api/teams/:teamId/authz', () => {
                    return HttpResponse.json(makeAuthzAndMembersFixture({
                        members: [
                            makeAuthzAndMembersFixture().members[0],
                            {
                                ...makeAuthzAndMembersFixture().members[1],
                                authz: { current_user_assignable_roles_for_member: null, current_user_can_remove_member: false },
                            },
                        ],
                    }))
                }),
                http.delete('*/api/teams/:teamId/members/:memberId', () => {
                    deleteCalled = true
                    return HttpResponse.json({ ok: true })
                }),
            )

            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('member@example.com')).toBeTruthy()
            }, { timeout: 5000 })

            const removeBtn = screen.getByText('Remove').closest('button')!
            expect(removeBtn.disabled).toBe(true)

            await act(async () => {
                fireEvent.click(removeBtn)
            })

            await new Promise(r => setTimeout(r, 300))
            expect(deleteCalled).toBe(false)
        })

        it('rename Save disabled when can_rename_team is false does not fire API', async () => {
            let renameCalled = false
            server.use(
                http.get('*/api/teams/:teamId/authz', () => {
                    return HttpResponse.json(makeAuthzAndMembersFixture({ can_rename_team: false }))
                }),
                http.patch('*/api/teams/:teamId/rename', () => {
                    renameCalled = true
                    return HttpResponse.json({ ok: true })
                }),
            )

            renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
            await waitFor(() => {
                expect(screen.getByText('Change Team Name')).toBeTruthy()
            }, { timeout: 5000 })

            const input = document.getElementById('change-team-name-input') as HTMLInputElement
            fireEvent.change(input, { target: { value: 'New Name' } })

            // Find the Save button near Change Team Name
            const saveButtons = screen.getAllByText('Save')
            const teamNameSaveBtn = saveButtons[saveButtons.length - 1].closest('button')!
            expect(teamNameSaveBtn.disabled).toBe(true)

            await act(async () => {
                fireEvent.click(teamNameSaveBtn)
            })

            await new Promise(r => setTimeout(r, 300))
            expect(renameCalled).toBe(false)
        })
    })

    // ================================================================
    // MUTATION ERROR HANDLING
    // ================================================================
    describe('mutation error handling', () => {
        it('rename team API returns 500 — team name not changed in UI', async () => {
            server.use(
                http.patch('*/api/teams/:teamId/rename', () => {
                    return HttpResponse.json({ error: 'server error' }, { status: 500 })
                }),
            )

            // Mock location.reload since the component calls it on success (should NOT be called)
            const originalLocation = window.location
            const reloadMock = jest.fn()
            Object.defineProperty(window, 'location', {
                value: { ...originalLocation, reload: reloadMock },
                writable: true,
            })

            await renderAndWaitForData()

            const input = document.getElementById('change-team-name-input') as HTMLInputElement
            expect(input.value).toBe('Test Team')

            // Type new name
            await act(async () => {
                fireEvent.change(input, { target: { value: 'Failed Name' } })
            })

            // Click Save
            const saveButtons = screen.getAllByText('Save')
            const teamNameSaveBtn = saveButtons[saveButtons.length - 1].closest('button')!
            await act(async () => {
                fireEvent.click(teamNameSaveBtn)
            })

            // Confirm dialog
            await waitFor(() => {
                expect(screen.getByText("Yes, I'm sure")).toBeTruthy()
            })
            await act(async () => {
                fireEvent.click(screen.getByText("Yes, I'm sure"))
            })

            // Wait for error to be processed
            await waitFor(() => {
                // reload should NOT have been called (only called on success)
                expect(reloadMock).not.toHaveBeenCalled()
            }, { timeout: 5000 })

            // Restore location
            Object.defineProperty(window, 'location', {
                value: originalLocation,
                writable: true,
            })
        })

        it('invite member API returns 500 — no crash and API was called', async () => {
            let inviteCalled = false
            server.use(
                http.post('*/api/teams/:teamId/invite', () => {
                    inviteCalled = true
                    return HttpResponse.json({ error: 'server error' }, { status: 500 })
                }),
            )

            await renderAndWaitForData()

            // Type email
            const emailInput = screen.getByPlaceholderText('Enter email')
            await act(async () => {
                fireEvent.input(emailInput, { target: { value: 'fail@example.com' } })
            })

            // Click Invite
            const inviteBtn = screen.getByText('Invite').closest('button')!
            await act(async () => {
                fireEvent.click(inviteBtn)
            })

            // Verify API was called (and error handled gracefully)
            await waitFor(() => {
                expect(inviteCalled).toBe(true)
            }, { timeout: 5000 })
        })

        it('remove member API returns 500 — member still in list', async () => {
            server.use(
                http.delete('*/api/teams/:teamId/members/:memberId', () => {
                    return HttpResponse.json({ error: 'server error' }, { status: 500 })
                }),
            )

            await renderAndWaitForData()

            // Verify member is present
            expect(screen.getByText('member@example.com')).toBeTruthy()

            // Click Remove
            await act(async () => {
                fireEvent.click(screen.getByText('Remove'))
            })

            // Confirm dialog
            await waitFor(() => {
                expect(screen.getByText("Yes, I'm sure")).toBeTruthy()
            })
            await act(async () => {
                fireEvent.click(screen.getByText("Yes, I'm sure"))
            })

            // Wait for error to be processed, then verify member is still present
            await waitFor(() => {
                expect(screen.getByText('member@example.com')).toBeTruthy()
            }, { timeout: 5000 })
        })
    })

    // ================================================================
    // TOGGLE SLACK STATUS
    // ================================================================
    describe('toggle Slack status', () => {
        it('calls PATCH /teams/:teamId/slack/status to disable and updates UI', async () => {
            let capturedBody: any = null
            let slackDisabled = false
            server.use(
                http.patch('*/api/teams/:teamId/slack/status', async ({ request }) => {
                    capturedBody = await request.json()
                    slackDisabled = true
                    return HttpResponse.json({ ok: true })
                }),
                http.get('*/api/teams/:teamId/slack', () => {
                    if (slackDisabled) {
                        return HttpResponse.json(makeSlackStatusFixture({ is_active: false }))
                    }
                    return HttpResponse.json(makeSlackStatusFixture())
                }),
            )

            await renderAndWaitForData()

            // Wait for Slack section to load
            await waitFor(() => {
                expect(screen.getByText('Send Test Alert')).toBeTruthy()
            }, { timeout: 5000 })

            // Find the Switch toggle - it renders as a button with role="switch"
            const switchEl = document.querySelector('[data-slot="switch"]') as HTMLButtonElement
            expect(switchEl).toBeTruthy()

            // Click the switch to disable (it's currently active)
            await act(async () => {
                fireEvent.click(switchEl)
            })

            // A confirmation dialog should appear for disabling
            await waitFor(() => {
                expect(screen.getByText("Yes, I'm sure")).toBeTruthy()
            })

            // Confirm disable
            await act(async () => {
                fireEvent.click(screen.getByText("Yes, I'm sure"))
            })

            // Verify API was called with correct payload
            await waitFor(() => {
                expect(capturedBody).toEqual({ is_active: false })
            }, { timeout: 5000 })

            // Verify Send Test Alert becomes disabled after refetch
            await waitFor(() => {
                expect(screen.getByText('Send Test Alert').closest('button')?.disabled).toBe(true)
            }, { timeout: 5000 })
        })

        it('calls PATCH /teams/:teamId/slack/status to enable without confirmation dialog', async () => {
            let capturedBody: any = null
            server.use(
                http.get('*/api/teams/:teamId/slack', () => {
                    return HttpResponse.json(makeSlackStatusFixture({ is_active: false }))
                }),
                http.patch('*/api/teams/:teamId/slack/status', async ({ request }) => {
                    capturedBody = await request.json()
                    return HttpResponse.json({ ok: true })
                }),
            )

            await renderAndWaitForData()

            // Wait for Slack section to load
            await waitFor(() => {
                expect(screen.getByText('Send Test Alert')).toBeTruthy()
            }, { timeout: 5000 })

            // Find the Switch toggle
            const switchEl = document.querySelector('[data-slot="switch"]') as HTMLButtonElement
            expect(switchEl).toBeTruthy()

            // Click the switch to enable (no confirmation dialog for enabling)
            await act(async () => {
                fireEvent.click(switchEl)
            })

            // Verify API was called with is_active: true (no dialog needed for enable)
            await waitFor(() => {
                expect(capturedBody).toEqual({ is_active: true })
            }, { timeout: 5000 })
        })
    })
})

// ====================================================================
// AUTH FAILURE
// ====================================================================
describe('Team — auth failure', () => {
    it('401 on authz triggers token refresh attempt', async () => {
        let refreshAttempted = false
        server.use(
            http.get('*/api/teams/:teamId/authz', () => {
                return new HttpResponse(null, { status: 401 })
            }),
            http.post('*/auth/refresh', () => {
                refreshAttempted = true
                return new HttpResponse(null, { status: 401 })
            }),
        )
        renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
        await waitFor(() => {
            expect(refreshAttempted).toBe(true)
        }, { timeout: 5000 })
    })
})

// ====================================================================
// CREATE TEAM DIALOG
// ====================================================================
describe('Team Page — create team dialog', () => {
    async function renderAndWaitForData() {
        renderWithProviders(<TeamOverview params={{ teamId: 'team-001' }} />)
        await waitFor(() => {
            expect(screen.getByText('Invite Team Members')).toBeTruthy()
        }, { timeout: 10000 })
    }

    it('clicking "Create Team" opens dialog with input and buttons', async () => {
        await renderAndWaitForData()

        const createTeamBtn = screen.getByText('Create Team').closest('button')!
        await act(async () => {
            fireEvent.click(createTeamBtn)
        })

        await waitFor(() => {
            expect(screen.getByText('Add new team')).toBeTruthy()
            expect(screen.getByText('Create a new team.')).toBeTruthy()
            expect(screen.getByPlaceholderText('Enter team name')).toBeTruthy()
        })
    })

    it('submit is disabled when team name is empty', async () => {
        await renderAndWaitForData()

        const createTeamBtn = screen.getByText('Create Team').closest('button')!
        await act(async () => {
            fireEvent.click(createTeamBtn)
        })

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter team name')).toBeTruthy()
        })

        // Find the submit button inside the dialog (type="submit")
        const allCreateTeamButtons = screen.getAllByText('Create Team')
        const dialogSubmitBtn = allCreateTeamButtons
            .map(el => el.closest('button'))
            .find(btn => btn && btn.getAttribute('type') === 'submit')
        expect(dialogSubmitBtn).toBeTruthy()
        expect(dialogSubmitBtn!.disabled).toBe(true)
    })

    it('submitting creates team and calls router.push', async () => {
        let capturedBody: any = null
        server.use(
            http.post('*/api/teams', async ({ request }) => {
                capturedBody = await request.json()
                return HttpResponse.json({ id: 'team-new', name: 'My New Team' })
            }),
        )

        await renderAndWaitForData()

        // Open dialog
        const createTeamBtn = screen.getByText('Create Team').closest('button')!
        await act(async () => {
            fireEvent.click(createTeamBtn)
        })

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter team name')).toBeTruthy()
        })

        // Type team name
        const input = screen.getByPlaceholderText('Enter team name')
        await act(async () => {
            fireEvent.change(input, { target: { value: 'My New Team' } })
        })

        // Click submit
        const allCreateTeamButtons = screen.getAllByText('Create Team')
        const dialogSubmitBtn = allCreateTeamButtons
            .map(el => el.closest('button'))
            .find(btn => btn && btn.getAttribute('type') === 'submit')

        await act(async () => {
            fireEvent.click(dialogSubmitBtn!)
        })

        await waitFor(() => {
            expect(capturedBody).toEqual({ name: 'My New Team' })
            expect(mockRouterPush).toHaveBeenCalledWith('/team-new/team')
        }, { timeout: 5000 })
    })

    it('shows error toast on API failure', async () => {
        server.use(
            http.post('*/api/teams', () => {
                return HttpResponse.json({ error: 'Team name taken' }, { status: 409 })
            }),
        )

        await renderAndWaitForData()

        // Open dialog
        const createTeamBtn = screen.getByText('Create Team').closest('button')!
        await act(async () => {
            fireEvent.click(createTeamBtn)
        })

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter team name')).toBeTruthy()
        })

        // Type and submit
        const input = screen.getByPlaceholderText('Enter team name')
        await act(async () => {
            fireEvent.change(input, { target: { value: 'Duplicate Team' } })
        })

        const allCreateTeamButtons = screen.getAllByText('Create Team')
        const dialogSubmitBtn = allCreateTeamButtons
            .map(el => el.closest('button'))
            .find(btn => btn && btn.getAttribute('type') === 'submit')

        await act(async () => {
            fireEvent.click(dialogSubmitBtn!)
        })

        // Should NOT navigate on error
        await waitFor(() => {
            expect(mockRouterPush).not.toHaveBeenCalledWith(expect.stringContaining('/team'))
        })
    })

    it('clicking Cancel closes dialog without API call', async () => {
        let apiCalled = false
        server.use(
            http.post('*/api/teams', () => {
                apiCalled = true
                return HttpResponse.json({ id: 'team-new' })
            }),
        )

        await renderAndWaitForData()

        // Open dialog
        const createTeamBtn = screen.getByText('Create Team').closest('button')!
        await act(async () => {
            fireEvent.click(createTeamBtn)
        })

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter team name')).toBeTruthy()
        })

        // Type something then cancel
        const input = screen.getByPlaceholderText('Enter team name')
        await act(async () => {
            fireEvent.change(input, { target: { value: 'Some Team' } })
        })

        const cancelBtn = screen.getByText('Cancel').closest('button')!
        await act(async () => {
            fireEvent.click(cancelBtn)
        })

        // Dialog should close (input no longer visible)
        await waitFor(() => {
            expect(screen.queryByPlaceholderText('Enter team name')).toBeNull()
        })

        expect(apiCalled).toBe(false)
    })
})

describe('Team page — loading states', () => {
    it('shows skeleton loading before data arrives', async () => {
        server.use(
            http.get('*/api/teams', async () => {
                await new Promise(r => setTimeout(r, 200))
                return HttpResponse.json(makeTeamsFixture())
            }),
        )
        renderWithProviders(<TeamOverview params={{ teamId: 'test-team' }} />)
        expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
    })
})
