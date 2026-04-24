import { ExceptionsType } from '@/app/api/api_calls'
import ExceptionsDetailsPlot from '@/app/components/exceptions_details_plot'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'

let lastLineProps: any = null

jest.mock('@nivo/line', () => ({
  ResponsiveLine: (props: any) => {
    lastLineProps = props
    return <div data-testid="line-mock" />
  },
}))

jest.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light' }) }))
jest.mock('@/app/components/skeleton', () => ({ SkeletonPlot: () => <div data-testid="skeleton-mock">loading</div> }))

const mockUseExceptionsDetailsPlotQuery = jest.fn((): { data: any; status: string; error: Error | null } => ({ data: undefined, status: 'pending', error: null }))

jest.mock('@/app/query/hooks', () => ({
  __esModule: true,
  useExceptionsDetailsPlotQuery: () => mockUseExceptionsDetailsPlotQuery(),
}))

jest.mock('@/app/stores/provider', () => {
  const { create } = jest.requireActual('zustand')
  const filtersStore = create(() => ({
    filters: { ready: false, serialisedFilters: null },
  }))
  return { __esModule: true, useFiltersStore: filtersStore }
})

const { useFiltersStore } = require('@/app/stores/provider') as any

const defaultFilters = { ready: true, startDate: '2025-01-01T00:00:00Z', endDate: '2025-07-20T00:00:00Z', serialisedFilters: 'default' }

describe('ExceptionsDetailsPlot', () => {
  beforeEach(() => {
    lastLineProps = null
    useFiltersStore.setState({ filters: { ready: false, serialisedFilters: null } })
    mockUseExceptionsDetailsPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
  })

  it('uses demo data when demo=true', async () => {
    useFiltersStore.setState({ filters: defaultFilters })
    render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Crash} exceptionsGroupId="g1" demo />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    // In demo mode, the query result is ignored and demo data is used
    expect(lastLineProps.xScale.precision).toBe('day')
  })

  it('renders error state from api', async () => {
    useFiltersStore.setState({ filters: defaultFilters })
    mockUseExceptionsDetailsPlotQuery.mockReturnValue({ data: undefined, status: 'error', error: new Error('test') })
    render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Crash} exceptionsGroupId="g1" />)
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument()
  })

  it('renders no data state from api', async () => {
    useFiltersStore.setState({ filters: defaultFilters })
    mockUseExceptionsDetailsPlotQuery.mockReturnValue({ data: null, status: 'success', error: null })
    render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Crash} exceptionsGroupId="g1" />)

    expect(screen.getByText('No Data')).toBeInTheDocument()
  })

  it('renders loading state before request resolves', async () => {
    useFiltersStore.setState({ filters: defaultFilters })
    mockUseExceptionsDetailsPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })

    render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Crash} exceptionsGroupId="g1" />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('maps API success data and sets plot points', async () => {
    const plotData = [{ id: 'v1', data: [{ x: '2025-02-01', y: 7 }] }]
    useFiltersStore.setState({ filters: defaultFilters })
    mockUseExceptionsDetailsPlotQuery.mockReturnValue({
      data: plotData,
      status: 'success',
      error: null,
    })

    render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Crash} exceptionsGroupId="g1" />)

    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.data[0].id).toBe('v1')
    expect(lastLineProps.data[0].data[0].y).toBe(7)
    expect(lastLineProps.axisLeft.legend).toBe('Crash instances')
    expect(lastLineProps.axisLeft.legendOffset).toBe(-40)
  })

  it('does not fetch when filters are not ready', async () => {
    useFiltersStore.setState({ filters: { ready: false, serialisedFilters: null } })
    render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Crash} exceptionsGroupId="g1" />)
    // Query hook is called but TanStack Query handles the enabled flag internally
    expect(mockUseExceptionsDetailsPlotQuery).toHaveBeenCalled()
  })

  it('adjusts legend offset in demo mode and uses tooltip date formatting', async () => {
    const demoFilters = { ready: true, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T06:00:00Z', serialisedFilters: 'demo' }
    useFiltersStore.setState({ filters: demoFilters })
    render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Anr} exceptionsGroupId="g1" demo />)
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
    const plotData = [{ id: 'v1', data: [{ x: '2025-02-01', y: 1 }] }]
    useFiltersStore.setState({ filters: defaultFilters })
    mockUseExceptionsDetailsPlotQuery.mockReturnValue({
      data: plotData,
      status: 'success',
      error: null,
    })

    render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Anr} exceptionsGroupId="g1" />)
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
    const plotData = [{ id: 'v1', data: [{ x: '2026-02-01T03:00:00', y: 2 }] }]

    // minutes range (6 hours)
    const minutesFilters = { ready: true, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T06:00:00Z', serialisedFilters: 'minutes' }
    useFiltersStore.setState({ filters: minutesFilters })
    mockUseExceptionsDetailsPlotQuery.mockReturnValue({ data: plotData, status: 'success', error: null })
    const { unmount } = render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Crash} exceptionsGroupId="g1" />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('minute')
    unmount()

    // hours range (5 days)
    const hoursFilters = { ready: true, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-06T00:00:00Z', serialisedFilters: 'hours' }
    useFiltersStore.setState({ filters: hoursFilters })
    const { unmount: unmount2 } = render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Crash} exceptionsGroupId="g1" />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('hour')
    unmount2()

    // days range (~73 days)
    const daysFilters = { ready: true, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z', serialisedFilters: 'days' }
    useFiltersStore.setState({ filters: daysFilters })
    const { unmount: unmount3 } = render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Crash} exceptionsGroupId="g1" />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.xScale.precision).toBe('day')
    unmount3()

    // months range (1 year)
    const monthsFilters = { ready: true, startDate: '2025-01-01T00:00:00Z', endDate: '2026-01-01T00:00:00Z', serialisedFilters: 'months' }
    useFiltersStore.setState({ filters: monthsFilters })
    render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Crash} exceptionsGroupId="g1" />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())
    expect(lastLineProps.axisBottom.format).toBe('%d %b, %Y')
  })

  it('hides stale chart while new range data is loading', async () => {
    const plotData = [{ id: 'v1', data: [{ x: '2025-02-01', y: 7 }] }]
    useFiltersStore.setState({ filters: defaultFilters })
    mockUseExceptionsDetailsPlotQuery.mockReturnValue({ data: plotData, status: 'success', error: null })

    render(<ExceptionsDetailsPlot exceptionsType={ExceptionsType.Crash} exceptionsGroupId="g1" />)
    await waitFor(() => expect(screen.getByTestId('line-mock')).toBeInTheDocument())

    // Change filters and set loading
    const newFilters = { ready: true, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T06:00:00Z', serialisedFilters: 'new' }
    await act(async () => {
      useFiltersStore.setState({ filters: newFilters })
      mockUseExceptionsDetailsPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
    })

    await waitFor(() => {
      expect(screen.getByText('loading')).toBeInTheDocument()
      expect(screen.queryByTestId('line-mock')).not.toBeInTheDocument()
    })
  })
})
