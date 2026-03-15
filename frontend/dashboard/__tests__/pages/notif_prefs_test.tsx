import Notifications from '@/app/[teamId]/notif_prefs/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockFetchNotifPrefs = jest.fn()
const mockUpdateNotifPrefs = jest.fn()
const mockToastPositive = jest.fn()
const mockToastNegative = jest.fn()

jest.mock('@/app/utils/use_toast', () => ({
  toastPositive: (...args: any[]) => mockToastPositive(...args),
  toastNegative: (...args: any[]) => mockToastNegative(...args),
}))

jest.mock('@/app/api/api_calls', () => ({
  __esModule: true,
  FetchNotifPrefsApiStatus: { Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  UpdateNotifPrefsApiStatus: { Init: 'init', Loading: 'loading', Success: 'success', Error: 'error', Cancelled: 'cancelled' },
  emptyNotifPrefs: {
    error_spike: true,
    app_hang_spike: true,
    bug_report: true,
    daily_summary: true,
  },
  fetchNotifPrefsFromServer: (...args: any[]) => mockFetchNotifPrefs(...args),
  updateNotifPrefsFromServer: (...args: any[]) => mockUpdateNotifPrefs(...args),
}))

jest.mock('@/app/components/button', () => ({
  Button: ({ children, loading, disabled, ...props }: any) => (
    <button disabled={disabled || loading} {...props}>{children}</button>
  ),
}))

jest.mock('@/app/components/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      role="checkbox"
      checked={checked}
      onChange={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}))

jest.mock('@/app/components/loading_spinner', () => ({
  __esModule: true,
  default: () => <div data-testid="loading-spinner">Loading...</div>,
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

const defaultNotifPrefs = {
  error_spike: true,
  app_hang_spike: true,
  bug_report: true,
  daily_summary: true,
}

describe('Notifications page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state initially', () => {
    mockFetchNotifPrefs.mockReturnValue(new Promise(() => { }))
    render(<Notifications />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders four notification checkboxes with correct labels', async () => {
    mockFetchNotifPrefs.mockResolvedValue({ status: 'success', data: defaultNotifPrefs })
    render(<Notifications />)

    await waitFor(() => {
      expect(screen.getByText('Crash Spike email')).toBeInTheDocument()
      expect(screen.getByText('ANR spike email')).toBeInTheDocument()
      expect(screen.getByText('Bug Reports')).toBeInTheDocument()
      expect(screen.getByText('Daily Summary')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(4)
    checkboxes.forEach((cb) => {
      expect(cb).toBeChecked()
    })
  })

  it('renders page title as Notifications', async () => {
    mockFetchNotifPrefs.mockResolvedValue({ status: 'success', data: defaultNotifPrefs })
    render(<Notifications />)

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })
  })

  it('renders description text', async () => {
    mockFetchNotifPrefs.mockResolvedValue({ status: 'success', data: defaultNotifPrefs })
    render(<Notifications />)

    await waitFor(() => {
      expect(screen.getByText(/Choose which email notifications you want to receive/)).toBeInTheDocument()
    })
  })

  it('save button is disabled when no changes', async () => {
    mockFetchNotifPrefs.mockResolvedValue({ status: 'success', data: defaultNotifPrefs })
    render(<Notifications />)

    await waitFor(() => {
      expect(screen.getByText('Crash Spike email')).toBeInTheDocument()
    })

    const saveButton = screen.getByRole('button', { name: 'Save' })
    expect(saveButton).toBeDisabled()
  })

  it('toggling a checkbox enables save button', async () => {
    mockFetchNotifPrefs.mockResolvedValue({ status: 'success', data: defaultNotifPrefs })
    render(<Notifications />)

    await waitFor(() => {
      expect(screen.getByText('Crash Spike email')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    const saveButton = screen.getByRole('button', { name: 'Save' })
    expect(saveButton).not.toBeDisabled()
  })

  it('saves updated preferences with correct payload', async () => {
    mockFetchNotifPrefs.mockResolvedValue({ status: 'success', data: defaultNotifPrefs })
    mockUpdateNotifPrefs.mockResolvedValue({ status: 'success' })
    render(<Notifications />)

    await waitFor(() => {
      expect(screen.getByText('Crash Spike email')).toBeInTheDocument()
    })

    // Uncheck first checkbox (error_spike)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    const saveButton = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockUpdateNotifPrefs).toHaveBeenCalledWith({
        error_spike: false,
        app_hang_spike: true,
        bug_report: true,
        daily_summary: true,
      })
    })
  })

  it('shows success toast after save', async () => {
    mockFetchNotifPrefs.mockResolvedValue({ status: 'success', data: defaultNotifPrefs })
    mockUpdateNotifPrefs.mockResolvedValue({ status: 'success' })
    render(<Notifications />)

    await waitFor(() => {
      expect(screen.getByText('Crash Spike email')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockToastPositive).toHaveBeenCalledWith('Notification preferences saved')
    })
  })

  it('shows error toast on save failure', async () => {
    mockFetchNotifPrefs.mockResolvedValue({ status: 'success', data: defaultNotifPrefs })
    mockUpdateNotifPrefs.mockResolvedValue({ status: 'error', error: 'something went wrong' })
    render(<Notifications />)

    await waitFor(() => {
      expect(screen.getByText('Crash Spike email')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockToastNegative).toHaveBeenCalledWith('Error saving notification preferences', 'something went wrong')
    })
  })

  it('renders team-scoped disclaimer', async () => {
    mockFetchNotifPrefs.mockResolvedValue({ status: 'success', data: defaultNotifPrefs })
    render(<Notifications />)

    await waitFor(() => {
      expect(screen.getByText(/does not affect your team/)).toBeInTheDocument()
    })
  })

  it('shows error when fetch fails', async () => {
    mockFetchNotifPrefs.mockResolvedValue({ status: 'error', data: null })
    render(<Notifications />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch notification preferences/)).toBeInTheDocument()
    })
  })
})
