import TeamOverview from '@/app/[teamId]/team/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockToastPositive = jest.fn()
const mockToastNegative = jest.fn()
const mockPush = jest.fn()
const mockSearchParamsGet = jest.fn((_: string): string | null => null)
const mockSearchParamsToString = jest.fn(() => '')

jest.mock('@/app/utils/use_toast', () => ({
  toastPositive: (...args: any[]) => mockToastPositive(...args),
  toastNegative: (...args: any[]) => mockToastNegative(...args),
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

const mockTeam = { id: 'team-1', name: 'Team One' }

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
  TestSlackAlertApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
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
    members: [],
  },
}))

// --- Bridge stores: tests control these, query hook mocks read from them ---
const { create: createBridge } = jest.requireActual('zustand') as any
const teamsStore = createBridge(() => ({
  teamsApiStatus: 'loading',
  teams: null as any,
  selectedTeam: null as any,
  fetchTeams: jest.fn(),
  setSelectedTeam: jest.fn(),
  reset: jest.fn(),
}))
const teamPageStore = createBridge(() => ({
  currentUserId: undefined as string | undefined,
  authzAndMembersApiStatus: 'loading',
  authzAndMembers: { can_invite_roles: [] as string[], can_rename_team: false, can_manage_slack: false, members: [] as any[] },
  pendingInvitesApiStatus: 'loading',
  pendingInvites: null as any,
  teamSlackConnectUrl: null as string | null,
  fetchTeamSlackConnectUrlApiStatus: 'init',
  teamSlack: null as any,
  fetchTeamSlackStatusApiStatus: 'init',
  updateTeamSlackStatusApiStatus: 'init',
  testSlackAlertApiStatus: 'init',
  teamNameChangeApiStatus: 'init',
  inviteMemberApiStatus: 'init',
  removeMemberApiStatus: 'init',
  resendPendingInviteApiStatus: 'init',
  removePendingInviteApiStatus: 'init',
  roleChangeApiStatus: 'init',
  fetchCurrentUserId: jest.fn(),
  fetchAuthzAndMembers: jest.fn(),
  fetchPendingInvites: jest.fn(),
  fetchTeamSlackConnectUrl: jest.fn(),
  fetchTeamSlackStatus: jest.fn(),
  changeTeamName: jest.fn(),
  inviteMember: jest.fn(),
  removeMember: jest.fn(),
  resendPendingInvite: jest.fn(),
  removePendingInvite: jest.fn(),
  changeRole: jest.fn(),
  updateSlackStatus: jest.fn(),
  testSlackAlert: jest.fn(),
  reset: jest.fn(),
}))

function mapStatus(s: string) {
  if (s === 'loading') { return 'pending' }
  if (s === 'init') { return 'pending' }
  return s
}

