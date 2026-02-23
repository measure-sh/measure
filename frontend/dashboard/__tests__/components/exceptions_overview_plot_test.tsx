import ExceptionsOverviewPlot from '@/app/components/exceptions_overview_plot'
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
  ExceptionsType: { Crash: 'crash', Anr: 'anr' },
  ExceptionsOverviewPlotApiStatus: { Loading: 'loading', Success: 'success', Error: 'error', NoData: 'no_data' },
  fetchExceptionsOverviewPlotFromServer: (...args: any[]) => fetchMock(...args),
}))

const filters = { ready: true, startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-06T00:00:00Z' } as any

describe('ExceptionsOverviewPlot', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    lastLineProps = null
  })

  it('renders error state', async () => {
    fetchMock.mockResolvedValue({ status: 'error', data: null })
    render(<ExceptionsOverviewPlot exceptionsType={'crash' as any} filters={filters} />)

    expect(await screen.findByText(/Error fetching plot/)).toBeInTheDocument()
  })

  it('renders no data state', async () => {
    fetchMock.mockResolvedValue({ status: 'no_data', data: null })
    render(<ExceptionsOverviewPlot exceptionsType={'crash' as any} filters={filters} />)

    expect(await screen.findByText('No Data')).toBeInTheDocument()
  })

  it('does not fetch when filters are not ready', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [] })
    render(<ExceptionsOverviewPlot exceptionsType={'crash' as any} filters={{ ...filters, ready: false }} />)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders loading state before request resolves', async () => {
    let resolvePromise: (value: any) => void = () => { }
    const pending = new Promise((resolve) => {
      resolvePromise = resolve
    })
    fetchMock.mockReturnValue(pending)

    render(<ExceptionsOverviewPlot exceptionsType={'crash' as any} filters={filters} />)
    expect(screen.getByText('loading')).toBeInTheDocument()

    resolvePromise({ status: 'success', data: [{ id: 'v', data: [{ datetime: '2026-01-02T00:00:00', instances: 1 }] }] })
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
  })

  it('renders success with hour precision for ~days range', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v', data: [{ datetime: '2026-01-02T00:00:00', instances: 3 }] }] })
    render(<ExceptionsOverviewPlot exceptionsType={'crash' as any} filters={filters} />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('hour')
    expect(lastLineProps.data[0].data[0].y).toBe(3)
    expect(lastLineProps.axisLeft.legend).toBe('Crash instances')
    expect(lastLineProps.axisLeft.format(2)).toBe(2)
    expect(lastLineProps.axisLeft.format(1.5)).toBe('')
    expect(fetchMock).toHaveBeenCalledWith('crash', filters)
  })

  it('sets ANR axis legend for ANR mode', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v', data: [{ datetime: '2026-01-02T00:00:00', instances: 1 }] }] })
    render(<ExceptionsOverviewPlot exceptionsType={'anr' as any} filters={filters} />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisLeft.legend).toBe('ANR instances')
  })

  it('pluralizes tooltip label for singular and plural values', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v', data: [{ datetime: '2026-01-02T00:00:00', instances: 1 }] }] })
    render(<ExceptionsOverviewPlot exceptionsType={'crash' as any} filters={filters} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    const singleTooltip = lastLineProps.sliceTooltip({
      slice: {
        points: [{
          id: 'p1',
          serieColor: '#111',
          serieId: 'v',
          data: { xFormatted: '2026-01-02T00:00:00', y: 1, yFormatted: 1 },
        }],
      },
    })
    const multiTooltip = lastLineProps.sliceTooltip({
      slice: {
        points: [{
          id: 'p2',
          serieColor: '#111',
          serieId: 'v',
          data: { xFormatted: '2026-01-02T00:00:00', y: 3, yFormatted: 3 },
        }],
      },
    })

    const { container: single } = render(singleTooltip)
    const { container: multi } = render(multiTooltip)
    expect(single.textContent).toContain('1 instance')
    expect(multi.textContent).toContain('3 instances')
    expect(single.textContent).toContain('Date:')
    expect(multi.textContent).toContain('Date:')
  })

  it('switches axis format based on range', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v', data: [{ datetime: '2026-01-02T00:00:00', instances: 2 }] }] })
    const { rerender } = render(<ExceptionsOverviewPlot exceptionsType={'crash' as any} filters={{ ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-01T06:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('minute')

    rerender(<ExceptionsOverviewPlot exceptionsType={'crash' as any} filters={{ ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('day')

    rerender(<ExceptionsOverviewPlot exceptionsType={'crash' as any} filters={{ ...filters, startDate: '2025-01-01T00:00:00Z', endDate: '2026-01-01T00:00:00Z' }} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisBottom.format).toBe('%b %Y')
  })
})
