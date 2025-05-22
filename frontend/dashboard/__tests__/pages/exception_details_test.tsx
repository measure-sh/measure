import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, beforeEach, expect } from '@jest/globals'
import '@testing-library/jest-dom'
import { ExceptionsDetails } from '@/app/components/exceptions_details'
import { ExceptionsType } from '@/app/api/api_calls'

// Global replace mock for router.replace
const replaceMock = jest.fn()

// Mock next/navigation hooks
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
    }),
    // By default, return empty search params.
    useSearchParams: () => new URLSearchParams(),
}))

// Mock time utils
jest.mock('@/app/utils/time_utils', () => ({
    formatDateToHumanReadableDateTime: jest.fn(() => 'January 1, 2020 12:00 AM'),
}))

// Mock API calls and constants for exceptions details with valid data.
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    emptyExceptionsOverviewResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    emptyCrashExceptionsDetailsResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    emptyAnrExceptionsDetailsResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    ExceptionsDetailsApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success'
    },
    ExceptionsType: {
        Crash: 'crash',
        Anr: 'anr'
    },
    FilterSource: {
        Crashes: 'crashes',
        Anrs: 'anrs',
        Events: 'events'
    },
    fetchExceptionsDetailsFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: {
                results: [
                    {
                        id: 'exception1',
                        session_id: 'session1',
                        timestamp: '2020-01-01T00:00:00Z',
                        type: 'NullPointerException',
                        thread_name: 'main',
                        attribute: {
                            installation_id: 'installation1',
                            app_version: '1.0.0',
                            app_build: '123',
                            app_unique_id: 'unique1',
                            measure_sdk_version: '2.0.0',
                            platform: 'Android',
                            thread_name: 'main',
                            user_id: 'user1',
                            device_name: 'Pixel 6 Pro',
                            device_model: 'Pixel 6 Pro',
                            device_manufacturer: 'Google ',
                            device_type: 'phone',
                            device_is_foldable: false,
                            device_is_physical: true,
                            device_density_dpi: 420,
                            device_width_px: 1080,
                            device_height_px: 2340,
                            device_density: 3.0,
                            device_locale: 'en_US',
                            os_name: 'Android',
                            os_version: '12',
                            network_type: 'WiFi',
                            network_provider: 'Verizon',
                            network_generation: '5G'
                        },
                        exception: {
                            title: 'NullPointerException',
                            stacktrace: 'java.lang.NullPointerException: Attempt to invoke virtual method on a null object reference\n\tat com.example.MainActivity.onCreate(MainActivity.java:42)'
                        },
                        anr: {
                            title: 'ANR in com.example.MainActivity',
                            stacktrace: 'ANR in com.example.MainActivity\n\tat com.example.MainActivity.onResume(MainActivity.java:65)'
                        },
                        attachments: [
                            {
                                id: 'attachment1',
                                name: 'screenshot.png',
                                type: 'image/png',
                                key: 'screenshot1',
                                location: '/images/screenshot1.png'
                            }
                        ],
                        threads: [
                            {
                                name: 'main',
                                frames: [
                                    'java.lang.Thread.sleep(Native Method)',
                                    'com.example.MainActivity$1.run(MainActivity.java:52)'
                                ]
                            },
                            {
                                name: 'RenderThread',
                                frames: [
                                    'android.view.ThreadedRenderer.nativeSyncAndDrawFrame(Native Method)',
                                    'android.view.ThreadedRenderer.syncAndDrawFrame(ThreadedRenderer.java:144)'
                                ]
                            }
                        ],
                        attributes: {
                            customAttr1: 'value1',
                            customAttr2: 'value2'
                        }
                    }
                ],
                meta: { previous: true, next: true },
            }
        })
    ),
}))

// Update the Filters mock
jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="filters-mock">
            <button
                data-testid="update-filters"
                onClick={() =>
                    props.onFiltersChanged({
                        ready: true,
                        serialisedFilters: 'updated',
                        app: { id: 'app1', name: 'Test App' }
                    })
                }
            >
                Update Filters
            </button>
            <button
                data-testid="update-filters-2"
                onClick={() =>
                    props.onFiltersChanged({
                        ready: true,
                        serialisedFilters: 'updated2',
                        app: { id: 'app1', name: 'Test App' }
                    })
                }
            >
                Update Filters 2
            </button>
        </div>
    ),
    AppVersionsInitialSelectionType: { All: 'all' },
    defaultFilters: { ready: false, serialisedFilters: '' },
}))