jest.mock('@/app/query/hooks', () => ({
  __esModule: true,
  useTeamsQuery: () => {
    const s = teamsStore.getState()
    return { data: s.teams, status: mapStatus(s.teamsApiStatus) }
  },
  useAuthzAndMembersQuery: () => {
    const s = teamPageStore.getState()
    return { data: s.authzAndMembers, status: mapStatus(s.authzAndMembersApiStatus) }
  },
  usePendingInvitesQuery: () => {
    const s = teamPageStore.getState()
    return { data: s.pendingInvites, status: mapStatus(s.pendingInvitesApiStatus) }
  },
  useTeamSlackConnectUrlQuery: () => {
    const s = teamPageStore.getState()
    return { data: s.teamSlackConnectUrl, status: mapStatus(s.fetchTeamSlackConnectUrlApiStatus) }
  },
  useTeamSlackStatusQuery: () => {
    const s = teamPageStore.getState()
    return { data: s.teamSlack, status: mapStatus(s.fetchTeamSlackStatusApiStatus) }
  },
  useChangeTeamNameMutation: () => {
    const s = teamPageStore.getState()
    return {
      mutate: async (params: any, opts: any) => {
        const result = await s.changeTeamName(params.teamId, params.newName)
        if (result) { opts?.onSuccess?.() } else { opts?.onError?.() }
      },
      isPending: s.teamNameChangeApiStatus === 'loading',
    }
  },
  useInviteMemberMutation: () => {
    const s = teamPageStore.getState()
    return {
      mutate: async (params: any, opts: any) => {
        const result = await s.inviteMember(params.teamId, params.email, params.role)
        if (result) { opts?.onSuccess?.() } else { opts?.onError?.() }
      },
      isPending: s.inviteMemberApiStatus === 'loading',
    }
  },
  useRemoveMemberMutation: () => {
    const s = teamPageStore.getState()
    return {
      mutate: async (params: any, opts: any) => {
        const result = await s.removeMember(params.teamId, params.memberId)
        if (result) { opts?.onSuccess?.() } else { opts?.onError?.() }
      },
      isPending: s.removeMemberApiStatus === 'loading',
    }
  },
  useResendPendingInviteMutation: () => {
    const s = teamPageStore.getState()
    return {
      mutate: async (params: any, opts: any) => {
        const result = await s.resendPendingInvite(params.teamId, params.inviteId)
        if (result) { opts?.onSuccess?.() } else { opts?.onError?.() }
      },
      isPending: s.resendPendingInviteApiStatus === 'loading',
    }
  },
  useRemovePendingInviteMutation: () => {
    const s = teamPageStore.getState()
    return {
      mutate: async (params: any, opts: any) => {
        const result = await s.removePendingInvite(params.teamId, params.inviteId)
        if (result) { opts?.onSuccess?.() } else { opts?.onError?.() }
      },
      isPending: s.removePendingInviteApiStatus === 'loading',
    }
  },
  useChangeRoleMutation: () => {
    const s = teamPageStore.getState()
    return {
      mutate: async (params: any, opts: any) => {
        const result = await s.changeRole(params.teamId, params.newRole, params.memberId)
        if (result) { opts?.onSuccess?.() } else { opts?.onError?.() }
      },
      isPending: s.roleChangeApiStatus === 'loading',
    }
  },
  useUpdateSlackStatusMutation: () => {
    const s = teamPageStore.getState()
    return {
      mutate: async (params: any, opts: any) => {
        const result = await s.updateSlackStatus(params.teamId, params.status)
        if (result) { opts?.onSuccess?.() } else { opts?.onError?.() }
      },
      isPending: s.updateTeamSlackStatusApiStatus === 'loading',
    }
  },
  useTestSlackAlertMutation: () => {
    const s = teamPageStore.getState()
    return {
      mutate: async (params: any, opts: any) => {
        const result = await s.testSlackAlert(params.teamId)
        if (result) { opts?.onSuccess?.() } else { opts?.onError?.() }
      },
      isPending: s.testSlackAlertApiStatus === 'loading',
    }
  },
}))

jest.mock('@/app/stores/provider', () => {
  const { create } = jest.requireActual('zustand')
  const sessionStore = create(() => ({
    session: { user: { id: undefined } },
    fetchSession: jest.fn(),
  }))
  return {
    __esModule: true,
    useSessionStore: sessionStore,
  }
})

const useTeamsStore = teamsStore
const useTeamPageStore = teamPageStore

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

const setDefaultTeamsState = () => {
  useTeamsStore.setState({
    teamsApiStatus: 'success',
    teams: [mockTeam],
    selectedTeam: mockTeam,
  })
}

const setDefaultTeamPageState = () => {
  const { useSessionStore } = require('@/app/stores/provider')
  useSessionStore.setState({ session: { user: { id: 'user-1' } } })
  useTeamPageStore.setState({
    currentUserId: 'user-1',
    authzAndMembersApiStatus: 'success',
    authzAndMembers: defaultAuthz,
    pendingInvitesApiStatus: 'success',
    pendingInvites: defaultPendingInvites,
    fetchTeamSlackConnectUrlApiStatus: 'success',
    teamSlackConnectUrl: 'https://slack/connect',
    fetchTeamSlackStatusApiStatus: 'success',
    teamSlack: { slack_team_name: 'Measure', is_active: true },
  })
}

