import SessionTimelinesOverviewPlot from '@/app/components/session_timelines_overview_plot'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'

let lastLineProps: any = null
const fetchMock = jest.fn()

jest.mock('@nivo/line', () => ({
  ResponsiveLine: (props: any) => {
    lastLineProps = props
    return <div data-testid="line-mock" />
  },
}))

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

jest.mock('@/app/components/loading_spinner', () => ({
  __esModule: true,
  default: () => <div data-testid="loading-spinner" />,
}))

jest.mock('@/app/api/api_calls', () => ({
  __esModule: true,
  SessionTimelinesOverviewPlotApiStatus: {
    Loading: 'loading',
    Success: 'success',
    Error: 'error',
    NoData: 'no_data',
  },
  fetchSessionTimelinesOverviewPlotFromServer: (...args: any[]) => fetchMock(...args),
}))

const filters = {
  ready: true,
  startDate: '2026-02-23T00:00:00Z',
  endDate: '2026-02-23T06:00:00Z',
} as any

describe('SessionTimelinesOverviewPlot', () => {
  beforeEach(() => {
    lastLineProps = null
    fetchMock.mockReset()
  })

  it('renders no data state', async () => {
    fetchMock.mockResolvedValue({ status: 'no_data', data: null })
    render(<SessionTimelinesOverviewPlot filters={filters} />)

    expect(await screen.findByText('No Data')).toBeInTheDocument()
  })

  it('does not fetch when filters are not ready', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [] })
    render(<SessionTimelinesOverviewPlot filters={{ ...filters, ready: false }} />)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders error state', async () => {
    fetchMock.mockResolvedValue({ status: 'error', data: null })
    render(<SessionTimelinesOverviewPlot filters={filters} />)

    expect(await screen.findByText(/Error fetching plot/)).toBeInTheDocument()
  })

  it('renders loading spinner before request resolves', async () => {
    let resolvePromise: (value: any) => void = () => { }
    const pending = new Promise((resolve) => {
      resolvePromise = resolve
    })
    fetchMock.mockReturnValue(pending)

    render(<SessionTimelinesOverviewPlot filters={filters} />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

    resolvePromise({ status: 'success', data: [{ id: '1.0.0', data: [{ datetime: '2026-02-23T01:00:00', instances: 2 }] }] })
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
  })

  it('maps data and uses minute x-axis for short ranges', async () => {
    fetchMock.mockResolvedValue({
      status: 'success',
      data: [{ id: '1.0.0', data: [{ datetime: '2026-02-23T01:00:00', instances: 2 }] }],
    })

    render(<SessionTimelinesOverviewPlot filters={filters} />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('minute')
    expect(lastLineProps.axisBottom.format).toBe('%b %d, %H:%M')
    expect(lastLineProps.axisLeft.legend).toBe('Session Timelines')
    expect(lastLineProps.data[0].data[0].y).toBe(2)
    expect(fetchMock).toHaveBeenCalledWith(filters)
  })

  it('uses hour precision for medium range', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: '1.0.0', data: [{ datetime: '2026-02-10T01:00:00', instances: 2 }] }] })
    render(<SessionTimelinesOverviewPlot filters={{ ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-06T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('hour')
  })

  it('uses day precision for multi-month range', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: '1.0.0', data: [{ datetime: '2026-03-01', instances: 2 }] }] })
    render(<SessionTimelinesOverviewPlot filters={{ ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('day')
    expect(lastLineProps.axisBottom.format).toBe('%b %d, %Y')
  })

  it('uses month formatting for long range', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: '1.0.0', data: [{ datetime: '2026-01-01', instances: 2 }] }] })
    render(<SessionTimelinesOverviewPlot filters={{ ...filters, startDate: '2025-01-01T00:00:00Z', endDate: '2026-01-01T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisBottom.format).toBe('%b %Y')
  })

  it('renders tooltip with expected labels', async () => {
    fetchMock.mockResolvedValue({
      status: 'success',
      data: [{ id: '1.0.0', data: [{ datetime: '2026-02-23T01:00:00', instances: 2 }] }],
    })
    render(<SessionTimelinesOverviewPlot filters={filters} />)
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
    fetchMock
      .mockResolvedValueOnce({ status: 'success', data: [{ id: '1.0.0', data: [{ datetime: '2026-03-01', instances: 2 }] }] })
      .mockImplementationOnce(() => new Promise(() => { }))

    const { rerender } = render(<SessionTimelinesOverviewPlot filters={{ ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    rerender(<SessionTimelinesOverviewPlot filters={{ ...filters, startDate: '2026-02-23T00:00:00Z', endDate: '2026-02-23T06:00:00Z' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.queryByTestId('line-mock')).not.toBeInTheDocument()
    })
  })
})
