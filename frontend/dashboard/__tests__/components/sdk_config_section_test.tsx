import SdkConfigSection from '@/app/components/sdk_config_section'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

// Mock API calls
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    UpdateSdkConfigApiStatus: {
        Init: 'init',
        Loading: 'loading',
        Error: 'error',
        Success: 'success',
        Cancelled: 'cancelled'
    },
    updateSdkConfigFromServer: jest.fn(),
}))

// Mock toast utilities
jest.mock('@/app/utils/use_toast', () => ({
    toastPositive: jest.fn(),
    toastNegative: jest.fn(),
}))

// Mock Accordion to keep all items open for testing
jest.mock('@/app/components/accordion', () => ({
    Accordion: ({ children }: any) => <div>{children}</div>,
    AccordionContent: ({ children }: any) => <div>{children}</div>,
    AccordionItem: ({ children, value }: any) => <div data-testid={`accordion-item-${value}`}>{children}</div>,
    AccordionTrigger: ({ children }: any) => <div>{children}</div>,
}))

jest.mock('@/app/components/dropdown_select', () => ({
    __esModule: true,
    default: ({ initialSelected, onChangeSelected, 'data-testid': testId }: any) => (
        <select
            data-testid={testId}
            value={initialSelected}
            onChange={(e) => onChangeSelected?.(e.target.value)}
        >
            <option value="All text and media">All text and media</option>
            <option value="All text">All text</option>
            <option value="All text except clickable">All text except clickable</option>
            <option value="Sensitive fileds only">Sensitive fileds only</option>
        </select>
    ),
    DropdownSelectType: { SingleString: 'single_string' },
}))

jest.mock('@/app/components/danger_confirmation_dialog', () => ({
    __esModule: true,
    default: ({ open, body, affirmativeText, cancelText, onAffirmativeAction, onCancelAction }: any) =>
        open ? (
            <div data-testid="danger-confirmation-dialog">
                <div>{body}</div>
                <button data-testid="dialog-affirmative-button" onClick={onAffirmativeAction}>{affirmativeText}</button>
                <button data-testid="dialog-cancel-button" onClick={onCancelAction}>{cancelText}</button>
            </div>
        ) : null,
}))

const mockInitialConfig = {
    crash_take_screenshot: true,
    crash_timeline_sampling_rate: 100,
    anr_take_screenshot: true,
    anr_timeline_sampling_rate: 100,
    trace_sampling_rate: 0.1,
    launch_sampling_rate: 0.1,
    journey_sampling_rate: 0.1,
    http_disable_event_for_urls: [],
    http_track_request_for_urls: [],
    http_track_response_for_urls: [],
    http_blocked_headers: [],
    screenshot_mask_level: 'sensitive_fields_only',
}

