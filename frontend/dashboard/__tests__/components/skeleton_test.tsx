import { Skeleton, SkeletonListPage, SkeletonMetricsCard, SkeletonPlot, SkeletonTable } from '@/app/components/skeleton'
import { render } from '@testing-library/react'

describe('Skeleton', () => {
    it('renders with data-slot attribute', () => {
        const { container } = render(<Skeleton className="h-4 w-full" />)
        const el = container.querySelector('[data-slot="skeleton"]')
        expect(el).toBeTruthy()
        expect(el?.className).toContain('h-4')
        expect(el?.className).toContain('w-full')
    })

    it('merges custom className with base classes', () => {
        const { container } = render(<Skeleton className="h-8 w-24" />)
        const el = container.querySelector('[data-slot="skeleton"]')
        expect(el?.className).toContain('animate-pulse')
        expect(el?.className).toContain('h-8')
    })
})

describe('SkeletonPlot', () => {
    it('renders y-axis ticks and x-axis ticks when showAxes is true', () => {
        const { container } = render(<SkeletonPlot />)
        const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
        // 5 y-axis ticks + 1 chart area + 6 x-axis ticks = 12
        expect(skeletons.length).toBe(12)
    })

    it('renders only chart area when showAxes is false', () => {
        const { container } = render(<SkeletonPlot showAxes={false} />)
        const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
        // Only the chart area rectangle
        expect(skeletons.length).toBe(1)
    })
})

describe('SkeletonTable', () => {
    it('renders correct number of rows and columns', () => {
        const { container } = render(<SkeletonTable rows={3} columns={4} />)
        const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
        // 4 header + 3*4 data = 16
        expect(skeletons.length).toBe(16)
    })

    it('uses default 5 rows and 3 columns', () => {
        const { container } = render(<SkeletonTable />)
        const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
        // 3 header + 5*3 data = 18
        expect(skeletons.length).toBe(18)
    })
})

describe('SkeletonMetricsCard', () => {
    it('renders value and trend skeletons', () => {
        const { container } = render(<SkeletonMetricsCard />)
        const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
        expect(skeletons.length).toBe(2)
    })
})

describe('SkeletonListPage', () => {
    it('renders plot and table by default', () => {
        const { container } = render(<SkeletonListPage />)
        const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
        // SkeletonPlot (12) + SkeletonTable default (18) = 30
        expect(skeletons.length).toBe(30)
    })

    it('renders only table when showPlot is false', () => {
        const { container } = render(<SkeletonListPage showPlot={false} />)
        const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
        // SkeletonTable default (18) only
        expect(skeletons.length).toBe(18)
    })

    it('accepts custom table columns', () => {
        const { container } = render(<SkeletonListPage showPlot={false} tableColumns={2} />)
        const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
        // 2 header + 5*2 data = 12
        expect(skeletons.length).toBe(12)
    })
})
