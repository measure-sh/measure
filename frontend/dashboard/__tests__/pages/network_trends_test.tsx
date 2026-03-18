import NetworkTrends from '@/app/components/network_trends'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

// Global router mocks
const pushMock = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: pushMock,
    }),
}))

// Mock API
const mockFetchTrends = jest.fn()

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    NetworkTrendsApiStatus: {
        Loading: 'loading',
        Success: 'success',
        Error: 'error',
        NoData: 'no_data',
    },
    fetchNetworkTrendsFromServer: (...args: any[]) => mockFetchTrends(...args),
}))

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    defaultFilters: { ready: false, serialisedFilters: '' },
}))

// Mock LoadingBar
jest.mock('@/app/components/loading_bar', () => {
    return function LoadingBar() {
        return <div data-testid="loading-bar-mock">LoadingBar</div>
    }
})

// Mock table components to pass through
jest.mock('@/app/components/table', () => ({
    Table: (props: any) => <table {...props} />,
    TableBody: (props: any) => <tbody {...props} />,
    TableCell: (props: any) => <td {...props} />,
    TableHead: (props: any) => <th {...props} />,
    TableHeader: (props: any) => <thead {...props} />,
    TableRow: (props: any) => <tr {...props} />,
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: any) => (
        <a href={href} className={className}>{children}</a>
    ),
}))

jest.mock('@/app/utils/shared_styles', () => ({
    underlineLinkStyle: 'underline-link',
}))

const mockTrendsData = {
    trends_latency: [
        { domain: 'api.example.com', path_pattern: '/v1/slow', p95_latency: 3000, error_rate: 2.5, frequency: 15000 },
        { domain: 'api.example.com', path_pattern: '/v1/slower', p95_latency: 5000, error_rate: 1.0, frequency: 8000 },
    ],
    trends_error_rate: [
        { domain: 'api.example.com', path_pattern: '/v1/errors', p95_latency: 500, error_rate: 15.3, frequency: 20000 },
    ],
    trends_frequency: [
        { domain: 'cdn.example.com', path_pattern: '/images/*', p95_latency: 200, error_rate: 0.1, frequency: 500000 },
        { domain: 'api.example.com', path_pattern: '/v1/events', p95_latency: 100, error_rate: 0.2, frequency: 300000 },
        { domain: 'api.example.com', path_pattern: '/v1/health', p95_latency: 50, error_rate: 0.0, frequency: 200000 },
    ],
}

const readyFilters = {
    ready: true,
    serialisedFilters: 'test-filters',
    app: { id: 'app1' },
}

describe('NetworkTrends - Demo mode', () => {
    beforeEach(() => {
        pushMock.mockClear()
        mockFetchTrends.mockReset()
    })

    it('renders title and demo data without fetching APIs', () => {
        render(<NetworkTrends demo={true} />)

        expect(screen.getByText('Top Endpoints')).toBeInTheDocument()
        expect(mockFetchTrends).not.toHaveBeenCalled()
    })

    it('hides learn more subtitle in demo mode', () => {
        render(<NetworkTrends demo={true} />)

        expect(screen.queryByText('Learn more')).not.toBeInTheDocument()
    })

    it('renders table headers in demo mode', () => {
        render(<NetworkTrends demo={true} />)

        expect(screen.getByText('Endpoint')).toBeInTheDocument()
        expect(screen.getByText('Latency (p95)')).toBeInTheDocument()
        expect(screen.getByText('Error Rate %')).toBeInTheDocument()
        expect(screen.getByText('Frequency')).toBeInTheDocument()
    })

    it('renders demo endpoint data correctly', () => {
        render(<NetworkTrends demo={true} />)

        // Demo data sorted by latency (slowest first) - check first entry
        expect(screen.getByText(/payments\.demo-provider\.com\/\*\/checkout/)).toBeInTheDocument()
    })

    it('does not navigate on row click in demo mode', () => {
        render(<NetworkTrends demo={true} />)

        const rows = screen.getAllByRole('row')
        // Skip header row
        fireEvent.click(rows[1])
        expect(pushMock).not.toHaveBeenCalled()
    })
})

