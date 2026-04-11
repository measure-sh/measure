import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

import SessionTimelineSeekBar from '@/app/components/session_timeline_seekbar'

describe('SessionTimelineSeekBar', () => {
    it('renders a range input', () => {
        render(<SessionTimelineSeekBar value={50} onChange={jest.fn()} />)
        const input = screen.getByRole('slider')
        expect(input).toBeInTheDocument()
        expect(input).toHaveAttribute('type', 'range')
    })

    it('sets min to 1 and max to 100', () => {
        render(<SessionTimelineSeekBar value={50} onChange={jest.fn()} />)
        const input = screen.getByRole('slider')
        expect(input).toHaveAttribute('min', '1')
        expect(input).toHaveAttribute('max', '100')
    })

    it('reflects the value prop', () => {
        render(<SessionTimelineSeekBar value={75} onChange={jest.fn()} />)
        expect(screen.getByRole('slider')).toHaveValue('75')
    })

    it('calls onChange with parsed integer when slider moves', () => {
        const onChange = jest.fn()
        render(<SessionTimelineSeekBar value={50} onChange={onChange} />)
        fireEvent.change(screen.getByRole('slider'), { target: { value: '30' } })
        expect(onChange).toHaveBeenCalledWith(30)
    })

    it('sets progress CSS variable based on value', () => {
        render(<SessionTimelineSeekBar value={42} onChange={jest.fn()} />)
        const input = screen.getByRole('slider')
        expect(input.style.getPropertyValue('--progress-percent')).toBe('42%')
    })
})
