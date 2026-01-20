import Usage from '@/app/[teamId]/usage/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

// Mock toast functions
const mockToastPositive = jest.fn()
const mockToastNegative = jest.fn()

jest.mock('@/app/utils/use_toast', () => ({
    toastPositive: (...args: any[]) => mockToastPositive(...args),
    toastNegative: (...args: any[]) => mockToastNegative(...args),
}))

// Mock API calls
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    FetchUsageApiStatus: {
        Loading: 0,
        Success: 1,
        Error: 2,
        NoApps: 3,
        Cancelled: 4,
    },
    FetchBillingInfoApiStatus: {
        Loading: 0,
        Success: 1,
        Error: 2,
        Cancelled: 3,
    },
    FetchStripeCheckoutSessionApiStatus: {
        Loading: 0,
        Success: 1,
        Error: 2,
        Cancelled: 3,
    },
    DowngradeToFreeApiStatus: {
        Loading: 0,
        Success: 1,
        Error: 2,
        Cancelled: 3,
    },
    AuthzAndMembersApiStatus: {
        Loading: 0,
        Success: 1,
        Error: 2,
        Cancelled: 3,
    },
    emptyUsage: [
        {
            app_id: '',
            app_name: '',
            monthly_app_usage: [
                { month_year: '', sessions: 0, events: 0, spans: 0 },
            ],
        },
    ],
    fetchUsageFromServer: jest.fn(() =>
        Promise.resolve({
            status: 1, // Success
            data: [
                {
                    app_id: 'app1',
                    app_name: 'My App',
                    monthly_app_usage: [
                        { month_year: '2025-01', sessions: 100, events: 500, spans: 200 },
                        { month_year: '2025-02', sessions: 150, events: 700, spans: 300 },
                    ],
                },
            ],
        })
    ),
    fetchBillingInfoFromServer: jest.fn(() =>
        Promise.resolve({
            status: 1, // Success
            data: {
                team_id: 'team1',
                plan: 'free',
                max_retention: 30,
                max_units: 1000000,
                stripe_customer_id: null,
                stripe_subscription_id: null,
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z',
            },
        })
    ),
    fetchStripeCheckoutSessionFromServer: jest.fn(() =>
        Promise.resolve({
            status: 1, // Success
            data: { checkout_url: 'https://checkout.stripe.com/test' },
        })
    ),
    downgradeToFreeFromServer: jest.fn(() =>
        Promise.resolve({
            status: 1, // Success
            data: {},
        })
    ),
    fetchAuthzAndMembersFromServer: jest.fn(() =>
        Promise.resolve({
            status: 1, // Success
            data: {
                can_change_billing: true,
                members: [
                    { id: 'user1', name: 'Test User', email: 'test@test.com', role: 'owner' },
                ],
            },
        })
    ),
}))

// Mock feature flags - billing enabled by default
jest.mock('@/app/utils/feature_flag_utils', () => ({
    isBillingEnabled: jest.fn(() => true),
}))

// Mock next-themes
jest.mock('next-themes', () => ({
    useTheme: () => ({ theme: 'light' }),
}))

// Mock ResponsivePie
jest.mock('@nivo/pie', () => ({
    ResponsivePie: () => <div data-testid="pie-chart-mock" />,
}))

// Mock DropdownSelect
jest.mock('@/app/components/dropdown_select', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="dropdown-mock">
            <span>{props.title}</span>
        </div>
    ),
    DropdownSelectType: { SingleString: 0 },
}))

// Mock LoadingSpinner
jest.mock('@/app/components/loading_spinner', () => () => (
    <div data-testid="loading-spinner-mock" />
))

// Mock DangerConfirmationDialog
jest.mock('@/app/components/danger_confirmation_dialog', () => ({
    __esModule: true,
    default: (props: any) => {
        if (!props.open) return null
        return (
            <div data-testid="danger-dialog-mock">
                <button data-testid="dialog-affirm" onClick={props.onAffirmativeAction}>
                    {props.affirmativeText}
                </button>
                <button data-testid="dialog-cancel" onClick={props.onCancelAction}>
                    {props.cancelText}
                </button>
            </div>
        )
    },
}))