describe('SdkConfigSection Component', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders the heading and all accordion sections', () => {
        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Check heading
        expect(screen.getByText('Configure data collection')).toBeInTheDocument()

        // Check all accordion sections are rendered
        expect(screen.getByText('Crashes')).toBeInTheDocument()
        expect(screen.getByText('ANRs')).toBeInTheDocument()
        expect(screen.getByText('Traces')).toBeInTheDocument()
        expect(screen.getByText('Launch Metrics')).toBeInTheDocument()
        expect(screen.getByText('User Journeys')).toBeInTheDocument()
        expect(screen.getByText('HTTP')).toBeInTheDocument()
        expect(screen.getByText('Screenshot Masking')).toBeInTheDocument()
    })

    it('hides ANR section when osName is iOS, shows it for Android and null', () => {
        // Test with iOS
        const { unmount } = render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName="ios"
            />
        )

        expect(screen.queryByText('ANRs')).not.toBeInTheDocument()
        unmount()

        // Test with Android
        const { unmount: unmount2 } = render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName="android"
            />
        )

        expect(screen.getByText('ANRs')).toBeInTheDocument()
        unmount2()

        // Test with null
        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        expect(screen.getByText('ANRs')).toBeInTheDocument()
    })

    it('initializes with correct config values and all save buttons disabled', () => {
        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Check that all save buttons are initially disabled
        expect(screen.getByTestId('crashes-save-button')).toBeDisabled()
        expect(screen.getByTestId('anrs-save-button')).toBeDisabled()
        expect(screen.getByTestId('traces-save-button')).toBeDisabled()
        expect(screen.getByTestId('launch-save-button')).toBeDisabled()
        expect(screen.getByTestId('journey-save-button')).toBeDisabled()
        expect(screen.getByTestId('http-save-button')).toBeDisabled()
        expect(screen.getByTestId('masking-save-button')).toBeDisabled()
    })

    it('disables all inputs when currentUserCanChangeAppSettings is false', () => {
        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={false}
                osName={null}
            />
        )

        // Check that switches are disabled
        expect(screen.getByTestId('crash-screenshot-switch')).toBeDisabled()
        expect(screen.getByTestId('anr-screenshot-switch')).toBeDisabled()

        // Check that inputs are disabled
        expect(screen.getByTestId('crash-timeline-sampling-rate-input')).toBeDisabled()
        expect(screen.getByTestId('anr-timeline-sampling-rate-input')).toBeDisabled()
        expect(screen.getByTestId('trace-sampling-rate-input')).toBeDisabled()
        expect(screen.getByTestId('launch-sampling-rate-input')).toBeDisabled()
        expect(screen.getByTestId('journey-sampling-rate-input')).toBeDisabled()

        // Check that textareas are disabled
        expect(screen.getByTestId('http-disable-urls-textarea')).toBeDisabled()
        expect(screen.getByTestId('http-track-request-urls-textarea')).toBeDisabled()
        expect(screen.getByTestId('http-track-response-urls-textarea')).toBeDisabled()
        expect(screen.getByTestId('http-blocked-headers-textarea')).toBeDisabled()
    })

    it('saves crashes config with correct payload, shows loading state, and displays success toast', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        const { toastPositive } = require('@/app/utils/use_toast')

        // Mock API to return success
        updateSdkConfigFromServer.mockResolvedValue({
            status: 'success'
        })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Make changes to crashes config
        const crashSwitch = screen.getByTestId('crash-screenshot-switch')
        await act(async () => {
            fireEvent.click(crashSwitch)
        })

        const crashTimelineInput = screen.getByTestId('crash-timeline-sampling-rate-input')
        await act(async () => {
            fireEvent.change(crashTimelineInput, { target: { value: '50' } })
            fireEvent.blur(crashTimelineInput)
        })

        // Click save button
        const saveButton = screen.getByTestId('crashes-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        // Click affirmative on confirmation dialog
        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        // Verify API was called with correct payload
        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                expect.objectContaining({
                    crash_take_screenshot: false,
                    crash_timeline_sampling_rate: 50
                })
            )
        })

        // Verify success toast was shown
        expect(toastPositive).toHaveBeenCalled()
    })

    it('saves ANR config with correct payload on successful save', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        const { toastPositive } = require('@/app/utils/use_toast')

        updateSdkConfigFromServer.mockResolvedValue({
            status: 'success'
        })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Make changes to ANR config
        const anrSwitch = screen.getByTestId('anr-screenshot-switch')
        await act(async () => {
            fireEvent.click(anrSwitch)
        })

        const anrTimelineInput = screen.getByTestId('anr-timeline-sampling-rate-input')
        await act(async () => {
            fireEvent.change(anrTimelineInput, { target: { value: '75' } })
            fireEvent.blur(anrTimelineInput)
        })

        // Click save button
        const saveButton = screen.getByTestId('anrs-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        // Click affirmative on confirmation dialog
        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        // Verify API was called with correct payload
        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                expect.objectContaining({
                    anr_take_screenshot: false,
                    anr_timeline_sampling_rate: 75
                })
            )
        })

        expect(toastPositive).toHaveBeenCalled()
    })

    it('saves traces config with correct payload on successful save', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        const { toastPositive } = require('@/app/utils/use_toast')

        updateSdkConfigFromServer.mockResolvedValue({
            status: 'success'
        })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Change trace sampling rate
        const traceInput = screen.getByTestId('trace-sampling-rate-input')
        await act(async () => {
            fireEvent.change(traceInput, { target: { value: '0.5' } })
            fireEvent.blur(traceInput)
        })

        // Click save button
        const saveButton = screen.getByTestId('traces-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        // Click affirmative on confirmation dialog
        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        // Verify API was called with correct payload
        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                expect.objectContaining({
                    trace_sampling_rate: 0.5
                })
            )
        })

        expect(toastPositive).toHaveBeenCalled()
    })

    it('saves HTTP config with correct payload including all URL and header fields', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        const { toastPositive } = require('@/app/utils/use_toast')

        updateSdkConfigFromServer.mockResolvedValue({
            status: 'success'
        })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Change all HTTP fields
        const httpDisableUrlsTextarea = screen.getByTestId('http-disable-urls-textarea')
        await act(async () => {
            fireEvent.change(httpDisableUrlsTextarea, {
                target: { value: 'https://example.com/*\nhttps://test.com/*' }
            })
        })

        const httpTrackRequestUrlsTextarea = screen.getByTestId('http-track-request-urls-textarea')
        await act(async () => {
            fireEvent.change(httpTrackRequestUrlsTextarea, {
                target: { value: 'https://api.example.com/*' }
            })
        })

        const httpTrackResponseUrlsTextarea = screen.getByTestId('http-track-response-urls-textarea')
        await act(async () => {
            fireEvent.change(httpTrackResponseUrlsTextarea, {
                target: { value: 'https://api.example.com/users/*' }
            })
        })

        const httpBlockedHeadersTextarea = screen.getByTestId('http-blocked-headers-textarea')
        await act(async () => {
            fireEvent.change(httpBlockedHeadersTextarea, {
                target: { value: 'Authorization\nX-API-Key' }
            })
        })

        // Click save button
        const saveButton = screen.getByTestId('http-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        // Click affirmative on confirmation dialog
        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        // Verify API was called with correct payload
        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                expect.objectContaining({
                    http_disable_event_for_urls: ['https://example.com/*', 'https://test.com/*'],
                    http_track_request_for_urls: ['https://api.example.com/*'],
                    http_track_response_for_urls: ['https://api.example.com/users/*'],
                    http_blocked_headers: ['Authorization', 'X-API-Key']
                })
            )
        })

        expect(toastPositive).toHaveBeenCalled()
    })

    it('saves masking config with correct payload on successful save', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        const { toastPositive } = require('@/app/utils/use_toast')

        updateSdkConfigFromServer.mockResolvedValue({
            status: 'success'
        })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Change masking dropdown
        const maskingDropdown = screen.getByTestId('screenshot-mask-level-dropdown')
        await act(async () => {
            fireEvent.change(maskingDropdown, { target: { value: 'All text' } })
        })

        // Click save button
        const saveButton = screen.getByTestId('masking-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        // Click affirmative on confirmation dialog
        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        // Verify API was called with correct payload
        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                expect.objectContaining({
                    screenshot_mask_level: 'all_text'
                })
            )
        })

        expect(toastPositive).toHaveBeenCalled()
    })

    it('displays error toast when save fails and keeps save button enabled', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        const { toastNegative } = require('@/app/utils/use_toast')

        // Mock API to return error
        updateSdkConfigFromServer.mockResolvedValue({
            status: 'error',
            error: 'Failed to update configuration'
        })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Make a change to enable the save button
        const crashSwitch = screen.getByTestId('crash-screenshot-switch')
        await act(async () => {
            fireEvent.click(crashSwitch)
        })

        // Click save button
        const saveButton = screen.getByTestId('crashes-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        // Click affirmative on confirmation dialog
        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        // Wait for API call and error toast
        await waitFor(() => {
            expect(toastNegative).toHaveBeenCalled()
        })

        // Verify save button is still enabled
        expect(screen.getByTestId('crashes-save-button')).not.toBeDisabled()
    })

    it('disables save button on successful save', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        const { toastPositive } = require('@/app/utils/use_toast')

        updateSdkConfigFromServer.mockResolvedValue({
            status: 'success'
        })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Make a change to crashes config
        const crashSwitch = screen.getByTestId('crash-screenshot-switch')
        await act(async () => {
            fireEvent.click(crashSwitch)
        })

        // Verify save button is enabled after change
        const saveButton = screen.getByTestId('crashes-save-button')
        expect(saveButton).not.toBeDisabled()

        // Click save button
        await act(async () => {
            fireEvent.click(saveButton)
        })

        // Click affirmative on confirmation dialog
        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        // Wait for success toast
        await waitFor(() => {
            expect(toastPositive).toHaveBeenCalled()
        })

        // Verify save button is disabled after successful save
        await waitFor(() => {
            expect(saveButton).toBeDisabled()
        })

        // Make another change to verify the button can be enabled again
        await act(async () => {
            fireEvent.click(crashSwitch)
        })

        // Verify save button is enabled again after new change
        expect(saveButton).not.toBeDisabled()
    })

    it('renders http urls in text area trimming whitespace and filtering empty lines', async () => {
        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={{
                    ...mockInitialConfig,
                    http_disable_event_for_urls: ['https://example.com/*', 'https://test.com/*']
                }}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Verify initial array is converted to newline-separated string
        const httpDisableUrlsTextarea = screen.getByTestId('http-disable-urls-textarea')
        expect(httpDisableUrlsTextarea).toHaveValue('https://example.com/*\nhttps://test.com/*')

        // Test input with whitespace and empty lines
        await act(async () => {
            fireEvent.change(httpDisableUrlsTextarea, {
                target: { value: '  https://api.example.com/*  \n\n  https://another.com/*  \n\n\n' }
            })
        })

        // Click save to trigger conversion
        const saveButton = screen.getByTestId('http-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        // Mock the API call to verify payload
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        updateSdkConfigFromServer.mockResolvedValue({ status: 'success' })

        // Click affirmative on confirmation dialog
        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        // Verify whitespace is trimmed and empty lines are filtered
        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                expect.objectContaining({
                    http_disable_event_for_urls: ['https://api.example.com/*', 'https://another.com/*']
                })
            )
        })
    })

    it('correctly converts mask levels between backend and display formats', () => {
        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={{
                    ...mockInitialConfig,
                    screenshot_mask_level: 'sensitive_fields_only'
                }}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        const maskingDropdown = screen.getByTestId('screenshot-mask-level-dropdown')
        expect(maskingDropdown).toHaveValue('Sensitive fileds only')
    })

    it('saves crash config on confirmation', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        updateSdkConfigFromServer.mockResolvedValue({ status: 'success' })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Make changes to crash config
        const crashSwitch = screen.getByTestId('crash-screenshot-switch')
        await act(async () => {
            fireEvent.click(crashSwitch)
        })

        const crashTimelineInput = screen.getByTestId('crash-timeline-sampling-rate-input')
        await act(async () => {
            fireEvent.change(crashTimelineInput, { target: { value: '75' } })
            fireEvent.blur(crashTimelineInput)
        })

        // Click save and confirm
        const saveButton = screen.getByTestId('crashes-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                {
                    crash_take_screenshot: false,
                    crash_timeline_sampling_rate: 75
                }
            )
        })
    })

    it('saves ANR config on confirmation', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        updateSdkConfigFromServer.mockResolvedValue({ status: 'success' })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Make changes to ANR config
        const anrSwitch = screen.getByTestId('anr-screenshot-switch')
        await act(async () => {
            fireEvent.click(anrSwitch)
        })

        const anrTimelineInput = screen.getByTestId('anr-timeline-sampling-rate-input')
        await act(async () => {
            fireEvent.change(anrTimelineInput, { target: { value: '50' } })
            fireEvent.blur(anrTimelineInput)
        })

        // Click save and confirm
        const saveButton = screen.getByTestId('anrs-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                {
                    anr_take_screenshot: false,
                    anr_timeline_sampling_rate: 50
                }
            )
        })
    })

    it('saves traces config on confirmation', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        updateSdkConfigFromServer.mockResolvedValue({ status: 'success' })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Change trace sampling rate
        const traceInput = screen.getByTestId('trace-sampling-rate-input')
        await act(async () => {
            fireEvent.change(traceInput, { target: { value: '0.5' } })
            fireEvent.blur(traceInput)
        })

        // Click save and confirm
        const saveButton = screen.getByTestId('traces-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                {
                    trace_sampling_rate: 0.5
                }
            )
        })
    })

    it('saves launch config on confirmation', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        updateSdkConfigFromServer.mockResolvedValue({ status: 'success' })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Change launch sampling rate
        const launchInput = screen.getByTestId('launch-sampling-rate-input')
        await act(async () => {
            fireEvent.change(launchInput, { target: { value: '1' } })
            fireEvent.blur(launchInput)
        })

        // Click save and confirm
        const saveButton = screen.getByTestId('launch-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                {
                    launch_sampling_rate: 1
                }
            )
        })
    })

    it('saves journey config on confirmation', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        updateSdkConfigFromServer.mockResolvedValue({ status: 'success' })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Change journey sampling rate
        const journeyInput = screen.getByTestId('journey-sampling-rate-input')
        await act(async () => {
            fireEvent.change(journeyInput, { target: { value: '0.25' } })
            fireEvent.blur(journeyInput)
        })

        // Click save and confirm
        const saveButton = screen.getByTestId('journey-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                {
                    journey_sampling_rate: 0.25
                }
            )
        })
    })

    it('saves HTTP config on confirmation', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        updateSdkConfigFromServer.mockResolvedValue({ status: 'success' })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Change HTTP fields
        const httpDisableUrlsTextarea = screen.getByTestId('http-disable-urls-textarea')
        await act(async () => {
            fireEvent.change(httpDisableUrlsTextarea, {
                target: { value: 'https://example.com/*\nhttps://test.com/*' }
            })
        })

        const httpTrackRequestUrlsTextarea = screen.getByTestId('http-track-request-urls-textarea')
        await act(async () => {
            fireEvent.change(httpTrackRequestUrlsTextarea, {
                target: { value: 'https://api.example.com/*' }
            })
        })

        const httpTrackResponseUrlsTextarea = screen.getByTestId('http-track-response-urls-textarea')
        await act(async () => {
            fireEvent.change(httpTrackResponseUrlsTextarea, {
                target: { value: 'https://api.example.com/users/*' }
            })
        })

        const httpBlockedHeadersTextarea = screen.getByTestId('http-blocked-headers-textarea')
        await act(async () => {
            fireEvent.change(httpBlockedHeadersTextarea, {
                target: { value: 'Authorization\nX-API-Key' }
            })
        })

        // Click save and confirm
        const saveButton = screen.getByTestId('http-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                {
                    http_disable_event_for_urls: ['https://example.com/*', 'https://test.com/*'],
                    http_track_request_for_urls: ['https://api.example.com/*'],
                    http_track_response_for_urls: ['https://api.example.com/users/*'],
                    http_blocked_headers: ['Authorization', 'X-API-Key']
                }
            )
        })
    })

    it('saves masking config on confirmation', async () => {
        const { updateSdkConfigFromServer } = require('@/app/api/api_calls')
        updateSdkConfigFromServer.mockResolvedValue({ status: 'success' })

        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        // Change masking level
        const maskingDropdown = screen.getByTestId('screenshot-mask-level-dropdown')
        await act(async () => {
            fireEvent.change(maskingDropdown, { target: { value: 'All text' } })
        })

        // Click save and confirm
        const saveButton = screen.getByTestId('masking-save-button')
        await act(async () => {
            fireEvent.click(saveButton)
        })

        await waitFor(() => {
            expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
        })

        const affirmativeButton = screen.getByTestId('dialog-affirmative-button')
        await act(async () => {
            fireEvent.click(affirmativeButton)
        })

        await waitFor(() => {
            expect(updateSdkConfigFromServer).toHaveBeenCalledWith(
                'test-app-id',
                {
                    screenshot_mask_level: 'all_text'
                }
            )
        })
    })

    it('disables all inputs for users without change permission', () => {
        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={false}
                osName={null}
            />
        )

        // Check that switches are disabled
        expect(screen.getByTestId('crash-screenshot-switch')).toBeDisabled()
        expect(screen.getByTestId('anr-screenshot-switch')).toBeDisabled()

        // Check that inputs are disabled
        expect(screen.getByTestId('crash-timeline-sampling-rate-input')).toBeDisabled()
        expect(screen.getByTestId('anr-timeline-sampling-rate-input')).toBeDisabled()
        expect(screen.getByTestId('trace-sampling-rate-input')).toBeDisabled()
        expect(screen.getByTestId('launch-sampling-rate-input')).toBeDisabled()
        expect(screen.getByTestId('journey-sampling-rate-input')).toBeDisabled()

        // Check that textareas are disabled
        expect(screen.getByTestId('http-disable-urls-textarea')).toBeDisabled()
        expect(screen.getByTestId('http-track-request-urls-textarea')).toBeDisabled()
        expect(screen.getByTestId('http-track-response-urls-textarea')).toBeDisabled()
        expect(screen.getByTestId('http-blocked-headers-textarea')).toBeDisabled()

        // Check that all save buttons are disabled
        expect(screen.getByTestId('crashes-save-button')).toBeDisabled()
        expect(screen.getByTestId('anrs-save-button')).toBeDisabled()
        expect(screen.getByTestId('traces-save-button')).toBeDisabled()
        expect(screen.getByTestId('launch-save-button')).toBeDisabled()
        expect(screen.getByTestId('journey-save-button')).toBeDisabled()
        expect(screen.getByTestId('http-save-button')).toBeDisabled()
        expect(screen.getByTestId('masking-save-button')).toBeDisabled()
    })

    it('limits trace sampling rate to max value of 1', async () => {
        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        const traceInput = screen.getByTestId('trace-sampling-rate-input') as HTMLInputElement

        // Verify max attribute is set to 1
        expect(traceInput).toHaveAttribute('max', '1')

        // Try to set value above 1
        await act(async () => {
            fireEvent.change(traceInput, { target: { value: '1.5' } })
            fireEvent.blur(traceInput)
        })

        // Value should be clamped to 1
        expect(traceInput.value).toBe('1')
    })

    it('limits journey sampling rate to max value of 1', async () => {
        render(
            <SdkConfigSection
                appId="test-app-id"
                appName="Test App"
                initialConfig={mockInitialConfig}
                currentUserCanChangeAppSettings={true}
                osName={null}
            />
        )

        const journeyInput = screen.getByTestId('journey-sampling-rate-input') as HTMLInputElement

        // Verify max attribute is set to 1
        expect(journeyInput).toHaveAttribute('max', '1')

        // Try to set value above 1
        await act(async () => {
            fireEvent.change(journeyInput, { target: { value: '2' } })
            fireEvent.blur(journeyInput)
        })

        // Value should be clamped to 1
        expect(journeyInput.value).toBe('1')
    })
})