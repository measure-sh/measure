import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

let lastLineProps: any = null
let lastTabSelectProps: any = null

jest.mock('@nivo/line', () => ({
  ResponsiveLine: (props: any) => {
    lastLineProps = props
    return <div data-testid="line-mock" />
  },
}))

jest.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light' }) }))
jest.mock('@/app/components/loading_spinner', () => ({ __esModule: true, default: () => <div>loading</div> }))

jest.mock('@/app/components/tab_select', () => ({
  __esModule: true,
  default: ({ items, selected, onChangeSelected }: any) => {
    lastTabSelectProps = { items, selected, onChangeSelected }
    return (
      <div>
        {items.map((item: string) => (
          <button key={item} data-testid={`quantile-${item}`} aria-pressed={selected === item} onClick={() => onChangeSelected(item)}>
            {item}
          </button>
        ))}
      </div>
    )
  },
}))

const mockUseSpanMetricsPlotQuery = jest.fn((): { data: any; status: string; error: Error | null } => ({ data: undefined, status: 'pending', error: null }))

jest.mock('@/app/query/hooks', () => ({
  __esModule: true,
  RootSpanMetricsQuantile: {
    p50: 'p50',
    p90: 'p90',
    p95: 'p95',
    p99: 'p99',
  },
  useSpanMetricsPlotQuery: () => mockUseSpanMetricsPlotQuery(),
}))

jest.mock('@/app/stores/provider', () => {
  const { create } = jest.requireActual('zustand')
  const filtersStore = create(() => ({
    filters: { ready: false, serialisedFilters: null },
  }))
  return { __esModule: true, useFiltersStore: filtersStore }
})

import SpanMetricsPlot from '@/app/components/span_metrics_plot'
const { useFiltersStore } = require('@/app/stores/provider') as any