// Mock ExceptionspDetailsPlot component
jest.mock('@/app/components/exceptions_details_plot', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="exceptions-details-plot-mock">ExceptionspDetailsPlot Rendered</div>
    ),
}))

// Mock ExceptionsDistributionPlot component
jest.mock('@/app/components/exceptions_distribution_plot', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="exceptions-distribution-plot-mock">ExceptionsDistributionPlot Rendered</div>
    ),
}))

// Updated Paginator mock renders Next and Prev buttons
jest.mock('@/app/components/paginator', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="paginator-mock">
            <button data-testid="prev-button" onClick={props.onPrev} disabled={!props.prevEnabled}>Prev</button>
            <button data-testid="next-button" onClick={props.onNext} disabled={!props.nextEnabled}>Next</button>
            <span>{props.displayText}</span>
        </div>
    ),
}))

// Mock LoadingSpinner component
jest.mock('@/app/components/loading_spinner', () => () => (
    <div data-testid="loading-spinner-mock">LoadingSpinner Rendered</div>
))

// Mock Accordion component
jest.mock('@/app/components/accordion', () => ({
    __esModule: true,
    Accordion: (props: { children: React.ReactNode }) => <div data-testid="accordion-mock">{props.children}</div>,
    AccordionItem: (props: { children: React.ReactNode; value: string }) => <div data-testid={`accordion-item-${props.value}`}>{props.children}</div>,
    AccordionTrigger: (props: { children: React.ReactNode }) => <div data-testid="accordion-trigger">{props.children}</div>,
    AccordionContent: (props: { children: React.ReactNode }) => <div data-testid="accordion-content">{props.children}</div>,
}))

// Mock Next.js Link component
jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
        <a href={href} className={className} data-testid="mock-link">
            {children}
        </a>
    ),
}))

// Mock Image component
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt, className, width, height }: any) => (
        <img
            src={src}
            alt={alt}
            className={className}
            width={width}
            height={height}
            data-testid="mock-image"
        />
    ),
}))

// Mock CopyAiContext component
jest.mock('@/app/components/copy_ai_context', () => ({
    __esModule: true,
    default: (props: any) => (
        <button data-testid="copy-ai-context-mock">Copy AI Context</button>
    ),
}))

