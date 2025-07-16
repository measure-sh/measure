import { useScrollDirection } from '@/app/utils/scroll_utils';
import { describe, expect, it } from '@jest/globals';
import '@testing-library/jest-dom/jest-globals';
import { fireEvent, render, screen } from '@testing-library/react';

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