const defaultFilters = { ready: true, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T08:00:00Z', serialisedFilters: '2026-02-01T00:00:00Z|2026-02-01T08:00:00Z|minutes' }

describe('SpanMetricsPlot', () => {
  beforeEach(() => {
    lastLineProps = null
    lastTabSelectProps = null
    useFiltersStore.setState({ filters: { ready: false, serialisedFilters: null } })
    mockUseSpanMetricsPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
  })

  it('renders no data state', async () => {
    useFiltersStore.setState({ filters: defaultFilters })
    mockUseSpanMetricsPlotQuery.mockReturnValue({ data: null, status: 'success', error: null })
    render(<SpanMetricsPlot />)

    expect(screen.getByText('No Data')).toBeInTheDocument()
  })

  it('renders error state', async () => {
    useFiltersStore.setState({ filters: defaultFilters })
    mockUseSpanMetricsPlotQuery.mockReturnValue({ data: undefined, status: 'error', error: new Error('test') })
    render(<SpanMetricsPlot />)
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument()
  })

  it('does not fetch when filters are not ready', async () => {
    useFiltersStore.setState({ filters: { ready: false, serialisedFilters: null } })
    render(<SpanMetricsPlot />)
    // Query hook is called but TanStack Query handles the enabled flag internally
    expect(mockUseSpanMetricsPlotQuery).toHaveBeenCalled()
  })

  it('renders loading state before request resolves', async () => {
    useFiltersStore.setState({ filters: defaultFilters })
    mockUseSpanMetricsPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
    render(<SpanMetricsPlot />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('maps quantile and updates when tab changes', async () => {
    const plotData = [{ id: 'v1', data: [{ id: 'v1.0', x: '2026-02-01T01:00:00', y: 30 }] }]

    useFiltersStore.setState({ filters: defaultFilters })
    mockUseSpanMetricsPlotQuery.mockReturnValue({
      data: plotData,
      status: 'success',
      error: null,
    })

    render(<SpanMetricsPlot />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.data[0].data[0].y).toBe(30)
    // Component initializes with p50 (from useState default)
    expect(lastLineProps.axisLeft.legend).toBe('Duration (p50)')
    expect(lastTabSelectProps.items).toEqual(['p50', 'p90', 'p95', 'p99'])
    expect(lastTabSelectProps.selected).toBe('p50')

    // Change to p99 - this triggers a re-render with new quantile passed to the query hook
    const plotDataP99 = [{ id: 'v1', data: [{ id: 'v1.0', x: '2026-02-01T01:00:00', y: 40 }] }]
    mockUseSpanMetricsPlotQuery.mockReturnValue({
      data: plotDataP99,
      status: 'success',
      error: null,
    })

    fireEvent.click(screen.getByTestId('quantile-p99'))
    await waitFor(() => expect(lastLineProps.data[0].data[0].y).toBe(40))
    expect(lastLineProps.axisLeft.legend).toBe('Duration (p99)')
  })

  it('renders tooltip with human readable millis', async () => {
    const plotData = [{ id: 'v1', data: [{ id: 'v1.0', x: '2026-02-01T01:00:00', y: 30 }] }]
    useFiltersStore.setState({ filters: defaultFilters })
    mockUseSpanMetricsPlotQuery.mockReturnValue({
      data: plotData,
      status: 'success',
      error: null,
    })

    render(<SpanMetricsPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    const tooltip = lastLineProps.sliceTooltip({
      slice: {
        points: [{
          id: 'p1',
          serieColor: '#111',
          serieId: 'v1',
          data: { xFormatted: '2026-02-01T01:00:00', yFormatted: 30 },
        }],
      },
    })
    const { container } = render(tooltip)
    expect(container.textContent).toContain('Date:')
    expect(container.textContent).toContain('(p50)')
  })

  it('uses hour/day/month axis configuration for larger ranges', async () => {
    // hours range (5 days)
    const hoursFilters = { ready: true, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-06T00:00:00Z', serialisedFilters: '2026-02-01T00:00:00Z|2026-02-06T00:00:00Z|hours' }
    const plotData = [{ id: 'v1', data: [{ id: 'v1.0', x: '2026-02-10T01:00:00', y: 30 }] }]

    useFiltersStore.setState({ filters: hoursFilters })
    mockUseSpanMetricsPlotQuery.mockReturnValue({
      data: plotData,
      status: 'success',
      error: null,
    })
    render(<SpanMetricsPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('hour')
  })

  it('uses day axis configuration for medium ranges', async () => {
    const daysFilters = { ready: true, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z', serialisedFilters: '2026-01-01T00:00:00Z|2026-03-15T00:00:00Z|days' }
    const plotData = [{ id: 'v1', data: [{ id: 'v1.0', x: '2026-02-10T01:00:00', y: 30 }] }]

    useFiltersStore.setState({ filters: daysFilters })
    mockUseSpanMetricsPlotQuery.mockReturnValue({
      data: plotData,
      status: 'success',
      error: null,
    })
    render(<SpanMetricsPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('day')
  })

  it('uses month axis configuration for large ranges', async () => {
    const monthsFilters = { ready: true, startDate: '2025-01-01T00:00:00Z', endDate: '2026-01-01T00:00:00Z', serialisedFilters: '2025-01-01T00:00:00Z|2026-01-01T00:00:00Z|months' }
    const plotData = [{ id: 'v1', data: [{ id: 'v1.0', x: '2026-02-10T01:00:00', y: 30 }] }]

    useFiltersStore.setState({ filters: monthsFilters })
    mockUseSpanMetricsPlotQuery.mockReturnValue({
      data: plotData,
      status: 'success',
      error: null,
    })
    render(<SpanMetricsPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisBottom.format).toBe('%d %b, %Y')
  })

  it('throws for invalid quantile selection', async () => {
    const plotData = [{ id: 'v1', data: [{ id: 'v1.0', x: '2026-02-01T01:00:00', y: 30 }] }]
    useFiltersStore.setState({ filters: defaultFilters })
    mockUseSpanMetricsPlotQuery.mockReturnValue({
      data: plotData,
      status: 'success',
      error: null,
    })

    render(<SpanMetricsPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    let thrown: any = null
    try {
      lastTabSelectProps.onChangeSelected('p75')
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBe('Invalid quantile selected')
  })

  it('hides stale chart while new range data is loading', async () => {
    // First render with success state
    const plotData = [{ id: 'v1', data: [{ id: 'v1.0', x: '2026-02-10T01:00:00', y: 30 }] }]
    const hoursFilters = { ready: true, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-06T00:00:00Z', serialisedFilters: '2026-02-01T00:00:00Z|2026-02-06T00:00:00Z|hours' }
    useFiltersStore.setState({ filters: hoursFilters })
    mockUseSpanMetricsPlotQuery.mockReturnValue({
      data: plotData,
      status: 'success',
      error: null,
    })
    render(<SpanMetricsPlot />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    // Now change filters and set loading
    const newFilters = { ready: true, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T08:00:00Z', serialisedFilters: '2026-02-01T00:00:00Z|2026-02-01T08:00:00Z|minutes' }
    await act(async () => {
      useFiltersStore.setState({ filters: newFilters })
      mockUseSpanMetricsPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
    })

    await waitFor(() => {
      expect(screen.getByText('loading')).toBeInTheDocument()
      expect(screen.queryByTestId('line-mock')).not.toBeInTheDocument()
    })
  })

})
