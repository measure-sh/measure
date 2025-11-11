import SdkConfigNumericInput from '@/app/components/sdk_config_numeric_input'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

describe('SdkConfigNumericInput Component', () => {
    const onChangeMock = jest.fn()

    beforeEach(() => {
        onChangeMock.mockClear()
    })

    describe('rendering', () => {
        it('renders input with correct initial value', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')
            expect(input).toHaveValue(50)
        })

        it('renders input with correct min attribute', () => {
            render(<SdkConfigNumericInput value={50} minValue={10} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('min', '10')
        })

        it('renders input with correct max attribute', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('max', '100')
        })

        it('renders input with default minValue of 0', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('min', '0')
        })

        it('renders input with default step of 1', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('step', '1')
        })

        it('renders input with custom step', () => {
            render(<SdkConfigNumericInput value={0.5} maxValue={1} step={0.01} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('step', '0.01')
        })

        it('renders input as disabled when disabled prop is true', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} disabled={true} />)
            const input = screen.getByRole('spinbutton')
            expect(input).toBeDisabled()
        })

        it('renders input with data-testid when provided', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} testId="my-input" />)
            const input = screen.getByTestId('my-input')
            expect(input).toBeInTheDocument()
        })
    })

    describe('integer type (default)', () => {
        it('updates local value when user types valid integer', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton') as HTMLInputElement

            act(() => {
                fireEvent.change(input, { target: { value: '75' } })
            })

            expect(input.value).toBe('75')
        })

        it('calls onChange with parsed integer value', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')

            act(() => {
                fireEvent.change(input, { target: { value: '75' } })
            })

            expect(onChangeMock).toHaveBeenCalledWith(75)
        })

        it('clamps value to max when user enters number exceeding maxValue', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')

            act(() => {
                fireEvent.change(input, { target: { value: '150' } })
            })

            expect(onChangeMock).toHaveBeenCalledWith(100)
        })

        it('clamps value to min when user enters number below minValue', () => {
            render(<SdkConfigNumericInput value={50} minValue={10} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')

            act(() => {
                fireEvent.change(input, { target: { value: '5' } })
            })

            expect(onChangeMock).toHaveBeenCalledWith(10)
        })

        it('clamps value to 0 when user enters negative number with default minValue', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')

            act(() => {
                fireEvent.change(input, { target: { value: '-10' } })
            })

            expect(onChangeMock).toHaveBeenCalledWith(0)
        })
    })

    describe('float type', () => {
        it('updates local value when user types valid float', () => {
            render(<SdkConfigNumericInput value={0.5} maxValue={1} step={0.01} type="float" onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton') as HTMLInputElement

            act(() => {
                fireEvent.change(input, { target: { value: '0.75' } })
            })

            expect(input.value).toBe('0.75')
        })

        it('calls onChange with parsed float value', () => {
            render(<SdkConfigNumericInput value={0.5} maxValue={1} step={0.01} type="float" onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')

            act(() => {
                fireEvent.change(input, { target: { value: '0.75' } })
            })

            expect(onChangeMock).toHaveBeenCalledWith(0.75)
        })

        it('clamps float value to max', () => {
            render(<SdkConfigNumericInput value={0.5} maxValue={1} step={0.01} type="float" onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')

            act(() => {
                fireEvent.change(input, { target: { value: '1.5' } })
            })

            expect(onChangeMock).toHaveBeenCalledWith(1)
        })

        it('clamps float value to min', () => {
            render(<SdkConfigNumericInput value={0.5} minValue={0} maxValue={1} step={0.01} type="float" onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')

            act(() => {
                fireEvent.change(input, { target: { value: '-0.5' } })
            })

            expect(onChangeMock).toHaveBeenCalledWith(0)
        })
    })

    describe('blur behavior', () => {
        it('resets to original value on blur when input is empty', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton') as HTMLInputElement

            act(() => {
                fireEvent.change(input, { target: { value: '' } })
            })

            expect(input.value).toBe('')

            act(() => {
                fireEvent.blur(input)
            })

            expect(input.value).toBe('50')
        })

        it('clamps and formats value on blur when value exceeds max', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton') as HTMLInputElement

            act(() => {
                fireEvent.change(input, { target: { value: '150' } })
            })

            act(() => {
                fireEvent.blur(input)
            })

            expect(input.value).toBe('100')
        })

        it('clamps and formats value on blur when value is below min', () => {
            render(<SdkConfigNumericInput value={50} minValue={10} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton') as HTMLInputElement

            act(() => {
                fireEvent.change(input, { target: { value: '5' } })
            })

            act(() => {
                fireEvent.blur(input)
            })

            expect(input.value).toBe('10')
        })

        it('resets to original value on blur when input contains invalid text', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton') as HTMLInputElement

            act(() => {
                fireEvent.change(input, { target: { value: 'abc' } })
            })

            act(() => {
                fireEvent.blur(input)
            })

            expect(input.value).toBe('50')
        })
    })

    describe('external value changes', () => {
        it('updates local value when value prop changes externally', () => {
            const { rerender } = render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton') as HTMLInputElement

            expect(input.value).toBe('50')

            rerender(<SdkConfigNumericInput value={75} maxValue={100} onChange={onChangeMock} />)

            expect(input.value).toBe('75')
        })

        it('updates local value when float value prop changes externally', () => {
            const { rerender } = render(<SdkConfigNumericInput value={0.5} maxValue={1} step={0.01} type="float" onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton') as HTMLInputElement

            expect(input.value).toBe('0.5')

            rerender(<SdkConfigNumericInput value={0.75} maxValue={1} step={0.01} type="float" onChange={onChangeMock} />)

            expect(input.value).toBe('0.75')
        })
    })

    describe('edge cases', () => {
        it('does not call onChange when input is empty', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')

            act(() => {
                fireEvent.change(input, { target: { value: '' } })
            })

            expect(onChangeMock).not.toHaveBeenCalled()
        })

        it('does not call onChange when input contains only whitespace', () => {
            render(<SdkConfigNumericInput value={50} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')

            act(() => {
                fireEvent.change(input, { target: { value: '   ' } })
            })

            expect(onChangeMock).not.toHaveBeenCalled()
        })

        it('handles zero value correctly', () => {
            render(<SdkConfigNumericInput value={0} maxValue={100} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton') as HTMLInputElement

            expect(input.value).toBe('0')
        })

        it('handles minValue equal to maxValue', () => {
            render(<SdkConfigNumericInput value={50} minValue={50} maxValue={50} onChange={onChangeMock} />)
            const input = screen.getByRole('spinbutton')

            act(() => {
                fireEvent.change(input, { target: { value: '100' } })
            })

            expect(onChangeMock).toHaveBeenCalledWith(50)
        })
    })
})