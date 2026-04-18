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

// Mock API calls - only need the enum/constant exports, not the fetch functions
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
    FetchSubscriptionInfoApiStatus: {
        Loading: 0,
        Success: 1,
        Error: 2,
        Cancelled: 3,
    },
    FetchCustomerPortalUrlApiStatus: {
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
                { month_year: '', sessions: 0, events: 0, spans: 0, bytes_in: 0 },
            ],
        },
    ],
}))

// --- Bridge store for usage page ---
const { create: createBridge } = jest.requireActual('zustand') as any
const usageBridge = createBridge(() => ({
    fetchUsageApiStatus: 0, // Loading
    usage: [] as any[],
    months: [] as string[],
    selectedMonth: undefined as string | undefined,
    selectedMonthUsage: [] as any[],
    currentBillingCycleUsage: 0,
    fetchBillingInfoApiStatus: 0, // Loading
    billingInfo: null as any,
    fetchSubscriptionInfoApiStatus: 0, // Loading
    subscriptionInfo: null as any,
    currentUserCanChangePlan: false,
    fetchUsage: jest.fn(),
    setSelectedMonth: jest.fn(),
    fetchPermissions: jest.fn(),
    fetchBillingInfo: jest.fn(),
    pollForPlan: jest.fn(),
    fetchSubscriptionInfo: jest.fn(),
    handleUpgrade: jest.fn(),
    handleDowngrade: jest.fn(),
    handleManageBilling: jest.fn(),
    reset: jest.fn(),
}))

function usageStatusMap(s: number) {
    // 0=Loading, 1=Success, 2=Error, 3=NoApps
    if (s === 0) { return 'pending' }
    if (s === 1) { return 'success' }
    if (s === 2) { return 'error' }
    if (s === 3) { return 'success' } // NoApps returns null data
    return 'pending'
}

function billingStatusMap(s: number) {
    if (s === 0) { return 'pending' }
    if (s === 1) { return 'success' }
    if (s === 2) { return 'error' }
    return 'pending'
}

jest.mock('@/app/query/hooks', () => ({
    __esModule: true,
    useUsageQuery: () => {
        const s = usageBridge.getState()
        // For NoApps (3), return null as data with success status
        const data = s.fetchUsageApiStatus === 3 ? null :
            (s.fetchUsageApiStatus === 1 && s.usage.length === 0 && s.months.length > 0) ?
                // Build usage data from months/selectedMonthUsage
                s.selectedMonthUsage.map((u: any) => ({
                    app_id: u.id, app_name: u.label,
                    monthly_app_usage: [{ month_year: s.selectedMonth || s.months[s.months.length - 1], sessions: u.value, events: u.events, spans: u.spans, bytes_in: u.bytes_in }]
                })) :
                s.usage.length > 0 ? s.usage : undefined
        return { data, status: usageStatusMap(s.fetchUsageApiStatus) }
    },
    useUsagePermissionsQuery: () => {
        const s = usageBridge.getState()
        return { data: { canChangePlan: s.currentUserCanChangePlan } }
    },
    useBillingInfoQuery: () => {
        const s = usageBridge.getState()
        return { data: s.billingInfo, status: billingStatusMap(s.fetchBillingInfoApiStatus) }
    },
    useSubscriptionInfoQuery: () => {
        const s = usageBridge.getState()
        return { data: s.subscriptionInfo, status: billingStatusMap(s.fetchSubscriptionInfoApiStatus) }
    },
    usePollForPlanQuery: () => {
        return { data: undefined }
    },
    useHandleUpgradeMutation: () => {
        const s = usageBridge.getState()
        return {
            mutate: async (params: any, opts: any) => {
                const result = await s.handleUpgrade(params.teamId, params.successUrl, params.cancelUrl)
                if (result?.redirect) {
                    opts?.onSuccess?.({ checkout_url: result.redirect })
                } else if (result?.alreadyUpgraded) {
                    opts?.onSuccess?.({ already_upgraded: true })
                } else if (result?.error) {
                    opts?.onSuccess?.({}) // no checkout_url triggers error toast
                } else {
                    opts?.onError?.()
                }
            },
            isPending: false,
        }
    },
    useDowngradeToFreeMutation: () => {
        const s = usageBridge.getState()
        return {
            mutate: async (params: any, opts: any) => {
                const result = await s.handleDowngrade(params.teamId)
                if (result) { opts?.onSuccess?.() } else { opts?.onError?.() }
            },
            isPending: false,
        }
    },
    fetchCustomerPortalUrl: async (teamId: string, returnUrl: string) => {
        const s = usageBridge.getState()
        return await s.handleManageBilling(teamId, returnUrl)
    },
}))

