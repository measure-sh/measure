import UsageThresholdBanner from '@/app/components/usage_threshold_banner'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

const mockFetchBillingUsageThresholdFromServer = jest.fn()

jest.mock('@/app/utils/feature_flag_utils', () => ({
  isBillingEnabled: jest.fn(),
}))

jest.mock('@/app/api/api_calls', () => ({
  __esModule: true,
  FetchBillingUsageThresholdApiStatus: {
    Loading: 'Loading',
    Success: 'Success',
    Error: 'Error',
    Cancelled: 'Cancelled',
  },
  fetchBillingUsageThresholdFromServer: (...args: unknown[]) => mockFetchBillingUsageThresholdFromServer(...args),
}))

jest.mock('next/link', () => {
  return function MockLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
    return <a href={href} className={className}>{children}</a>
  }
})

const { isBillingEnabled } = require('@/app/utils/feature_flag_utils')
const { FetchBillingUsageThresholdApiStatus } = require('@/app/api/api_calls')

const successResponse = (threshold: number) => ({
  status: FetchBillingUsageThresholdApiStatus.Success,
  data: { threshold },
})

const errorResponse = () => ({
  status: FetchBillingUsageThresholdApiStatus.Error,
  data: null,
})

describe('UsageThresholdBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('When billing is disabled', () => {
    it('renders nothing and does not call the API', async () => {
      isBillingEnabled.mockReturnValue(false)

      const { container } = render(<UsageThresholdBanner teamId="team-1" />)

      expect(container.firstChild).toBeNull()
      expect(mockFetchBillingUsageThresholdFromServer).not.toHaveBeenCalled()
    })
  })

  describe('When the API returns threshold 0', () => {
    it('renders nothing', async () => {
      isBillingEnabled.mockReturnValue(true)
      mockFetchBillingUsageThresholdFromServer.mockResolvedValue(successResponse(0))

      const { container } = render(<UsageThresholdBanner teamId="team-1" />)

      await waitFor(() => {
        expect(mockFetchBillingUsageThresholdFromServer).toHaveBeenCalledWith('team-1')
      })

      expect(container.firstChild).toBeNull()
    })
  })

  describe('When the API call fails', () => {
    it('renders nothing gracefully', async () => {
      isBillingEnabled.mockReturnValue(true)
      mockFetchBillingUsageThresholdFromServer.mockResolvedValue(errorResponse())

      const { container } = render(<UsageThresholdBanner teamId="team-1" />)

      await waitFor(() => {
        expect(mockFetchBillingUsageThresholdFromServer).toHaveBeenCalled()
      })

      expect(container.firstChild).toBeNull()
    })
  })

  describe('When threshold is 75', () => {
    it('shows yellow banner with 75% message', async () => {
      isBillingEnabled.mockReturnValue(true)
      mockFetchBillingUsageThresholdFromServer.mockResolvedValue(successResponse(75))

      render(<UsageThresholdBanner teamId="team-1" />)

      await waitFor(() => {
        expect(screen.getByText('75% of free plan used.')).toBeInTheDocument()
      })

      const banner = screen.getByText('75% of free plan used.').parentElement!
      expect(banner).toHaveClass('bg-yellow-300')
      expect(banner).toHaveClass('text-primary-foreground')
    })

    it('shows Upgrade to Pro link pointing to usage page', async () => {
      isBillingEnabled.mockReturnValue(true)
      mockFetchBillingUsageThresholdFromServer.mockResolvedValue(successResponse(75))

      render(<UsageThresholdBanner teamId="team-1" />)

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /Upgrade to Pro/i })
        expect(link).toHaveAttribute('href', '/team-1/usage')
      })
    })
  })

  describe('When threshold is 90', () => {
    it('shows orange banner with 90% message', async () => {
      isBillingEnabled.mockReturnValue(true)
      mockFetchBillingUsageThresholdFromServer.mockResolvedValue(successResponse(90))

      render(<UsageThresholdBanner teamId="team-1" />)

      await waitFor(() => {
        expect(screen.getByText('90% of free plan used.')).toBeInTheDocument()
      })

      const banner = screen.getByText('90% of free plan used.').parentElement!
      expect(banner).toHaveClass('bg-orange-600')
      expect(banner).toHaveClass('text-accent-foreground')
    })

    it('shows Upgrade to Pro link pointing to usage page', async () => {
      isBillingEnabled.mockReturnValue(true)
      mockFetchBillingUsageThresholdFromServer.mockResolvedValue(successResponse(90))

      render(<UsageThresholdBanner teamId="team-1" />)

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /Upgrade to Pro/i })
        expect(link).toHaveAttribute('href', '/team-1/usage')
      })
    })
  })

  describe('When threshold is 100', () => {
    it('shows red banner with ingest blocked message', async () => {
      isBillingEnabled.mockReturnValue(true)
      mockFetchBillingUsageThresholdFromServer.mockResolvedValue(successResponse(100))

      render(<UsageThresholdBanner teamId="team-1" />)

      await waitFor(() => {
        expect(screen.getByText('100% of free plan used — event ingestion blocked.')).toBeInTheDocument()
      })

      const banner = screen.getByText('100% of free plan used — event ingestion blocked.').parentElement!
      expect(banner).toHaveClass('bg-red-500')
      expect(banner).toHaveClass('text-accent-foreground')
    })

    it('shows Upgrade to Pro link pointing to usage page', async () => {
      isBillingEnabled.mockReturnValue(true)
      mockFetchBillingUsageThresholdFromServer.mockResolvedValue(successResponse(100))

      render(<UsageThresholdBanner teamId="team-1" />)

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /Upgrade to Pro/i })
        expect(link).toHaveAttribute('href', '/team-1/usage')
      })
    })
  })

  describe('When teamId changes', () => {
    it('re-fetches data for the new team', async () => {
      isBillingEnabled.mockReturnValue(true)
      mockFetchBillingUsageThresholdFromServer.mockResolvedValue(successResponse(75))

      const { rerender } = render(<UsageThresholdBanner teamId="team-1" />)

      await waitFor(() => {
        expect(mockFetchBillingUsageThresholdFromServer).toHaveBeenCalledWith('team-1')
      })

      await act(async () => {
        rerender(<UsageThresholdBanner teamId="team-2" />)
      })

      await waitFor(() => {
        expect(mockFetchBillingUsageThresholdFromServer).toHaveBeenCalledWith('team-2')
      })

      expect(mockFetchBillingUsageThresholdFromServer).toHaveBeenCalledTimes(2)
    })

    it('updates the upgrade link href for the new team', async () => {
      isBillingEnabled.mockReturnValue(true)
      mockFetchBillingUsageThresholdFromServer.mockResolvedValue(successResponse(75))

      const { rerender } = render(<UsageThresholdBanner teamId="team-1" />)

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /Upgrade to Pro/i })
        expect(link).toHaveAttribute('href', '/team-1/usage')
      })

      await act(async () => {
        rerender(<UsageThresholdBanner teamId="team-2" />)
      })

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /Upgrade to Pro/i })
        expect(link).toHaveAttribute('href', '/team-2/usage')
      })
    })
  })
})