const renderPage = async ({ waitForSlack = true }: { waitForSlack?: boolean } = {}) => {
  setDefaultTeamsState()
  setDefaultTeamPageState()
  render(<TeamOverview params={{ teamId: 'team-1' }} />)
  await screen.findByText('Invite Team Members')
  if (waitForSlack) {
    await screen.findByTestId('slack-switch')
  }
}

describe('Team Page', () => {
  const originalLocation = window.location

  beforeEach(() => {
    jest.clearAllMocks()
    useTeamsStore.setState({
      teamsApiStatus: 'loading',
      teams: null,
      selectedTeam: null,
      fetchTeams: jest.fn(),
      setSelectedTeam: jest.fn(),
      reset: jest.fn(),
    })
    useTeamPageStore.setState({
      currentUserId: undefined,
      authzAndMembersApiStatus: 'loading',
      authzAndMembers: { can_invite_roles: [], can_rename_team: false, can_manage_slack: false, members: [] },
      pendingInvitesApiStatus: 'loading',
      pendingInvites: null,
      teamSlackConnectUrl: null,
      fetchTeamSlackConnectUrlApiStatus: 'init',
      teamSlack: null,
      fetchTeamSlackStatusApiStatus: 'init',
      updateTeamSlackStatusApiStatus: 'init',
      testSlackAlertApiStatus: 'init',
      teamNameChangeApiStatus: 'init',
      inviteMemberApiStatus: 'init',
      removeMemberApiStatus: 'init',
      resendPendingInviteApiStatus: 'init',
      removePendingInviteApiStatus: 'init',
      roleChangeApiStatus: 'init',
      fetchCurrentUserId: jest.fn(),
      fetchAuthzAndMembers: jest.fn(),
      fetchPendingInvites: jest.fn(),
      fetchTeamSlackConnectUrl: jest.fn(),
      fetchTeamSlackStatus: jest.fn(),
      changeTeamName: jest.fn(),
      inviteMember: jest.fn(),
      removeMember: jest.fn(),
      resendPendingInvite: jest.fn(),
      removePendingInvite: jest.fn(),
      changeRole: jest.fn(),
      updateSlackStatus: jest.fn(),
      testSlackAlert: jest.fn(),
      reset: jest.fn(),
    })
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
    expect(screen.getByText('Slack Integration')).toBeInTheDocument()
    expect(screen.getByText('Change Team Name')).toBeInTheDocument()
  })

  it('renders slack integration doc link', async () => {
    await renderPage()

    const learnMoreLink = screen.getByRole('link', { name: 'Learn more' })
    expect(learnMoreLink).toHaveAttribute('href', '/docs/features/feature-slack-integration')
  })

  it('shows team fetch error when teams API fails', async () => {
    useTeamsStore.setState({
      teamsApiStatus: 'error',
      teams: null,
      selectedTeam: null,
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)

    expect(await screen.findByText('Error fetching team, please refresh page to try again')).toBeInTheDocument()
  })

  it('shows members fetch error when authz API fails', async () => {
    setDefaultTeamsState()
    useTeamPageStore.setState({
      currentUserId: 'user-1',
      authzAndMembersApiStatus: 'error',
      authzAndMembers: defaultAuthz,
      pendingInvitesApiStatus: 'success',
      pendingInvites: defaultPendingInvites,
      fetchTeamSlackConnectUrlApiStatus: 'success',
      teamSlackConnectUrl: 'https://slack/connect',
      fetchTeamSlackStatusApiStatus: 'success',
      teamSlack: { slack_team_name: 'Measure', is_active: true },
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByText('Invite Team Members')

    expect(await screen.findByText('Error fetching team members, please refresh page to try again')).toBeInTheDocument()
  })

  it('shows members loading spinner while authz API is pending', async () => {
    setDefaultTeamsState()
    useTeamPageStore.setState({
      currentUserId: 'user-1',
      authzAndMembersApiStatus: 'loading',
      pendingInvitesApiStatus: 'loading',
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)

    const spinners = await screen.findAllByTestId('loading-spinner-mock')
    expect(spinners.length).toBeGreaterThan(0)
  })

  it('shows pending invites fetch error when pending invites API fails', async () => {
    setDefaultTeamsState()
    useTeamPageStore.setState({
      currentUserId: 'user-1',
      authzAndMembersApiStatus: 'success',
      authzAndMembers: defaultAuthz,
      pendingInvitesApiStatus: 'error',
      pendingInvites: null,
      fetchTeamSlackConnectUrlApiStatus: 'success',
      teamSlackConnectUrl: 'https://slack/connect',
      fetchTeamSlackStatusApiStatus: 'success',
      teamSlack: { slack_team_name: 'Measure', is_active: true },
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByText('Invite Team Members')

    expect(await screen.findByText('Error fetching pending invites, please refresh page to try again')).toBeInTheDocument()
  })

  it('shows pending invites loading spinner while pending invites API is pending', async () => {
    setDefaultTeamsState()
    useTeamPageStore.setState({
      currentUserId: 'user-1',
      authzAndMembersApiStatus: 'success',
      authzAndMembers: defaultAuthz,
      pendingInvitesApiStatus: 'loading',
      pendingInvites: null,
      fetchTeamSlackConnectUrlApiStatus: 'success',
      teamSlackConnectUrl: 'https://slack/connect',
      fetchTeamSlackStatusApiStatus: 'success',
      teamSlack: { slack_team_name: 'Measure', is_active: true },
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)

    const spinners = await screen.findAllByTestId('loading-spinner-mock')
    expect(spinners.length).toBeGreaterThan(0)
  })

  it('disables team rename save when can_rename_team is false', async () => {
    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      authzAndMembers: { ...defaultAuthz, can_rename_team: false },
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByText('Invite Team Members')

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
    const mockChangeTeamName = jest.fn().mockResolvedValue(true)
    useTeamPageStore.setState({ changeTeamName: mockChangeTeamName })

    await renderPage()

    fireEvent.change(screen.getByDisplayValue('Team One'), { target: { value: 'Team Updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockChangeTeamName).toHaveBeenCalledWith('team-1', 'Team Updated')
    })
  })

  it('shows error toast when team rename fails', async () => {
    const mockChangeTeamName = jest.fn().mockResolvedValue(false)
    useTeamPageStore.setState({ changeTeamName: mockChangeTeamName })

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
    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      authzAndMembers: { ...defaultAuthz, can_invite_roles: [] },
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByText('Invite Team Members')

    expect(screen.getAllByTestId('dropdown-Roles')[0]).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled()
  })

  it('disables pending invite actions when role is not invitable', async () => {
    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      authzAndMembers: { ...defaultAuthz, can_invite_roles: ['developer'] },
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByText('Invite Team Members')

    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeDisabled()
  })

  it('invites member successfully', async () => {
    const mockInviteMember = jest.fn().mockResolvedValue(true)
    useTeamPageStore.setState({ inviteMember: mockInviteMember })

    await renderPage()

    fireEvent.input(screen.getByPlaceholderText('Enter email'), { target: { value: 'new@member.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }))

    await waitFor(() => {
      expect(mockInviteMember).toHaveBeenCalledWith('team-1', 'new@member.com', expect.any(String))
      expect(mockToastPositive).toHaveBeenCalled()
    })
  })

  it('shows error toast when invite member fails', async () => {
    const mockInviteMember = jest.fn().mockResolvedValue(false)
    useTeamPageStore.setState({ inviteMember: mockInviteMember })

    await renderPage()

    fireEvent.input(screen.getByPlaceholderText('Enter email'), { target: { value: 'new@member.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error inviting member')
    })
  })

  it('changes member role through confirmation dialog', async () => {
    const mockChangeRole = jest.fn().mockResolvedValue(true)
    useTeamPageStore.setState({ changeRole: mockChangeRole })

    await renderPage()

    fireEvent.click(screen.getAllByTestId('dropdown-Roles')[1])
    fireEvent.click(screen.getByRole('button', { name: 'Change Role' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockChangeRole).toHaveBeenCalledWith('team-1', expect.any(String), 'user-2')
      expect(mockToastPositive).toHaveBeenCalled()
    })
  })

  it('shows non-editable current role selector when no assignable roles are returned', async () => {
    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      authzAndMembers: {
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
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByText('Invite Team Members')

    expect(screen.getByTestId('dropdown-Current Role')).toBeInTheDocument()
  })

  it('does not render role/remove actions for the current user row', async () => {
    await renderPage()

    expect(screen.getAllByRole('button', { name: 'Change Role' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1)
  })

  it('shows error toast when role change fails', async () => {
    const mockChangeRole = jest.fn().mockResolvedValue(false)
    useTeamPageStore.setState({ changeRole: mockChangeRole })

    await renderPage()

    fireEvent.click(screen.getAllByTestId('dropdown-Roles')[1])
    fireEvent.click(screen.getByRole('button', { name: 'Change Role' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error changing role')
    })
  })

  it('removes member through confirmation dialog', async () => {
    const mockRemoveMember = jest.fn().mockResolvedValue(true)
    useTeamPageStore.setState({ removeMember: mockRemoveMember })

    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockRemoveMember).toHaveBeenCalledWith('team-1', 'user-2')
      expect(mockToastPositive).toHaveBeenCalled()
    })
  })

  it('shows error toast when remove member fails', async () => {
    const mockRemoveMember = jest.fn().mockResolvedValue(false)
    useTeamPageStore.setState({ removeMember: mockRemoveMember })

    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error removing member')
    })
  })

  it('resends and revokes pending invites via confirmation dialogs', async () => {
    const mockResendPendingInvite = jest.fn().mockResolvedValue(true)
    const mockRemovePendingInvite = jest.fn().mockResolvedValue(true)
    useTeamPageStore.setState({
      resendPendingInvite: mockResendPendingInvite,
      removePendingInvite: mockRemovePendingInvite,
    })

    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Resend' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockResendPendingInvite).toHaveBeenCalledWith('team-1', 'invite-1')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockRemovePendingInvite).toHaveBeenCalledWith('team-1', 'invite-1')
    })
  })

  it('shows error toast when resend pending invite fails', async () => {
    const mockResendPendingInvite = jest.fn().mockResolvedValue(false)
    useTeamPageStore.setState({ resendPendingInvite: mockResendPendingInvite })

    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Resend' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error resending invite')
    })
  })

  it('shows error toast when revoke pending invite fails', async () => {
    const mockRemovePendingInvite = jest.fn().mockResolvedValue(false)
    useTeamPageStore.setState({ removePendingInvite: mockRemovePendingInvite })

    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error removing pending invite')
    })
  })

  it('disables slack actions when can_manage_slack is false', async () => {
    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      authzAndMembers: { ...defaultAuthz, can_manage_slack: false },
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByTestId('slack-switch')

    expect(screen.getByTestId('slack-switch')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send Test Alert' })).toBeDisabled()
  })

  it('handles slack enable action', async () => {
    const mockUpdateSlackStatus = jest.fn().mockResolvedValue(true)

    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      teamSlack: { slack_team_name: 'Measure', is_active: false },
      updateSlackStatus: mockUpdateSlackStatus,
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByTestId('slack-switch')

    fireEvent.click(screen.getByTestId('slack-switch'))

    await waitFor(() => {
      expect(mockUpdateSlackStatus).toHaveBeenCalledWith('team-1', true)
    })
  })

  it('handles test slack alert action', async () => {
    const mockTestSlackAlert = jest.fn().mockResolvedValue(true)

    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      testSlackAlert: mockTestSlackAlert,
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByRole('button', { name: 'Send Test Alert' })

    fireEvent.click(screen.getByRole('button', { name: 'Send Test Alert' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockTestSlackAlert).toHaveBeenCalledWith('team-1')
    })
  })

  it('shows slack setup link when slack is not connected and disables it without permissions', async () => {
    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      authzAndMembers: { ...defaultAuthz, can_manage_slack: false },
      teamSlack: null,
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByText('Invite Team Members')

    const addToSlackImage = await screen.findByAltText('Add to Slack')
    const link = addToSlackImage.closest('a')
    expect(link).toHaveAttribute('href', 'https://slack/connect')
    expect(link).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows slack integration error when slack APIs fail', async () => {
    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      fetchTeamSlackStatusApiStatus: 'error',
      teamSlack: null,
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByText('Invite Team Members')

    expect(await screen.findByText((content) => content.includes('Error fetching Slack Integration status'))).toBeInTheDocument()
  })

  it('shows slack integration error when slack connect URL fetch fails', async () => {
    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      fetchTeamSlackConnectUrlApiStatus: 'error',
      teamSlackConnectUrl: null,
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByText('Invite Team Members')

    expect(await screen.findByText((content) => content.includes('Error fetching Slack Integration status'))).toBeInTheDocument()
  })

  it('shows error toast when disabling slack integration fails', async () => {
    const mockUpdateSlackStatus = jest.fn().mockResolvedValue(false)

    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      teamSlack: { slack_team_name: 'Measure', is_active: true },
      updateSlackStatus: mockUpdateSlackStatus,
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByRole('button', { name: 'Send Test Alert' })
    fireEvent.click(screen.getByTestId('slack-switch'))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error disabling Slack integration')
    })
  })

  it('shows error toast when enabling slack integration fails', async () => {
    const mockUpdateSlackStatus = jest.fn().mockResolvedValue(false)

    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      teamSlack: { slack_team_name: 'Measure', is_active: false },
      updateSlackStatus: mockUpdateSlackStatus,
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByTestId('slack-switch')
    fireEvent.click(screen.getByTestId('slack-switch'))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error enabling Slack integration')
    })
  })

  it('shows success toast when disabling slack integration succeeds', async () => {
    const mockUpdateSlackStatus = jest.fn().mockResolvedValue(true)

    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      updateSlackStatus: mockUpdateSlackStatus,
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByRole('button', { name: 'Send Test Alert' })

    fireEvent.click(screen.getByTestId('slack-switch'))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastPositive).toHaveBeenCalledWith('Slack integration disabled successfully')
    })
  })

  it('prevents add-to-slack navigation when slack management is disabled', async () => {
    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      authzAndMembers: { ...defaultAuthz, can_manage_slack: false },
      teamSlack: null,
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByText('Invite Team Members')

    const addToSlackImage = await screen.findByAltText('Add to Slack')
    const link = addToSlackImage.closest('a')!
    const clickEvent = createEvent.click(link, { button: 0 })

    fireEvent(link, clickEvent)

    expect(clickEvent.defaultPrevented).toBe(true)
  })

  it('shows error toast when sending test slack alert fails', async () => {
    const mockTestSlackAlert = jest.fn().mockResolvedValue(false)

    setDefaultTeamsState()
    setDefaultTeamPageState()
    useTeamPageStore.setState({
      testSlackAlert: mockTestSlackAlert,
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByRole('button', { name: 'Send Test Alert' })
    fireEvent.click(screen.getByRole('button', { name: 'Send Test Alert' }))
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error sending test Slack alerts')
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

  it('renders page without slack connect URL when currentUserId is undefined', async () => {
    // When session doesn't have user.id, the slack connect URL query won't be enabled
    const { useSessionStore } = require('@/app/stores/provider')
    useSessionStore.setState({ session: { user: { id: undefined } } })

    setDefaultTeamsState()
    useTeamPageStore.setState({
      authzAndMembersApiStatus: 'success',
      authzAndMembers: defaultAuthz,
      pendingInvitesApiStatus: 'success',
      pendingInvites: defaultPendingInvites,
      fetchTeamSlackConnectUrlApiStatus: 'success',
      teamSlackConnectUrl: 'https://slack/connect',
      fetchTeamSlackStatusApiStatus: 'success',
      teamSlack: { slack_team_name: 'Measure', is_active: true },
    })

    render(<TeamOverview params={{ teamId: 'team-1' }} />)
    await screen.findByText('Invite Team Members')

    // Page renders without errors even without session user ID
    expect(screen.getByText('Team')).toBeInTheDocument()
  })

  it('navigates to new team after create team success callback', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Create Team' }))

    expect(mockPush).toHaveBeenCalledWith('/team-2/team')
  })
})
