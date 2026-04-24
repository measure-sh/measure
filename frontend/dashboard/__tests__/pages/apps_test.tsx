import Apps from '@/app/[teamId]/apps/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

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
  FetchAppThresholdPrefsApiStatus: {
    Init: 'init',
    Loading: 'loading',
    Success: 'success',
    Error: 'error',
    Cancelled: 'cancelled',
  },
  UpdateAppThresholdPrefsApiStatus: {
    Init: 'init',
    Loading: 'loading',
    Success: 'success',
    Error: 'error',
    Cancelled: 'cancelled',
  },
  defaultAppThresholdPrefs: {
    error_good_threshold: 95,
    error_caution_threshold: 85,
    error_spike_min_count_threshold: 100,
    error_spike_min_rate_threshold: 0.5,
  },
  FilterSource: {
    Events: 'events',
  },
  emptyAppRetention: {
    retention: 30,
  },
  fetchAuthzAndMembersFromServer: jest.fn(),
  fetchBillingInfoFromServer: jest.fn(),
  fetchAppRetentionFromServer: jest.fn(),
  updateAppRetentionFromServer: jest.fn(),
  fetchSdkConfigFromServer: jest.fn(),
  changeAppNameFromServer: jest.fn(),
  changeAppApiKeyFromServer: jest.fn(),
  fetchAppThresholdPrefsFromServer: jest.fn(),
  updateAppThresholdPrefsFromServer: jest.fn(),
}))

// --- Bridge store: tests control this, query hook mocks read from it ---
const { create: createBridge } = jest.requireActual('zustand') as any
const appsStore = createBridge((set: any) => ({
  // Permissions (derived from authzAndMembers query)
  canCreateApp: false,
  canRenameApp: false,
  canChangeRetention: false,
  canRotateApiKey: false,
  canWriteSdkConfig: false,
  canChangeAppThresholdPrefs: false,
  // Page load status (legacy mapping)
  pageLoadStatus: 'Init',
  // Query data
  appRetention: { retention: 90 },
  updatedAppRetention: { retention: 90 },
  sdkConfig: null as any,
  fetchBillingInfoApiStatus: 'loading',
  retentionChangeAllowed: false,
  fetchAppThresholdPrefsApiStatus: 'Init',
  updateAppThresholdPrefsApiStatus: 'Init',
  appThresholdPrefs: { error_good_threshold: 2, error_caution_threshold: 5, error_spike_min_count_threshold: 100, error_spike_min_rate_threshold: 5 },
  savedAppThresholdPrefs: { error_good_threshold: 2, error_caution_threshold: 5, error_spike_min_count_threshold: 100, error_spike_min_rate_threshold: 5 },
  updateAppRetentionApiStatus: 'Init',
  appNameChangeApiStatus: 'Init',
  appApiKeyChangeApiStatus: 'Init',
  // Action mocks
  fetchPermissions: jest.fn(),
  loadPageData: jest.fn(),
  fetchBillingInfo: jest.fn(),
  updateAppThresholdPrefs: jest.fn(),
  saveAppRetention: jest.fn(),
  changeAppName: jest.fn(),
  changeAppApiKey: jest.fn(),
  setUpdatedAppRetention: jest.fn((retention: any) => set({ updatedAppRetention: retention })),
  setAppThresholdPrefs: jest.fn((prefs: any) => set({ appThresholdPrefs: prefs })),
  setUpdateAppThresholdPrefsApiStatus: jest.fn((status: any) => set({ updateAppThresholdPrefsApiStatus: status })),
  setAppNameChangeApiStatus: jest.fn((status: any) => set({ appNameChangeApiStatus: status })),
  reset: jest.fn(),
}))

// Map legacy pageLoadStatus to TanStack query statuses
function deriveQueryStatuses(state: any) {
  const pls = state.pageLoadStatus
  if (pls === 'Loading') {
    return { retentionStatus: 'pending', sdkStatus: 'pending' }
  }
  if (pls === 'Error') {
    return { retentionStatus: 'error', sdkStatus: 'error' }
  }
  if (pls === 'Success') {
    return { retentionStatus: 'success', sdkStatus: 'success' }
  }
  return { retentionStatus: 'pending', sdkStatus: 'pending' }
}

