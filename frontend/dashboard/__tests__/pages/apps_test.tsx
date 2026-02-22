import Apps from '@/app/[teamId]/apps/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import * as React from 'react'

const mockToastPositive = jest.fn()
const mockToastNegative = jest.fn()
const mockRefreshFilters = jest.fn()

const baseMockApp = {
  id: 'app-1',
  team_id: 'team-1',
  name: 'Demo App',
  api_key: {
    created_at: '2025-01-01T00:00:00Z',
    key: 'msrsh_key_checksum',
    last_seen: null,
    revoked: false,
  },
  onboarded: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  os_name: 'Android',
  onboarded_at: '2025-01-01T00:00:00Z',
  unique_identifier: 'com.example.app',
}

let mockCurrentApp = { ...baseMockApp, api_key: { ...baseMockApp.api_key } }

const getAppPayload = () => ({
  ...mockCurrentApp,
  api_key: { ...mockCurrentApp.api_key },
})

jest.mock('@/app/utils/use_toast', () => ({
  toastPositive: (...args: any[]) => mockToastPositive(...args),
  toastNegative: (...args: any[]) => mockToastNegative(...args),
}))

jest.mock('@/app/auth/measure_auth', () => ({
  measureAuth: {
    getSession: jest.fn(() => Promise.resolve({ session: { user: { id: 'user-1' } }, error: null })),
  },
}))

jest.mock('@/app/utils/env_utils', () => ({
  isCloud: jest.fn(() => false),
}))

jest.mock('@/app/api/api_calls', () => ({
  __esModule: true,
  AuthzAndMembersApiStatus: {
    Loading: 'loading',
    Success: 'success',
    Error: 'error',
    Cancelled: 'cancelled',
  },
  FetchBillingInfoApiStatus: {
    Loading: 'loading',
    Success: 'success',
    Error: 'error',
    Cancelled: 'cancelled',
  },
  FetchAppRetentionApiStatus: {
    Loading: 'loading',
    Success: 'success',
    Error: 'error',
    Cancelled: 'cancelled',
  },
  SdkConfigApiStatus: {
    Loading: 'loading',
    Success: 'success',
    Error: 'error',
    Cancelled: 'cancelled',
  },
  UpdateAppRetentionApiStatus: {
    Init: 'init',
    Loading: 'loading',
    Success: 'success',
    Error: 'error',
    Cancelled: 'cancelled',
  },
  AppNameChangeApiStatus: {
    Init: 'init',
    Loading: 'loading',
    Success: 'success',
    Error: 'error',
    Cancelled: 'cancelled',
  },
  AppApiKeyChangeApiStatus: {
    Init: 'init',
    Loading: 'loading',
    Success: 'success',
    Error: 'error',
    Cancelled: 'cancelled',
  },
  FilterSource: {
    Events: 'events',
  },
  emptyAppRetention: {
    retention: 30,
  },
  fetchAuthzAndMembersFromServer: jest.fn(() =>
    Promise.resolve({
      status: 'success',
      data: {
        can_create_app: true,
        can_rename_app: true,
        can_change_retention: true,
        can_rotate_api_key: true,
        can_write_sdk_config: true,
        members: [],
      },
    })
  ),
  fetchBillingInfoFromServer: jest.fn(() => Promise.resolve({ status: 'success', data: { plan: 'free' } })),
  fetchAppRetentionFromServer: jest.fn(() =>
    Promise.resolve({
      status: 'success',
      data: {
        retention: 30,
      },
    })
  ),
  updateAppRetentionFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
  fetchSdkConfigFromServer: jest.fn(() =>
    Promise.resolve({
      status: 'success',
      data: {
        session_sampling_rate: 100,
      },
    })
  ),
  changeAppNameFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
  changeAppApiKeyFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
}))