describe('NetworkTrends - Non-demo mode', () => {
    beforeEach(() => {
        pushMock.mockClear()
        mockFetchTrends.mockReset()
    })

    it('shows loading bar while data is loading', async () => {
        mockFetchTrends.mockReturnValue(new Promise(() => { }))

        render(<NetworkTrends filters={readyFilters as any} teamId="123" active={true} />)

        expect(screen.getByTestId('loading-bar-mock')).toBeInTheDocument()
    })

    it('renders title and learn more subtitle', async () => {
        mockFetchTrends.mockResolvedValue({
            status: 'success',
            data: mockTrendsData,
        })

        render(<NetworkTrends filters={readyFilters as any} teamId="123" active={true} />)

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0))
        })

        expect(screen.getByText('Top Endpoints')).toBeInTheDocument()
        expect(screen.getByText('Learn more')).toBeInTheDocument()
    })

    it('renders table with data after successful fetch', async () => {
        mockFetchTrends.mockResolvedValue({
            status: 'success',
            data: mockTrendsData,
        })

        render(<NetworkTrends filters={readyFilters as any} teamId="123" active={true} />)

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0))
        })

        expect(screen.getByText('Endpoint')).toBeInTheDocument()
        expect(screen.getByText(/api\.example\.com\/v1\/slow$/)).toBeInTheDocument()
        expect(screen.getByText(/api\.example\.com\/v1\/slower/)).toBeInTheDocument()
    })

    it('shows error message when API fails', async () => {
        mockFetchTrends.mockResolvedValue({ status: 'error' })

        render(<NetworkTrends filters={readyFilters as any} teamId="123" active={true} />)

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0))
        })

        expect(screen.getByText('Error fetching overview, please change filters & try again')).toBeInTheDocument()
    })

    it('shows no data message when API returns no data', async () => {
        mockFetchTrends.mockResolvedValue({ status: 'no_data' })

        render(<NetworkTrends filters={readyFilters as any} teamId="123" active={true} />)

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0))
        })

        expect(screen.getByText('No data available for the selected filters')).toBeInTheDocument()
    })

    it('switches to error rate tab and shows correct data', async () => {
        mockFetchTrends.mockResolvedValue({
            status: 'success',
            data: mockTrendsData,
        })

        render(<NetworkTrends filters={readyFilters as any} teamId="123" active={true} />)

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0))
        })

        const errorTab = screen.getByText('Highest Error %')
        await act(async () => {
            fireEvent.click(errorTab)
        })

        expect(screen.getByText(/api\.example\.com\/v1\/errors/)).toBeInTheDocument()
        expect(screen.getByText('15.3%')).toBeInTheDocument()
    })

    it('switches to frequency tab and shows correct data', async () => {
        mockFetchTrends.mockResolvedValue({
            status: 'success',
            data: mockTrendsData,
        })

        render(<NetworkTrends filters={readyFilters as any} teamId="123" active={true} />)

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0))
        })

        const freqTab = screen.getByText('Most Frequent')
        await act(async () => {
            fireEvent.click(freqTab)
        })

        expect(screen.getByText(/cdn\.example\.com\/images\/\*/)).toBeInTheDocument()
    })

    it('navigates to endpoint details on row click', async () => {
        mockFetchTrends.mockResolvedValue({
            status: 'success',
            data: mockTrendsData,
        })

        render(<NetworkTrends filters={readyFilters as any} teamId="123" active={true} />)

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0))
        })

        const rows = screen.getAllByRole('row')
        await act(async () => {
            fireEvent.click(rows[1])
        })

        expect(pushMock).toHaveBeenCalledWith(
            '/123/network/details?domain=api.example.com&path=%2Fv1%2Fslow'
        )
    })

    it('does not fetch when active is false', () => {
        render(<NetworkTrends filters={readyFilters as any} teamId="123" active={false} />)
        expect(mockFetchTrends).not.toHaveBeenCalled()
    })
})