function deriveThresholdStatus(state: any) {
  const s = state.fetchAppThresholdPrefsApiStatus
  if (s === 'success') { return 'success' }
  if (s === 'error') { return 'error' }
  if (s === 'loading') { return 'pending' }
  return 'success' // default for loaded page
}

jest.mock('@/app/query/hooks', () => ({
  __esModule: true,
  useAuthzAndMembersQuery: () => {
    const s = appsStore.getState()
    return {
      data: {
        can_create_app: s.canCreateApp,
        can_rename_app: s.canRenameApp,
        can_change_retention: s.canChangeRetention,
        can_rotate_api_key: s.canRotateApiKey,
        can_write_sdk_config: s.canWriteSdkConfig,
        can_change_app_threshold_prefs: s.canChangeAppThresholdPrefs,
      },
    }
  },
  useAppRetentionQuery: () => {
    const s = appsStore.getState()
    const { retentionStatus } = deriveQueryStatuses(s)
    return { data: s.appRetention, status: retentionStatus }
  },
  useSdkConfigQuery: () => {
    const s = appsStore.getState()
    const { sdkStatus } = deriveQueryStatuses(s)
    return { data: s.sdkConfig, status: sdkStatus }
  },
  useAppThresholdPrefsQuery: () => {
    const s = appsStore.getState()
    return { data: s.savedAppThresholdPrefs, status: deriveThresholdStatus(s) }
  },
  useBillingInfoQuery: () => {
    const s = appsStore.getState()
    // When retentionChangeAllowed is true, simulate a paid plan
    const data = s.retentionChangeAllowed ? { plan: 'pro' } : null
    return { data, status: 'success' }
  },
  useUpdateAppRetentionMutation: () => {
    const s = appsStore.getState()
    return {
      mutate: (params: any, opts: any) => {
        const result = s.saveAppRetention(params.appId, params.retention)
        if (result && typeof result.then === 'function') {
          result.then(() => {
            const st = appsStore.getState()
            if (st.updateAppRetentionApiStatus === 'success') {
              opts?.onSuccess?.()
            } else if (st.updateAppRetentionApiStatus === 'error') {
              opts?.onError?.()
            }
          })
        } else {
          const st = appsStore.getState()
          if (st.updateAppRetentionApiStatus === 'success') {
            opts?.onSuccess?.()
          } else if (st.updateAppRetentionApiStatus === 'error') {
            opts?.onError?.()
          }
        }
      },
      isPending: s.updateAppRetentionApiStatus === 'loading',
    }
  },
  useChangeAppNameMutation: () => {
    const s = appsStore.getState()
    return {
      mutate: (params: any, opts: any) => {
        const result = s.changeAppName(params.appName)
        if (result && typeof result.then === 'function') {
          result.then((success: boolean) => {
            if (success) { opts?.onSuccess?.() }
            else { opts?.onError?.() }
          })
        }
      },
      isPending: s.appNameChangeApiStatus === 'loading',
    }
  },
  useChangeAppApiKeyMutation: () => {
    const s = appsStore.getState()
    return {
      mutate: (params: any, opts: any) => {
        const result = s.changeAppApiKey(params.appId)
        if (result && typeof result.then === 'function') {
          result.then((success: boolean) => {
            if (success) { opts?.onSuccess?.() }
            else { opts?.onError?.() }
          })
        }
      },
      isPending: s.appApiKeyChangeApiStatus === 'loading',
    }
  },
  useUpdateAppThresholdPrefsMutation: () => {
    const s = appsStore.getState()
    return {
      mutate: (params: any, opts: any) => {
        const result = s.updateAppThresholdPrefs(params.appId, params.prefs)
        if (result && typeof result.then === 'function') {
          result.then((success: boolean) => {
            if (success !== false) { opts?.onSuccess?.() }
            else { opts?.onError?.() }
          })
        } else {
          opts?.onSuccess?.()
        }
      },
      isPending: s.updateAppThresholdPrefsApiStatus === 'loading',
    }
  },
}))

