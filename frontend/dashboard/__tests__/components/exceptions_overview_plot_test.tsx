import { ExceptionsType } from '@/app/api/api_calls'
import ExceptionsOverviewPlot from '@/app/components/exceptions_overview_plot'
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
jest.mock('@/app/components/loading_spinner', () => ({ __esModule: true, default: () => <div>loading</div> }))

const mockUseExceptionsOverviewPlotQuery = jest.fn((): { data: any; status: string; error: Error | null } => ({ data: undefined, status: 'pending', error: null }))

jest.mock('@/app/query/hooks', () => ({
  __esModule: true,
  useExceptionsOverviewPlotQuery: () => mockUseExceptionsOverviewPlotQuery(),
}))

jest.mock('@/app/stores/provider', () => {
  const { create } = jest.requireActual('zustand')
  const filtersStore = create(() => ({
    filters: { ready: false, serialisedFilters: '' },
  }))
  return { __esModule: true, useFiltersStore: filtersStore }
})

const { useFiltersStore } = require('@/app/stores/provider') as any

const filters = { ready: true, startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-06T00:00:00Z' } as any

describe('ExceptionsOverviewPlot', () => {
  beforeEach(() => {
    lastLineProps = null
    useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })
    mockUseExceptionsOverviewPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
  })

  it('renders error state', async () => {
    useFiltersStore.setState({ filters })
    mockUseExceptionsOverviewPlotQuery.mockReturnValue({ data: undefined, status: 'error', error: new Error('test') })
    render(<ExceptionsOverviewPlot exceptionsType={ExceptionsType.Crash} />)

    expect(await screen.findByText(/Error fetching plot/)).toBeInTheDocument()
  })

  it('renders no data state', async () => {
    useFiltersStore.setState({ filters })
    mockUseExceptionsOverviewPlotQuery.mockReturnValue({ data: null, status: 'success', error: null })
    render(<ExceptionsOverviewPlot exceptionsType={ExceptionsType.Crash} />)

    expect(await screen.findByText('No Data')).toBeInTheDocument()
  })

  it('does not fetch when filters are not ready', async () => {
    useFiltersStore.setState({ filters: { ...filters, ready: false } })
    render(<ExceptionsOverviewPlot exceptionsType={ExceptionsType.Crash} />)
    expect(mockUseExceptionsOverviewPlotQuery).toHaveBeenCalled()
  })

  it('renders loading state before data is available', async () => {
    useFiltersStore.setState({ filters })
    mockUseExceptionsOverviewPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })

    render(<ExceptionsOverviewPlot exceptionsType={ExceptionsType.Crash} />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('renders success with hour precision for ~days range', async () => {
    useFiltersStore.setState({ filters })
    mockUseExceptionsOverviewPlotQuery.mockReturnValue({
      data: [{ id: 'v', data: [{ id: 'v.0', x: '2026-01-02T00:00:00', y: 3 }] }],
      status: 'success',
      error: null,
    })
    render(<ExceptionsOverviewPlot exceptionsType={ExceptionsType.Crash} />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('hour')
    expect(lastLineProps.data[0].data[0].y).toBe(3)
    expect(lastLineProps.axisLeft.legend).toBe('Crash instances')
    expect(lastLineProps.axisLeft.format(2)).toBe(2)
    expect(lastLineProps.axisLeft.format(1.5)).toBe('')
  })

  it('sets ANR axis legend for ANR mode', async () => {
    useFiltersStore.setState({ filters })
    mockUseExceptionsOverviewPlotQuery.mockReturnValue({
      data: [{ id: 'v', data: [{ id: 'v.0', x: '2026-01-02T00:00:00', y: 1 }] }],
      status: 'success',
      error: null,
    })
    render(<ExceptionsOverviewPlot exceptionsType={ExceptionsType.Anr} />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisLeft.legend).toBe('ANR instances')
  })

  it('pluralizes tooltip label for singular and plural values', async () => {
    useFiltersStore.setState({ filters })
    mockUseExceptionsOverviewPlotQuery.mockReturnValue({
      data: [{ id: 'v', data: [{ id: 'v.0', x: '2026-01-02T00:00:00', y: 1 }] }],
      status: 'success',
      error: null,
    })
    render(<ExceptionsOverviewPlot exceptionsType={ExceptionsType.Crash} />)
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
    // Minute precision for sub-12h range
    const minuteFilters = { ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-01T06:00:00Z' }
    useFiltersStore.setState({ filters: minuteFilters })
    mockUseExceptionsOverviewPlotQuery.mockReturnValue({
      data: [{ id: 'v', data: [{ id: 'v.0', x: '2026-01-02T00:00:00', y: 2 }] }],
      status: 'success',
      error: null,
    })
    const { unmount: unmount1 } = render(<ExceptionsOverviewPlot exceptionsType={ExceptionsType.Crash} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('minute')

    unmount1()
    lastLineProps = null

    // Day precision for multi-month range
    const dayFilters = { ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z' }
    useFiltersStore.setState({ filters: dayFilters })
    const { unmount: unmount2 } = render(<ExceptionsOverviewPlot exceptionsType={ExceptionsType.Crash} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('day')

    unmount2()
    lastLineProps = null

    // Month formatting for year-long range
    const monthFilters = { ...filters, startDate: '2025-01-01T00:00:00Z', endDate: '2026-01-01T00:00:00Z' }
    useFiltersStore.setState({ filters: monthFilters })
    render(<ExceptionsOverviewPlot exceptionsType={ExceptionsType.Crash} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisBottom.format).toBe('%d %b, %Y')
  })

  it('hides stale chart while new range data is loading', async () => {
    const longFilters = { ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z' }
    useFiltersStore.setState({ filters: longFilters })
    mockUseExceptionsOverviewPlotQuery.mockReturnValue({
      data: [{ id: 'v', data: [{ id: 'v.0', x: '2026-01-02', y: 2 }] }],
      status: 'success',
      error: null,
    })
    const { unmount } = render(<ExceptionsOverviewPlot exceptionsType={ExceptionsType.Crash} />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    unmount()

    const newFilters = { ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-01T06:00:00Z' }
    useFiltersStore.setState({ filters: newFilters })
    mockUseExceptionsOverviewPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })

    render(<ExceptionsOverviewPlot exceptionsType={ExceptionsType.Crash} />)

    await waitFor(() => {
      expect(screen.getByText('loading')).toBeInTheDocument()
      expect(screen.queryByTestId('line-mock')).not.toBeInTheDocument()
    })
  })
})
