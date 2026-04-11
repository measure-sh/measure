import SessionsVsExceptionsPlot from '@/app/components/sessions_vs_exceptions_overview_plot'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

let lastLineProps: any = null

jest.mock('@nivo/line', () => ({
  ResponsiveLine: (props: any) => {
    lastLineProps = props
    return <div data-testid="line-mock" />
  },
}))

jest.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light' }) }))
jest.mock('@/app/components/loading_spinner', () => ({ __esModule: true, default: () => <div>loading</div> }))

const mockUseSessionsVsExceptionsPlotQuery = jest.fn((): { data: any; status: string; error: Error | null } => ({ data: undefined, status: 'pending', error: null }))

jest.mock('@/app/query/hooks', () => ({
  __esModule: true,
  useSessionsVsExceptionsPlotQuery: () => mockUseSessionsVsExceptionsPlotQuery(),
}))

jest.mock('@/app/stores/provider', () => {
  const { create } = jest.requireActual('zustand')
  const filtersStore = create(() => ({
    filters: { ready: false, serialisedFilters: '', startDate: '', endDate: '' },
  }))
  return { __esModule: true, useFiltersStore: filtersStore }
})

const { useFiltersStore } = require('@/app/stores/provider') as any

const filters = { ready: true, serialisedFilters: 'test', startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T06:00:00Z' }

describe('SessionsVsExceptionsPlot', () => {
  beforeEach(() => {
    lastLineProps = null
    useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '', startDate: '', endDate: '' } })
    mockUseSessionsVsExceptionsPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
  })

  it('renders no data state', () => {
    useFiltersStore.setState({ filters })
    mockUseSessionsVsExceptionsPlotQuery.mockReturnValue({ data: null, status: 'success', error: null })
    render(<SessionsVsExceptionsPlot />)
    expect(screen.getByText('No Data')).toBeInTheDocument()
  })

  it('renders error state', () => {
    useFiltersStore.setState({ filters })
    mockUseSessionsVsExceptionsPlotQuery.mockReturnValue({ data: undefined, status: 'error', error: new Error('test') })
    render(<SessionsVsExceptionsPlot />)
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument()
  })

  it('renders loading state', () => {
    useFiltersStore.setState({ filters })
    mockUseSessionsVsExceptionsPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
    render(<SessionsVsExceptionsPlot />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('uses demo data and bypasses API in demo mode', () => {
    useFiltersStore.setState({ filters })
    render(<SessionsVsExceptionsPlot demo />)
    expect(screen.getByTestId('line-mock')).toBeInTheDocument()
    expect(lastLineProps.data[0].id).toBe('Sessions')
  })

  it('renders data and minute precision axis for sub-12h range', () => {
    useFiltersStore.setState({ filters })
    mockUseSessionsVsExceptionsPlotQuery.mockReturnValue({
      data: [{ id: 'Sessions', data: [{ id: 's1', x: '2026-02-01T01:00:00', y: 10 }] }],
      status: 'success',
      error: null,
    })
    render(<SessionsVsExceptionsPlot />)

    expect(screen.getByTestId('line-mock')).toBeInTheDocument()
    expect(lastLineProps.xScale.precision).toBe('minute')
    expect(lastLineProps.data[0].id).toBe('Sessions')
  })

  it('uses hour/day/month axis config based on range', () => {
    // Hours range (5 days)
    const hourFilters = { ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-06T00:00:00Z' }
    useFiltersStore.setState({ filters: hourFilters })
    mockUseSessionsVsExceptionsPlotQuery.mockReturnValue({
      data: [{ id: 'Sessions', data: [{ id: 's1', x: '2026-02-01T01:00:00', y: 10 }] }],
      status: 'success',
      error: null,
    })
    const { unmount: u1 } = render(<SessionsVsExceptionsPlot />)
    expect(lastLineProps.xScale.precision).toBe('hour')
    u1()

    // Days range (73 days)
    const dayFilters = { ...filters, startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-15T00:00:00Z' }
    useFiltersStore.setState({ filters: dayFilters })
    const { unmount: u2 } = render(<SessionsVsExceptionsPlot />)
    expect(lastLineProps.xScale.precision).toBe('day')
    u2()

    // Months range (1 year)
    const monthFilters = { ...filters, startDate: '2025-01-01T00:00:00Z', endDate: '2026-01-01T00:00:00Z' }
    useFiltersStore.setState({ filters: monthFilters })
    render(<SessionsVsExceptionsPlot />)
    expect(lastLineProps.axisBottom.format).toBe('%d %b, %Y')
  })

  it('renders tooltip in Sessions, Crashes, ANRs order', () => {
    useFiltersStore.setState({ filters })
    mockUseSessionsVsExceptionsPlotQuery.mockReturnValue({
      data: [
        { id: 'ANRs', data: [{ id: 'a1', x: '2026-02-01T01:00:00', y: 1 }] },
        { id: 'Sessions', data: [{ id: 's1', x: '2026-02-01T01:00:00', y: 10 }] },
        { id: 'Crashes', data: [{ id: 'c1', x: '2026-02-01T01:00:00', y: 2 }] },
      ],
      status: 'success',
      error: null,
    })
    render(<SessionsVsExceptionsPlot />)
    expect(screen.getByTestId('line-mock')).toBeInTheDocument()

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

  it('skips missing tooltip series and keeps known ordering', () => {
    useFiltersStore.setState({ filters })
    mockUseSessionsVsExceptionsPlotQuery.mockReturnValue({
      data: [
        { id: 'Sessions', data: [{ id: 's1', x: '2026-02-01T01:00:00', y: 10 }] },
        { id: 'ANRs', data: [{ id: 'a1', x: '2026-02-01T01:00:00', y: 1 }] },
      ],
      status: 'success',
      error: null,
    })
    render(<SessionsVsExceptionsPlot />)

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

  it('uses fallback color for unknown series id', () => {
    useFiltersStore.setState({ filters })
    mockUseSessionsVsExceptionsPlotQuery.mockReturnValue({
      data: [{ id: 'Sessions', data: [{ id: 's1', x: '2026-02-01T01:00:00', y: 10 }] }],
      status: 'success',
      error: null,
    })
    render(<SessionsVsExceptionsPlot />)

    expect(lastLineProps.colors({ id: 'Unknown' })).toBe('#888')
    expect(lastLineProps.pointBorderColor({ serieId: 'Unknown' })).toBe('#888')
  })

  it('hides stale chart while new range data is loading', () => {
    // First render with data
    useFiltersStore.setState({ filters })
    mockUseSessionsVsExceptionsPlotQuery.mockReturnValue({
      data: [{ id: 'Sessions', data: [{ id: 's1', x: '2026-02-01T01:00:00', y: 10 }] }],
      status: 'success',
      error: null,
    })
    const { unmount } = render(<SessionsVsExceptionsPlot />)
    expect(screen.getByTestId('line-mock')).toBeInTheDocument()
    unmount()

    // New range, data loading
    const newFilters = { ...filters, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T03:00:00Z' }
    useFiltersStore.setState({ filters: newFilters })
    mockUseSessionsVsExceptionsPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
    render(<SessionsVsExceptionsPlot />)

    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(screen.queryByTestId('line-mock')).not.toBeInTheDocument()
  })
})
