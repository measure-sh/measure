import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

jest.mock('@/app/components/input', () => ({
    Input: (props: any) => <input {...props} />,
}))

import DebounceTextInput from '@/app/components/debounce_text_input'

beforeEach(() => {
    jest.useFakeTimers()
})

afterEach(() => {
    jest.useRealTimers()
})

describe('DebounceTextInput', () => {
    describe('Rendering', () => {
        it('renders with placeholder', () => {
            render(<DebounceTextInput id="search" placeholder="Search..." initialValue="" onChange={jest.fn()} />)
            expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
        })

        it('renders with initial value', () => {
            render(<DebounceTextInput id="search" placeholder="Search..." initialValue="hello" onChange={jest.fn()} />)
            expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
        })

        it('renders with the provided id', () => {
            render(<DebounceTextInput id="my-input" placeholder="" initialValue="" onChange={jest.fn()} />)
            expect(document.getElementById('my-input')).toBeInTheDocument()
        })
    })

    describe('Debounce behaviour', () => {
        it('does not call onChange immediately on input', () => {
            const onChange = jest.fn()
            render(<DebounceTextInput id="search" placeholder="" initialValue="" onChange={onChange} />)

            // Clear initial mount call
            act(() => { jest.advanceTimersByTime(500) })
            onChange.mockClear()

            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
            expect(onChange).not.toHaveBeenCalledWith('test')
        })

        it('calls onChange after 500ms debounce delay', () => {
            const onChange = jest.fn()
            render(<DebounceTextInput id="search" placeholder="" initialValue="" onChange={onChange} />)

            act(() => { jest.advanceTimersByTime(500) })
            onChange.mockClear()

            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })

            act(() => { jest.advanceTimersByTime(500) })
            expect(onChange).toHaveBeenCalledWith('test')
        })

        it('resets debounce timer on rapid input', () => {
            const onChange = jest.fn()
            render(<DebounceTextInput id="search" placeholder="" initialValue="" onChange={onChange} />)

            act(() => { jest.advanceTimersByTime(500) })
            onChange.mockClear()

            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a' } })
            act(() => { jest.advanceTimersByTime(300) })

            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ab' } })
            act(() => { jest.advanceTimersByTime(300) })

            // 'a' should NOT have fired (timer was reset)
            expect(onChange).not.toHaveBeenCalledWith('a')

            // After another 200ms (total 500 since last change), 'ab' should fire
            act(() => { jest.advanceTimersByTime(200) })
            expect(onChange).toHaveBeenCalledWith('ab')
        })

        it('fires onChange on mount with initial value', () => {
            const onChange = jest.fn()
            render(<DebounceTextInput id="search" placeholder="" initialValue="init" onChange={onChange} />)

            act(() => { jest.advanceTimersByTime(500) })
            expect(onChange).toHaveBeenCalledWith('init')
        })
    })

    describe('initialSelected sync', () => {
        it('updates input value when initialValue prop changes', () => {
            const { rerender } = render(
                <DebounceTextInput id="search" placeholder="" initialValue="old" onChange={jest.fn()} />
            )
            expect(screen.getByDisplayValue('old')).toBeInTheDocument()

            rerender(<DebounceTextInput id="search" placeholder="" initialValue="new" onChange={jest.fn()} />)
            expect(screen.getByDisplayValue('new')).toBeInTheDocument()
        })
    })
})