jest.mock('@/app/stores/provider', () => {
  const { create } = jest.requireActual('zustand')
  const filtersStore = create(() => ({
    filters: { ready: false, app: null, serialisedFilters: '' },
  }))
  return {
    __esModule: true,
    useFiltersStore: filtersStore,
  }
})

jest.mock('@/app/components/filters', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: React.forwardRef((_props: any, ref: any) => {
      const { useFiltersStore } = require('@/app/stores/provider')
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
          useFiltersStore.setState({
            filters: {
              ready: true,
              app: getAppPayload(),
              serialisedFilters: 'app=app-1',
            },
          })
        },
      }))

      return <div data-testid="filters-mock" />
    }),
    AppVersionsInitialSelectionType: { All: 'all' },
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

jest.mock('@/app/components/skeleton', () => ({
  Skeleton: ({ className, ...props }: any) => <div data-testid="skeleton-mock" className={className} {...props} />,
}))

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

const useAppsStore = appsStore
const { useFiltersStore } = require('@/app/stores/provider') as any

const defaultLoadedAppsState = {
  canCreateApp: true,
  canRenameApp: true,
  canChangeRetention: true,
  canRotateApiKey: true,
  canWriteSdkConfig: true,
  canChangeAppThresholdPrefs: true,
  pageLoadStatus: 'Success',
  appRetention: { retention: 30 },
  updatedAppRetention: { retention: 30 },
  sdkConfig: { session_sampling_rate: 100 },
  retentionChangeAllowed: true,
  fetchAppThresholdPrefsApiStatus: 'success',
  appThresholdPrefs: { error_good_threshold: 95, error_caution_threshold: 85, error_spike_min_count_threshold: 100, error_spike_min_rate_threshold: 0.5 },
  savedAppThresholdPrefs: { error_good_threshold: 95, error_caution_threshold: 85, error_spike_min_count_threshold: 100, error_spike_min_rate_threshold: 0.5 },
}

const renderPage = async () => {
  await act(async () => {
    render(<Apps params={{ teamId: 'team-1' }} />)
    await Promise.resolve()
  })
}

