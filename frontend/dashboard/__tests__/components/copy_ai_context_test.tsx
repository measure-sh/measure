import { describe, expect, it, beforeEach } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

const mockToastPositive = jest.fn()
const mockWriteText = jest.fn()

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    ExceptionsType: { Crash: 'crash', Anr: 'anr' },
    emptyCrashExceptionsDetailsResponse: {},
    emptyAnrExceptionsDetailsResponse: {},
}))

jest.mock('@/app/utils/use_toast', () => ({
    toastPositive: (...args: any[]) => mockToastPositive(...args),
}))

jest.mock('@/app/utils/time_utils', () => ({
    formatDateToHumanReadableDateTime: (ts: string) => `formatted:${ts}`,
}))

jest.mock('@/app/components/button', () => ({
    Button: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...props}>{children}</button>
    ),
}))

jest.mock('@/app/components/tooltip', () => ({
    Tooltip: ({ children }: any) => <div>{children}</div>,
    TooltipTrigger: ({ children }: any) => <div>{children}</div>,
    TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
}))

import CopyAiContext from '@/app/components/copy_ai_context'

function mockCrashDetails() {
    return {
        results: [{
            attribute: {
                app_version: '2.0.0',
                platform: 'android',
                device_manufacturer: 'Google ',
                device_model: 'Pixel 7',
                network_type: 'Wifi',
                thread_name: 'main',
            },
            timestamp: '2024-01-01T00:00:00Z',
            exception: { stacktrace: 'at com.example.Main.run(Main.java:10)\nat com.example.App.start(App.java:5)' },
            threads: [
                { name: 'worker-1', frames: ['frame1', 'frame2'] },
            ],
        }],
    }
}

function mockAnrDetails() {
    return {
        results: [{
            attribute: {
                app_version: '1.0.0',
                platform: 'android',
                device_manufacturer: 'Samsung ',
                device_model: 'Galaxy S21',
                network_type: '5G',
                thread_name: 'main',
            },
            timestamp: '2024-06-15T12:00:00Z',
            anr: { stacktrace: 'at com.example.ANR.block(ANR.java:20)' },
            threads: null,
        }],
    }
}

beforeEach(() => {
    Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
    })
    mockWriteText.mockClear()
    mockToastPositive.mockClear()
})

describe('CopyAiContext', () => {
    describe('Rendering', () => {
        it('renders Copy AI Context button', () => {
            render(<CopyAiContext appName="MyApp" exceptionsType={'crash' as any} exceptionsDetails={mockCrashDetails() as any} />)
            expect(screen.getByText('Copy AI Context')).toBeInTheDocument()
        })

        it('renders tooltip content', () => {
            render(<CopyAiContext appName="MyApp" exceptionsType={'crash' as any} exceptionsDetails={mockCrashDetails() as any} />)
            expect(screen.getByTestId('tooltip-content')).toBeInTheDocument()
        })
    })

    describe('Clipboard and toast', () => {
        it('copies formatted context to clipboard on click', () => {
            render(<CopyAiContext appName="MyApp" exceptionsType={'crash' as any} exceptionsDetails={mockCrashDetails() as any} />)
            fireEvent.click(screen.getByText('Copy AI Context'))
            expect(mockWriteText).toHaveBeenCalledTimes(1)
            const copied = mockWriteText.mock.calls[0][0]
            expect(copied).toContain('I am trying to fix an exception')
        })

        it('shows success toast on click', () => {
            render(<CopyAiContext appName="MyApp" exceptionsType={'crash' as any} exceptionsDetails={mockCrashDetails() as any} />)
            fireEvent.click(screen.getByText('Copy AI Context'))
            expect(mockToastPositive).toHaveBeenCalledWith('AI context copied to clipboard')
        })
    })

    describe('Crash context formatting', () => {
        it('includes app name', () => {
            render(<CopyAiContext appName="MyApp" exceptionsType={'crash' as any} exceptionsDetails={mockCrashDetails() as any} />)
            fireEvent.click(screen.getByText('Copy AI Context'))
            const copied = mockWriteText.mock.calls[0][0]
            expect(copied).toContain('App Name: MyApp')
        })

        it('includes app version', () => {
            render(<CopyAiContext appName="MyApp" exceptionsType={'crash' as any} exceptionsDetails={mockCrashDetails() as any} />)
            fireEvent.click(screen.getByText('Copy AI Context'))
            const copied = mockWriteText.mock.calls[0][0]
            expect(copied).toContain('App version: 2.0.0')
        })

        it('includes crash stacktrace', () => {
            render(<CopyAiContext appName="MyApp" exceptionsType={'crash' as any} exceptionsDetails={mockCrashDetails() as any} />)
            fireEvent.click(screen.getByText('Copy AI Context'))
            const copied = mockWriteText.mock.calls[0][0]
            expect(copied).toContain('STACK TRACES')
            expect(copied).toContain('com.example.Main.run')
        })

        it('includes thread information', () => {
            render(<CopyAiContext appName="MyApp" exceptionsType={'crash' as any} exceptionsDetails={mockCrashDetails() as any} />)
            fireEvent.click(screen.getByText('Copy AI Context'))
            const copied = mockWriteText.mock.calls[0][0]
            expect(copied).toContain('Thread: main')
            expect(copied).toContain('Thread: worker-1')
        })

        it('includes device info', () => {
            render(<CopyAiContext appName="MyApp" exceptionsType={'crash' as any} exceptionsDetails={mockCrashDetails() as any} />)
            fireEvent.click(screen.getByText('Copy AI Context'))
            const copied = mockWriteText.mock.calls[0][0]
            expect(copied).toContain('Device: Google Pixel 7')
        })
    })

    describe('ANR context formatting', () => {
        it('uses anr stacktrace instead of exception stacktrace', () => {
            render(<CopyAiContext appName="MyApp" exceptionsType={'anr' as any} exceptionsDetails={mockAnrDetails() as any} />)
            fireEvent.click(screen.getByText('Copy AI Context'))
            const copied = mockWriteText.mock.calls[0][0]
            expect(copied).toContain('com.example.ANR.block')
        })

        it('handles null threads gracefully', () => {
            render(<CopyAiContext appName="MyApp" exceptionsType={'anr' as any} exceptionsDetails={mockAnrDetails() as any} />)
            fireEvent.click(screen.getByText('Copy AI Context'))
            // Should not throw and should produce valid output
            const copied = mockWriteText.mock.calls[0][0]
            expect(copied).toContain('App Name: MyApp')
        })
    })
})