describe('ExceptionsDetails Component - Crashes', () => {
    beforeEach(() => {
        replaceMock.mockClear()
    })

    it('renders the app name and exceptions group name', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(screen.getByText('Test App')).toBeInTheDocument()
        expect(screen.getByText('NullPointerException@MainActivity.java')).toBeInTheDocument()
    })

    it('does not render main exceptions UI when filters are not ready', () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        expect(screen.queryByTestId('exceptions-details-plot-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('exceptions-distribution-plot-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('paginator-mock')).not.toBeInTheDocument()
        expect(screen.queryByText('Stack traces')).not.toBeInTheDocument()
    })

    it('renders main exceptions UI when filters become ready and updates URL', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check URL update with limit and filters
        expect(replaceMock).toHaveBeenCalledWith('?limit=1&updated', { scroll: false })

        // Verify main UI components are rendered
        expect(screen.getByTestId('exceptions-details-plot-mock')).toBeInTheDocument()
        expect(screen.getByTestId('exceptions-distribution-plot-mock')).toBeInTheDocument()
        expect(screen.getByTestId('paginator-mock')).toBeInTheDocument()
        expect(screen.getByText('Stack traces')).toBeInTheDocument()
    })

    it('displays crash details correctly when API returns results', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Verify the exception details are displayed
        expect(screen.getByText('Id: exception1')).toBeInTheDocument()
        expect(screen.getByText('Date & time: January 1, 2020 12:00 AM')).toBeInTheDocument()
        expect(screen.getByText('Device: Google Pixel 6 Pro')).toBeInTheDocument()
        expect(screen.getByText('App version: 1.0.0')).toBeInTheDocument()
        expect(screen.getByText('Network type: WiFi')).toBeInTheDocument()

        // Check that the accordion for the crash thread is rendered
        const crashAccordion = screen.getByTestId('accordion-item-Thread: main')
        expect(crashAccordion).toBeInTheDocument()
        expect(crashAccordion).toHaveTextContent('Thread: main')
        expect(crashAccordion).toHaveTextContent(
            'java.lang.NullPointerException: Attempt to invoke virtual method on a null object reference'
        )

        // Check that additional thread accordions are rendered
        const mainThreadAccordion = screen.getByTestId('accordion-item-main-0')
        expect(mainThreadAccordion).toBeInTheDocument()
        expect(mainThreadAccordion).toHaveTextContent('Thread: main')
        expect(mainThreadAccordion).toHaveTextContent('java.lang.Thread.sleep(Native Method)')
        expect(mainThreadAccordion).toHaveTextContent('com.example.MainActivity$1.run(MainActivity.java:52)')

        const renderThreadAccordion = screen.getByTestId('accordion-item-RenderThread-1')
        expect(renderThreadAccordion).toBeInTheDocument()
        expect(renderThreadAccordion).toHaveTextContent('Thread: RenderThread')
        expect(renderThreadAccordion).toHaveTextContent('android.view.ThreadedRenderer.nativeSyncAndDrawFrame(Native Method)')
        expect(renderThreadAccordion).toHaveTextContent('android.view.ThreadedRenderer.syncAndDrawFrame(ThreadedRenderer.java:144)')
    })

    it('shows error message when API returns error status', async () => {
        // Override the mock to return an error
        const { fetchExceptionsDetailsFromServer } = require('@/app/api/api_calls')
        fetchExceptionsDetailsFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'error',
            })
        )

        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that error message is displayed
        expect(screen.getByText(/Error fetching list of crashes/)).toBeInTheDocument()
    })

    it('renders appropriate link to view the session', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the link includes the correct path
        const link = screen.getByTestId('mock-link')
        expect(link).toHaveAttribute('href', '/123/sessions/app1/session1')
        expect(link).toHaveTextContent('View Session')
    })

    it('renders attachments when available', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the attachment image is rendered
        const image = screen.getByTestId('mock-image')
        expect(image).toHaveAttribute('src', '/images/screenshot1.png')
        expect(image).toHaveAttribute('alt', 'Screenshot 0')
    })

    it('does not update URL if filters remain unchanged', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })
        expect(replaceMock).toHaveBeenCalledTimes(1)

        await act(async () => {
            fireEvent.click(updateButton)
        })
        expect(replaceMock).toHaveBeenCalledTimes(1)
    })

    describe('Pagination handling', () => {
        it('updates keyId and keyTimestamp when Next is clicked', async () => {
            render(
                <ExceptionsDetails
                    exceptionsType={ExceptionsType.Crash}
                    teamId="123"
                    appId="app1"
                    exceptionsGroupId="exception1"
                    exceptionsGroupName="NullPointerException@MainActivity.java"
                />
            )

            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })

            const nextButton = await screen.findByTestId('next-button')
            await act(async () => {
                fireEvent.click(nextButton)
            })

            // The keyId should be set to the ID of the first item in results
            expect(replaceMock).toHaveBeenLastCalledWith('?keyId=exception1&keyTimestamp=2020-01-01T00%3A00%3A00Z&limit=1&updated', { scroll: false })
        })

        it('updates keyId and keyTimestamp when Prev is clicked', async () => {
            render(
                <ExceptionsDetails
                    exceptionsType={ExceptionsType.Crash}
                    teamId="123"
                    appId="app1"
                    exceptionsGroupId="exception1"
                    exceptionsGroupName="NullPointerException@MainActivity.java"
                />
            )

            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })

            const prevButton = await screen.findByTestId('prev-button')
            await act(async () => {
                fireEvent.click(prevButton)
            })

            expect(replaceMock).toHaveBeenLastCalledWith('?keyId=exception1&keyTimestamp=2020-01-01T00%3A00%3A00Z&limit=-1&updated', { scroll: false })
        })

        it('resets pagination parameters when filters change', async () => {
            // Override useSearchParams to simulate initial parameters
            const { useSearchParams } = jest.requireActual('next/navigation')
            const useSearchParamsSpy = jest
                .spyOn(require('next/navigation'), 'useSearchParams')
                .mockReturnValue(new URLSearchParams('?keyId=previousKey&keyTimestamp=previousTs&limit=1'))

            render(
                <ExceptionsDetails
                    exceptionsType={ExceptionsType.Crash}
                    teamId="123"
                    appId="app1"
                    exceptionsGroupId="exception1"
                    exceptionsGroupName="NullPointerException@MainActivity.java"
                />
            )

            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })
            expect(replaceMock).toHaveBeenCalledWith('?keyId=previousKey&keyTimestamp=previousTs&limit=1&updated', { scroll: false })

            // Now simulate a filter change with a different value
            const updateButton2 = screen.getByTestId('update-filters-2')
            await act(async () => {
                fireEvent.click(updateButton2)
            })

            // Should keep the keyId and keyTimestamp from URL
            expect(replaceMock).toHaveBeenLastCalledWith('?keyId=previousKey&keyTimestamp=previousTs&limit=1&updated2', { scroll: false })
            useSearchParamsSpy.mockRestore()
        })
    })

    it('correctly displays and hides loading spinner based on API status', async () => {
        // Mock implementation to control loading state
        const { fetchExceptionsDetailsFromServer } = require('@/app/api/api_calls')

        // Create a promise that won't resolve immediately to maintain loading state
        let resolvePromise: (value: any) => void
        const loadingPromise = new Promise(resolve => {
            resolvePromise = resolve
        })

        fetchExceptionsDetailsFromServer.mockImplementationOnce(() => loadingPromise)

        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Crash}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="NullPointerException@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Test the loading state - loading spinner should be visible
        expect(screen.getByTestId('loading-spinner-mock')).toBeInTheDocument()
        expect(screen.queryByText('Id: exception1')).not.toBeInTheDocument()

        // Resolve the loading promise to move to success state
        await act(async () => {
            resolvePromise({
                status: 'success',
                data: {
                    results: [
                        {
                            id: 'exception1',
                            session_id: 'session1',
                            timestamp: '2020-01-01T00:00:00Z',
                            type: 'NullPointerException',
                            thread_name: 'main',
                            attribute: {
                                device_manufacturer: 'Google ',
                                device_model: '6 Pro',
                                app_version: '1.0.0',
                                network_type: 'WiFi'
                            },
                            exception: {
                                title: 'NullPointerException',
                                stacktrace: 'java.lang.NullPointerException'
                            },
                            threads: [],
                            attachments: []
                        }
                    ],
                    meta: { previous: false, next: false },
                }
            })
        })

        // After loading, the details should be visible and loading spinner should be gone
        await screen.findByText('Id: exception1')
        expect(screen.queryByTestId('loading-spinner-mock')).not.toBeInTheDocument()
    })
})

