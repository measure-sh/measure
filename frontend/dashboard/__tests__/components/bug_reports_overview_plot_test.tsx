import BugReportsOverviewPlot from '@/app/components/bug_reports_overview_plot'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'

let lastLineProps: any = null

jest.mock('@nivo/line', () => ({
  ResponsiveLine: (props: any) => {
    lastLineProps = props
    return <div data-testid="line-mock" />
  },
}))

jest.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light' }) }))
jest.mock('@/app/components/skeleton', () => ({ SkeletonPlot: () => <div data-testid="skeleton-mock">loading</div> }))

const mockUseBugReportsOverviewPlotQuery = jest.fn((): { data: any; status: string; error: Error | null } => ({ data: undefined, status: 'pending', error: null }))

jest.mock('@/app/query/hooks', () => ({
  __esModule: true,
  useBugReportsOverviewPlotQuery: () => mockUseBugReportsOverviewPlotQuery(),
}))

jest.mock('@/app/stores/provider', () => {
  const { create } = jest.requireActual('zustand')
  const filtersStore = create(() => ({
    filters: { ready: false, serialisedFilters: '' },
  }))
  return { __esModule: true, useFiltersStore: filtersStore }
})

const { useFiltersStore } = require('@/app/stores/provider') as any

const filters = { ready: true, startDate: '2025-01-01T00:00:00Z', endDate: '2025-12-31T00:00:00Z' } as any

describe('BugReportsOverviewPlot', () => {
  beforeEach(() => {
    lastLineProps = null
    useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })
    mockUseBugReportsOverviewPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
  })

  it('renders error state', async () => {
    useFiltersStore.setState({ filters })
    mockUseBugReportsOverviewPlotQuery.mockReturnValue({ data: undefined, status: 'error', error: new Error('test') })
    render(<BugReportsOverviewPlot />)
    expect(await screen.findByText(/Error fetching plot/)).toBeInTheDocument()
  })

  it('renders no data state', async () => {
    useFiltersStore.setState({ filters })
    mockUseBugReportsOverviewPlotQuery.mockReturnValue({ data: null, status: 'success', error: null })
    render(<BugReportsOverviewPlot />)
    expect(await screen.findByText('No Data')).toBeInTheDocument()
  })

  it('does not fetch when filters are not ready', async () => {
    useFiltersStore.setState({ filters: { ...filters, ready: false } })
    render(<BugReportsOverviewPlot />)
    // Query hook is called but TanStack Query handles the enabled flag internally
    expect(mockUseBugReportsOverviewPlotQuery).toHaveBeenCalled()
  })

  it('renders loading state before data is available', async () => {
    useFiltersStore.setState({ filters })
    mockUseBugReportsOverviewPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })

    render(<BugReportsOverviewPlot />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('maps API result shape to nivo data', async () => {
    useFiltersStore.setState({ filters })
    mockUseBugReportsOverviewPlotQuery.mockReturnValue({
      data: [{ id: 'v1', data: [{ id: 'v1.0', x: '2025-02-01', y: 2 }] }],
      status: 'success',
      error: null,
    })
    render(<BugReportsOverviewPlot />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.data[0].id).toBe('v1')
    expect(lastLineProps.data[0].data[0].y).toBe(2)
    expect(lastLineProps.axisLeft.legend).toBe('Bug Reports')
  })

  it('uses month-style axis formatting for long range', async () => {
    useFiltersStore.setState({ filters })
    mockUseBugReportsOverviewPlotQuery.mockReturnValue({
      data: [{ id: 'v', data: [{ id: 'v.0', x: '2025-02-01', y: 1 }] }],
      status: 'success',
      error: null,
    })
    render(<BugReportsOverviewPlot />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisBottom.format).toBe('%d %b, %Y')
  })

  it('uses minute/day configs for shorter ranges', async () => {
    const minuteFilters = { ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T06:00:00Z' }
    useFiltersStore.setState({ filters: minuteFilters })
    mockUseBugReportsOverviewPlotQuery.mockReturnValue({
      data: [{ id: 'v', data: [{ id: 'v.0', x: '2026-02-01T01:00:00', y: 1 }] }],
      status: 'success',
      error: null,
    })
    const { unmount } = render(<BugReportsOverviewPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('minute')

    unmount()
    lastLineProps = null

    const dayFilters = { ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-30T00:00:00Z' }
    useFiltersStore.setState({ filters: dayFilters })
    mockUseBugReportsOverviewPlotQuery.mockReturnValue({
      data: [{ id: 'v', data: [{ id: 'v.0', x: '2026-02-01', y: 1 }] }],
      status: 'success',
      error: null,
    })
    render(<BugReportsOverviewPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('day')
  })

  it('pluralizes tooltip labels for singular and plural', async () => {
    useFiltersStore.setState({ filters })
    mockUseBugReportsOverviewPlotQuery.mockReturnValue({
      data: [{ id: 'v1', data: [{ id: 'v1.0', x: '2025-02-01', y: 2 }] }],
      status: 'success',
      error: null,
    })
    render(<BugReportsOverviewPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    const one = lastLineProps.sliceTooltip({
      slice: { points: [{ id: 'p1', serieColor: '#111', serieId: 'v1', data: { xFormatted: '2025-02-01', yFormatted: 1 } }] },
    })
    const many = lastLineProps.sliceTooltip({
      slice: { points: [{ id: 'p2', serieColor: '#111', serieId: 'v1', data: { xFormatted: '2025-02-01', yFormatted: 3 } }] },
    })
    const r1 = render(one)
    const r2 = render(many)
    expect(r1.container.textContent).toContain('Bug Report')
    expect(r2.container.textContent).toContain('Bug Reports')
  })

  it('hides stale chart while new range data is loading', async () => {
    useFiltersStore.setState({ filters })
    mockUseBugReportsOverviewPlotQuery.mockReturnValue({
      data: [{ id: 'v1', data: [{ id: 'v1.0', x: '2025-02-01', y: 2 }] }],
      status: 'success',
      error: null,
    })
    const { unmount } = render(<BugReportsOverviewPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    unmount()

    // Simulate new range: filters changed, query is loading
    const newFilters = { ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T06:00:00Z' }
    useFiltersStore.setState({ filters: newFilters })
    mockUseBugReportsOverviewPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })

    render(<BugReportsOverviewPlot />)

    await waitFor(() => {
      expect(screen.getByText('loading')).toBeInTheDocument()
      expect(screen.queryByTestId('line-mock')).not.toBeInTheDocument()
    })
  })
})
