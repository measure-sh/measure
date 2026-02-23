import ExceptionsDetailsPlot from '@/app/components/exceptions_details_plot'
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
  ExceptionsDetailsPlotApiStatus: { Loading: 'loading', Success: 'success', Error: 'error', NoData: 'no_data' },
  fetchExceptionsDetailsPlotFromServer: (...args: any[]) => fetchMock(...args),
}))

const filters = { ready: true, startDate: '2025-01-01T00:00:00Z', endDate: '2025-07-20T00:00:00Z' } as any

describe('ExceptionsDetailsPlot', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    lastLineProps = null
  })

  it('uses demo data when demo=true', async () => {
    render(<ExceptionsDetailsPlot exceptionsType={'crash' as any} exceptionsGroupId="g1" filters={filters} demo />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(lastLineProps.xScale.precision).toBe('day')
  })

  it('renders error state from api', async () => {
    fetchMock.mockResolvedValue({ status: 'error', data: null })
    render(<ExceptionsDetailsPlot exceptionsType={'crash' as any} exceptionsGroupId="g1" filters={filters} />)
    expect(await screen.findByText(/Error fetching plot/)).toBeInTheDocument()
  })

  it('renders no data state from api', async () => {
    fetchMock.mockResolvedValue({ status: 'no_data', data: null })
    render(<ExceptionsDetailsPlot exceptionsType={'crash' as any} exceptionsGroupId="g1" filters={filters} />)

    expect(await screen.findByText('No Data')).toBeInTheDocument()
  })

  it('renders loading state before request resolves', async () => {
    let resolvePromise: (value: any) => void = () => { }
    const pending = new Promise((resolve) => {
      resolvePromise = resolve
    })
    fetchMock.mockReturnValue(pending)

    render(<ExceptionsDetailsPlot exceptionsType={'crash' as any} exceptionsGroupId="g1" filters={filters} />)
    expect(screen.getByText('loading')).toBeInTheDocument()

    resolvePromise({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2025-02-01', instances: 1 }] }] })
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
  })

  it('maps API success data and sets plot points', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2025-02-01', instances: 7 }] }] })
    render(<ExceptionsDetailsPlot exceptionsType={'crash' as any} exceptionsGroupId="g1" filters={filters} />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.data[0].id).toBe('v1')
    expect(lastLineProps.data[0].data[0].y).toBe(7)
    expect(lastLineProps.axisLeft.legend).toBe('Crash instances')
    expect(lastLineProps.axisLeft.legendOffset).toBe(-40)
    expect(fetchMock).toHaveBeenCalledWith('crash', 'g1', filters)
  })

  it('does not fetch when filters are not ready', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [] })
    render(<ExceptionsDetailsPlot exceptionsType={'crash' as any} exceptionsGroupId="g1" filters={{ ...filters, ready: false }} />)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('adjusts legend offset in demo mode and uses tooltip date formatting', async () => {
    render(<ExceptionsDetailsPlot exceptionsType={'anr' as any} exceptionsGroupId="g1" filters={{ ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T06:00:00Z' }} demo />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisLeft.legendOffset).toBe(-45)

    const tooltip = lastLineProps.sliceTooltip({
      slice: {
        points: [{
          id: 'p1',
          serieColor: '#222',
          serieId: 'v1',
          data: { xFormatted: '2026-02-01T03:00:00', y: 2 },
        }],
      },
    })
    const { container } = render(tooltip)
    expect(container.textContent).toContain('Date:')
    expect(container.textContent).toContain('instances')
  })

  it('uses singular tooltip label when value is 1', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2025-02-01', instances: 1 }] }] })
    render(<ExceptionsDetailsPlot exceptionsType={'anr' as any} exceptionsGroupId="g1" filters={filters} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisLeft.legend).toBe('ANR instances')

    const tooltip = lastLineProps.sliceTooltip({
      slice: {
        points: [{
          id: 'p1',
          serieColor: '#222',
          serieId: 'v1',
          data: { xFormatted: '2026-02-01T03:00:00', y: 1 },
        }],
      },
    })
    const { container } = render(tooltip)
    expect(container.textContent).toContain('1 instance')
  })

  it('uses minute/hour/day/month axis config based on date range', async () => {
    fetchMock.mockResolvedValue({ status: 'success', data: [{ id: 'v1', data: [{ datetime: '2026-02-01T03:00:00', instances: 2 }] }] })

    const { rerender } = render(
      <ExceptionsDetailsPlot exceptionsType={'crash' as any} exceptionsGroupId="g1" filters={{ ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T06:00:00Z' }} />
    )
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('minute')

    rerender(
      <ExceptionsDetailsPlot exceptionsType={'crash' as any} exceptionsGroupId="g1" filters={{ ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-06T00:00:00Z' }} />
    )
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('hour')

    rerender(
      <ExceptionsDetailsPlot exceptionsType={'crash' as any} exceptionsGroupId="g1" filters={{ ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z' }} />
    )
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('day')

    rerender(
      <ExceptionsDetailsPlot exceptionsType={'crash' as any} exceptionsGroupId="g1" filters={{ ...filters, startDate: '2025-01-01T00:00:00Z', endDate: '2026-01-01T00:00:00Z' }} />
    )
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisBottom.format).toBe('%b %Y')
  })
})