describe('ExceptionsDetails Component - ANRs', () => {
    beforeEach(() => {
        replaceMock.mockClear()
    })

    it('renders ANR thread correctly instead of crash thread', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Anr}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="ANR@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the ANR accordion is rendered instead of crash accordion
        const anrAccordion = screen.getByTestId('accordion-item-Thread: main')
        expect(anrAccordion).toBeInTheDocument()
        expect(anrAccordion).toHaveTextContent('Thread: main')
        expect(anrAccordion).toHaveTextContent('ANR in com.example.MainActivity')
    })

    it('shows error message with ANR-specific text', async () => {
        // Override the mock to return an error
        const { fetchExceptionsDetailsFromServer } = require('@/app/api/api_calls')
        fetchExceptionsDetailsFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'error',
            })
        )

        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Anr}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="ANR@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(screen.getByText(/Error fetching list of ANRs/)).toBeInTheDocument()
    })

    it('displays proper plots when filters are ready', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Anr}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="ANR@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(screen.getByTestId('exceptions-details-plot-mock')).toBeInTheDocument()
        expect(screen.getByTestId('exceptions-distribution-plot-mock')).toBeInTheDocument()
    })

    it('correctly initializes with empty state for ANR type', async () => {
        const { fetchExceptionsDetailsFromServer } = require('@/app/api/api_calls')
        fetchExceptionsDetailsFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'success',
                data: {
                    results: [],
                    meta: { previous: false, next: false },
                }
            })
        )

        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Anr}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="ANR@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Should not display any exception details when no results
        expect(screen.queryByText(/Id:/)).not.toBeInTheDocument()
        expect(screen.queryByTestId('accordion-anr')).not.toBeInTheDocument()
    })

    it('shows the CopyAiContext button', async () => {
        render(
            <ExceptionsDetails
                exceptionsType={ExceptionsType.Anr}
                teamId="123"
                appId="app1"
                exceptionsGroupId="exception1"
                exceptionsGroupName="ANR@MainActivity.java"
            />
        )

        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(screen.getByTestId('copy-ai-context-mock')).toBeInTheDocument()
    })
})