jest.mock('@/app/components/filters', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        refresh: () => {
          mockRefreshFilters()
          mockCurrentApp = {
            ...mockCurrentApp,
            api_key: {
              ...mockCurrentApp.api_key,
              key: 'msrsh_rotated_key_checksum',
            },
          }
          props.onFiltersChanged({
            ready: true,
            app: getAppPayload(),
            serialisedFilters: 'app=app-1',
          })
        },
      }))

      return (
        <div data-testid="filters-mock">
          <button
            data-testid="update-filters"
            onClick={() =>
              props.onFiltersChanged({
                ready: true,
                app: getAppPayload(),
                serialisedFilters: 'app=app-1',
              })
            }
          >
            Update Filters
          </button>
        </div>
      )
    }),
    AppVersionsInitialSelectionType: { All: 'all' },
    defaultFilters: { ready: false, app: null, serialisedFilters: '' },
  }
})

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
  default: (props: any) => (
    <div data-testid="dropdown-select-mock">
      <span>{props.title}</span>
      <button
        data-testid="retention-select-90"
        disabled={props.disabled}
        onClick={() => props.onChangeSelected('3 months')}
      >
        Set 3 months
      </button>
    </div>
  ),
  DropdownSelectType: { SingleString: 'single' },
}))

jest.mock('@/app/components/create_app', () => ({
  __esModule: true,
  default: ({ disabled }: any) => <div data-testid="create-app-mock" data-disabled={disabled ? 'true' : 'false'} />,
}))

jest.mock('@/app/components/loading_spinner', () => () => <div data-testid="loading-spinner-mock" />)

jest.mock('@/app/components/sdk_configurator', () => ({
  __esModule: true,
  default: ({ currentUserCanChangeAppSettings }: any) => (
    <div data-testid="sdk-configurator-mock" data-can-change={currentUserCanChangeAppSettings ? 'true' : 'false'} />
  ),
}))

jest.mock('@/app/components/danger_confirmation_dialog', () => ({
  __esModule: true,
  default: (props: any) => {
    if (!props.open) return null

    return (
      <div data-testid={`danger-dialog-${props.affirmativeText}`}>
        {props.body}
        <button onClick={props.onAffirmativeAction}>{props.affirmativeText}</button>
        <button onClick={props.onCancelAction}>{props.cancelText}</button>
      </div>
    )
  },
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

const renderPage = async () => {
  await act(async () => {
    render(<Apps params={{ teamId: 'team-1' }} />)
    await Promise.resolve()
  })
}

const renderLoadedPage = async () => {
  await renderPage()

  await act(async () => {
    fireEvent.click(screen.getByTestId('update-filters'))
  })
}

const openRotateDialog = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Rotate' }))
  })
}

const openRenameDialog = async () => {
  const renameInput = screen.getByDisplayValue('Demo App')
  await act(async () => {
    fireEvent.change(renameInput, { target: { value: 'Renamed App' } })
  })

  const saveButtons = screen.getAllByRole('button', { name: 'Save' })
  await act(async () => {
    fireEvent.click(saveButtons[1])
  })
}

const openRetentionDialog = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('retention-select-90'))
  })

  const saveButtons = screen.getAllByRole('button', { name: 'Save' })
  await act(async () => {
    fireEvent.click(saveButtons[0])
  })
}

