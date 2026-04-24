import { afterEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

let mockPathname = '/'
let mockSearchParams = new URLSearchParams()
let mockIsCloud = false

jest.mock('next/navigation', () => ({
    __esModule: true,
    usePathname: () => mockPathname,
    useSearchParams: () => mockSearchParams,
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

jest.mock('@/app/utils/env_utils', () => ({
    __esModule: true,
    isCloud: () => mockIsCloud,
}))

import AppBreadcrumbs from '@/app/components/app_breadcrumbs'

afterEach(() => {
    mockPathname = '/'
    mockSearchParams = new URLSearchParams()
    mockIsCloud = false
})

describe('AppBreadcrumbs', () => {
    describe('Rendering — invalid paths', () => {
        it('renders nothing for root path', () => {
            mockPathname = '/'
            const { container } = render(<AppBreadcrumbs />)
            expect(container.firstChild).toBeNull()
        })

        it('renders nothing when only teamId is in path', () => {
            mockPathname = '/team-123'
            const { container } = render(<AppBreadcrumbs />)
            expect(container.firstChild).toBeNull()
        })
    })

    describe('Section pages — current page (no link)', () => {
        it.each([
            ['overview', 'Overview'],
            ['session_timelines', 'Session Timelines'],
            ['journeys', 'Journeys'],
            ['crashes', 'Crashes'],
            ['anrs', 'ANRs'],
            ['bug_reports', 'Bug Reports'],
            ['alerts', 'Alerts'],
            ['traces', 'Traces'],
            ['network', 'Network'],
            ['apps', 'Apps'],
            ['team', 'Team'],
            ['notif_prefs', 'Notifications'],
            ['usage', 'Usage'],
        ])('renders "%s" slug as "%s" title with aria-current="page"', (slug, title) => {
            mockPathname = `/team-123/${slug}`
            render(<AppBreadcrumbs />)
            const el = screen.getByText(title)
            expect(el).toBeInTheDocument()
            expect(el).toHaveAttribute('aria-current', 'page')
            // Section page: no link back to section (it IS the section)
            expect(el.closest('a')).toBeNull()
        })

        it('falls back to raw slug for unknown section', () => {
            mockPathname = '/team-123/mystery_section'
            render(<AppBreadcrumbs />)
            expect(screen.getByText('mystery_section')).toBeInTheDocument()
        })

        it('renders "usage" slug as "Usage & Billing" in cloud mode', () => {
            mockIsCloud = true
            mockPathname = '/team-123/usage'
            render(<AppBreadcrumbs />)
            const el = screen.getByText('Usage & Billing')
            expect(el).toBeInTheDocument()
            expect(el).toHaveAttribute('aria-current', 'page')
            expect(screen.queryByText('Usage')).toBeNull()
        })

        it('renders "usage" slug as "Usage" (not "Usage & Billing") in self-hosted mode', () => {
            mockIsCloud = false
            mockPathname = '/team-123/usage'
            render(<AppBreadcrumbs />)
            expect(screen.getByText('Usage')).toBeInTheDocument()
            expect(screen.queryByText('Usage & Billing')).toBeNull()
        })
    })

    describe('Detail pages — section link + current page', () => {
        it('renders section as link and last segment as current page', () => {
            mockPathname = '/team-123/crashes/app-1/group-1/NullPointerException'
            render(<AppBreadcrumbs />)

            const sectionLink = screen.getByText('Crashes').closest('a')
            expect(sectionLink).toBeInTheDocument()
            expect(sectionLink).toHaveAttribute('href', '/team-123/crashes')

            const currentPage = screen.getByText('NullPointerException')
            expect(currentPage).toHaveAttribute('aria-current', 'page')
            expect(currentPage.closest('a')).toBeNull()
        })

        it('URL-decodes the last segment', () => {
            mockPathname = '/team-123/crashes/app-1/group-1/NullPointerException%40MainActivity.kt'
            render(<AppBreadcrumbs />)
            expect(screen.getByText('NullPointerException@MainActivity.kt')).toBeInTheDocument()
        })

        it('handles URL-encoded spaces in last segment', () => {
            mockPathname = '/team-123/anrs/app-1/group-1/ANR%20in%20CartActivity'
            render(<AppBreadcrumbs />)
            expect(screen.getByText('ANR in CartActivity')).toBeInTheDocument()
        })

        it('shows raw traceId for trace detail pages', () => {
            mockPathname = '/team-123/traces/app-1/a1b2c3d4-5678-9abc-def0-123456789abc'
            render(<AppBreadcrumbs />)
            expect(screen.getByText('Traces').closest('a')).toHaveAttribute('href', '/team-123/traces')
            expect(screen.getByText('a1b2c3d4-5678-9abc-def0-123456789abc')).toBeInTheDocument()
        })

        it('shows raw sessionId for session timeline detail pages', () => {
            mockPathname = '/team-123/session_timelines/app-1/sess-001'
            render(<AppBreadcrumbs />)
            expect(screen.getByText('Session Timelines').closest('a')).toHaveAttribute(
                'href',
                '/team-123/session_timelines',
            )
            expect(screen.getByText('sess-001')).toBeInTheDocument()
        })

        it('shows raw bugReportId for bug report detail pages', () => {
            mockPathname = '/team-123/bug_reports/app-1/evt-br-001'
            render(<AppBreadcrumbs />)
            expect(screen.getByText('Bug Reports').closest('a')).toHaveAttribute(
                'href',
                '/team-123/bug_reports',
            )
            expect(screen.getByText('evt-br-001')).toBeInTheDocument()
        })

        it('falls back to raw slug for unknown section with a detail segment', () => {
            mockPathname = '/team-123/unknown/something/NamedThing'
            render(<AppBreadcrumbs />)
            expect(screen.getByText('unknown').closest('a')).toHaveAttribute('href', '/team-123/unknown')
            expect(screen.getByText('NamedThing')).toBeInTheDocument()
        })
    })

    describe('Network details — special handling via search params', () => {
        it('renders "Details" when no domain or path in search params', () => {
            mockPathname = '/team-123/network/details'
            mockSearchParams = new URLSearchParams()
            render(<AppBreadcrumbs />)
            expect(screen.getByText('Network').closest('a')).toHaveAttribute(
                'href',
                '/team-123/network',
            )
            expect(screen.getByText('Details')).toBeInTheDocument()
        })

        it('renders domain+path from search params when present', () => {
            mockPathname = '/team-123/network/details'
            mockSearchParams = new URLSearchParams('domain=api.example.com&path=/v1/users')
            render(<AppBreadcrumbs />)
            expect(screen.getByText('api.example.com/v1/users')).toBeInTheDocument()
        })

        it('renders just domain when path is missing', () => {
            mockPathname = '/team-123/network/details'
            mockSearchParams = new URLSearchParams('domain=cdn.example.com')
            render(<AppBreadcrumbs />)
            expect(screen.getByText('cdn.example.com')).toBeInTheDocument()
        })

        it('renders just path when domain is missing', () => {
            mockPathname = '/team-123/network/details'
            mockSearchParams = new URLSearchParams('path=/images/*')
            render(<AppBreadcrumbs />)
            expect(screen.getByText('/images/*')).toBeInTheDocument()
        })

        it('does NOT apply domain+path logic on /network section page itself', () => {
            mockPathname = '/team-123/network'
            mockSearchParams = new URLSearchParams('domain=api.example.com&path=/v1/users')
            render(<AppBreadcrumbs />)
            // On the section page, breadcrumb shows "Network" only — domain/path not used
            expect(screen.getByText('Network')).toBeInTheDocument()
            expect(screen.queryByText('api.example.com/v1/users')).toBeNull()
        })
    })

    describe('Structure', () => {
        it('uses aria-label="breadcrumb" on the nav element', () => {
            mockPathname = '/team-123/overview'
            render(<AppBreadcrumbs />)
            expect(screen.getByLabelText('breadcrumb')).toBeInTheDocument()
        })
    })
})
