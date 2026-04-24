import SessionTimelinesOverviewPlot from '@/app/components/session_timelines_overview_plot'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'

let lastLineProps: any = null

jest.mock('@nivo/line', () => ({
  ResponsiveLine: (props: any) => {
    lastLineProps = props
    return <div data-testid="line-mock" />
  },
}))

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

jest.mock('@/app/components/skeleton', () => ({
  SkeletonPlot: () => <div data-testid="skeleton-mock" />,
}))

const mockUseSessionTimelinesOverviewPlotQuery = jest.fn((): { data: any; status: string; error: Error | null } => ({ data: undefined, status: 'pending', error: null }))

jest.mock('@/app/query/hooks', () => ({
  __esModule: true,
  useSessionTimelinesOverviewPlotQuery: () => mockUseSessionTimelinesOverviewPlotQuery(),
}))

jest.mock('@/app/stores/provider', () => {
  const { create } = jest.requireActual('zustand')
  const filtersStore = create(() => ({
    filters: { ready: false, serialisedFilters: '' },
  }))
  return { __esModule: true, useFiltersStore: filtersStore }
})

const { useFiltersStore } = require('@/app/stores/provider') as any

const filters = {
  ready: true,
  startDate: '2026-02-23T00:00:00Z',
  endDate: '2026-02-23T06:00:00Z',
} as any

describe('SessionTimelinesOverviewPlot', () => {
  beforeEach(() => {
    lastLineProps = null
    useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })
    mockUseSessionTimelinesOverviewPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
  })

  it('renders no data state', async () => {
    useFiltersStore.setState({ filters })
    mockUseSessionTimelinesOverviewPlotQuery.mockReturnValue({ data: null, status: 'success', error: null })
    render(<SessionTimelinesOverviewPlot />)

    expect(await screen.findByText('No Data')).toBeInTheDocument()
  })

  it('does not fetch when filters are not ready', async () => {
    useFiltersStore.setState({ filters: { ...filters, ready: false } })
    render(<SessionTimelinesOverviewPlot />)
    expect(mockUseSessionTimelinesOverviewPlotQuery).toHaveBeenCalled()
  })

  it('renders error state', async () => {
    useFiltersStore.setState({ filters })
    mockUseSessionTimelinesOverviewPlotQuery.mockReturnValue({ data: undefined, status: 'error', error: new Error('test') })
    render(<SessionTimelinesOverviewPlot />)

    expect(await screen.findByText(/Error fetching plot/)).toBeInTheDocument()
  })

  it('renders loading spinner before data is available', async () => {
    useFiltersStore.setState({ filters })
    mockUseSessionTimelinesOverviewPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })

    render(<SessionTimelinesOverviewPlot />)
    expect(screen.getByTestId('skeleton-mock')).toBeInTheDocument()
  })

  it('maps data and uses minute x-axis for short ranges', async () => {
    useFiltersStore.setState({ filters })
    mockUseSessionTimelinesOverviewPlotQuery.mockReturnValue({
      data: [{ id: '1.0.0', data: [{ id: '1.0.0.0', x: '2026-02-23T01:00:00', y: 2 }] }],
      status: 'success',
      error: null,
    })

    render(<SessionTimelinesOverviewPlot />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('minute')
    expect(lastLineProps.axisBottom.format).toBe('%b %d, %H:%M')
    expect(lastLineProps.axisLeft.legend).toBe('Session Timelines')
    expect(lastLineProps.data[0].data[0].y).toBe(2)
  })

  it('uses hour precision for medium range', async () => {
    const mediumFilters = { ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-06T00:00:00Z' }
    useFiltersStore.setState({ filters: mediumFilters })
    mockUseSessionTimelinesOverviewPlotQuery.mockReturnValue({
      data: [{ id: '1.0.0', data: [{ id: '1.0.0.0', x: '2026-02-10T01:00:00', y: 2 }] }],
      status: 'success',
      error: null,
    })
    render(<SessionTimelinesOverviewPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('hour')
  })

  it('uses day precision for multi-month range', async () => {
    const longFilters = { ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z' }
    useFiltersStore.setState({ filters: longFilters })
    mockUseSessionTimelinesOverviewPlotQuery.mockReturnValue({
      data: [{ id: '1.0.0', data: [{ id: '1.0.0.0', x: '2026-03-01', y: 2 }] }],
      status: 'success',
      error: null,
    })
    render(<SessionTimelinesOverviewPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('day')
    expect(lastLineProps.axisBottom.format).toBe('%b %d, %Y')
  })

  it('uses month formatting for long range', async () => {
    const yearFilters = { ...filters, startDate: '2025-01-01T00:00:00Z', endDate: '2026-01-01T00:00:00Z' }
    useFiltersStore.setState({ filters: yearFilters })
    mockUseSessionTimelinesOverviewPlotQuery.mockReturnValue({
      data: [{ id: '1.0.0', data: [{ id: '1.0.0.0', x: '2026-01-01', y: 2 }] }],
      status: 'success',
      error: null,
    })
    render(<SessionTimelinesOverviewPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisBottom.format).toBe('%d %b, %Y')
  })

  it('renders tooltip with expected labels', async () => {
    useFiltersStore.setState({ filters })
    mockUseSessionTimelinesOverviewPlotQuery.mockReturnValue({
      data: [{ id: '1.0.0', data: [{ id: '1.0.0.0', x: '2026-02-23T01:00:00', y: 2 }] }],
      status: 'success',
      error: null,
    })
    render(<SessionTimelinesOverviewPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    const tooltip = lastLineProps.sliceTooltip({
      slice: {
        points: [{
          id: 'p1',
          serieColor: '#111',
          serieId: '1.0.0',
          data: { xFormatted: '2026-02-23T01:00:00', yFormatted: 2 },
        }],
      },
    })
    const { container } = render(tooltip)
    expect(container.textContent).toContain('Date:')
    expect(container.textContent).toContain('session timelines')
  })

  it('hides stale chart while new range data is loading', async () => {
    const longFilters = { ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z' }
    useFiltersStore.setState({ filters: longFilters })
    mockUseSessionTimelinesOverviewPlotQuery.mockReturnValue({
      data: [{ id: '1.0.0', data: [{ id: '1.0.0.0', x: '2026-03-01', y: 2 }] }],
      status: 'success',
      error: null,
    })
    const { unmount } = render(<SessionTimelinesOverviewPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    unmount()

    const newFilters = { ...filters, startDate: '2026-02-23T00:00:00Z', endDate: '2026-02-23T06:00:00Z' }
    useFiltersStore.setState({ filters: newFilters })
    mockUseSessionTimelinesOverviewPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })

    render(<SessionTimelinesOverviewPlot />)

    await waitFor(() => {
      expect(screen.getByTestId('skeleton-mock')).toBeInTheDocument()
      expect(screen.queryByTestId('line-mock')).not.toBeInTheDocument()
    })
  })
})
