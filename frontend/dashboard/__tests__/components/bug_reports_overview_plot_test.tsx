import BugReportsOverviewPlot from '@/app/components/bug_reports_overview_plot'
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

jest.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light' }) }))
jest.mock('@/app/components/loading_spinner', () => ({ __esModule: true, default: () => <div>loading</div> }))

jest.mock('@/app/api/api_calls', () => ({
  __esModule: true,
  BugReportsOverviewPlotApiStatus: { Loading: 'loading', Success: 'success', Error: 'error', NoData: 'no_data' },
  fetchBugReportsOverviewPlotFromServer: (...args: any[]) => fetchMock(...args),
}))

const filters = { ready: true, startDate: '2025-01-01T00:00:00Z', endDate: '2025-12-31T00:00:00Z' } as any

describe('BugReportsOverviewPlot', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    lastLineProps = null
  })

  it('renders error state', async () => {
    fetchMock.mockResolvedValue({ status: 'error', data: null })
    render(<BugReportsOverviewPlot filters={filters} />)
    expect(await screen.findByText(/Error fetching plot/)).toBeInTheDocument()
  })

  it('renders no data state', async () => {
    fetchMock.mockResolvedValue({ status: 'no_data', data: null })
    render(<BugReportsOverviewPlot filters={filters} />)
    expect(await screen.findByText('No Data')).toBeInTheDocument()
  })

  it('does not fetch when filters are not ready', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [] })
    render(<BugReportsOverviewPlot filters={{ ...filters, ready: false }} />)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders loading state before request resolves', async () => {
    let resolvePromise: (value: any) => void = () => { }
    const pending = new Promise((resolve) => {
      resolvePromise = resolve
    })
    fetchMock.mockReturnValue(pending)

    render(<BugReportsOverviewPlot filters={filters} />)
    expect(screen.getByText('loading')).toBeInTheDocument()

    resolvePromise({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2025-02-01', instances: 1 }] }] })
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
  })

  it('maps API result shape to nivo data', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2025-02-01', instances: 2 }] }] })
    render(<BugReportsOverviewPlot filters={filters} />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.data[0].id).toBe('v1')
    expect(lastLineProps.data[0].data[0].y).toBe(2)
    expect(lastLineProps.axisLeft.legend).toBe('Bug Reports')
    expect(fetchMock).toHaveBeenCalledWith(filters)
  })

  it('uses month-style axis formatting for long range', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v', data: [{ datetime: '2025-02-01', instances: 1 }] }] })
    render(<BugReportsOverviewPlot filters={filters} />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisBottom.format).toBe('%b %Y')
  })

  it('uses minute/day configs for shorter ranges', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v', data: [{ datetime: '2026-02-01T01:00:00', instances: 1 }] }] })
    const { rerender } = render(<BugReportsOverviewPlot filters={{ ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T06:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('minute')

    rerender(<BugReportsOverviewPlot filters={{ ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-30T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('day')
  })

  it('pluralizes tooltip labels for singular and plural', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2025-02-01', instances: 2 }] }] })
    render(<BugReportsOverviewPlot filters={filters} />)
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
    fetchMock
      .mockResolvedValueOnce({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2025-02-01', instances: 2 }] }] })
      .mockImplementationOnce(() => new Promise(() => { }))

    const { rerender } = render(<BugReportsOverviewPlot filters={filters} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    rerender(<BugReportsOverviewPlot filters={{ ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T06:00:00Z' }} />)

    await waitFor(() => {
      expect(screen.getByText('loading')).toBeInTheDocument()
      expect(screen.queryByTestId('line-mock')).not.toBeInTheDocument()
    })
  })
})
