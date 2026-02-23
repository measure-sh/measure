import SessionsVsExceptionsPlot from '@/app/components/sessions_vs_exceptions_overview_plot'
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
  SessionsVsExceptionsPlotApiStatus: { Loading: 'loading', Success: 'success', Error: 'error', NoData: 'no_data' },
  fetchSessionsVsExceptionsPlotFromServer: (...args: any[]) => fetchMock(...args),
}))

const filters = { ready: true, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T06:00:00Z' } as any

describe('SessionsVsExceptionsPlot', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    lastLineProps = null
  })

  it('renders no data state', async () => {
    fetchMock.mockResolvedValue({ status: 'no_data', data: null })
    render(<SessionsVsExceptionsPlot filters={filters} />)

    expect(await screen.findByText('No Data')).toBeInTheDocument()
  })

  it('renders error state', async () => {
    fetchMock.mockResolvedValue({ status: 'error', data: null })
    render(<SessionsVsExceptionsPlot filters={filters} />)
    expect(await screen.findByText(/Error fetching plot/)).toBeInTheDocument()
  })

  it('does not fetch when filters are not ready', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [] })
    render(<SessionsVsExceptionsPlot filters={{ ...filters, ready: false }} />)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders loading state before request resolves', async () => {
    let resolvePromise: (value: any) => void = () => { }
    const pending = new Promise((resolve) => {
      resolvePromise = resolve
    })
    fetchMock.mockReturnValue(pending)

    render(<SessionsVsExceptionsPlot filters={filters} />)
    expect(screen.getByText('loading')).toBeInTheDocument()

    resolvePromise({ status: 'success', data: [{ id: 'Sessions', data: [{ id: 's1', x: '2026-02-01T01:00:00', y: 10 }] }] })
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
  })

  it('uses demo data and bypasses API in demo mode', async () => {
    render(<SessionsVsExceptionsPlot filters={filters} demo />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(lastLineProps.data[0].id).toBe('Sessions')
  })

  it('renders data and minute precision axis for sub-12h range', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'Sessions', data: [{ id: 's1', x: '2026-02-01T01:00:00', y: 10 }] }] })
    render(<SessionsVsExceptionsPlot filters={filters} />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('minute')
    expect(lastLineProps.data[0].id).toBe('Sessions')
    expect(fetchMock).toHaveBeenCalledWith(filters)
  })

  it('uses hour/day/month axis config based on range', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'Sessions', data: [{ id: 's1', x: '2026-02-01T01:00:00', y: 10 }] }] })

    const { rerender } = render(<SessionsVsExceptionsPlot filters={{ ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-06T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('hour')

    rerender(<SessionsVsExceptionsPlot filters={{ ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('day')

    rerender(<SessionsVsExceptionsPlot filters={{ ...filters, startDate: '2025-01-01T00:00:00Z', endDate: '2026-01-01T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisBottom.format).toBe('%b %Y')
  })

  it('renders tooltip in Sessions, Crashes, ANRs order', async () => {
    fetchMock.mockResolvedValue({
      status: 'success',
      data: [
        { id: 'ANRs', data: [{ id: 'a1', x: '2026-02-01T01:00:00', y: 1 }] },
        { id: 'Sessions', data: [{ id: 's1', x: '2026-02-01T01:00:00', y: 10 }] },
        { id: 'Crashes', data: [{ id: 'c1', x: '2026-02-01T01:00:00', y: 2 }] },
      ],
    })
    render(<SessionsVsExceptionsPlot filters={filters} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    const tooltip = lastLineProps.sliceTooltip({
      slice: {
        points: [
          { id: 'a1', serieId: 'ANRs', data: { xFormatted: '2026-02-01T01:00:00', yFormatted: 1 } },
          { id: 's1', serieId: 'Sessions', data: { xFormatted: '2026-02-01T01:00:00', yFormatted: 10 } },
          { id: 'c1', serieId: 'Crashes', data: { xFormatted: '2026-02-01T01:00:00', yFormatted: 2 } },
        ],
      },
    })

    const { container } = render(tooltip)
    const text = container.textContent || ''
    expect(text.indexOf('Sessions')).toBeLessThan(text.indexOf('Crashes'))
    expect(text.indexOf('Crashes')).toBeLessThan(text.indexOf('ANRs'))
  })

  it('skips missing tooltip series and keeps known ordering', async () => {
    fetchMock.mockResolvedValue({
      status: 'success',
      data: [
        { id: 'Sessions', data: [{ id: 's1', x: '2026-02-01T01:00:00', y: 10 }] },
        { id: 'ANRs', data: [{ id: 'a1', x: '2026-02-01T01:00:00', y: 1 }] },
      ],
    })
    render(<SessionsVsExceptionsPlot filters={filters} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    const tooltip = lastLineProps.sliceTooltip({
      slice: {
        points: [
          { id: 'a1', serieId: 'ANRs', data: { xFormatted: '2026-02-01T01:00:00', yFormatted: 1 } },
          { id: 's1', serieId: 'Sessions', data: { xFormatted: '2026-02-01T01:00:00', yFormatted: 10 } },
        ],
      },
    })

    const { container } = render(tooltip)
    const text = container.textContent || ''
    expect(text).toContain('Sessions')
    expect(text).not.toContain('Crashes')
    expect(text).toContain('ANRs')
  })

  it('uses fallback color for unknown series id', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'Sessions', data: [{ id: 's1', x: '2026-02-01T01:00:00', y: 10 }] }] })
    render(<SessionsVsExceptionsPlot filters={filters} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    expect(lastLineProps.colors({ id: 'Unknown' })).toBe('#888')
    expect(lastLineProps.pointBorderColor({ serieId: 'Unknown' })).toBe('#888')
  })
})
