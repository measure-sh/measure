import TeamOverview from '@/app/[teamId]/team/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockToastPositive = jest.fn()
const mockToastNegative = jest.fn()
const mockPush = jest.fn()
const mockSearchParamsGet = jest.fn((_: string): string | null => null)
const mockSearchParamsToString = jest.fn(() => '')

jest.mock('@/app/utils/use_toast', () => ({
  toastPositive: (...args: any[]) => mockToastPositive(...args),
  toastNegative: (...args: any[]) => mockToastNegative(...args),
}))

jest.mock('@/app/auth/measure_auth', () => ({
  measureAuth: {
    getSession: jest.fn(() => Promise.resolve({ session: { user: { id: 'user-1' } }, error: null })),
  },
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: mockSearchParamsToString,
  }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ unoptimized, ...props }: any) => <img {...props} />,
}))

const defaultAuthz = {
  can_invite_roles: ['viewer', 'developer'],
  can_change_billing: true,
  can_create_app: true,
  can_rename_app: true,
  can_change_retention: true,
  can_rotate_api_key: true,
  can_write_sdk_config: true,
  can_rename_team: true,
  can_manage_slack: true,
  can_change_team_threshold_prefs: true,
  members: [
    {
      id: 'user-1',
      name: 'Owner',
      email: 'owner@test.com',
      role: 'owner',
      last_sign_in_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      authz: {
        current_user_assignable_roles_for_member: [],
        current_user_can_remove_member: false,
      },
    },
    {
      id: 'user-2',
      name: 'Dev',
      email: 'dev@test.com',
      role: 'developer',
      last_sign_in_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      authz: {
        current_user_assignable_roles_for_member: ['admin', 'developer', 'viewer'],
        current_user_can_remove_member: true,
      },
    },
  ],
}

const defaultPendingInvites = [
  {
    id: 'invite-1',
    email: 'invitee@test.com',
    invited_by_email: 'owner@test.com',
    role: 'viewer',
    valid_until: '2025-01-10T00:00:00Z',
  },
]

