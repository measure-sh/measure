import UsageThresholdBanner from '@/app/components/usage_threshold_banner'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock query hook
let mockThresholdData: number | undefined = undefined

jest.mock('@/app/query/hooks', () => ({
  __esModule: true,
  useUsageThresholdQuery: () => ({
    data: mockThresholdData,
    status: mockThresholdData !== undefined ? 'success' : 'pending',
    error: null,
  }),
}))

jest.mock('@/app/utils/feature_flag_utils', () => ({
  isBillingEnabled: jest.fn(),
}))

jest.mock('next/link', () => {
  return function MockLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
    return <a href={href} className={className}>{children}</a>
  }
})

const { isBillingEnabled } = require('@/app/utils/feature_flag_utils')

describe('UsageThresholdBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockThresholdData = undefined
  })

  describe('When billing is disabled', () => {
    it('renders nothing', () => {
      isBillingEnabled.mockReturnValue(false)
      mockThresholdData = undefined

      const { container } = render(<UsageThresholdBanner teamId="team-1" />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('When the API returns threshold 0', () => {
    it('renders nothing', () => {
      isBillingEnabled.mockReturnValue(true)
      mockThresholdData = 0

      const { container } = render(<UsageThresholdBanner teamId="team-1" />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('When the threshold is undefined (pending)', () => {
    it('renders nothing gracefully', () => {
      isBillingEnabled.mockReturnValue(true)
      mockThresholdData = undefined

      const { container } = render(<UsageThresholdBanner teamId="team-1" />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('When threshold is 75', () => {
    it('shows yellow banner with 75% message', () => {
      isBillingEnabled.mockReturnValue(true)
      mockThresholdData = 75

      render(<UsageThresholdBanner teamId="team-1" />)

      expect(screen.getByText('75% of free plan used.')).toBeInTheDocument()

      const banner = screen.getByText('75% of free plan used.').parentElement!
      expect(banner).toHaveClass('bg-yellow-300')
      expect(banner).toHaveClass('text-primary-foreground')
    })

    it('shows Upgrade to Pro link pointing to usage page', () => {
      isBillingEnabled.mockReturnValue(true)
      mockThresholdData = 75

      render(<UsageThresholdBanner teamId="team-1" />)

      const link = screen.getByRole('link', { name: /Upgrade to Pro/i })
      expect(link).toHaveAttribute('href', '/team-1/usage')
    })
  })

  describe('When threshold is 90', () => {
    it('shows orange banner with 90% message', () => {
      isBillingEnabled.mockReturnValue(true)
      mockThresholdData = 90

      render(<UsageThresholdBanner teamId="team-1" />)

      expect(screen.getByText('90% of free plan used.')).toBeInTheDocument()

      const banner = screen.getByText('90% of free plan used.').parentElement!
      expect(banner).toHaveClass('bg-orange-600')
      expect(banner).toHaveClass('text-accent-foreground')
    })

    it('shows Upgrade to Pro link pointing to usage page', () => {
      isBillingEnabled.mockReturnValue(true)
      mockThresholdData = 90

      render(<UsageThresholdBanner teamId="team-1" />)

      const link = screen.getByRole('link', { name: /Upgrade to Pro/i })
      expect(link).toHaveAttribute('href', '/team-1/usage')
    })
  })

  describe('When threshold is 100', () => {
    it('shows red banner with ingest blocked message', () => {
      isBillingEnabled.mockReturnValue(true)
      mockThresholdData = 100

      render(<UsageThresholdBanner teamId="team-1" />)

      expect(screen.getByText('100% of free plan used — event ingestion blocked.')).toBeInTheDocument()

      const banner = screen.getByText('100% of free plan used — event ingestion blocked.').parentElement!
      expect(banner).toHaveClass('bg-red-500')
      expect(banner).toHaveClass('text-accent-foreground')
    })

    it('shows Upgrade to Pro link pointing to usage page', () => {
      isBillingEnabled.mockReturnValue(true)
      mockThresholdData = 100

      render(<UsageThresholdBanner teamId="team-1" />)

      const link = screen.getByRole('link', { name: /Upgrade to Pro/i })
      expect(link).toHaveAttribute('href', '/team-1/usage')
    })
  })

  describe('When teamId changes', () => {
    it('updates the upgrade link href for the new team', () => {
      isBillingEnabled.mockReturnValue(true)
      mockThresholdData = 75

      const { rerender } = render(<UsageThresholdBanner teamId="team-1" />)

      const link1 = screen.getByRole('link', { name: /Upgrade to Pro/i })
      expect(link1).toHaveAttribute('href', '/team-1/usage')

      rerender(<UsageThresholdBanner teamId="team-2" />)

      const link2 = screen.getByRole('link', { name: /Upgrade to Pro/i })
      expect(link2).toHaveAttribute('href', '/team-2/usage')
    })
  })
})