describe('Apps Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCurrentApp = { ...baseMockApp, api_key: { ...baseMockApp.api_key } }
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.measure.sh'
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(),
      },
    })
  })

  it('renders main settings sections after app filters load', async () => {
    await renderLoadedPage()

    expect(await screen.findByText('Configure Data Retention')).toBeInTheDocument()
    expect(screen.getByText('Change App Name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rotate' })).toBeInTheDocument()
    expect(screen.getByTestId('sdk-configurator-mock')).toBeInTheDocument()
    expect(screen.getByTestId('create-app-mock')).toHaveAttribute('data-disabled', 'false')
    expect(screen.getByTestId('sdk-configurator-mock')).toHaveAttribute('data-can-change', 'true')
  })

  it('does not render settings sections before filters are ready', async () => {
    await renderPage()

    expect(screen.queryByText('Configure Data Retention')).not.toBeInTheDocument()
    expect(screen.queryByText('Change App Name')).not.toBeInTheDocument()
    expect(screen.queryByText('Rotate API key')).not.toBeInTheDocument()
  })

  it('shows loading state while app settings are being fetched', async () => {
    const { fetchAppRetentionFromServer } = require('@/app/api/api_calls')

    let resolvePromise: (value: any) => void
    const loadingPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    fetchAppRetentionFromServer.mockImplementationOnce(() => loadingPromise)

    await renderPage()

    await act(async () => {
      fireEvent.click(screen.getByTestId('update-filters'))
    })

    expect(screen.getByTestId('loading-spinner-mock')).toBeInTheDocument()

    await act(async () => {
      resolvePromise!({ status: 'success', data: { retention: 30 } })
    })
  })

  it('shows error message when app settings fetch fails', async () => {
    const { fetchSdkConfigFromServer } = require('@/app/api/api_calls')
    fetchSdkConfigFromServer.mockImplementationOnce(() =>
      Promise.resolve({ status: 'error' })
    )

    await renderLoadedPage()

    expect(await screen.findByText(/Error fetching app settings/)).toBeInTheDocument()
  })

  it('shows rotate button for admin users', async () => {
    await renderLoadedPage()

    expect(await screen.findByRole('button', { name: 'Rotate' })).toBeInTheDocument()
  })

  it('shows rotate button for owner users', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(() =>
      Promise.resolve({
        status: 'success',
        data: {
          can_rotate_api_key: true,
          can_rename_app: true,
          can_change_retention: true,
          can_write_sdk_config: true,
          can_create_app: true,
          members: [],
        },
      })
    )

    await renderLoadedPage()

    expect(await screen.findByRole('button', { name: 'Rotate' })).toBeInTheDocument()
  })

  it('disables rotate button for non-admin users', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(() =>
      Promise.resolve({
        status: 'success',
        data: {
          can_rotate_api_key: false,
          can_rename_app: false,
          can_change_retention: false,
          can_write_sdk_config: false,
          can_create_app: false,
          members: [],
        },
      })
    )

    await renderLoadedPage()

    expect(screen.getByRole('button', { name: 'Rotate' })).toBeDisabled()
    expect(screen.getByTestId('create-app-mock')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('sdk-configurator-mock')).toHaveAttribute('data-can-change', 'false')
  })

  it('keeps retention and rename save disabled for non-admin users', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(() =>
      Promise.resolve({
        status: 'success',
        data: {
          can_rotate_api_key: false,
          can_rename_app: false,
          can_change_retention: false,
          can_write_sdk_config: false,
          can_create_app: false,
          members: [],
        },
      })
    )

    await renderLoadedPage()

    await act(async () => {
      fireEvent.click(screen.getByTestId('retention-select-90'))
    })

    const renameInput = screen.getByDisplayValue('Demo App')
    await act(async () => {
      fireEvent.change(renameInput, { target: { value: 'Renamed App' } })
    })

    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    expect(saveButtons[0]).toBeDisabled()
    expect(saveButtons[1]).toBeDisabled()
    expect(screen.getByDisplayValue('Renamed App')).toBeDisabled()
    expect(screen.getByTestId('retention-select-90')).toBeDisabled()
  })

  it('handles authz API error by disabling rotate button', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error' }))

    await renderLoadedPage()

    expect(screen.getByRole('button', { name: 'Rotate' })).toBeDisabled()
    expect(screen.getByTestId('create-app-mock')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('sdk-configurator-mock')).toHaveAttribute('data-can-change', 'false')
  })

  it('handles authz API cancelled by disabling app write controls', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'cancelled' }))

    await renderLoadedPage()

    expect(screen.getByRole('button', { name: 'Rotate' })).toBeDisabled()
    expect(screen.getByTestId('create-app-mock')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('sdk-configurator-mock')).toHaveAttribute('data-can-change', 'false')
  })

  it('handles missing permission flags by disabling rotate button', async () => {
    const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
    fetchAuthzAndMembersFromServer.mockImplementationOnce(() =>
      Promise.resolve({
        status: 'success',
        data: {
          members: [],
        },
      })
    )

    await renderLoadedPage()

    expect(screen.getByRole('button', { name: 'Rotate' })).toBeDisabled()
    expect(screen.getByTestId('create-app-mock')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('sdk-configurator-mock')).toHaveAttribute('data-can-change', 'false')
  })

  it('opens rotate confirmation dialog with warning text', async () => {
    await renderLoadedPage()

    await openRotateDialog()

    expect(screen.getByText(/won't be able to send data anymore/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes, rotate key' })).toBeInTheDocument()
  })

  it('cancels rotate and does not call API', async () => {
    const { changeAppApiKeyFromServer } = require('@/app/api/api_calls')

    await renderLoadedPage()
    await openRotateDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(changeAppApiKeyFromServer).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Yes, rotate key' })).not.toBeInTheDocument()
  })

  it('rotates API key successfully, reloads filters, and updates displayed key', async () => {
    const { changeAppApiKeyFromServer } = require('@/app/api/api_calls')

    await renderLoadedPage()
    await openRotateDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, rotate key' }))
    })

    expect(changeAppApiKeyFromServer).toHaveBeenCalledWith('app-1')
    expect(mockToastPositive).toHaveBeenCalledWith('API key rotated')
    expect(mockRefreshFilters).toHaveBeenCalled()
    expect(await screen.findAllByDisplayValue('msrsh_rotated_key_checksum')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Yes, rotate key' })).not.toBeInTheDocument()
  })

  it('shows failure toast when API key rotation fails', async () => {
    const { changeAppApiKeyFromServer } = require('@/app/api/api_calls')
    changeAppApiKeyFromServer.mockImplementationOnce(() =>
      Promise.resolve({ status: 'error' })
    )

    await renderLoadedPage()
    await openRotateDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, rotate key' }))
    })

    expect(mockToastNegative).toHaveBeenCalledWith('Error rotating API key')
    expect(mockRefreshFilters).not.toHaveBeenCalled()
  })

  it('handles cancelled rotate without toasts', async () => {
    const { changeAppApiKeyFromServer } = require('@/app/api/api_calls')
    changeAppApiKeyFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'cancelled' }))

    await renderLoadedPage()
    await openRotateDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, rotate key' }))
    })

    expect(mockToastPositive).not.toHaveBeenCalled()
    expect(mockToastNegative).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Rotate' })).not.toBeDisabled()
  })


  it('disables rotate button while rotation is in progress and prevents repeated submit', async () => {
    const { changeAppApiKeyFromServer } = require('@/app/api/api_calls')

    let resolvePromise: (value: any) => void
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    changeAppApiKeyFromServer.mockImplementationOnce(() => pendingPromise)

    await renderLoadedPage()
    await openRotateDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, rotate key' }))
    })

    const rotateButton = screen.getByRole('button', { name: 'Rotate' })
    expect(rotateButton).toBeDisabled()

    await act(async () => {
      fireEvent.click(rotateButton)
    })

    expect(screen.queryByRole('button', { name: 'Yes, rotate key' })).not.toBeInTheDocument()
    expect(changeAppApiKeyFromServer).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolvePromise!({ status: 'success' })
    })
  })

  it('enables rename save only when name changes', async () => {
    await renderLoadedPage()

    const renameInput = screen.getByDisplayValue('Demo App')
    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    const renameSaveButton = saveButtons[1]

    expect(renameSaveButton).toBeDisabled()

    await act(async () => {
      fireEvent.change(renameInput, { target: { value: 'Renamed App' } })
    })

    expect(renameSaveButton).not.toBeDisabled()
  })

  it('renames app successfully', async () => {
    const { changeAppNameFromServer } = require('@/app/api/api_calls')

    await renderLoadedPage()
    await openRenameDialog()

    expect(screen.getByText(/Are you sure you want to rename app/i)).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    expect(changeAppNameFromServer).toHaveBeenCalledWith('app-1', 'Renamed App')
    expect(mockToastPositive).toHaveBeenCalledWith('App name changed')
    expect(mockRefreshFilters).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: "Yes, I'm sure" })).not.toBeInTheDocument()
  })

  it('disables rename actions while rename is in progress and prevents double submit', async () => {
    const { changeAppNameFromServer } = require('@/app/api/api_calls')

    let resolvePromise: (value: any) => void
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    changeAppNameFromServer.mockImplementationOnce(() => pendingPromise)

    await renderLoadedPage()
    await openRenameDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    const renameSaveButton = screen.getAllByRole('button', { name: 'Save' })[1]
    expect(renameSaveButton).toBeDisabled()
    expect(changeAppNameFromServer).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.click(renameSaveButton)
    })
    expect(changeAppNameFromServer).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolvePromise!({ status: 'success' })
    })
  })

  it('shows rename error toast on failure', async () => {
    const { changeAppNameFromServer } = require('@/app/api/api_calls')
    changeAppNameFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error' }))

    await renderLoadedPage()
    await openRenameDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    expect(mockToastNegative).toHaveBeenCalledWith('Error changing app name')
  })

  it('handles cancelled rename without toasts', async () => {
    const { changeAppNameFromServer } = require('@/app/api/api_calls')
    changeAppNameFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'cancelled' }))

    await renderLoadedPage()
    await openRenameDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    expect(mockToastPositive).not.toHaveBeenCalled()
    expect(mockToastNegative).not.toHaveBeenCalled()
  })


  it('cancels rename and does not call API', async () => {
    const { changeAppNameFromServer } = require('@/app/api/api_calls')

    await renderLoadedPage()
    await openRenameDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(changeAppNameFromServer).not.toHaveBeenCalled()
  })

  it('enables retention save when retention period changes', async () => {
    await renderLoadedPage()

    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    const retentionSaveButton = saveButtons[0]

    expect(retentionSaveButton).toBeDisabled()

    await act(async () => {
      fireEvent.click(screen.getByTestId('retention-select-90'))
    })

    expect(retentionSaveButton).not.toBeDisabled()
  })

  it('updates retention successfully', async () => {
    const { updateAppRetentionFromServer } = require('@/app/api/api_calls')

    await renderLoadedPage()
    await openRetentionDialog()

    expect(screen.getByText(/change the retention period/i)).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    expect(updateAppRetentionFromServer).toHaveBeenCalledWith('app-1', { retention: 90 })
    expect(mockToastPositive).toHaveBeenCalledWith('Your app settings have been saved')
    expect(screen.queryByRole('button', { name: "Yes, I'm sure" })).not.toBeInTheDocument()
  })

  it('disables retention actions while update is in progress and prevents double submit', async () => {
    const { updateAppRetentionFromServer } = require('@/app/api/api_calls')

    let resolvePromise: (value: any) => void
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    updateAppRetentionFromServer.mockImplementationOnce(() => pendingPromise)

    await renderLoadedPage()
    await openRetentionDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    const retentionSaveButton = screen.getAllByRole('button', { name: 'Save' })[0]
    expect(retentionSaveButton).toBeDisabled()
    expect(updateAppRetentionFromServer).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.click(retentionSaveButton)
    })
    expect(updateAppRetentionFromServer).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolvePromise!({ status: 'success' })
    })
  })

  it('shows retention error toast on failure', async () => {
    const { updateAppRetentionFromServer } = require('@/app/api/api_calls')
    updateAppRetentionFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error', error: 'bad retention' }))

    await renderLoadedPage()
    await openRetentionDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    expect(mockToastNegative).toHaveBeenCalledWith('Error saving app settings', 'bad retention')
  })

  it('handles cancelled retention update without toasts', async () => {
    const { updateAppRetentionFromServer } = require('@/app/api/api_calls')
    updateAppRetentionFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'cancelled' }))

    await renderLoadedPage()
    await openRetentionDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    expect(mockToastPositive).not.toHaveBeenCalled()
    expect(mockToastNegative).not.toHaveBeenCalled()
  })


  it('cancels retention update and does not call API', async () => {
    const { updateAppRetentionFromServer } = require('@/app/api/api_calls')

    await renderLoadedPage()
    await openRetentionDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(updateAppRetentionFromServer).not.toHaveBeenCalled()
  })

  it('copies API URL from copy sdk variables section', async () => {
    await renderLoadedPage()

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' })

    await act(async () => {
      fireEvent.click(copyButtons[0])
    })

    expect((navigator.clipboard.writeText as jest.Mock)).toHaveBeenCalledWith('https://api.measure.sh')
    expect(mockToastPositive).toHaveBeenCalledWith('Base URL copied to clipboard')
  })

  it('copy buttons are scoped to Copy SDK Variables section', async () => {
    await renderLoadedPage()

    const copySdkHeader = screen.getByText('Copy SDK Variables')
    const section = copySdkHeader.parentElement as HTMLElement
    const copyButtons = within(section).getAllByRole('button', { name: 'Copy' })
    expect(copyButtons).toHaveLength(2)
  })

  it('copies API key from copy sdk variables section', async () => {
    await renderLoadedPage()

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' })

    await act(async () => {
      fireEvent.click(copyButtons[1])
    })

    expect((navigator.clipboard.writeText as jest.Mock)).toHaveBeenCalledWith('msrsh_key_checksum')
    expect(mockToastPositive).toHaveBeenCalledWith('API key copied to clipboard')
  })

  it('retention save is disabled when retention change is not allowed', async () => {
    const { isCloud } = require('@/app/utils/env_utils')
    const { fetchBillingInfoFromServer } = require('@/app/api/api_calls')
    isCloud.mockReturnValueOnce(true)
    fetchBillingInfoFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'success', data: { plan: 'free' } }))

    await renderLoadedPage()

    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    const retentionSaveButton = saveButtons[0]

    await act(async () => {
      fireEvent.click(screen.getByTestId('retention-select-90'))
    })

    expect(retentionSaveButton).toBeDisabled()
  })

  it('retention save remains disabled when billing info fetch fails in cloud mode', async () => {
    const { isCloud } = require('@/app/utils/env_utils')
    const { fetchBillingInfoFromServer } = require('@/app/api/api_calls')
    isCloud.mockReturnValueOnce(true)
    fetchBillingInfoFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'error' }))

    await renderLoadedPage()

    await act(async () => {
      fireEvent.click(screen.getByTestId('retention-select-90'))
    })

    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    const retentionSaveButton = saveButtons[0]
    expect(retentionSaveButton).toBeDisabled()
  })

  it('retention save remains disabled when billing info fetch is cancelled in cloud mode', async () => {
    const { isCloud } = require('@/app/utils/env_utils')
    const { fetchBillingInfoFromServer } = require('@/app/api/api_calls')
    isCloud.mockReturnValueOnce(true)
    fetchBillingInfoFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'cancelled' }))

    await renderLoadedPage()

    await act(async () => {
      fireEvent.click(screen.getByTestId('retention-select-90'))
    })

    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    const retentionSaveButton = saveButtons[0]
    expect(retentionSaveButton).toBeDisabled()
  })

  it('retention save can be enabled for paid plan in cloud', async () => {
    const { isCloud } = require('@/app/utils/env_utils')
    const { fetchBillingInfoFromServer } = require('@/app/api/api_calls')
    isCloud.mockReturnValueOnce(true)
    fetchBillingInfoFromServer.mockImplementationOnce(() => Promise.resolve({ status: 'success', data: { plan: 'pro' } }))

    await renderLoadedPage()

    await act(async () => {
      fireEvent.click(screen.getByTestId('retention-select-90'))
    })

    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    const retentionSaveButton = saveButtons[0]

    await waitFor(() => {
      expect(retentionSaveButton).not.toBeDisabled()
    })
  })
})