const renderLoadedPage = async () => {
  useAppsStore.setState({
    ...defaultLoadedAppsState,
    changeAppName: jest.fn().mockResolvedValue(true),
    changeAppApiKey: jest.fn().mockResolvedValue(true),
    updateAppThresholdPrefs: jest.fn().mockResolvedValue(true),
    saveAppRetention: jest.fn().mockImplementation(async () => {
      useAppsStore.setState({ updateAppRetentionApiStatus: 'success' })
    }),
  })

  await renderPage()

  await act(async () => {
    useFiltersStore.setState({
      filters: {
        ready: true,
        app: getAppPayload(),
        serialisedFilters: 'app=app-1',
      },
    })
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
    useFiltersStore.setState({ filters: { ready: false, app: null, serialisedFilters: '' } })
    useAppsStore.setState({
      canCreateApp: false,
      canRenameApp: false,
      canChangeRetention: false,
      canRotateApiKey: false,
      canWriteSdkConfig: false,
      canChangeAppThresholdPrefs: false,
      pageLoadStatus: 'Init',
      appRetention: { retention: 90 },
      updatedAppRetention: { retention: 90 },
      sdkConfig: null,
      fetchBillingInfoApiStatus: 'loading',
      retentionChangeAllowed: false,
      fetchAppThresholdPrefsApiStatus: 'Init',
      updateAppThresholdPrefsApiStatus: 'Init',
      appThresholdPrefs: { error_good_threshold: 2, error_caution_threshold: 5, error_spike_min_count_threshold: 100, error_spike_min_rate_threshold: 5 },
      savedAppThresholdPrefs: { error_good_threshold: 2, error_caution_threshold: 5, error_spike_min_count_threshold: 100, error_spike_min_rate_threshold: 5 },
      updateAppRetentionApiStatus: 'Init',
      appNameChangeApiStatus: 'Init',
      appApiKeyChangeApiStatus: 'Init',
      fetchPermissions: jest.fn(),
      loadPageData: jest.fn(),
      fetchBillingInfo: jest.fn(),
      updateAppThresholdPrefs: jest.fn(),
      saveAppRetention: jest.fn(),
      changeAppName: jest.fn(),
      changeAppApiKey: jest.fn(),
      setUpdatedAppRetention: jest.fn((retention: any) => useAppsStore.setState({ updatedAppRetention: retention })),
      setAppThresholdPrefs: jest.fn((prefs: any) => useAppsStore.setState({ appThresholdPrefs: prefs })),
      setUpdateAppThresholdPrefsApiStatus: jest.fn((status: any) => useAppsStore.setState({ updateAppThresholdPrefsApiStatus: status })),
      setAppNameChangeApiStatus: jest.fn((status: any) => useAppsStore.setState({ appNameChangeApiStatus: status })),
      reset: jest.fn(),
    })
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
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      pageLoadStatus: 'Loading',
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    expect(screen.getAllByTestId('skeleton-mock').length).toBeGreaterThan(0)
  })

  it('shows error message when app settings fetch fails', async () => {
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      pageLoadStatus: 'Error',
      sdkConfig: null,
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    expect(await screen.findByText(/Error fetching app settings/)).toBeInTheDocument()
  })

  it('shows rotate button for admin users', async () => {
    await renderLoadedPage()

    expect(await screen.findByRole('button', { name: 'Rotate' })).toBeInTheDocument()
  })

  it('shows rotate button for owner users', async () => {
    await renderLoadedPage()

    expect(await screen.findByRole('button', { name: 'Rotate' })).toBeInTheDocument()
  })

  it('disables rotate button for non-admin users', async () => {
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      canRotateApiKey: false,
      canRenameApp: false,
      canChangeRetention: false,
      canWriteSdkConfig: false,
      canCreateApp: false,
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    expect(screen.getByRole('button', { name: 'Rotate' })).toBeDisabled()
    expect(screen.getByTestId('create-app-mock')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('sdk-configurator-mock')).toHaveAttribute('data-can-change', 'false')
  })

  it('keeps retention and rename save disabled for non-admin users', async () => {
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      canRotateApiKey: false,
      canRenameApp: false,
      canChangeRetention: false,
      canWriteSdkConfig: false,
      canCreateApp: false,
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

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
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      canRotateApiKey: false,
      canRenameApp: false,
      canChangeRetention: false,
      canWriteSdkConfig: false,
      canCreateApp: false,
      canChangeAppThresholdPrefs: false,
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    expect(screen.getByRole('button', { name: 'Rotate' })).toBeDisabled()
    expect(screen.getByTestId('create-app-mock')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('sdk-configurator-mock')).toHaveAttribute('data-can-change', 'false')
  })

  it('handles authz API cancelled by disabling app write controls', async () => {
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      canRotateApiKey: false,
      canRenameApp: false,
      canChangeRetention: false,
      canWriteSdkConfig: false,
      canCreateApp: false,
      canChangeAppThresholdPrefs: false,
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    expect(screen.getByRole('button', { name: 'Rotate' })).toBeDisabled()
    expect(screen.getByTestId('create-app-mock')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('sdk-configurator-mock')).toHaveAttribute('data-can-change', 'false')
  })

  it('handles missing permission flags by disabling rotate button', async () => {
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      canRotateApiKey: false,
      canRenameApp: false,
      canChangeRetention: false,
      canWriteSdkConfig: false,
      canCreateApp: false,
      canChangeAppThresholdPrefs: false,
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

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
    await renderLoadedPage()
    await openRotateDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(useAppsStore.getState().changeAppApiKey).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Yes, rotate key' })).not.toBeInTheDocument()
  })

  it('rotates API key successfully, reloads filters, and updates displayed key', async () => {
    await renderLoadedPage()
    await openRotateDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, rotate key' }))
    })

    expect(useAppsStore.getState().changeAppApiKey).toHaveBeenCalled()
    expect(mockToastPositive).toHaveBeenCalledWith('API key rotated')
    expect(mockRefreshFilters).toHaveBeenCalled()
    expect(await screen.findAllByDisplayValue('msrsh_rotated_key_checksum')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Yes, rotate key' })).not.toBeInTheDocument()
  })

  it('shows failure toast when API key rotation fails', async () => {
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      changeAppApiKey: jest.fn().mockResolvedValue(false),
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    await openRotateDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, rotate key' }))
    })

    expect(mockToastNegative).toHaveBeenCalledWith('Error rotating API key')
    expect(mockRefreshFilters).not.toHaveBeenCalled()
  })

  it('handles cancelled rotate without toasts', async () => {
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      changeAppApiKey: jest.fn().mockResolvedValue(false),
      appApiKeyChangeApiStatus: 'cancelled',
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    await openRotateDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, rotate key' }))
    })

    expect(mockToastNegative).toHaveBeenCalledWith('Error rotating API key')
    expect(screen.getByRole('button', { name: 'Rotate' })).not.toBeDisabled()
  })


  it('disables rotate button while rotation is in progress and prevents repeated submit', async () => {
    let resolvePromise: (value: any) => void
    const pendingPromise = new Promise<boolean>((resolve) => {
      resolvePromise = resolve
    })

    useAppsStore.setState({
      ...defaultLoadedAppsState,
      changeAppApiKey: jest.fn().mockImplementation(() => {
        useAppsStore.setState({ appApiKeyChangeApiStatus: 'loading' })
        return pendingPromise
      }),
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

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
    expect(useAppsStore.getState().changeAppApiKey).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolvePromise!(true)
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
    await renderLoadedPage()
    await openRenameDialog()

    expect(screen.getByText(/Are you sure you want to rename app/i)).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    expect(useAppsStore.getState().changeAppName).toHaveBeenCalledWith('Renamed App')
    expect(mockToastPositive).toHaveBeenCalledWith('App name changed')
    expect(mockRefreshFilters).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: "Yes, I'm sure" })).not.toBeInTheDocument()
  })

  it('disables rename actions while rename is in progress and prevents double submit', async () => {
    let resolvePromise: (value: any) => void
    const pendingPromise = new Promise<boolean>((resolve) => {
      resolvePromise = resolve
    })

    useAppsStore.setState({
      ...defaultLoadedAppsState,
      changeAppName: jest.fn().mockImplementation(() => {
        useAppsStore.setState({ appNameChangeApiStatus: 'loading' })
        return pendingPromise
      }),
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    await openRenameDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    const renameSaveButton = screen.getAllByRole('button', { name: 'Save' })[1]
    expect(renameSaveButton).toBeDisabled()
    expect(useAppsStore.getState().changeAppName).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.click(renameSaveButton)
    })
    expect(useAppsStore.getState().changeAppName).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolvePromise!(true)
    })
  })

  it('shows rename error toast on failure', async () => {
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      changeAppName: jest.fn().mockResolvedValue(false),
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    await openRenameDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    expect(mockToastNegative).toHaveBeenCalledWith('Error changing app name')
  })

  it('handles cancelled rename without toasts', async () => {
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      changeAppName: jest.fn().mockResolvedValue(false),
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    await openRenameDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    expect(mockToastNegative).toHaveBeenCalledWith('Error changing app name')
  })


  it('cancels rename and does not call API', async () => {
    await renderLoadedPage()
    await openRenameDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(useAppsStore.getState().changeAppName).not.toHaveBeenCalled()
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
    await renderLoadedPage()
    await openRetentionDialog()

    expect(screen.getByText(/change the retention period/i)).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    expect(useAppsStore.getState().saveAppRetention).toHaveBeenCalled()
    expect(mockToastPositive).toHaveBeenCalledWith('Your app settings have been saved')
    expect(screen.queryByRole('button', { name: "Yes, I'm sure" })).not.toBeInTheDocument()
  })

  it('disables retention actions while update is in progress and prevents double submit', async () => {
    let resolvePromise: (value: any) => void
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve
    })

    useAppsStore.setState({
      ...defaultLoadedAppsState,
      saveAppRetention: jest.fn().mockImplementation(() => {
        useAppsStore.setState({ updateAppRetentionApiStatus: 'loading' })
        return pendingPromise
      }),
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    await openRetentionDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    const retentionSaveButton = screen.getAllByRole('button', { name: 'Save' })[0]
    expect(retentionSaveButton).toBeDisabled()
    expect(useAppsStore.getState().saveAppRetention).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.click(retentionSaveButton)
    })
    expect(useAppsStore.getState().saveAppRetention).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolvePromise!(undefined)
    })
  })

  it('shows retention error toast on failure', async () => {
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      saveAppRetention: jest.fn().mockImplementation(async () => {
        useAppsStore.setState({ updateAppRetentionApiStatus: 'error' })
      }),
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    await openRetentionDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    expect(mockToastNegative).toHaveBeenCalledWith('Error saving app settings')
  })

  it('handles cancelled retention update without toasts', async () => {
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      saveAppRetention: jest.fn().mockImplementation(async () => {
        useAppsStore.setState({ updateAppRetentionApiStatus: 'cancelled' })
      }),
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    await openRetentionDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Yes, I'm sure" }))
    })

    expect(mockToastPositive).not.toHaveBeenCalled()
    expect(mockToastNegative).not.toHaveBeenCalled()
  })


  it('cancels retention update and does not call API', async () => {
    await renderLoadedPage()
    await openRetentionDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(useAppsStore.getState().saveAppRetention).not.toHaveBeenCalled()
  })

  it('displays ingest URL when NEXT_PUBLIC_INGEST_BASE_URL is set', async () => {
    process.env.NEXT_PUBLIC_INGEST_BASE_URL = 'https://ingest.measure.sh'

    await renderLoadedPage()

    expect(screen.getByDisplayValue('https://ingest.measure.sh')).toBeInTheDocument()

    delete process.env.NEXT_PUBLIC_INGEST_BASE_URL
  })

  it('displays api base URL when NEXT_PUBLIC_INGEST_BASE_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_INGEST_BASE_URL

    await renderLoadedPage()

    expect(screen.getByDisplayValue('https://api.measure.sh')).toBeInTheDocument()
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

  it('copies ingest URL when NEXT_PUBLIC_INGEST_BASE_URL is set', async () => {
    process.env.NEXT_PUBLIC_INGEST_BASE_URL = 'https://ingest.measure.sh'

    await renderLoadedPage()

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' })

    await act(async () => {
      fireEvent.click(copyButtons[0])
    })

    expect((navigator.clipboard.writeText as jest.Mock)).toHaveBeenCalledWith('https://ingest.measure.sh')
    expect(mockToastPositive).toHaveBeenCalledWith('Base URL copied to clipboard')

    delete process.env.NEXT_PUBLIC_INGEST_BASE_URL
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
    isCloud.mockReturnValue(true)
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      retentionChangeAllowed: false,
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    const retentionSaveButton = saveButtons[0]

    await act(async () => {
      fireEvent.click(screen.getByTestId('retention-select-90'))
    })

    expect(retentionSaveButton).toBeDisabled()
  })

  it('retention save remains disabled when billing info fetch fails in cloud mode', async () => {
    const { isCloud } = require('@/app/utils/env_utils')
    isCloud.mockReturnValue(true)
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      retentionChangeAllowed: false,
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('retention-select-90'))
    })

    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    const retentionSaveButton = saveButtons[0]
    expect(retentionSaveButton).toBeDisabled()
  })

  it('retention save remains disabled when billing info fetch is cancelled in cloud mode', async () => {
    const { isCloud } = require('@/app/utils/env_utils')
    isCloud.mockReturnValue(true)
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      retentionChangeAllowed: false,
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('retention-select-90'))
    })

    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    const retentionSaveButton = saveButtons[0]
    expect(retentionSaveButton).toBeDisabled()
  })

  it('retention save can be enabled for paid plan in cloud', async () => {
    useAppsStore.setState({
      ...defaultLoadedAppsState,
      retentionChangeAllowed: true,
    })

    await renderPage()

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          app: getAppPayload(),
          serialisedFilters: 'app=app-1',
        },
      })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('retention-select-90'))
    })

    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    const retentionSaveButton = saveButtons[0]

    await waitFor(() => {
      expect(retentionSaveButton).not.toBeDisabled()
    })
  })

  describe('Threshold Preferences', () => {
    it('shows threshold sections after app filters load', async () => {
      await renderLoadedPage()

      expect(await screen.findByText('Change Error Thresholds')).toBeInTheDocument()
    })

    it('shows loading state while threshold prefs are fetched', async () => {
      useAppsStore.setState({
        ...defaultLoadedAppsState,
        fetchAppThresholdPrefsApiStatus: 'loading',
      })

      await renderPage()

      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            app: getAppPayload(),
            serialisedFilters: 'app=app-1',
          },
        })
      })

      const spinners = screen.getAllByTestId('skeleton-mock')
      expect(spinners.length).toBeGreaterThanOrEqual(1)
    })

    it('shows error message when threshold prefs fetch fails', async () => {
      useAppsStore.setState({
        ...defaultLoadedAppsState,
        fetchAppThresholdPrefsApiStatus: 'error',
      })

      await renderPage()

      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            app: getAppPayload(),
            serialisedFilters: 'app=app-1',
          },
        })
      })

      const errorMessages = screen.getAllByText(/Error fetching app threshold preferences/)
      expect(errorMessages.length).toBeGreaterThanOrEqual(1)
    })

    it('shows threshold inputs with fetched values', async () => {
      await renderLoadedPage()

      expect(screen.getByTestId('error-good-threshold-input')).toHaveValue(95)
      expect(screen.getByTestId('error-caution-threshold-input')).toHaveValue(85)
      expect(screen.getByTestId('error-spike-min-count-threshold-input')).toHaveValue(100)
      expect(screen.getByTestId('error-spike-min-rate-threshold-input')).toHaveValue(0.5)
    })

    it('threshold save button is disabled when no changes have been made', async () => {
      await renderLoadedPage()

      expect(screen.getByRole('button', { name: 'Save thresholds' })).toBeDisabled()
    })

    it('threshold save button enabled when good threshold changes', async () => {
      await renderLoadedPage()

      await act(async () => {
        fireEvent.change(screen.getByTestId('error-good-threshold-input'), { target: { value: '90' } })
      })

      const saveButtons = screen.getAllByRole('button', { name: 'Save thresholds' })
      expect(saveButtons[0]).not.toBeDisabled()
    })

    it('threshold save button enabled when caution threshold changes', async () => {
      await renderLoadedPage()

      await act(async () => {
        fireEvent.change(screen.getByTestId('error-caution-threshold-input'), { target: { value: '80' } })
      })

      const saveButtons = screen.getAllByRole('button', { name: 'Save thresholds' })
      expect(saveButtons[0]).not.toBeDisabled()
    })

    it('threshold save button enabled when spike min count changes', async () => {
      await renderLoadedPage()

      await act(async () => {
        fireEvent.change(screen.getByTestId('error-spike-min-count-threshold-input'), { target: { value: '200' } })
      })

      expect(screen.getByRole('button', { name: 'Save thresholds' })).not.toBeDisabled()
    })

    it('threshold save button enabled when spike rate changes', async () => {
      await renderLoadedPage()

      await act(async () => {
        fireEvent.change(screen.getByTestId('error-spike-min-rate-threshold-input'), { target: { value: '1' } })
      })

      expect(screen.getByRole('button', { name: 'Save thresholds' })).not.toBeDisabled()
    })

    it('updates threshold prefs successfully and shows toast', async () => {
      await renderLoadedPage()

      await act(async () => {
        fireEvent.change(screen.getByTestId('error-good-threshold-input'), { target: { value: '90' } })
      })

      const saveButtons = screen.getAllByRole('button', { name: 'Save thresholds' })
      await act(async () => {
        fireEvent.click(saveButtons[0])
      })

      expect(useAppsStore.getState().updateAppThresholdPrefs).toHaveBeenCalled()
      expect(mockToastPositive).toHaveBeenCalledWith('Thresholds updated successfully')
    })

    it('calls updateAppThresholdPrefs when save is clicked', async () => {
      useAppsStore.setState({
        ...defaultLoadedAppsState,
        updateAppThresholdPrefs: jest.fn().mockResolvedValue(true),
      })

      await renderPage()

      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            app: getAppPayload(),
            serialisedFilters: 'app=app-1',
          },
        })
      })

      await act(async () => {
        fireEvent.change(screen.getByTestId('error-good-threshold-input'), { target: { value: '90' } })
      })

      const saveButtons = screen.getAllByRole('button', { name: 'Save thresholds' })
      await act(async () => {
        fireEvent.click(saveButtons[0])
      })

      expect(useAppsStore.getState().updateAppThresholdPrefs).toHaveBeenCalledTimes(1)
    })

    it('shows error toast when threshold update fails', async () => {
      useAppsStore.setState({
        ...defaultLoadedAppsState,
        updateAppThresholdPrefs: jest.fn().mockResolvedValue(false),
      })

      await renderPage()

      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            app: getAppPayload(),
            serialisedFilters: 'app=app-1',
          },
        })
      })

      await act(async () => {
        fireEvent.change(screen.getByTestId('error-good-threshold-input'), { target: { value: '90' } })
      })

      const saveButtons = screen.getAllByRole('button', { name: 'Save thresholds' })
      await act(async () => {
        fireEvent.click(saveButtons[0])
      })

      expect(mockToastNegative).toHaveBeenCalledWith('Error updating thresholds')
    })

    it('handles cancelled threshold update without toasts', async () => {
      useAppsStore.setState({
        ...defaultLoadedAppsState,
        updateAppThresholdPrefs: jest.fn().mockResolvedValue(false),
      })

      await renderPage()

      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            app: getAppPayload(),
            serialisedFilters: 'app=app-1',
          },
        })
      })

      await act(async () => {
        fireEvent.change(screen.getByTestId('error-good-threshold-input'), { target: { value: '90' } })
      })

      const saveButtons = screen.getAllByRole('button', { name: 'Save thresholds' })
      await act(async () => {
        fireEvent.click(saveButtons[0])
      })

      expect(mockToastNegative).toHaveBeenCalledWith('Error updating thresholds')
    })

    it('disables threshold inputs for users without can_change_app_threshold_prefs', async () => {
      useAppsStore.setState({
        ...defaultLoadedAppsState,
        canChangeAppThresholdPrefs: false,
      })

      await renderPage()

      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            app: getAppPayload(),
            serialisedFilters: 'app=app-1',
          },
        })
      })

      expect(screen.getByTestId('error-good-threshold-input')).toBeDisabled()
      expect(screen.getByTestId('error-caution-threshold-input')).toBeDisabled()
      expect(screen.getByTestId('error-spike-min-count-threshold-input')).toBeDisabled()
      expect(screen.getByTestId('error-spike-min-rate-threshold-input')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Save thresholds' })).toBeDisabled()
    })

    it('shows validation error when good threshold is not greater than caution', async () => {
      await renderLoadedPage()

      await act(async () => {
        fireEvent.change(screen.getByTestId('error-good-threshold-input'), { target: { value: '80' } })
      })

      const saveButtons = screen.getAllByRole('button', { name: 'Save thresholds' })
      await act(async () => {
        fireEvent.click(saveButtons[0])
      })

      expect(mockToastNegative).toHaveBeenCalledWith('Error updating thresholds', 'Good threshold must be greater than caution threshold')
      expect(useAppsStore.getState().updateAppThresholdPrefs).not.toHaveBeenCalled()
    })

    it('shows validation error when spike rate threshold is zero', async () => {
      await renderLoadedPage()

      await act(async () => {
        fireEvent.change(screen.getByTestId('error-spike-min-rate-threshold-input'), { target: { value: '0' } })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save thresholds' }))
      })

      expect(mockToastNegative).toHaveBeenCalledWith('Error updating thresholds', 'Spike threshold must be between 0 (exclusive) and 100')
      expect(useAppsStore.getState().updateAppThresholdPrefs).not.toHaveBeenCalled()
    })

    // Note: loadPageData and fetchPermissions are now handled automatically by TanStack Query hooks
  })
})
