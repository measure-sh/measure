import UsageThresholdBanner from '@/app/components/usage_threshold_banner'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock query hook
let mockBillingInfo: any = undefined

jest.mock('@/app/query/hooks', () => ({
  __esModule: true,
  useBillingInfoQuery: () => ({
    data: mockBillingInfo,
    status: mockBillingInfo !== undefined ? 'success' : 'pending',
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

// Helper: build a billingInfo payload that produces a given usage percentage on Free.
function freeAt(percent: number) {
  const granted = 5_000_000_000
  return { plan: 'free', bytes_granted: granted, bytes_used: granted * (percent / 100) }
}

describe('UsageThresholdBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBillingInfo = undefined
  })

  describe('When billing is disabled', () => {
    it('renders nothing', () => {
      isBillingEnabled.mockReturnValue(false)
      mockBillingInfo = undefined

      const { container } = render(<UsageThresholdBanner teamId="team-1" />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('When usage is below 75%', () => {
    it('renders nothing', () => {
      isBillingEnabled.mockReturnValue(true)
      mockBillingInfo = freeAt(50)

      const { container } = render(<UsageThresholdBanner teamId="team-1" />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('When billingInfo is undefined (pending)', () => {
    it('renders nothing gracefully', () => {
      isBillingEnabled.mockReturnValue(true)
      mockBillingInfo = undefined

      const { container } = render(<UsageThresholdBanner teamId="team-1" />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('When the team is not on the Free plan', () => {
    it('renders nothing even at 100% usage (Pro/Enterprise have their own overage rules)', () => {
      isBillingEnabled.mockReturnValue(true)
      mockBillingInfo = { plan: 'pro', bytes_granted: 25_000_000_000, bytes_used: 25_000_000_000 }

      const { container } = render(<UsageThresholdBanner teamId="team-1" />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('When usage is in the 75% bucket', () => {
    it('shows yellow banner with 75% message', () => {
      isBillingEnabled.mockReturnValue(true)
      mockBillingInfo = freeAt(80)

      render(<UsageThresholdBanner teamId="team-1" />)

      expect(screen.getByText('75% of free plan used.')).toBeInTheDocument()

      const banner = screen.getByText('75% of free plan used.').parentElement!
      expect(banner).toHaveClass('bg-yellow-300')
      expect(banner).toHaveClass('text-primary-foreground')
    })

    it('shows Upgrade to Pro link pointing to usage page', () => {
      isBillingEnabled.mockReturnValue(true)
      mockBillingInfo = freeAt(80)

      render(<UsageThresholdBanner teamId="team-1" />)

      const link = screen.getByRole('link', { name: /Upgrade to Pro/i })
      expect(link).toHaveAttribute('href', '/team-1/usage')
    })
  })

  describe('When usage is in the 90% bucket', () => {
    it('shows orange banner with 90% message', () => {
      isBillingEnabled.mockReturnValue(true)
      mockBillingInfo = freeAt(95)

      render(<UsageThresholdBanner teamId="team-1" />)

      expect(screen.getByText('90% of free plan used.')).toBeInTheDocument()

      const banner = screen.getByText('90% of free plan used.').parentElement!
      expect(banner).toHaveClass('bg-orange-600')
      expect(banner).toHaveClass('text-accent-foreground')
    })

    it('shows Upgrade to Pro link pointing to usage page', () => {
      isBillingEnabled.mockReturnValue(true)
      mockBillingInfo = freeAt(95)

      render(<UsageThresholdBanner teamId="team-1" />)

      const link = screen.getByRole('link', { name: /Upgrade to Pro/i })
      expect(link).toHaveAttribute('href', '/team-1/usage')
    })
  })

  describe('When usage is at or above 100%', () => {
    it('shows red banner with ingest blocked message', () => {
      isBillingEnabled.mockReturnValue(true)
      mockBillingInfo = freeAt(100)

      render(<UsageThresholdBanner teamId="team-1" />)

      expect(screen.getByText('100% of free plan used — event ingestion blocked.')).toBeInTheDocument()

      const banner = screen.getByText('100% of free plan used — event ingestion blocked.').parentElement!
      expect(banner).toHaveClass('bg-red-500')
      expect(banner).toHaveClass('text-accent-foreground')
    })

    it('shows Upgrade to Pro link pointing to usage page', () => {
      isBillingEnabled.mockReturnValue(true)
      mockBillingInfo = freeAt(100)

      render(<UsageThresholdBanner teamId="team-1" />)

      const link = screen.getByRole('link', { name: /Upgrade to Pro/i })
      expect(link).toHaveAttribute('href', '/team-1/usage')
    })
  })

  describe('When teamId changes', () => {
    it('updates the upgrade link href for the new team', () => {
      isBillingEnabled.mockReturnValue(true)
      mockBillingInfo = freeAt(80)

      const { rerender } = render(<UsageThresholdBanner teamId="team-1" />)

      const link1 = screen.getByRole('link', { name: /Upgrade to Pro/i })
      expect(link1).toHaveAttribute('href', '/team-1/usage')

      rerender(<UsageThresholdBanner teamId="team-2" />)

      const link2 = screen.getByRole('link', { name: /Upgrade to Pro/i })
      expect(link2).toHaveAttribute('href', '/team-2/usage')
    })
  })
})
