import { MetricsApiStatus } from '@/app/api/api_calls'
import MetricsCard, {
    AnrFreeSessionsProps,
    AppAdoptionProps,
    AppSizeProps,
    AppStartTimeProps,
    CrashFreeSessionsProps,
    PerceivedAnrFreeSessionsProps,
    PerceivedCrashFreeSessionsProps
} from '@/app/components/metrics_card'
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import React from 'react'


// Mock the dependencies
jest.mock('@/app/components/card', () => ({
    Card: ({ children, className, ...props }: { children: React.ReactNode; className?: string }) => (
        <div className={className} data-testid="card" {...props}>
            {children}
        </div>
    ),
    CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div className={className} data-testid="card-content">
            {children}
        </div>
    ),
    CardFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div className={className} data-testid="card-footer">
            {children}
        </div>
    ),
}))

jest.mock('@/app/components/tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
    TooltipContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div className={className} data-testid="tooltip-content">
            {children}
        </div>
    ),

    TooltipTrigger: ({
        children,
        asChild,
        className,
    }: {
        children: React.ReactNode
        asChild?: boolean
        className?: string
    }) => (
        <div className={className} data-testid="tooltip-trigger">
            {children}
        </div>
    ),
}))

jest.mock('@/app/components/loading_spinner', () => {
    return function LoadingSpinner() {
        return <div data-testid="loading-spinner">Loading...</div>
    }
})

jest.mock('lucide-react', () => ({
    TrendingDown: ({ className }: { className?: string }) => (
        <div className={className} data-testid="trending-down-icon" />
    ),
    TrendingUp: ({ className }: { className?: string }) => (
        <div className={className} data-testid="trending-up-icon" />
    ),
    CheckCircle: ({ className }: { className?: string }) => (
        <div className={className} data-testid="check-circle-icon" />
    ),
    AlertTriangle: ({ className }: { className?: string }) => (
        <div className={className} data-testid="alert-triangle-icon" />
    ),
}))

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    MetricsApiStatus: {
        Loading: 'Loading',
        Success: 'Success',
        Error: 'Error',
    },
}))

