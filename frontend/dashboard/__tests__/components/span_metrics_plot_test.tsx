import SpanMetricsPlot from '@/app/components/span_metrics_plot'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let lastLineProps: any = null
let lastTabSelectProps: any = null
const fetchMock = jest.fn()

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

jest.mock('@/app/api/api_calls', () => ({
  __esModule: true,
  SpanMetricsPlotApiStatus: { Loading: 'loading', Success: 'success', Error: 'error', NoData: 'no_data' },
  fetchSpanMetricsPlotFromServer: (...args: any[]) => fetchMock(...args),
}))

const filters = { ready: true, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T08:00:00Z' } as any

describe('SpanMetricsPlot', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    lastLineProps = null
    lastTabSelectProps = null
  })

  it('renders no data state', async () => {
    fetchMock.mockResolvedValue({ status: 'no_data', data: null })
    render(<SpanMetricsPlot filters={filters} />)

    expect(await screen.findByText('No Data')).toBeInTheDocument()
  })

  it('renders error state', async () => {
    fetchMock.mockResolvedValue({ status: 'error', data: null })
    render(<SpanMetricsPlot filters={filters} />)
    expect(await screen.findByText(/Error fetching plot/)).toBeInTheDocument()
  })

  it('does not fetch when filters are not ready', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [] })
    render(<SpanMetricsPlot filters={{ ...filters, ready: false }} />)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders loading state before request resolves', async () => {
    let resolvePromise: (value: any) => void = () => { }
    const pending = new Promise((resolve) => {
      resolvePromise = resolve
    })
    fetchMock.mockReturnValue(pending)

    render(<SpanMetricsPlot filters={filters} />)
    expect(screen.getByText('loading')).toBeInTheDocument()

    resolvePromise({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2026-02-01T01:00:00', p50: 10, p90: 20, p95: 30, p99: 40 }] }] })
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
  })

  it('maps quantile and updates when tab changes', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2026-02-01T01:00:00', p50: 10, p90: 20, p95: 30, p99: 40 }] }] })
    render(<SpanMetricsPlot filters={filters} />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.data[0].data[0].y).toBe(30)
    expect(lastLineProps.axisLeft.legend).toBe('Duration (p95)')
    expect(fetchMock).toHaveBeenCalledWith(filters)
    expect(lastTabSelectProps.items).toEqual(['p50', 'p90', 'p95', 'p99'])
    expect(lastTabSelectProps.selected).toBe('p95')

    fireEvent.click(screen.getByTestId('quantile-p99'))
    await waitFor(() => expect(lastLineProps.data[0].data[0].y).toBe(40))
    expect(lastLineProps.axisLeft.legend).toBe('Duration (p99)')
  })

  it('renders tooltip with human readable millis', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2026-02-01T01:00:00', p50: 10, p90: 20, p95: 30, p99: 40 }] }] })
    render(<SpanMetricsPlot filters={filters} />)
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
    expect(container.textContent).toContain('(p95)')
  })

  it('uses hour/day/month axis configuration for larger ranges', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2026-02-10T01:00:00', p50: 10, p90: 20, p95: 30, p99: 40 }] }] })
    const { rerender } = render(<SpanMetricsPlot filters={{ ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-06T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('hour')

    rerender(<SpanMetricsPlot filters={{ ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('day')

    rerender(<SpanMetricsPlot filters={{ ...filters, startDate: '2025-01-01T00:00:00Z', endDate: '2026-01-01T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisBottom.format).toBe('%b %Y')
  })

  it('throws for invalid quantile selection', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2026-02-01T01:00:00', p50: 10, p90: 20, p95: 30, p99: 40 }] }] })
    render(<SpanMetricsPlot filters={filters} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    let thrown: any = null
    try {
      lastTabSelectProps.onChangeSelected('p75')
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBe('Invalid quantile selected')
  })

})
