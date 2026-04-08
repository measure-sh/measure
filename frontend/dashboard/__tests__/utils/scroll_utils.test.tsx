import { useScrollDirection, useScrollStop } from '@/app/utils/scroll_utils';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import '@testing-library/jest-dom/jest-globals';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React, { useRef } from 'react';

const TestComponent = () => {
  const scrollDirection = useScrollDirection()
  return <div>{scrollDirection}</div>
}

describe('useScrollDirection', () => {
  it('should return "scrolling up" initially', () => {
    render(<TestComponent />)
    expect(screen.getByText('scrolling up')).toBeInTheDocument()
  })

  it('should update the scroll direction correctly when scrolling down', async () => {
    render(<TestComponent />)

    fireEvent.scroll(window, { target: { scrollY: 100 } })

    await screen.findByText('scrolling down')

    expect(screen.getByText('scrolling down')).toBeInTheDocument()
  })

  it('should update the scroll direction correctly when scrolling up', async () => {
    render(<TestComponent />)

    fireEvent.scroll(window, { target: { scrollY: 100 } })
    fireEvent.scroll(window, { target: { scrollY: 50 } })

    await screen.findByText('scrolling up')

    expect(screen.getByText('scrolling up')).toBeInTheDocument()
  })
})

describe('useScrollStop', () => {
  let originalRaf: typeof window.requestAnimationFrame

  beforeEach(() => {
    jest.useFakeTimers()
    originalRaf = window.requestAnimationFrame
    window.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0 }
  })

  afterEach(() => {
    jest.useRealTimers()
    window.requestAnimationFrame = originalRaf
  })

  const ScrollStopTestComponent = ({ onScrollStop, delay }: { onScrollStop: () => void, delay?: number }) => {
    const ref = useRef<HTMLDivElement>(null)
    useScrollStop(ref as React.RefObject<HTMLElement>, onScrollStop, delay)
    return <div ref={ref} data-testid="scroll-container" style={{ height: 100, overflow: 'auto' }}>
      <div style={{ height: 1000 }}>Content</div>
    </div>
  }

  it('calls onScrollStop after scroll stops and delay elapses', () => {
    const onScrollStop = jest.fn()
    render(<ScrollStopTestComponent onScrollStop={onScrollStop} />)

    const container = screen.getByTestId('scroll-container')
    fireEvent.scroll(container)

    // Before delay
    act(() => { jest.advanceTimersByTime(100) })
    expect(onScrollStop).not.toHaveBeenCalled()

    // After default delay (150ms)
    act(() => { jest.advanceTimersByTime(50) })
    expect(onScrollStop).toHaveBeenCalledTimes(1)
  })

  it('calls onScrollStop only once for multiple rapid scrolls', () => {
    const onScrollStop = jest.fn()
    render(<ScrollStopTestComponent onScrollStop={onScrollStop} />)

    const container = screen.getByTestId('scroll-container')

    // Fire several rapid scroll events
    fireEvent.scroll(container)
    fireEvent.scroll(container)
    fireEvent.scroll(container)

    // After delay, should only fire once
    act(() => { jest.advanceTimersByTime(150) })
    expect(onScrollStop).toHaveBeenCalledTimes(1)
  })

  it('uses custom delay', () => {
    const onScrollStop = jest.fn()
    render(<ScrollStopTestComponent onScrollStop={onScrollStop} delay={300} />)

    const container = screen.getByTestId('scroll-container')
    fireEvent.scroll(container)

    act(() => { jest.advanceTimersByTime(200) })
    expect(onScrollStop).not.toHaveBeenCalled()

    act(() => { jest.advanceTimersByTime(100) })
    expect(onScrollStop).toHaveBeenCalledTimes(1)
  })
})