describe('MetricsCard', () => {
    const createCrashFreeSessionsProps = (overrides = {}): CrashFreeSessionsProps => ({
        type: 'crash_free_sessions',
        status: MetricsApiStatus.Success,
        noData: false,
        value: 96.5,
        delta: 1.2,
        ...overrides,
    })

    const createPerceivedCrashFreeSessionsProps = (overrides = {}): PerceivedCrashFreeSessionsProps => ({
        type: 'perceived_crash_free_sessions',
        status: MetricsApiStatus.Success,
        noData: false,
        value: 97.8,
        delta: 0.8,
        ...overrides,
    })

    const createAnrFreeSessionsProps = (overrides = {}): AnrFreeSessionsProps => ({
        type: 'anr_free_sessions',
        status: MetricsApiStatus.Success,
        noData: false,
        value: 94.2,
        delta: 1.1,
        ...overrides,
    })

    const createPerceivedAnrFreeSessionsProps = (overrides = {}): PerceivedAnrFreeSessionsProps => ({
        type: 'perceived_anr_free_sessions',
        status: MetricsApiStatus.Success,
        noData: false,
        value: 95.5,
        delta: 0.9,
        ...overrides,
    })

    const createAppStartTimeProps = (overrides = {}): AppStartTimeProps => ({
        type: 'app_start_time',
        status: MetricsApiStatus.Success,
        noData: false,
        noDelta: false,
        value: 1200,
        delta: 0.8,
        launchType: 'Cold',
        ...overrides,
    })

    const createAppSizeProps = (overrides = {}): AppSizeProps => ({
        type: 'app_size',
        status: MetricsApiStatus.Success,
        noData: false,
        multiVersion: false,
        valueInBytes: 52428800, // 50MB
        deltaInBytes: -1048576, // -1MB
        ...overrides,
    })

    const createAppAdoptionProps = (overrides = {}): AppAdoptionProps => ({
        type: 'app_adoption',
        status: MetricsApiStatus.Success,
        noData: false,
        value: 25.5,
        sessions: 1250000,
        totalSessions: 5000000,
        ...overrides,
    })

    describe('Loading State', () => {
        it('should render loading spinner when status is Loading', () => {
            const props = createCrashFreeSessionsProps({ status: MetricsApiStatus.Loading })
            render(<MetricsCard {...props} />)

            expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
            expect(screen.getByText('Crash free sessions')).toBeInTheDocument()
        })
    })

    describe('Error State', () => {
        it('should render error message when status is Error', () => {
            const props = createCrashFreeSessionsProps({ status: MetricsApiStatus.Error })
            render(<MetricsCard {...props} />)

            expect(screen.getByText('Error')).toBeInTheDocument()
            expect(screen.getByText('Crash free sessions')).toBeInTheDocument()
        })
    })

    describe('No Data State', () => {
        it('should render no data message when noData is true', () => {
            const props = createCrashFreeSessionsProps({ noData: true })
            render(<MetricsCard {...props} />)

            expect(screen.getByText('No data')).toBeInTheDocument()
            expect(screen.getByText('Crash free sessions')).toBeInTheDocument()
        })
    })

    describe('Crash Free Sessions', () => {
        it('should render crash free sessions data correctly', () => {
            const props = createCrashFreeSessionsProps()
            render(<MetricsCard {...props} />)

            expect(screen.getByText('96.5%')).toBeInTheDocument()
            expect(screen.getByText('1.2x better')).toBeInTheDocument()
            expect(screen.getByText('Crash free sessions')).toBeInTheDocument()
            const trendingUpIcon = screen.getByTestId('trending-up-icon')
            expect(trendingUpIcon).toHaveClass('text-green-600')
            const trendingText = screen.getByText('1.2x better')
            expect(trendingText).toHaveClass('text-green-600')
            const cardContent = screen.getByTestId('card-content')
            const checkCircleIcon = within(cardContent).getByTestId('check-circle-icon')
            expect(checkCircleIcon).toBeInTheDocument() // Status icon for > 95%
            expect(checkCircleIcon).toHaveClass('text-green-600')
        })

        it('should render different status icons based on value and their colors', () => {
            // Test good status (> 95%)
            const goodProps = createCrashFreeSessionsProps({ value: 96 })
            const { rerender } = render(<MetricsCard {...goodProps} />)
            const cardContent = screen.getByTestId('card-content')
            const checkCircleIcon = within(cardContent).getByTestId('check-circle-icon')
            expect(checkCircleIcon).toHaveClass('text-green-600')

            // Test caution status (85-95%)
            const cautionProps = createCrashFreeSessionsProps({ value: 90 })
            rerender(<MetricsCard {...cautionProps} />)
            const cardContent2 = screen.getByTestId('card-content')
            const alertTriangleIconYellow = within(cardContent2).getByTestId('alert-triangle-icon')
            expect(alertTriangleIconYellow).toHaveClass('text-yellow-600')

            // Test poor status (≤ 85%)
            const poorProps = createCrashFreeSessionsProps({ value: 80 })
            rerender(<MetricsCard {...poorProps} />)
            const cardContent3 = screen.getByTestId('card-content')
            const alertTriangleIconRed = within(cardContent3).getByTestId('alert-triangle-icon')
            expect(alertTriangleIconRed).toHaveClass('text-red-600')
        })

        it('should handle delta trends correctly and their colors', () => {
            // Test improvement (delta > 1)
            const improvementProps = createCrashFreeSessionsProps({ delta: 1.5 })
            const { rerender } = render(<MetricsCard {...improvementProps} />)
            const trendingUpIcon = screen.getByTestId('trending-up-icon')
            expect(trendingUpIcon).toHaveClass('text-green-600')
            const trendingText = screen.getByText('1.5x better')
            expect(trendingText).toHaveClass('text-green-600')

            // Test regression (0 < delta < 1)
            const regressionProps = createCrashFreeSessionsProps({ delta: 0.7 })
            rerender(<MetricsCard {...regressionProps} />)
            const trendingDownIcon = screen.getByTestId('trending-down-icon')
            expect(trendingDownIcon).toHaveClass('text-yellow-600')
            const trendingTextWorse = screen.getByText('0.7x worse')
            expect(trendingTextWorse).toHaveClass('text-yellow-600')

            // Test no change (delta = 0)
            const noChangeProps = createCrashFreeSessionsProps({ delta: 0 })
            rerender(<MetricsCard {...noChangeProps} />)
            expect(screen.queryByText(/x better|x worse/)).not.toBeInTheDocument()
        })
    })

    describe('Perceived Crash Free Sessions', () => {
        it('should render perceived crash free sessions data correctly', () => {
            const props = createPerceivedCrashFreeSessionsProps()
            render(<MetricsCard {...props} />)

            expect(screen.getByText('97.8%')).toBeInTheDocument()
            expect(screen.getByText('0.8x worse')).toBeInTheDocument()
            expect(screen.getByText('Perceived crash free sessions')).toBeInTheDocument()
        })
    })

    describe('ANR Free Sessions', () => {
        it('should render ANR free sessions data correctly', () => {
            const props = createAnrFreeSessionsProps()
            render(<MetricsCard {...props} />)

            expect(screen.getByText('94.2%')).toBeInTheDocument()
            expect(screen.getByText('1.1x better')).toBeInTheDocument()
            expect(screen.getByText('ANR free sessions')).toBeInTheDocument()
        })
    })

    describe('Perceived ANR Free Sessions', () => {
        it('should render perceived ANR free sessions data correctly', () => {
            const props = createPerceivedAnrFreeSessionsProps()
            render(<MetricsCard {...props} />)

            expect(screen.getByText('95.5%')).toBeInTheDocument()
            expect(screen.getByText('0.9x worse')).toBeInTheDocument()
            expect(screen.getByText('Perceived ANR free sessions')).toBeInTheDocument()
        })
    })

    describe('App Start Time', () => {
        it('should render app start time data correctly and check colors', () => {
            const props = createAppStartTimeProps()
            render(<MetricsCard {...props} />)

            expect(screen.getByText('1200ms')).toBeInTheDocument()
            expect(screen.getByText('0.8x faster')).toBeInTheDocument()
            const trendingDownIcon = screen.getByTestId('trending-down-icon')
            expect(trendingDownIcon).toHaveClass('text-green-600')
            const trendingText = screen.getByText('0.8x faster')
            expect(trendingText).toHaveClass('text-green-600')
            const cardContent = screen.getByTestId('card-content')
            const checkCircleIcon = within(cardContent).getByTestId('check-circle-icon')
            expect(checkCircleIcon).toHaveClass('text-green-600')
        })

        it('should show correct status icons for app start time and their colors', () => {
            // Test good performance (delta <= 1)
            const goodProps = createAppStartTimeProps({ delta: 0.8 })
            const { rerender } = render(<MetricsCard {...goodProps} />)
            const cardContent = screen.getByTestId('card-content')
            const checkCircleIcon = within(cardContent).getByTestId('check-circle-icon')
            expect(checkCircleIcon).toHaveClass('text-green-600')

            // Test poor performance (delta > 1)
            const poorProps = createAppStartTimeProps({ delta: 1.5 })
            rerender(<MetricsCard {...poorProps} />)
            const cardContent2 = screen.getByTestId('card-content')
            const alertTriangleIcon = within(cardContent2).getByTestId('alert-triangle-icon')
            expect(alertTriangleIcon).toHaveClass('text-yellow-600')
        })

        it('should handle start time delta trends correctly and their colors', () => {
            // Test slower performance (delta > 1)
            const slowerProps = createAppStartTimeProps({ delta: 1.3 })
            const { rerender } = render(<MetricsCard {...slowerProps} />)
            const trendingUpIcon = screen.getByTestId('trending-up-icon')
            expect(trendingUpIcon).toHaveClass('text-yellow-600')
            const trendingText = screen.getByText('1.3x slower')
            expect(trendingText).toHaveClass('text-yellow-600')

            // Test faster performance (0 < delta < 1)
            const fasterProps = createAppStartTimeProps({ delta: 0.7 })
            rerender(<MetricsCard {...fasterProps} />)
            const trendingDownIcon = screen.getByTestId('trending-down-icon')
            expect(trendingDownIcon).toHaveClass('text-green-600')
            const trendingTextFaster = screen.getByText('0.7x faster')
            expect(trendingTextFaster).toHaveClass('text-green-600')
        })

        it('should not show delta trend when noDelta is true', () => {
            // Test slower performance (delta > 1)
            const slowerProps = createAppStartTimeProps({ delta: 1.3, noDelta: true })
            const { rerender } = render(<MetricsCard {...slowerProps} />)
            const trendingUpIcon = screen.queryByTestId('trending-up-icon')
            expect(trendingUpIcon).toBeNull()
            const trendingText = screen.queryByText('1.3x slower')
            expect(trendingText).toBeNull()

            // Test faster performance (0 < delta < 1)
            const fasterProps = createAppStartTimeProps({ delta: 0.7, noDelta: true })
            rerender(<MetricsCard {...fasterProps} />)
            const trendingDownIcon = screen.queryByTestId('trending-down-icon')
            expect(trendingDownIcon).toBeNull()
            const trendingTextFaster = screen.queryByText('0.7x faster')
            expect(trendingTextFaster).toBeNull()
        })
    })

    describe('App Size', () => {
        it('should render app size data correctly and check colors', () => {
            const props = createAppSizeProps()
            render(<MetricsCard {...props} />)

            expect(screen.getByText('50.0 MB')).toBeInTheDocument()
            expect(screen.getByText('-1.00 MB')).toBeInTheDocument()
            const trendingDownIcon = screen.getByTestId('trending-down-icon')
            expect(trendingDownIcon).toHaveClass('text-green-600')
            const trendingText = screen.getByText('-1.00 MB')
            expect(trendingText).toHaveClass('text-green-600')
            const cardContent = screen.getByTestId('card-content')
            const checkCircleIcon = within(cardContent).getByTestId('check-circle-icon')
            expect(checkCircleIcon).toHaveClass('text-green-600')
        })

        it('should show correct status icons for app size and their colors', () => {
            // Test size decrease (deltaInBytes <= 0)
            const decreaseProps = createAppSizeProps({ deltaInBytes: -1048576 })
            const { rerender } = render(<MetricsCard {...decreaseProps} />)
            const cardContent = screen.getByTestId('card-content')
            const checkCircleIcon = within(cardContent).getByTestId('check-circle-icon')
            expect(checkCircleIcon).toHaveClass('text-green-600')

            // Test size increase (deltaInBytes > 0)
            const increaseProps = createAppSizeProps({ deltaInBytes: 2097152 })
            rerender(<MetricsCard {...increaseProps} />)
            const cardContent2 = screen.getByTestId('card-content')
            const alertTriangleIcon = within(cardContent2).getByTestId('alert-triangle-icon')
            expect(alertTriangleIcon).toHaveClass('text-yellow-600')
        })

        it('should handle size delta trends correctly and their colors', () => {
            // Test size decrease
            const decreaseProps = createAppSizeProps({ deltaInBytes: -2097152 })
            const { rerender } = render(<MetricsCard {...decreaseProps} />)
            const trendingDownIcon = screen.getByTestId('trending-down-icon')
            expect(trendingDownIcon).toHaveClass('text-green-600')
            const trendingText = screen.getByText('-2.00 MB')
            expect(trendingText).toHaveClass('text-green-600')

            // Test size increase
            const increaseProps = createAppSizeProps({ deltaInBytes: 3145728 })
            rerender(<MetricsCard {...increaseProps} />)
            const trendingUpIcon = screen.getByTestId('trending-up-icon')
            expect(trendingUpIcon).toHaveClass('text-yellow-600')
            const trendingTextUp = screen.getByText('+3.00 MB')
            expect(trendingTextUp).toHaveClass('text-yellow-600')

            // Test no change
            const noChangeProps = createAppSizeProps({ deltaInBytes: 0 })
            rerender(<MetricsCard {...noChangeProps} />)
            expect(screen.queryByText(/MB/)).toBeInTheDocument() // Main value should still show
            expect(screen.queryByText(/\+.*MB|-.*MB/)).not.toBeInTheDocument() // No delta
        })

        it('should handle small size delta trends in kilobytes', () => {
            // Test small size changes, in bytes or kilobytes
            const smallDecreaseProps = createAppSizeProps({ deltaInBytes: -2286 })
            render(<MetricsCard {...smallDecreaseProps} />)
            const trendingIcon = screen.getByTestId('trending-down-icon')
            expect(trendingIcon).toHaveClass('text-green-600')
            const trendingText = screen.getByText('-2.23 KB')
            expect(trendingText).toHaveClass('text-green-600')
        })

        it('should handle small size delta trends in bytes', () => {
            // Test small size changes, in bytes or bytes
            const smallIncreaseProps = createAppSizeProps({ deltaInBytes: 220 })
            render(<MetricsCard {...smallIncreaseProps} />)
            const trendingIcon = screen.getByTestId('trending-up-icon')
            expect(trendingIcon).toHaveClass('text-yellow-600')
            const trendingTextUp = screen.getByText('+220 B')
            expect(trendingTextUp).toHaveClass('text-yellow-600')
        })

        it('should show disclaimer when multiple app versions are selected', () => {
            const appSizeProps = createAppSizeProps({ deltaInBytes: 220, multiVersion: true })
            render(<MetricsCard {...appSizeProps} />)
            const trendingIcon = screen.queryByTestId('trending-up-icon')
            expect(trendingIcon).not.toBeInTheDocument()
            const trendingTextUp = screen.queryByText('+220 B')
            expect(trendingTextUp).not.toBeInTheDocument()
            const cardContent2 = screen.getByTestId('card-content')
            const alertTriangleIcon = within(cardContent2).queryByTestId('alert-triangle-icon')
            expect(alertTriangleIcon).not.toBeInTheDocument()
            expect(screen.getByText('App size metric is only available when a single app version is selected.')).toBeInTheDocument()
        })
    })

    describe('App Adoption', () => {
        it('should render app adoption data correctly', () => {
            const props = createAppAdoptionProps()
            render(<MetricsCard {...props} />)

            expect(screen.getByText('25.5%')).toBeInTheDocument()
            expect(screen.getByText('1.25M/5M sessions')).toBeInTheDocument()
            expect(screen.getByText('App adoption')).toBeInTheDocument()
        })

        it('should not show status icon for app adoption', () => {
            const props = createAppAdoptionProps()
            render(<MetricsCard {...props} />)

            // App adoption should not have status icons
            expect(screen.queryByTestId('check-circle-icon')).not.toBeInTheDocument()
            expect(screen.queryByTestId('alert-triangle-icon')).not.toBeInTheDocument()
        })
    })

    describe('Tooltip Content', () => {
        it('should render tooltip content for crash free sessions', () => {
            const props = createCrashFreeSessionsProps()
            render(<MetricsCard {...props} />)

            const tooltipContent = screen.getByTestId('tooltip-content')
            expect(tooltipContent).toHaveTextContent('Crash free sessions = (1 - Sessions which experienced a crash')
            expect(tooltipContent).toHaveTextContent('Delta value = Crash free sessions percentage')
            expect(tooltipContent).toHaveTextContent('Good (> 95%)')
            expect(tooltipContent).toHaveTextContent('Caution (> 85%)')
            expect(tooltipContent).toHaveTextContent('Poor (≤ 85%)')
        })

        it('should render tooltip content for app start time with launch type', () => {
            const props = createAppStartTimeProps({ launchType: 'Hot' })
            render(<MetricsCard {...props} />)

            const tooltipContent = screen.getByTestId('tooltip-content')
            expect(tooltipContent).toHaveTextContent('App start time = p95 Hot launch time')
            expect(tooltipContent).toHaveTextContent('Delta value = p95 Hot launch time')
        })

        it('should render tooltip content for app size', () => {
            const props = createAppSizeProps()
            render(<MetricsCard {...props} />)

            const tooltipContent = screen.getByTestId('tooltip-content')
            expect(tooltipContent).toHaveTextContent('Delta value = App size of selected app version')
            expect(tooltipContent).toHaveTextContent('Good (size decreased or unchanged')
            expect(tooltipContent).toHaveTextContent('Caution (size increased')
        })

        it('should render tooltip content for app adoption with session counts', () => {
            const props = createAppAdoptionProps()
            render(<MetricsCard {...props} />)

            const tooltipContent = screen.getByTestId('tooltip-content')
            expect(tooltipContent).toHaveTextContent('Adoption = (Sessions of selected app versions')
            expect(tooltipContent).toHaveTextContent('Selected Sessions = 1250000')
            expect(tooltipContent).toHaveTextContent('Total Sessions = 5000000')
        })
    })

    describe('Edge Cases', () => {
        it('should handle zero values correctly', () => {
            const props = createCrashFreeSessionsProps({ value: 0, delta: 0 })
            render(<MetricsCard {...props} />)

            expect(screen.getByText('0%')).toBeInTheDocument()
            expect(screen.queryByText(/x better|x worse/)).not.toBeInTheDocument()
        })

        it('should handle very large numbers in app adoption', () => {
            const props = createAppAdoptionProps({
                sessions: 1500000000, // 1.5B
                totalSessions: 5000000000 // 5B
            })
            render(<MetricsCard {...props} />)

            expect(screen.getByText('1.5B/5B sessions')).toBeInTheDocument()
        })

        it('should handle negative app size values', () => {
            const props = createAppSizeProps({
                valueInBytes: 10485760, // 10MB
                deltaInBytes: -5242880 // -5MB
            })
            render(<MetricsCard {...props} />)

            expect(screen.getByText('10.0 MB')).toBeInTheDocument()
            expect(screen.getByText('-5.00 MB')).toBeInTheDocument()
        })

        it('should handle unknown metric type gracefully', () => {
            // Using type assertion to test edge case with unknown type
            const props = {
                type: 'unknown_metric' as any,
                status: MetricsApiStatus.Success,
                noData: false
            } as any // <-- add 'as any' to suppress type error
            render(<MetricsCard {...props} />)

            expect(screen.getByText('Unknown metric')).toBeInTheDocument()
        })
    })

    describe('Accessibility', () => {
        it('should have proper structure with card elements', () => {
            const props = createCrashFreeSessionsProps()
            render(<MetricsCard {...props} />)

            expect(screen.getByTestId('card')).toBeInTheDocument()
            expect(screen.getByTestId('card-content')).toBeInTheDocument()
            expect(screen.getByTestId('card-footer')).toBeInTheDocument()
            expect(screen.getByTestId('tooltip')).toBeInTheDocument()
            expect(screen.getByTestId('tooltip-trigger')).toBeInTheDocument()
            expect(screen.getByTestId('tooltip-content')).toBeInTheDocument()
        })

        it('should apply hover classes correctly', () => {
            const props = createCrashFreeSessionsProps()
            render(<MetricsCard {...props} />)

            const card = screen.getByTestId('card')
            expect(card).toHaveClass('hover:bg-muted/50')
        })
    })

    describe('Status Icon Display Logic', () => {
        it('should show status icon only for supported metric types with success status and data', () => {
            // Test each supported type individually with proper typing
            const crashFreeProps = createCrashFreeSessionsProps()
            const { unmount: unmount1 } = render(<MetricsCard {...crashFreeProps} />)
            const cardContent1 = screen.getByTestId('card-content')
            const statusIcons1 = cardContent1.querySelectorAll('[data-testid="check-circle-icon"], [data-testid="alert-triangle-icon"]')
            expect(statusIcons1).toHaveLength(1)
            unmount1()

            const perceivedCrashProps = createPerceivedCrashFreeSessionsProps()
            const { unmount: unmount2 } = render(<MetricsCard {...perceivedCrashProps} />)
            const cardContent2 = screen.getByTestId('card-content')
            const statusIcons2 = cardContent2.querySelectorAll('[data-testid="check-circle-icon"], [data-testid="alert-triangle-icon"]')
            expect(statusIcons2).toHaveLength(1)
            unmount2()

            const anrProps = createAnrFreeSessionsProps()
            const { unmount: unmount3 } = render(<MetricsCard {...anrProps} />)
            const cardContent3 = screen.getByTestId('card-content')
            const statusIcons3 = cardContent3.querySelectorAll('[data-testid="check-circle-icon"], [data-testid="alert-triangle-icon"]')
            expect(statusIcons3).toHaveLength(1)
            unmount3()

            const perceivedAnrProps = createPerceivedAnrFreeSessionsProps()
            const { unmount: unmount4 } = render(<MetricsCard {...perceivedAnrProps} />)
            const cardContent4 = screen.getByTestId('card-content')
            const statusIcons4 = cardContent4.querySelectorAll('[data-testid="check-circle-icon"], [data-testid="alert-triangle-icon"]')
            expect(statusIcons4).toHaveLength(1)
            unmount4()

            const startTimeProps = createAppStartTimeProps()
            const { unmount: unmount5 } = render(<MetricsCard {...startTimeProps} />)
            const cardContent5 = screen.getByTestId('card-content')
            const statusIcons5 = cardContent5.querySelectorAll('[data-testid="check-circle-icon"], [data-testid="alert-triangle-icon"]')
            expect(statusIcons5).toHaveLength(1)
            unmount5()

            const sizeProps = createAppSizeProps()
            const { unmount: unmount6 } = render(<MetricsCard {...sizeProps} />)
            const cardContent6 = screen.getByTestId('card-content')
            const statusIcons6 = cardContent6.querySelectorAll('[data-testid="check-circle-icon"], [data-testid="alert-triangle-icon"]')
            expect(statusIcons6).toHaveLength(1)
            unmount6()
        })

        it('should not show status icon for app adoption', () => {
            const props = createAppAdoptionProps()
            render(<MetricsCard {...props} />)

            // App adoption should not have status icons in the card content
            const cardContent = screen.getByTestId('card-content')
            const statusIcons = cardContent.querySelectorAll('[data-testid*="circle-icon"], [data-testid*="triangle-icon"]')
            expect(statusIcons).toHaveLength(0)
        })

        it('should not show status icon when loading, error, or no data', () => {
            const baseProps = createCrashFreeSessionsProps()

            // Test loading
            const { rerender } = render(<MetricsCard {...baseProps} status={MetricsApiStatus.Loading} />)
            let cardContent = screen.getByTestId('card-content')
            let statusIcons = cardContent.querySelectorAll('[data-testid*="circle-icon"], [data-testid*="triangle-icon"]')
            expect(statusIcons).toHaveLength(0)

            // Test error
            rerender(<MetricsCard {...baseProps} status={MetricsApiStatus.Error} />)
            cardContent = screen.getByTestId('card-content')
            statusIcons = cardContent.querySelectorAll('[data-testid*="circle-icon"], [data-testid*="triangle-icon"]')
            expect(statusIcons).toHaveLength(0)

            // Test no data
            rerender(<MetricsCard {...baseProps} noData={true} />)
            cardContent = screen.getByTestId('card-content')
            statusIcons = cardContent.querySelectorAll('[data-testid*="circle-icon"], [data-testid*="triangle-icon"]')
            expect(statusIcons).toHaveLength(0)
        })
    })

    describe('Number Formatting', () => {
        it('should format large numbers with compact notation', () => {
            const props = createAppAdoptionProps({
                sessions: 2500000, // Should become 2.5M
                totalSessions: 10000000 // Should become 10M
            })
            render(<MetricsCard {...props} />)

            expect(screen.getByText('2.5M/10M sessions')).toBeInTheDocument()
        })

        it('should format app size with proper precision', () => {
            const props = createAppSizeProps({
                valueInBytes: 52428800, // 50MB exactly
                deltaInBytes: 1572864 // 1.5MB
            })
            render(<MetricsCard {...props} />)

            expect(screen.getByText('50.0 MB')).toBeInTheDocument()
            expect(screen.getByText('+1.50 MB')).toBeInTheDocument()
        })
    })
})
