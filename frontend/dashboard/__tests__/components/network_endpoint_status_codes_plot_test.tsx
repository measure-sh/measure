import NetworkEndpointStatusCodesPlot from '@/app/components/network_endpoint_status_codes_plot'
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

jest.mock('@/app/utils/time_utils', () => ({
  getPlotTimeGroupNivoConfig: () => ({
    xFormat: 'time:%Y-%m-%d',
    xScaleFormat: '%Y-%m-%d',
    xScalePrecision: 'day',
    axisBottomFormat: '%b %d',
  }),
  formatPlotTooltipDate: (d: string) => d,
  PlotTimeGroup: {},
}))

jest.mock('@/app/utils/shared_styles', () => ({
  chartTheme: {},
}))

jest.mock('@/app/utils/number_utils', () => ({
  numberToKMB: (v: number) => v,
}))

const plotTimeGroup = 'days' as any

describe('NetworkEndpointStatusCodesPlot', () => {
  beforeEach(() => {
    lastLineProps = null
  })

  it('renders No Data when data is empty', () => {
    render(<NetworkEndpointStatusCodesPlot statusCodes={[200]} data={[]} plotTimeGroup={plotTimeGroup} />)
    expect(screen.getByText('No Data')).toBeInTheDocument()
  })

  it('renders No Data when statusCodes is empty', () => {
    render(<NetworkEndpointStatusCodesPlot statusCodes={[]} data={[{ datetime: '2024-01-01', total_count: 10, count_200: 10 }]} plotTimeGroup={plotTimeGroup} />)
    expect(screen.getByText('No Data')).toBeInTheDocument()
  })

  it('passes correct number of series to ResponsiveLine', () => {
    const statusCodes = [200, 404, 500]
    const data = [{ datetime: '2024-01-01', total_count: 12, count_200: 8, count_404: 3, count_500: 1 }]

    render(<NetworkEndpointStatusCodesPlot statusCodes={statusCodes} data={data} plotTimeGroup={plotTimeGroup} />)

    expect(screen.getByTestId('line-mock')).toBeInTheDocument()
    expect(lastLineProps.data).toHaveLength(3)
    expect(lastLineProps.data[0].id).toBe('200')
    expect(lastLineProps.data[1].id).toBe('404')
    expect(lastLineProps.data[2].id).toBe('500')
  })

  it('uses bucket-based colors for status codes', () => {
    const statusCodes = [200, 404]
    const data = [{ datetime: '2024-01-01', total_count: 10, count_200: 8, count_404: 2 }]

    render(<NetworkEndpointStatusCodesPlot statusCodes={statusCodes} data={data} plotTimeGroup={plotTimeGroup} />)

    // Light theme colors: 2xx = #e8c1a0, 4xx = #f1e15b
    const color200 = lastLineProps.colors({ id: '200' })
    const color404 = lastLineProps.colors({ id: '404' })
    expect(color200).toBe('#e8c1a0')
    expect(color404).toBe('#f1e15b')
  })

  it('renders tooltip with status code labels and percentages', () => {
    const statusCodes = [200, 500]
    const data = [{ datetime: '2024-01-01', total_count: 10, count_200: 9, count_500: 1 }]

    render(<NetworkEndpointStatusCodesPlot statusCodes={statusCodes} data={data} plotTimeGroup={plotTimeGroup} />)

    const tooltip = lastLineProps.sliceTooltip({
      slice: {
        points: [
          { id: 'p1', serieColor: '#e8c1a0', serieId: '200', data: { xFormatted: '2024-01-01', y: 9, total_count: 10 } },
          { id: 'p2', serieColor: '#f47560', serieId: '500', data: { xFormatted: '2024-01-01', y: 1, total_count: 10 } },
        ],
      },
    })

    const { container } = render(tooltip)
    expect(container.textContent).toContain('Total: 10')
    expect(container.textContent).toContain('200: 9 (90.0%)')
    expect(container.textContent).toContain('500: 1 (10.0%)')
  })

  it('maps y values correctly from data', () => {
    const statusCodes = [200, 301]
    const data = [
      { datetime: '2024-01-01', total_count: 15, count_200: 10, count_301: 5 },
      { datetime: '2024-01-02', total_count: 20, count_200: 18, count_301: 2 },
    ]

    render(<NetworkEndpointStatusCodesPlot statusCodes={statusCodes} data={data} plotTimeGroup={plotTimeGroup} />)

    expect(lastLineProps.data[0].data[0].y).toBe(10)
    expect(lastLineProps.data[0].data[1].y).toBe(18)
    expect(lastLineProps.data[1].data[0].y).toBe(5)
    expect(lastLineProps.data[1].data[1].y).toBe(2)
  })
})