// Mock Button - pass through as real button elements
jest.mock('@/app/components/button', () => ({
    Button: (props: any) => <button {...props} />,
    buttonVariants: (opts: any) => opts?.variant || 'default',
}))

// Mock Card - pass through as div
jest.mock('@/app/components/card', () => ({
    Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

// Mock next/link
jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

describe('Usage Page', () => {
    const originalLocation = window.location

    beforeEach(() => {
        jest.clearAllMocks()
        jest.useFakeTimers()

        // Reset window.location.search
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...originalLocation, search: '', href: 'http://localhost/team1/usage', pathname: '/team1/usage' },
        })
        window.history.replaceState = jest.fn()
    })

    afterEach(() => {
        jest.useRealTimers()
        Object.defineProperty(window, 'location', {
            writable: true,
            value: originalLocation,
        })
    })

    // ---- Usage section ----

    it('renders the Usage heading', async () => {
        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })
        expect(screen.getByText('Usage')).toBeInTheDocument()
    })

    it('shows loading spinner while fetching usage', async () => {
        const { fetchUsageFromServer } = require('@/app/api/api_calls')

        let resolvePromise: (value: any) => void
        const loadingPromise = new Promise(resolve => {
            resolvePromise = resolve
        })
        fetchUsageFromServer.mockImplementationOnce(() => loadingPromise)

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByTestId('loading-spinner-mock')).toBeInTheDocument()

        // Clean up
        await act(async () => {
            resolvePromise!({ status: 1, data: [] })
        })
    })

    it('shows error message when usage fetch fails', async () => {
        const { fetchUsageFromServer } = require('@/app/api/api_calls')
        fetchUsageFromServer.mockImplementationOnce(() =>
            Promise.resolve({ status: 2 }) // Error
        )

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText(/Error fetching usage data/)).toBeInTheDocument()
    })

    it('shows NoApps message with link when no apps exist', async () => {
        const { fetchUsageFromServer } = require('@/app/api/api_calls')
        fetchUsageFromServer.mockImplementationOnce(() =>
            Promise.resolve({ status: 3 }) // NoApps
        )

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText(/don't have any apps yet/)).toBeInTheDocument()
        const link = screen.getByText('creating your first app!')
        expect(link).toBeInTheDocument()
        expect(link.closest('a')).toHaveAttribute('href', 'apps')
    })

    it('renders pie chart and month dropdown on success', async () => {
        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByTestId('pie-chart-mock')).toBeInTheDocument()
        expect(screen.getByTestId('dropdown-mock')).toBeInTheDocument()
    })

    // ---- Billing section ----

    it('does not render billing section when billing is disabled', async () => {
        const { isBillingEnabled } = require('@/app/utils/feature_flag_utils')
        isBillingEnabled.mockReturnValue(false)

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.queryByText('Billing')).not.toBeInTheDocument()

        isBillingEnabled.mockReturnValue(true)
    })

    it('does not call billing APIs when billing is disabled', async () => {
        const { isBillingEnabled } = require('@/app/utils/feature_flag_utils')
        const { fetchBillingInfoFromServer, fetchAuthzAndMembersFromServer } =
            require('@/app/api/api_calls')

        isBillingEnabled.mockReturnValue(false)

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(fetchBillingInfoFromServer).not.toHaveBeenCalled()
        expect(fetchAuthzAndMembersFromServer).not.toHaveBeenCalled()

        isBillingEnabled.mockReturnValue(true)
    })

    it('shows billing loading spinner while billing info loads', async () => {
        const { fetchBillingInfoFromServer } = require('@/app/api/api_calls')

        let resolvePromise: (value: any) => void
        const loadingPromise = new Promise(resolve => {
            resolvePromise = resolve
        })
        fetchBillingInfoFromServer.mockImplementationOnce(() => loadingPromise)

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // There will be at least one loading spinner for billing
        const spinners = screen.getAllByTestId('loading-spinner-mock')
        expect(spinners.length).toBeGreaterThanOrEqual(1)

        // Clean up
        await act(async () => {
            resolvePromise!({ status: 1, data: { plan: 'free' } })
        })
    })

    it('shows billing error message when billing info fetch fails', async () => {
        const { fetchBillingInfoFromServer } = require('@/app/api/api_calls')
        fetchBillingInfoFromServer.mockImplementationOnce(() =>
            Promise.resolve({ status: 2 }) // Error
        )

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText(/Error fetching billing data/)).toBeInTheDocument()
    })

    it('renders free plan card with Current Plan badge and pricing when on free plan', async () => {
        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText('FREE')).toBeInTheDocument()
        expect(screen.getByText('$0 per month')).toBeInTheDocument()
        expect(screen.getByText('Current Plan')).toBeInTheDocument()
        expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    })

    it('renders pro plan card with Current Plan badge when on pro plan', async () => {
        const { fetchBillingInfoFromServer } = require('@/app/api/api_calls')
        fetchBillingInfoFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 1,
                data: {
                    team_id: 'team1',
                    plan: 'pro',
                    max_retention: 365,
                    max_units: null,
                    stripe_customer_id: 'cus_123',
                    stripe_subscription_id: 'sub_123',
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                },
            })
        )

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText('PRO')).toBeInTheDocument()
        expect(screen.getByText('$50 per month')).toBeInTheDocument()
        expect(screen.getByText('Current Plan')).toBeInTheDocument()
        expect(screen.getByText('Downgrade to Free')).toBeInTheDocument()
        expect(screen.getByText('Contact us')).toBeInTheDocument()
    })

    it('shows units used in current month', async () => {
        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Usage data for 2025-02 (last month = initial): events 700 + spans 300 = 1000
        expect(screen.getByText('1,000')).toBeInTheDocument()
    })

    // ---- Upgrade flow ----

    it('upgrade button is disabled when user cannot change billing', async () => {
        const { fetchAuthzAndMembersFromServer } = require('@/app/api/api_calls')
        fetchAuthzAndMembersFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 1,
                data: {
                    can_change_billing: false,
                    members: [
                        { id: 'user1', name: 'Test User', email: 'test@test.com', role: 'viewer' },
                    ],
                },
            })
        )

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const upgradeButton = screen.getByText('Upgrade to Pro')
        expect(upgradeButton).toBeDisabled()
    })

    it('clicking upgrade calls checkout API and redirects', async () => {
        const { fetchStripeCheckoutSessionFromServer } = require('@/app/api/api_calls')

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const upgradeButton = screen.getByText('Upgrade to Pro')
        await act(async () => {
            fireEvent.click(upgradeButton)
        })

        expect(fetchStripeCheckoutSessionFromServer).toHaveBeenCalled()
        expect(window.location.href).toBe('https://checkout.stripe.com/test')
    })

    it('upgrade with already_upgraded response refreshes billing info and shows toast', async () => {
        const { fetchStripeCheckoutSessionFromServer, fetchBillingInfoFromServer } = require('@/app/api/api_calls')
        fetchStripeCheckoutSessionFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 1,
                data: { already_upgraded: true },
            })
        )

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Clear the initial call count
        fetchBillingInfoFromServer.mockClear()

        const upgradeButton = screen.getByText('Upgrade to Pro')
        await act(async () => {
            fireEvent.click(upgradeButton)
        })

        expect(mockToastPositive).toHaveBeenCalledWith(expect.stringContaining('subscription was found'))
        expect(fetchBillingInfoFromServer).toHaveBeenCalled()
    })

    it('upgrade error shows toast', async () => {
        const { fetchStripeCheckoutSessionFromServer } = require('@/app/api/api_calls')
        fetchStripeCheckoutSessionFromServer.mockImplementationOnce(() =>
            Promise.resolve({ status: 2 }) // Error
        )

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const upgradeButton = screen.getByText('Upgrade to Pro')
        await act(async () => {
            fireEvent.click(upgradeButton)
        })

        expect(mockToastNegative).toHaveBeenCalledWith('Failed to start checkout', 'Please try again.')
    })

    // ---- Downgrade flow ----

    it('clicking downgrade opens confirmation dialog', async () => {
        const { fetchBillingInfoFromServer } = require('@/app/api/api_calls')
        fetchBillingInfoFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 1,
                data: {
                    team_id: 'team1',
                    plan: 'pro',
                    max_retention: 365,
                    max_units: null,
                    stripe_customer_id: 'cus_123',
                    stripe_subscription_id: 'sub_123',
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                },
            })
        )

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const downgradeButton = screen.getByText('Downgrade to Free')
        await act(async () => {
            fireEvent.click(downgradeButton)
        })

        expect(screen.getByTestId('danger-dialog-mock')).toBeInTheDocument()
    })

    it('confirming downgrade calls API and shows success toast', async () => {
        const { fetchBillingInfoFromServer, downgradeToFreeFromServer } = require('@/app/api/api_calls')
        fetchBillingInfoFromServer
            .mockResolvedValueOnce({
                status: 1,
                data: {
                    team_id: 'team1',
                    plan: 'pro',
                    max_retention: 365,
                    max_units: null,
                    stripe_customer_id: 'cus_123',
                    stripe_subscription_id: 'sub_123',
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                },
            })
            // Poll result (success)
            .mockResolvedValueOnce({
                status: 1,
                data: {
                    plan: 'free',
                },
            })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Open dialog
        const downgradeButton = screen.getByText('Downgrade to Free')
        await act(async () => {
            fireEvent.click(downgradeButton)
        })

        // Confirm downgrade
        const affirmButton = screen.getByTestId('dialog-affirm')
        await act(async () => {
            fireEvent.click(affirmButton)
        })

        expect(downgradeToFreeFromServer).toHaveBeenCalledWith('team1')

        // Wait for async handleDowngrade to process polling
        await act(async () => {
            // Let promises resolve
        })

        expect(mockToastPositive).toHaveBeenCalledWith(expect.stringContaining('downgraded to Free'))
    })

    it('downgrade error shows error toast', async () => {
        const { fetchBillingInfoFromServer, downgradeToFreeFromServer } = require('@/app/api/api_calls')
        fetchBillingInfoFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 1,
                data: {
                    team_id: 'team1',
                    plan: 'pro',
                    max_retention: 365,
                    max_units: null,
                    stripe_customer_id: 'cus_123',
                    stripe_subscription_id: 'sub_123',
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                },
            })
        )
        downgradeToFreeFromServer.mockImplementationOnce(() =>
            Promise.resolve({ status: 2 }) // Error
        )

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Open dialog
        const downgradeButton = screen.getByText('Downgrade to Free')
        await act(async () => {
            fireEvent.click(downgradeButton)
        })

        // Confirm downgrade
        const affirmButton = screen.getByTestId('dialog-affirm')
        await act(async () => {
            fireEvent.click(affirmButton)
        })

        expect(mockToastNegative).toHaveBeenCalledWith('Failed to downgrade', 'Please try again.')
    })

    // ---- Stripe redirect handling ----

    it('shows success toast on ?success=true redirect', async () => {
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...originalLocation, search: '?success=true', href: 'http://localhost/team1/usage?success=true', pathname: '/team1/usage' },
        })
        window.history.replaceState = jest.fn()

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Advance timers past the 100ms setTimeout
        await act(async () => {
            jest.advanceTimersByTime(200)
        })

        expect(mockToastPositive).toHaveBeenCalledWith(expect.stringContaining('upgraded to Pro'))
    })

    it('shows cancel toast on ?canceled=true redirect', async () => {
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...originalLocation, search: '?canceled=true', href: 'http://localhost/team1/usage?canceled=true', pathname: '/team1/usage' },
        })
        window.history.replaceState = jest.fn()

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Advance timers past the 100ms setTimeout
        await act(async () => {
            jest.advanceTimersByTime(200)
        })

        expect(mockToastNegative).toHaveBeenCalledWith('Checkout canceled', 'You can try again anytime.')
    })

    it('polls billing info on success redirect until plan is pro', async () => {
        const { fetchBillingInfoFromServer } = require('@/app/api/api_calls')
        // Reset mocks
        fetchBillingInfoFromServer.mockReset()

        // 1. Initial page load
        fetchBillingInfoFromServer.mockResolvedValueOnce({ status: 1, data: { plan: 'free' } })

        // 2. Poll 1 (immediate after 100ms delay) -> still free
        fetchBillingInfoFromServer.mockResolvedValueOnce({ status: 1, data: { plan: 'free' } })

        // 3. Poll 2 (after 1s) -> still free
        fetchBillingInfoFromServer.mockResolvedValueOnce({ status: 1, data: { plan: 'free' } })

        // 4. Poll 3 (after another 1s) -> becomes pro
        fetchBillingInfoFromServer.mockResolvedValueOnce({ status: 1, data: { plan: 'pro' } })

        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...originalLocation, search: '?success=true', href: 'http://localhost/team1/usage?success=true', pathname: '/team1/usage' },
        })
        window.history.replaceState = jest.fn()

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Initial load
        expect(fetchBillingInfoFromServer).toHaveBeenCalledTimes(1)

        // Trigger useEffect timeout (100ms)
        await act(async () => {
            jest.advanceTimersByTime(100)
        })

        // Poll 1 should have happened
        expect(fetchBillingInfoFromServer).toHaveBeenCalledTimes(2)

        // Advance 1s for Poll 2
        await act(async () => {
            jest.advanceTimersByTime(1000)
        })
        expect(fetchBillingInfoFromServer).toHaveBeenCalledTimes(3)

        // Advance 1s for Poll 3 (Success)
        await act(async () => {
            jest.advanceTimersByTime(1000)
        })
        expect(fetchBillingInfoFromServer).toHaveBeenCalledTimes(4)

        // Verify it stopped polling (advance another 1s, ensures no more calls)
        await act(async () => {
            jest.advanceTimersByTime(1000)
        })
        expect(fetchBillingInfoFromServer).toHaveBeenCalledTimes(4)
    })

    it('polls billing info on downgrade success until plan is free', async () => {
        const { fetchBillingInfoFromServer, downgradeToFreeFromServer } = require('@/app/api/api_calls')

        // 1. Initial page load (Pro)
        fetchBillingInfoFromServer.mockResolvedValueOnce({
            status: 1,
            data: {
                team_id: 'team1',
                plan: 'pro',
                max_retention: 365,
                max_units: null,
                stripe_customer_id: 'cus_123',
                stripe_subscription_id: 'sub_123',
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z',
            },
        })

        // Downgrade success
        downgradeToFreeFromServer.mockResolvedValue({ status: 1 })

        // 2. Poll 1 (immediate) -> still pro
        fetchBillingInfoFromServer.mockResolvedValueOnce({
            status: 1,
            data: { plan: 'pro' },
        })

        // 3. Poll 2 (after 1s) -> becomes free
        fetchBillingInfoFromServer.mockResolvedValueOnce({
            status: 1,
            data: { plan: 'free' },
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Open dialog
        const downgradeButton = screen.getByText('Downgrade to Free')
        await act(async () => {
            fireEvent.click(downgradeButton)
        })

        // Confirm downgrade
        const affirmButton = screen.getByTestId('dialog-affirm')
        await act(async () => {
            fireEvent.click(affirmButton)
        })

        // Initial load called once AND Poll 1 (immediate after success)
        // Wait for async execution
        await act(async () => {
            // Let immediate promises resolve
        })
        expect(fetchBillingInfoFromServer).toHaveBeenCalledTimes(2)

        // Advance 1s for Poll 2
        await act(async () => {
            jest.advanceTimersByTime(1000)
        })
        expect(fetchBillingInfoFromServer).toHaveBeenCalledTimes(3)

        // Verify toast
        expect(mockToastPositive).toHaveBeenCalledWith(expect.stringContaining('downgraded to Free'))
    })
})