jest.mock('@/app/api/api_calls', () => ({
  __esModule: true,
  TeamsApiStatus: { Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  TeamNameChangeApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  AuthzAndMembersApiStatus: { Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  PendingInvitesApiStatus: { Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  InviteMemberApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  RemoveMemberApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  RoleChangeApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  ResendPendingInviteApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  RemovePendingInviteApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  FetchTeamSlackConnectUrlApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  FetchTeamSlackStatusApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  UpdateTeamSlackStatusApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  FetchTeamThresholdPrefsApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  UpdateTeamThresholdPrefsApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  TestSlackAlertApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  defaultTeamThresholdPrefs: {
    error_good_threshold: 95,
    error_caution_threshold: 85,
  },
  defaultAuthzAndMembers: {
    can_invite_roles: ['viewer'],
    can_change_billing: false,
    can_create_app: false,
    can_rename_app: false,
    can_change_retention: false,
    can_rotate_api_key: false,
    can_write_sdk_config: false,
    can_rename_team: false,
    can_manage_slack: false,
    can_change_team_threshold_prefs: false,
    members: [],
  },
  fetchTeamsFromServer: jest.fn(() => Promise.resolve({
    status: 'success',
    data: [{ id: 'team-1', name: 'Team One' }],
  })),
  fetchAuthzAndMembersFromServer: jest.fn(() => Promise.resolve({ status: 'success', data: defaultAuthz })),
  fetchPendingInvitesFromServer: jest.fn(() => Promise.resolve({ status: 'success', data: defaultPendingInvites })),
  changeTeamNameFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
  inviteMemberFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
  changeRoleFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
  removeMemberFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
  resendPendingInviteFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
  removePendingInviteFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
  fetchTeamSlackConnectUrlFromServer: jest.fn(() => Promise.resolve({ status: 'success', data: { url: 'https://slack/connect' } })),
  fetchTeamSlackStatusFromServer: jest.fn(() => Promise.resolve({ status: 'success', data: { slack_team_name: 'Measure', is_active: true } })),
  fetchTeamThresholdPrefsFromServer: jest.fn(() => Promise.resolve({ status: 'success', data: { error_good_threshold: 95, error_caution_threshold: 85 } })),
  updateTeamSlackStatusFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
  updateTeamThresholdPrefsFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
  sendTestSlackAlertFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
}))

jest.mock('@/app/components/button', () => ({
  Button: ({ children, loading, disabled, ...props }: any) => (
    <button disabled={disabled || loading} {...props}>{children}</button>
  ),
}))

jest.mock('@/app/components/input', () => ({
  Input: (props: any) => <input {...props} />,
}))

jest.mock('@/app/components/dropdown_select', () => ({
  __esModule: true,
  default: (props: any) => {
    const next = props.items?.find((i: any) => i !== props.initialSelected) ?? props.items?.[0]
    return (
      <button
        data-testid={`dropdown-${props.title}`}
        disabled={props.disabled}
        onClick={() => props.onChangeSelected?.(next)}
      >
        {props.title}
      </button>
    )
  },
  DropdownSelectType: { SingleString: 'single' },
}))

jest.mock('@/app/components/create_team', () => ({
  __esModule: true,
  default: ({ onSuccess }: any) => <button onClick={() => onSuccess('team-2')}>Create Team</button>,
}))

jest.mock('@/app/components/loading_spinner', () => () => <div data-testid="loading-spinner-mock" />)

jest.mock('@/app/components/switch', () => ({
  Switch: ({ checked, disabled, onCheckedChange }: any) => (
    <button
      data-testid="slack-switch"
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
    >
      switch
    </button>
  ),
}))

jest.mock('@/app/components/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children }: any) => <td>{children}</td>,
}))

jest.mock('@/app/components/danger_confirmation_dialog', () => ({
  __esModule: true,
  default: (props: any) => {
    if (!props.open) return null
    return (
      <div>
        <button onClick={props.onAffirmativeAction}>{props.affirmativeText}</button>
        <button onClick={props.onCancelAction}>{props.cancelText}</button>
      </div>
    )
  },
}))

jest.mock('@/app/components/confirmation_dialog', () => ({
  __esModule: true,
  default: (props: any) => {
    if (!props.open) return null
    return (
      <div>
        <button onClick={props.onAffirmativeAction}>{props.affirmativeText}</button>
        <button onClick={props.onCancelAction}>{props.cancelText}</button>
      </div>
    )
  },
}))

const renderPage = async () => {
  render(<TeamOverview params={{ teamId: 'team-1' }} />)
  await screen.findByText('Invite Team Members')
}

describe('Team Page', () => {
  const originalLocation = window.location

  beforeEach(() => {
    jest.clearAllMocks()
    const apiCalls = require('@/app/api/api_calls')
    const { measureAuth } = require('@/app/auth/measure_auth')
    measureAuth.getSession.mockImplementation(() => Promise.resolve({ session: { user: { id: 'user-1' } }, error: null }))
    apiCalls.fetchTeamsFromServer.mockImplementation(() => Promise.resolve({
      status: 'success',
      data: [{ id: 'team-1', name: 'Team One' }],
    }))
    apiCalls.fetchAuthzAndMembersFromServer.mockImplementation(() => Promise.resolve({ status: 'success', data: defaultAuthz }))
    apiCalls.fetchPendingInvitesFromServer.mockImplementation(() => Promise.resolve({ status: 'success', data: defaultPendingInvites }))
    apiCalls.changeTeamNameFromServer.mockImplementation(() => Promise.resolve({ status: 'success' }))
    apiCalls.inviteMemberFromServer.mockImplementation(() => Promise.resolve({ status: 'success' }))
    apiCalls.changeRoleFromServer.mockImplementation(() => Promise.resolve({ status: 'success' }))
    apiCalls.removeMemberFromServer.mockImplementation(() => Promise.resolve({ status: 'success' }))
    apiCalls.resendPendingInviteFromServer.mockImplementation(() => Promise.resolve({ status: 'success' }))
    apiCalls.removePendingInviteFromServer.mockImplementation(() => Promise.resolve({ status: 'success' }))
    apiCalls.fetchTeamSlackConnectUrlFromServer.mockImplementation(() => Promise.resolve({ status: 'success', data: { url: 'https://slack/connect' } }))
    apiCalls.fetchTeamSlackStatusFromServer.mockImplementation(() => Promise.resolve({ status: 'success', data: { slack_team_name: 'Measure', is_active: true } }))
    apiCalls.fetchTeamThresholdPrefsFromServer.mockImplementation(() => Promise.resolve({ status: 'success', data: { error_good_threshold: 95, error_caution_threshold: 85 } }))
    apiCalls.updateTeamSlackStatusFromServer.mockImplementation(() => Promise.resolve({ status: 'success' }))
    apiCalls.updateTeamThresholdPrefsFromServer.mockImplementation(() => Promise.resolve({ status: 'success' }))
    apiCalls.sendTestSlackAlertFromServer.mockImplementation(() => Promise.resolve({ status: 'success' }))
    mockSearchParamsGet.mockReset()
    mockSearchParamsGet.mockImplementation(() => null)
    mockSearchParamsToString.mockReset()
    mockSearchParamsToString.mockImplementation(() => '')
    window.sessionStorage.clear()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, reload: jest.fn() },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    })
  })

  it('renders core sections on successful load', async () => {
    await renderPage()

    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.getByText('Members')).toBeInTheDocument()
    expect(screen.getByText('Pending Invites')).toBeInTheDocument()
    expect(screen.getByText('Change Thresholds')).toBeInTheDocument()
    expect(screen.getByText('Slack Integration')).toBeInTheDocument()
    expect(screen.getByText('Change Team Name')).toBeInTheDocument()
  })

  it('shows team fetch error when teams API fails', async () => {
    const { fetchTeamsFromServer } = require('@/app/api/api_calls')
    fetchTeamsFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error' }))

    render(<TeamOverview params={{ teamId: 'team-1' }} />)

    expect(await screen.findByText('Error fetching team, please refresh page to try again')).toBeInTheDocument()
  })

  it('shows members fetch error when authz API fails', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error' }))

    await renderPage()

    expect(await screen.findByText('Error fetching team members, please refresh page to try again')).toBeInTheDocument()
  })

  it('shows members loading spinner while authz API is pending', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(
      () => new Promise(() => {})
    )

    render(<TeamOverview params={{ teamId: 'team-1' }} />)

    const spinners = await screen.findAllByTestId('loading-spinner-mock')
    expect(spinners.length).toBeGreaterThan(0)
  })

  it('shows pending invites fetch error when pending invites API fails', async () => {
    const { fetchPendingInvitesFromServer } = require('@/app/api/api_calls')
    fetchPendingInvitesFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error' }))

    await renderPage()

    expect(await screen.findByText('Error fetching pending invites, please refresh page to try again')).toBeInTheDocument()
  })

  it('shows pending invites loading spinner while pending invites API is pending', async () => {
    const { fetchPendingInvitesFromServer } = require('@/app/api/api_calls')
    fetchPendingInvitesFromServer.mockImplementationOnce(
      () => new Promise(() => {})
    )

    render(<TeamOverview params={{ teamId: 'team-1' }} />)

    const spinners = await screen.findAllByTestId('loading-spinner-mock')
    expect(spinners.length).toBeGreaterThan(0)
  })

  it('disables team rename save when can_rename_team is false', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(() => Promise.resolve({
      status: 'success',
      data: { ...defaultAuthz, can_rename_team: false },
    }))

    await renderPage()

    const saveButton = screen.getByRole('button', { name: 'Save' })
    expect(saveButton).toBeDisabled()
  })

  it('re-disables rename save when team name is changed back to original', async () => {
    await renderPage()

    const input = screen.getByDisplayValue('Team One')
    const saveButton = screen.getByRole('button', { name: 'Save' })

    fireEvent.change(input, { target: { value: 'Team Updated' } })
    expect(saveButton).not.toBeDisabled()

    fireEvent.change(input, { target: { value: 'Team One' } })
    expect(saveButton).toBeDisabled()
  })

  it('renames team after confirmation when can_rename_team is true', async () => {
    const { changeTeamNameFromServer } = require('@/app/api/api_calls')

    await renderPage()

    fireEvent.change(screen.getByDisplayValue('Team One'), { target: { value: 'Team Updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(changeTeamNameFromServer).toHaveBeenCalledWith('team-1', 'Team Updated')
    })
  })

  it('shows error toast when team rename fails', async () => {
    const { changeTeamNameFromServer } = require('@/app/api/api_calls')
    changeTeamNameFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error' }))

    await renderPage()

    fireEvent.change(screen.getByDisplayValue('Team One'), { target: { value: 'Team Updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error changing team name')
    })
  })

  it('uses renamed member authz fields for role change and remove actions', async () => {
    await renderPage()

    fireEvent.click(screen.getAllByTestId('dropdown-Roles')[1])

    const changeRoleButtons = screen.getAllByRole('button', { name: 'Change Role' })
    expect(changeRoleButtons[0]).not.toBeDisabled()

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' })
    expect(removeButtons[0]).not.toBeDisabled()
  })

  it('disables invite actions when can_invite_roles is empty', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(() => Promise.resolve({
      status: 'success',
      data: { ...defaultAuthz, can_invite_roles: [] },
    }))

    await renderPage()

    expect(screen.getAllByTestId('dropdown-Roles')[0]).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled()
  })

  it('disables pending invite actions when role is not invitable', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(() => Promise.resolve({
      status: 'success',
      data: { ...defaultAuthz, can_invite_roles: ['developer'] },
    }))

    await renderPage()

    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeDisabled()
  })

  it('invites member successfully', async () => {
    const { inviteMemberFromServer } = require('@/app/api/api_calls')

    await renderPage()

    fireEvent.input(screen.getByPlaceholderText('Enter email'), { target: { value: 'new@member.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }))

    await waitFor(() => {
      expect(inviteMemberFromServer).toHaveBeenCalledWith('team-1', 'new@member.com', expect.any(String))
      expect(mockToastPositive).toHaveBeenCalled()
    })
  })

  it('shows error toast when invite member fails', async () => {
    const { inviteMemberFromServer } = require('@/app/api/api_calls')
    inviteMemberFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error', error: 'failed' }))

    await renderPage()

    fireEvent.input(screen.getByPlaceholderText('Enter email'), { target: { value: 'new@member.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error inviting member', 'failed')
    })
  })

  it('changes member role through confirmation dialog', async () => {
    const { changeRoleFromServer } = require('@/app/api/api_calls')

    await renderPage()

    fireEvent.click(screen.getAllByTestId('dropdown-Roles')[1])
    fireEvent.click(screen.getByRole('button', { name: 'Change Role' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(changeRoleFromServer).toHaveBeenCalledWith('team-1', expect.any(String), 'user-2')
      expect(mockToastPositive).toHaveBeenCalled()
    })
  })

  it('shows non-editable current role selector when no assignable roles are returned', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(() => Promise.resolve({
      status: 'success',
      data: {
        ...defaultAuthz,
        members: [
          defaultAuthz.members[0],
          {
            ...defaultAuthz.members[1],
            authz: {
              ...defaultAuthz.members[1].authz,
              current_user_assignable_roles_for_member: [],
            },
          },
        ],
      },
    }))

    await renderPage()

    expect(screen.getByTestId('dropdown-Current Role')).toBeInTheDocument()
  })

  it('does not render role/remove actions for the current user row', async () => {
    await renderPage()

    expect(screen.getAllByRole('button', { name: 'Change Role' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1)
  })

  it('shows error toast when role change fails', async () => {
    const { changeRoleFromServer } = require('@/app/api/api_calls')
    changeRoleFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error', error: 'failed' }))

    await renderPage()

    fireEvent.click(screen.getAllByTestId('dropdown-Roles')[1])
    fireEvent.click(screen.getByRole('button', { name: 'Change Role' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error changing role', 'failed')
    })
  })

  it('removes member through confirmation dialog', async () => {
    const { removeMemberFromServer } = require('@/app/api/api_calls')

    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(removeMemberFromServer).toHaveBeenCalledWith('team-1', 'user-2')
      expect(mockToastPositive).toHaveBeenCalled()
    })
  })

  it('shows error toast when remove member fails', async () => {
    const { removeMemberFromServer } = require('@/app/api/api_calls')
    removeMemberFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error', error: 'failed' }))

    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error removing member', 'failed')
    })
  })

  it('resends and revokes pending invites via confirmation dialogs', async () => {
    const { resendPendingInviteFromServer, removePendingInviteFromServer } = require('@/app/api/api_calls')

    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Resend' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(resendPendingInviteFromServer).toHaveBeenCalledWith('team-1', 'invite-1')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(removePendingInviteFromServer).toHaveBeenCalledWith('team-1', 'invite-1')
    })
  })

  it('shows error toast when resend pending invite fails', async () => {
    const { resendPendingInviteFromServer } = require('@/app/api/api_calls')
    resendPendingInviteFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error', error: 'failed' }))

    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Resend' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error resending invite', 'failed')
    })
  })

  it('shows error toast when revoke pending invite fails', async () => {
    const { removePendingInviteFromServer } = require('@/app/api/api_calls')
    removePendingInviteFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error', error: 'failed' }))

    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error removing pending invite', 'failed')
    })
  })

  it('disables slack actions when can_manage_slack is false', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(() => Promise.resolve({
      status: 'success',
      data: { ...defaultAuthz, can_manage_slack: false },
    }))

    await renderPage()
    await screen.findByTestId('slack-switch')

    expect(screen.getByTestId('slack-switch')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send Test Alert' })).toBeDisabled()
  })

  describe('Threshold Preferences', () => {
    it('disables threshold actions when can_change_team_threshold_prefs is false', async () => {
      const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
      fetchAuthzAndMembersFromServer.mockImplementationOnce(() => Promise.resolve({
        status: 'success',
        data: { ...defaultAuthz, can_change_team_threshold_prefs: false },
      }))

      await renderPage()

      expect(screen.getByRole('button', { name: 'Save thresholds' })).toBeDisabled()
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs[0]).toBeDisabled()
      expect(inputs[1]).toBeDisabled()
    })

    it('updates threshold prefs successfully', async () => {
      const { updateTeamThresholdPrefsFromServer } = require('@/app/api/api_calls')
      await renderPage()

      const inputs = screen.getAllByRole('spinbutton')
      fireEvent.change(inputs[0], { target: { value: '97' } })
      fireEvent.change(inputs[1], { target: { value: '88' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save thresholds' }))

      await waitFor(() => {
        expect(updateTeamThresholdPrefsFromServer).toHaveBeenCalledWith('team-1', {
          error_good_threshold: 97,
          error_caution_threshold: 88,
        })
        expect(mockToastPositive).toHaveBeenCalledWith('Thresholds updated successfully')
      })
    })

    it('enables Save for threshold changes and disables when reverted', async () => {
      await renderPage()

      const saveThresholdsButton = screen.getByRole('button', { name: 'Save thresholds' })
      const inputs = screen.getAllByRole('spinbutton')
      expect(saveThresholdsButton).toBeDisabled()

      fireEvent.change(inputs[0], { target: { value: '97' } })
      expect(saveThresholdsButton).not.toBeDisabled()

      fireEvent.change(inputs[0], { target: { value: '95' } })
      expect(saveThresholdsButton).toBeDisabled()
    })

    it('normalizes leading zero threshold input on blur', async () => {
      await renderPage()

      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
      fireEvent.change(inputs[0], { target: { value: '5' } })
      expect(inputs[0].value).toBe('5')

      fireEvent.change(inputs[0], { target: { value: '0005' } })
      fireEvent.blur(inputs[0])

      expect(inputs[0].value).toBe('5')
    })

    it('clamps threshold values to [0, 100] before saving', async () => {
      const { updateTeamThresholdPrefsFromServer } = require('@/app/api/api_calls')
      await renderPage()

      const inputs = screen.getAllByRole('spinbutton')
      fireEvent.change(inputs[0], { target: { value: '101' } })
      fireEvent.change(inputs[1], { target: { value: '-1' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save thresholds' }))

      await waitFor(() => {
        expect(updateTeamThresholdPrefsFromServer).toHaveBeenCalledWith('team-1', {
          error_good_threshold: 100,
          error_caution_threshold: 0,
        })
      })
    })

    it('shows validation error when good threshold is not greater than caution threshold', async () => {
      const { updateTeamThresholdPrefsFromServer } = require('@/app/api/api_calls')
      await renderPage()

      const inputs = screen.getAllByRole('spinbutton')
      fireEvent.change(inputs[0], { target: { value: '80' } })
      fireEvent.change(inputs[1], { target: { value: '90' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save thresholds' }))

      expect(updateTeamThresholdPrefsFromServer).not.toHaveBeenCalled()
      expect(mockToastNegative).toHaveBeenCalledWith(
        'Error updating thresholds',
        'Good threshold must be greater than caution threshold',
      )
    })

    it('shows error toast when threshold update API fails', async () => {
      const { updateTeamThresholdPrefsFromServer } = require('@/app/api/api_calls')
      updateTeamThresholdPrefsFromServer.mockImplementationOnce(() => Promise.resolve({
        status: 'error',
        error: 'failed',
      }))

      await renderPage()

      const inputs = screen.getAllByRole('spinbutton')
      fireEvent.change(inputs[0], { target: { value: '97' } })
      fireEvent.change(inputs[1], { target: { value: '88' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save thresholds' }))

      await waitFor(() => {
        expect(mockToastNegative).toHaveBeenCalledWith('Error updating thresholds', 'failed')
      })
    })

    it('shows threshold prefs fetch error', async () => {
      const { fetchTeamThresholdPrefsFromServer } = require('@/app/api/api_calls')
      fetchTeamThresholdPrefsFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error' }))

      await renderPage()

      expect(await screen.findByText('Error fetching team threshold preferences, please refresh page to try again')).toBeInTheDocument()
    })
  })

  it('handles slack enable/disable and test alert actions', async () => {
    const {
      fetchTeamSlackStatusFromServer,
      updateTeamSlackStatusFromServer,
      sendTestSlackAlertFromServer,
    } = require('@/app/api/api_calls')

    fetchTeamSlackStatusFromServer.mockReset()
    fetchTeamSlackStatusFromServer.mockImplementation(() => Promise.resolve({
      status: 'success',
      data: { slack_team_name: 'Measure', is_active: false },
    }))

    await renderPage()
    await screen.findByTestId('slack-switch')

    fireEvent.click(screen.getByTestId('slack-switch'))

    await waitFor(() => {
      expect(updateTeamSlackStatusFromServer).toHaveBeenCalledWith('team-1', true)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Send Test Alert' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(sendTestSlackAlertFromServer).toHaveBeenCalledWith('team-1')
    })
  })

  it('shows slack setup link when slack is not connected and disables it without permissions', async () => {
    const { fetchAuthzAndMembersFromServer, fetchTeamSlackStatusFromServer } = require('@/app/api/api_calls')
    fetchTeamSlackStatusFromServer.mockReset()
    fetchAuthzAndMembersFromServer.mockImplementation(() => Promise.resolve({
      status: 'success',
      data: { ...defaultAuthz, can_manage_slack: false },
    }))
    fetchTeamSlackStatusFromServer.mockImplementation(() => Promise.resolve({
      status: 'success',
      data: null,
    }))

    await renderPage()

    const addToSlackImage = await screen.findByAltText('Add to Slack')
    const link = addToSlackImage.closest('a')
    expect(link).toHaveAttribute('href', 'https://slack/connect')
    expect(link).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows slack integration error when slack APIs fail', async () => {
    const { fetchTeamSlackStatusFromServer } = require('@/app/api/api_calls')
    fetchTeamSlackStatusFromServer.mockReset()
    fetchTeamSlackStatusFromServer.mockImplementation(() => Promise.resolve({
      status: 'error',
    }))

    await renderPage()

    expect(await screen.findByText((content) => content.includes('Error fetching Slack Integration status'))).toBeInTheDocument()
  })

  it('shows slack integration error when slack connect URL fetch fails', async () => {
    const { fetchTeamSlackConnectUrlFromServer } = require('@/app/api/api_calls')
    fetchTeamSlackConnectUrlFromServer.mockImplementationOnce(() => Promise.resolve({
      status: 'error',
    }))

    await renderPage()

    expect(await screen.findByText((content) => content.includes('Error fetching Slack Integration status'))).toBeInTheDocument()
  })

  it('shows error toast when disabling slack integration fails', async () => {
    const { fetchTeamSlackStatusFromServer, updateTeamSlackStatusFromServer } = require('@/app/api/api_calls')
    fetchTeamSlackStatusFromServer.mockReset()
    fetchTeamSlackStatusFromServer.mockImplementation(() => Promise.resolve({
      status: 'success',
      data: { slack_team_name: 'Measure', is_active: true },
    }))
    updateTeamSlackStatusFromServer.mockImplementationOnce(() => Promise.resolve({
      status: 'error',
      error: 'failed',
    }))

    await renderPage()
    await screen.findByRole('button', { name: 'Send Test Alert' })
    fireEvent.click(screen.getByTestId('slack-switch'))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error disabling Slack integration', 'failed')
    })
  })

  it('shows error toast when enabling slack integration fails', async () => {
    const { fetchTeamSlackStatusFromServer, updateTeamSlackStatusFromServer } = require('@/app/api/api_calls')
    fetchTeamSlackStatusFromServer.mockReset()
    fetchTeamSlackStatusFromServer.mockImplementation(() => Promise.resolve({
      status: 'success',
      data: { slack_team_name: 'Measure', is_active: false },
    }))
    updateTeamSlackStatusFromServer.mockImplementationOnce(() => Promise.resolve({
      status: 'error',
      error: 'failed',
    }))

    await renderPage()
    await screen.findByTestId('slack-switch')
    fireEvent.click(screen.getByTestId('slack-switch'))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error enabling Slack integration', 'failed')
    })
  })

  it('shows success toast when disabling slack integration succeeds', async () => {
    await renderPage()
    await screen.findByRole('button', { name: 'Send Test Alert' })

    fireEvent.click(screen.getByTestId('slack-switch'))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastPositive).toHaveBeenCalledWith('Slack integration disabled successfully')
    })
  })

  it('prevents add-to-slack navigation when slack management is disabled', async () => {
    const { fetchAuthzAndMembersFromServer, fetchTeamSlackStatusFromServer } = require('@/app/api/api_calls')
    fetchTeamSlackStatusFromServer.mockReset()
    fetchAuthzAndMembersFromServer.mockImplementation(() => Promise.resolve({
      status: 'success',
      data: { ...defaultAuthz, can_manage_slack: false },
    }))
    fetchTeamSlackStatusFromServer.mockImplementation(() => Promise.resolve({
      status: 'success',
      data: null,
    }))

    await renderPage()

    const addToSlackImage = await screen.findByAltText('Add to Slack')
    const link = addToSlackImage.closest('a')!
    const clickEvent = createEvent.click(link, { button: 0 })

    fireEvent(link, clickEvent)

    expect(clickEvent.defaultPrevented).toBe(true)
  })

  it('shows error toast when sending test slack alert fails', async () => {
    const { sendTestSlackAlertFromServer } = require('@/app/api/api_calls')
    sendTestSlackAlertFromServer.mockImplementationOnce(() => Promise.resolve({
      status: 'error',
      error: 'failed',
    }))

    await renderPage()
    await screen.findByRole('button', { name: 'Send Test Alert' })
    fireEvent.click(screen.getByRole('button', { name: 'Send Test Alert' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error sending test Slack alerts', 'failed')
    })
  })

  it('shows toast from error query param and clears it from URL', async () => {
    mockSearchParamsGet.mockImplementation((key: string) => (key === 'error' ? 'Boom' : null))
    mockSearchParamsToString.mockImplementation(() => 'error=Boom')
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState')

    await renderPage()

    expect(mockToastNegative).toHaveBeenCalledWith('Boom')
    expect(replaceStateSpy).toHaveBeenCalled()
    replaceStateSpy.mockRestore()
  })

  it('shows toast from success query param and clears it from URL', async () => {
    mockSearchParamsGet.mockImplementation((key: string) => (key === 'success' ? 'Nice' : null))
    mockSearchParamsToString.mockImplementation(() => 'success=Nice')
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState')

    await renderPage()

    expect(mockToastPositive).toHaveBeenCalledWith('Nice')
    expect(replaceStateSpy).toHaveBeenCalled()
    replaceStateSpy.mockRestore()
  })

  it('shows team renamed toast when session storage flag is present', async () => {
    window.sessionStorage.setItem('teamNameChanged', 'true')

    await renderPage()

    expect(mockToastPositive).toHaveBeenCalledWith('Team name changed')
    expect(window.sessionStorage.getItem('teamNameChanged')).toBeNull()
  })

  it('logs error and skips slack connect URL fetch when session lookup fails', async () => {
    const { measureAuth } = require('@/app/auth/measure_auth')
    const { fetchTeamSlackConnectUrlFromServer } = require('@/app/api/api_calls')
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    measureAuth.getSession.mockImplementationOnce(() => Promise.resolve({
      session: null,
      error: new Error('session failed'),
    }))

    await renderPage()

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(fetchTeamSlackConnectUrlFromServer).not.toHaveBeenCalled()
    })
    consoleErrorSpy.mockRestore()
  })

  it('navigates to new team after create team success callback', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Create Team' }))

    expect(mockPush).toHaveBeenCalledWith('/team-2/team')
  })
})
