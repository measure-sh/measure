import SamplingRateInput from '@/app/components/sampling_rate_input'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

describe('SamplingRateInput Component', () => {
    const onChangeMock = jest.fn()

    beforeEach(() => {
        onChangeMock.mockClear()
    })

    it('renders input with correct initial value', () => {
        render(<SamplingRateInput value={50} maxValue={100} onChange={onChangeMock} />)
        const input = screen.getByRole('spinbutton')
        expect(input).toHaveValue(50)
    })

    it('renders input with correct max attribute', () => {
        render(<SamplingRateInput value={50} maxValue={100} onChange={onChangeMock} />)
        const input = screen.getByRole('spinbutton')
        expect(input).toHaveAttribute('max', '100')
    })

    it('renders input as disabled when disabled prop is true', () => {
        render(<SamplingRateInput value={50} maxValue={100} onChange={onChangeMock} disabled={true} />)
        const input = screen.getByRole('spinbutton')
        expect(input).toBeDisabled()
    })

    it('displays correct placeholder text', () => {
        render(<SamplingRateInput value={50} maxValue={100} onChange={onChangeMock} />)
        const input = screen.getByRole('spinbutton')
        expect(input).toHaveAttribute('placeholder', '0-100%')
    })

    it('updates local value when user types valid number', () => {
        render(<SamplingRateInput value={50} maxValue={100} onChange={onChangeMock} />)
        const input = screen.getByRole('spinbutton') as HTMLInputElement
        
        act(() => {
            fireEvent.change(input, { target: { value: '75' } })
        })
        
        expect(input.value).toBe('75')
    })

    it('clamps value to max when user enters number exceeding maxValue', () => {
        render(<SamplingRateInput value={50} maxValue={100} onChange={onChangeMock} />)
        const input = screen.getByRole('spinbutton')
        
        act(() => {
            fireEvent.change(input, { target: { value: '150' } })
        })
        
        expect(onChangeMock).toHaveBeenCalledWith(100)
    })

    it('clamps value to 0 when user enters negative number', () => {
        render(<SamplingRateInput value={50} maxValue={100} onChange={onChangeMock} />)
        const input = screen.getByRole('spinbutton')
        
        act(() => {
            fireEvent.change(input, { target: { value: '-10' } })
        })
        
        expect(onChangeMock).toHaveBeenCalledWith(0)
    })

    it('calls onChange with clamped value when valid number is entered', () => {
        render(<SamplingRateInput value={50} maxValue={100} onChange={onChangeMock} />)
        const input = screen.getByRole('spinbutton')
        
        act(() => {
            fireEvent.change(input, { target: { value: '75.5' } })
        })
        
        expect(onChangeMock).toHaveBeenCalledWith(75.5)
    })

    it('resets to original value on blur when input is empty', () => {
        render(<SamplingRateInput value={50} maxValue={100} onChange={onChangeMock} />)
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

    it('clamps and formats value on blur when valid number is entered', () => {
        render(<SamplingRateInput value={50} maxValue={100} onChange={onChangeMock} />)
        const input = screen.getByRole('spinbutton') as HTMLInputElement
        
        act(() => {
            fireEvent.change(input, { target: { value: '150' } })
        })
        
        act(() => {
            fireEvent.blur(input)
        })
        
        expect(input.value).toBe('100')
    })

    it('updates local value when value prop changes externally', () => {
        const { rerender } = render(<SamplingRateInput value={50} maxValue={100} onChange={onChangeMock} />)
        const input = screen.getByRole('spinbutton') as HTMLInputElement
        
        expect(input.value).toBe('50')
        
        rerender(<SamplingRateInput value={75} maxValue={100} onChange={onChangeMock} />)
        
        expect(input.value).toBe('75')
    })
})