// Mock Skeleton
jest.mock('@/app/components/skeleton', () => ({
    Skeleton: ({ className, ...props }: any) => (
        <div data-testid="skeleton-mock" className={className} {...props} />
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

// Mock Progress - render as a div with progressbar role
jest.mock('@/app/components/progress', () => ({
    Progress: ({ value, ...props }: any) => (
        <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} {...props} />
    ),
}))

// Mock next/link
jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

const useUsageStore = usageBridge

// Helper: default free plan billing info
const freeBillingInfo = {
    team_id: 'team1',
    plan: 'free',
    max_retention: 30,
    max_units: 1000000,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
}

// Helper: default pro plan billing info
const proBillingInfo = {
    team_id: 'team1',
    plan: 'pro',
    max_retention: 365,
    max_units: null,
    stripe_customer_id: 'cus_123',
    stripe_subscription_id: 'sub_123',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
}

// Helper: default subscription info
const defaultSubscriptionInfo = {
    status: 'active',
    current_period_start: 1700000000,
    current_period_end: 1702678400,
    upcoming_invoice: { amount_due: 5000, currency: 'usd' },
    billing_cycle_usage: 12000000,
}

describe('Usage Page', () => {
    const originalLocation = window.location

    beforeEach(() => {
        jest.clearAllMocks()
        jest.useFakeTimers()

        // Reset store to defaults
        useUsageStore.setState({
            fetchUsageApiStatus: 0, // Loading
            usage: [],
            months: [],
            selectedMonth: undefined,
            selectedMonthUsage: [],
            currentBillingCycleUsage: 0,
            fetchBillingInfoApiStatus: 0, // Loading
            billingInfo: null,
            fetchSubscriptionInfoApiStatus: 0, // Loading
            subscriptionInfo: null,
            currentUserCanChangePlan: false,
            fetchUsage: jest.fn(),
            setSelectedMonth: jest.fn(),
            fetchPermissions: jest.fn(),
            fetchBillingInfo: jest.fn(),
            pollForPlan: jest.fn(),
            fetchSubscriptionInfo: jest.fn(),
            handleUpgrade: jest.fn(),
            handleDowngrade: jest.fn(),
            handleManageBilling: jest.fn(),
            reset: jest.fn(),
        })

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
        useUsageStore.setState({ fetchUsageApiStatus: 0 }) // Loading

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const spinners = screen.getAllByTestId('skeleton-mock')
        expect(spinners.length).toBeGreaterThanOrEqual(1)
    })

    it('shows error message when usage fetch fails', async () => {
        useUsageStore.setState({ fetchUsageApiStatus: 2 }) // Error

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText(/Error fetching usage data/)).toBeInTheDocument()
    })

    it('shows NoApps message with link when no apps exist', async () => {
        useUsageStore.setState({ fetchUsageApiStatus: 3 }) // NoApps

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText(/don't have any apps yet/)).toBeInTheDocument()
        const link = screen.getByText('creating your first app!')
        expect(link).toBeInTheDocument()
        expect(link.closest('a')).toHaveAttribute('href', 'apps')
    })

    it('renders pie chart and month dropdown on success', async () => {
        useUsageStore.setState({
            fetchUsageApiStatus: 1, // Success
            months: ['2025-01', '2025-02'],
            selectedMonth: '2025-02',
            selectedMonthUsage: [
                { id: 'app1', label: 'My App', value: 150, events: 700, spans: 300, bytes_in: 1048576 },
            ],
        })

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
        isBillingEnabled.mockReturnValue(false)

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const store = useUsageStore.getState()
        expect(store.fetchBillingInfo).not.toHaveBeenCalled()
        expect(store.fetchPermissions).not.toHaveBeenCalled()

        isBillingEnabled.mockReturnValue(true)
    })

    it('shows billing loading spinner while billing info loads', async () => {
        useUsageStore.setState({ fetchBillingInfoApiStatus: 0 }) // Loading

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // There will be at least one loading spinner for billing
        const spinners = screen.getAllByTestId('skeleton-mock')
        expect(spinners.length).toBeGreaterThanOrEqual(1)
    })

    it('shows billing error message when billing info fetch fails', async () => {
        useUsageStore.setState({ fetchBillingInfoApiStatus: 2 }) // Error

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText(/Error fetching billing data/)).toBeInTheDocument()
    })

    it('renders free plan card with Current Plan badge and pricing when on free plan', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: freeBillingInfo,
            currentUserCanChangePlan: true,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText('FREE')).toBeInTheDocument()
        expect(screen.getByText('$0 per month')).toBeInTheDocument()
        expect(screen.getByText('Current Plan')).toBeInTheDocument()
        expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    })

    it('renders pro plan card with Current Plan badge when on pro plan', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1, // Success
            subscriptionInfo: defaultSubscriptionInfo,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText('PRO')).toBeInTheDocument()
        expect(screen.getByText('$50 per month')).toBeInTheDocument()
        expect(screen.getByText('Current Plan')).toBeInTheDocument()
        expect(screen.getByText('Downgrade to Free')).toBeInTheDocument()
        expect(screen.getByText('Contact us')).toBeInTheDocument()
    })

    it('shows free plan usage progress bar with percentage and GB', async () => {
        useUsageStore.setState({
            fetchUsageApiStatus: 1, // Success
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: freeBillingInfo,
            currentBillingCycleUsage: 1048576, // 1 MB
            months: ['2025-01', '2025-02'],
            selectedMonth: '2025-02',
            selectedMonthUsage: [
                { id: 'app1', label: 'My App', value: 150, events: 700, spans: 300, bytes_in: 1048576 },
            ],
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Usage data: bytes_in = 1048576 (1 MB)
        // freeUsagePercent = Math.round((1048576 / (5 * 1024 * 1024 * 1024)) * 10000) / 100 = 0.02
        // Since usage > 0, Math.max(0.01, 0.02) = 0.02
        expect(screen.getByText('0.02%')).toBeInTheDocument()
        expect(screen.getByText(/1\.0 MB used of 5 GB/)).toBeInTheDocument()

        const progressbar = screen.getByRole('progressbar')
        expect(progressbar).toHaveAttribute('aria-valuenow', '0.02')
        expect(progressbar).toHaveAttribute('aria-valuemin', '0')
        expect(progressbar).toHaveAttribute('aria-valuemax', '100')
    })

    it('shows 0% when there is no usage', async () => {
        useUsageStore.setState({
            fetchUsageApiStatus: 1, // Success
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: freeBillingInfo,
            currentBillingCycleUsage: 0,
            months: ['2025-02'],
            selectedMonth: '2025-02',
            selectedMonthUsage: [
                { id: 'app1', label: 'Test App', value: 0, events: 0, spans: 0, bytes_in: 0 },
            ],
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText('0%')).toBeInTheDocument()
        expect(screen.getByText(/0 B used of 5 GB/)).toBeInTheDocument()
    })

    it('shows minimum 0.01% for very small usage', async () => {
        useUsageStore.setState({
            fetchUsageApiStatus: 1, // Success
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: freeBillingInfo,
            currentBillingCycleUsage: 48,
            months: ['2025-02'],
            selectedMonth: '2025-02',
            selectedMonthUsage: [
                { id: 'app1', label: 'Test App', value: 1, events: 1, spans: 0, bytes_in: 48 },
            ],
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // 48 bytes / 5 GB = ~0.0000009%, rounds to 0, but Math.max(0.01, 0) = 0.01
        expect(screen.getByText('0.01%')).toBeInTheDocument()
        expect(screen.getByText(/48 B used of 5 GB/)).toBeInTheDocument()
    })

    it('does not show free plan progress bar when on pro plan', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.queryByText(/Free plan usage:/)).not.toBeInTheDocument()
        expect(screen.queryByText(/used of 5 GB/)).not.toBeInTheDocument()
    })

    // ---- Upgrade flow ----

    it('upgrade button is disabled when user cannot change billing', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: freeBillingInfo,
            currentUserCanChangePlan: false,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const upgradeButton = screen.getByText('Upgrade to Pro')
        expect(upgradeButton).toBeDisabled()
    })

    it('clicking upgrade calls checkout API and redirects', async () => {
        const handleUpgrade = jest.fn().mockResolvedValue({ redirect: 'https://checkout.stripe.com/test' })
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: freeBillingInfo,
            currentUserCanChangePlan: true,
            handleUpgrade,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const upgradeButton = screen.getByText('Upgrade to Pro')
        await act(async () => {
            fireEvent.click(upgradeButton)
        })

        expect(handleUpgrade).toHaveBeenCalled()
        expect(window.location.href).toBe('https://checkout.stripe.com/test')
    })

    it('upgrade with already_upgraded response refreshes billing info and shows toast', async () => {
        const handleUpgrade = jest.fn().mockResolvedValue({ alreadyUpgraded: true })
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: freeBillingInfo,
            currentUserCanChangePlan: true,
            handleUpgrade,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const upgradeButton = screen.getByText('Upgrade to Pro')
        await act(async () => {
            fireEvent.click(upgradeButton)
        })

        expect(mockToastPositive).toHaveBeenCalledWith(expect.stringContaining('subscription was found'))
    })

    it('upgrade error shows toast', async () => {
        const handleUpgrade = jest.fn().mockResolvedValue({ error: true })
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: freeBillingInfo,
            currentUserCanChangePlan: true,
            handleUpgrade,
        })

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
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
        })

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
        const handleDowngrade = jest.fn().mockResolvedValue(true)
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
            handleDowngrade,
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

        expect(handleDowngrade).toHaveBeenCalledWith('team1')

        // Wait for async handleDowngrade to process
        await act(async () => {
            // Let promises resolve
        })

        expect(mockToastPositive).toHaveBeenCalledWith(expect.stringContaining('downgraded to Free'))
    })

    it('downgrade error shows error toast', async () => {
        const handleDowngrade = jest.fn().mockResolvedValue(false)
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
            handleDowngrade,
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

    it('shows success toast and clears URL params on success redirect', async () => {
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...originalLocation, search: '?success=true', href: 'http://localhost/team1/usage?success=true', pathname: '/team1/usage' },
        })
        window.history.replaceState = jest.fn()

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Trigger useEffect timeout (100ms)
        await act(async () => {
            jest.advanceTimersByTime(200)
        })

        expect(mockToastPositive).toHaveBeenCalledWith(expect.stringContaining('upgraded to Pro'))
        expect(window.history.replaceState).toHaveBeenCalled()
    })

    it('shows pro plan feature list when on free plan', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: freeBillingInfo,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText(/GB per month included/)).toBeInTheDocument()
        expect(screen.getByText(/Retention up to/)).toBeInTheDocument()
        expect(screen.getByText(/Extra data & retention charged at/)).toBeInTheDocument()
    })

    it('hides pro plan feature list when on pro plan', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.queryByText(/GB per month included/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Retention up to/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Extra data & retention charged at/)).not.toBeInTheDocument()
    })

    it('shows subscription info on pro plan when user can change billing', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1, // Success
            subscriptionInfo: defaultSubscriptionInfo,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText(/Status:/)).toBeInTheDocument()
        expect(screen.getByText(/active/i)).toBeInTheDocument()
        expect(screen.getByText(/Current billing cycle:/)).toBeInTheDocument()
        expect(screen.getByText(/Next invoice:/)).toBeInTheDocument()
        expect(screen.getByText(/Upcoming invoice amount/)).toBeInTheDocument()
    })

    it('does not show subscription info when on free plan', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: freeBillingInfo,
            currentUserCanChangePlan: true,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Free plan — subscription info should not be displayed
        expect(screen.queryByText(/Status:/)).not.toBeInTheDocument()
    })

    it('does not show subscription info when can_change_billing is false', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: false,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.queryByText(/Status:/)).not.toBeInTheDocument()
    })

    it('handles subscription info fetch error gracefully', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 2, // Error
            subscriptionInfo: null,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Subscription info section should be absent, no crash
        expect(screen.queryByText(/Status:/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Next invoice:/)).not.toBeInTheDocument()
        expect(screen.getByText('PRO')).toBeInTheDocument()
    })

    it('shows subscription info without estimated amount when upcoming_invoice is null', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1, // Success
            subscriptionInfo: {
                status: 'active',
                current_period_start: 1700000000,
                current_period_end: 1702678400,
                upcoming_invoice: null,
                billing_cycle_usage: 5000000,
            },
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText(/Status:/)).toBeInTheDocument()
        expect(screen.getByText(/Current billing cycle:/)).toBeInTheDocument()
        expect(screen.getByText(/Next invoice:/)).toBeInTheDocument()
        expect(screen.queryByText(/Upcoming invoice amount/)).not.toBeInTheDocument()
    })

    it('shows GB-days used in pro plan card', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1, // Success
            subscriptionInfo: {
                ...defaultSubscriptionInfo,
                billing_cycle_usage: 12500000,
            },
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const unitsItem = screen.getByText(/GB-days used/)
        expect(unitsItem).toBeInTheDocument()
        expect(unitsItem.textContent).toContain('12,500,000')
    })

    it('shows GB-days used in pro plan card with high usage', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1, // Success
            subscriptionInfo: {
                ...defaultSubscriptionInfo,
                billing_cycle_usage: 30000000,
            },
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const unitsItem = screen.getByText(/GB-days used/)
        expect(unitsItem).toBeInTheDocument()
        expect(unitsItem.textContent).toContain('30,000,000')
    })

    it('does not show GB-days used on free plan', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: freeBillingInfo,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.queryByText(/GB-days used/)).not.toBeInTheDocument()
    })

    it('does not show GB-days used when subscription info fetch fails', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 2, // Error
            subscriptionInfo: null,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.queryByText(/GB-days used/)).not.toBeInTheDocument()
    })

    // ---- Manage Billing button ----

    it('shows Manage Billing button when on pro plan', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.getByText('Manage Billing')).toBeInTheDocument()
    })

    it('hides Manage Billing button when on free plan', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: freeBillingInfo,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        expect(screen.queryByText('Manage Billing')).not.toBeInTheDocument()
    })

    it('Manage Billing button is disabled when user cannot change billing', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: false,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const btn = screen.getByText('Manage Billing')
        expect(btn).toBeDisabled()
    })

    it('clicking Manage Billing calls portal API and redirects', async () => {
        const handleManageBilling = jest.fn().mockResolvedValue({ redirect: 'https://billing.stripe.com/session/test' })
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
            handleManageBilling,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        await act(async () => {
            fireEvent.click(screen.getByText('Manage Billing'))
        })

        expect(handleManageBilling).toHaveBeenCalledWith('team1', 'http://localhost/team1/usage')
        expect(window.location.href).toBe('https://billing.stripe.com/session/test')
    })

    it('Manage Billing shows Redirecting... while loading', async () => {
        let resolveManageBilling: (value: any) => void
        const handleManageBilling = jest.fn().mockImplementation(
            () => new Promise((resolve) => { resolveManageBilling = resolve })
        )
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
            handleManageBilling,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        await act(async () => {
            fireEvent.click(screen.getByText('Manage Billing'))
        })

        expect(screen.getByText('Redirecting...')).toBeInTheDocument()

        await act(async () => {
            resolveManageBilling!({ redirect: 'https://billing.stripe.com/session/test' })
        })
    })

    it('Manage Billing error shows toast', async () => {
        const handleManageBilling = jest.fn().mockResolvedValue({ error: 'Please try again.' })
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
            handleManageBilling,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        await act(async () => {
            fireEvent.click(screen.getByText('Manage Billing'))
        })

        expect(mockToastNegative).toHaveBeenCalledWith(
            'Failed to open billing portal',
            'Please try again.'
        )
    })

    it('Manage Billing cancelled shows toast', async () => {
        const handleManageBilling = jest.fn().mockResolvedValue({ error: 'Request was cancelled.' })
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
            handleManageBilling,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        await act(async () => {
            fireEvent.click(screen.getByText('Manage Billing'))
        })

        expect(mockToastNegative).toHaveBeenCalledWith(
            'Failed to open billing portal',
            'Request was cancelled.'
        )
    })

    it('Downgrade button is disabled while Manage Billing is loading', async () => {
        let resolveManageBilling: (value: any) => void
        const handleManageBilling = jest.fn().mockImplementation(
            () => new Promise((resolve) => { resolveManageBilling = resolve })
        )
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
            handleManageBilling,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        await act(async () => {
            fireEvent.click(screen.getByText('Manage Billing'))
        })

        expect(screen.getByText('Downgrade to Free')).toBeDisabled()

        await act(async () => {
            resolveManageBilling!({ redirect: 'https://billing.stripe.com/session/test' })
        })
    })

    it('Manage Billing button is disabled while downgrading', async () => {
        let resolveDowngrade: (value: any) => void
        const handleDowngrade = jest.fn().mockImplementation(
            () => new Promise((resolve) => { resolveDowngrade = resolve })
        )
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
            handleDowngrade,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        // Open and confirm downgrade dialog
        await act(async () => {
            fireEvent.click(screen.getByText('Downgrade to Free'))
        })
        await act(async () => {
            fireEvent.click(screen.getByTestId('dialog-affirm'))
        })

        expect(screen.getByText('Manage Billing')).toBeDisabled()

        await act(async () => {
            resolveDowngrade!(true)
        })
    })

    it('shows skeleton placeholders while subscription info is loading on pro plan', async () => {
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 0, // Loading
            subscriptionInfo: null,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        const skeletons = screen.getAllByTestId('skeleton-mock')
        expect(skeletons.length).toBeGreaterThan(0)
    })

    it('Manage Billing success with no URL shows toast', async () => {
        const handleManageBilling = jest.fn().mockResolvedValue({ error: 'No portal URL returned.' })
        useUsageStore.setState({
            fetchBillingInfoApiStatus: 1, // Success
            billingInfo: proBillingInfo,
            currentUserCanChangePlan: true,
            fetchSubscriptionInfoApiStatus: 1,
            subscriptionInfo: defaultSubscriptionInfo,
            handleManageBilling,
        })

        await act(async () => {
            render(<Usage params={{ teamId: 'team1' }} />)
        })

        await act(async () => {
            fireEvent.click(screen.getByText('Manage Billing'))
        })

        expect(mockToastNegative).toHaveBeenCalledWith(
            'Failed to open billing portal',
            'No portal URL returned.'
        )
    })
})
