import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

const mockSetTheme = jest.fn()

jest.mock('next-themes', () => ({
    useTheme: () => ({ theme: 'light', setTheme: mockSetTheme }),
}))

jest.mock('lucide-react', () => ({
    Sun: ({ className }: any) => <span data-testid="sun-icon" className={className} />,
    Moon: ({ className }: any) => <span data-testid="moon-icon" className={className} />,
}))

jest.mock('@/app/components/button', () => ({
    Button: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...props}>{children}</button>
    ),
}))

import { ThemeToggle } from '@/app/components/theme_toggle'

describe('ThemeToggle', () => {
    it('renders sun and moon icons', () => {
        render(<ThemeToggle />)
        expect(screen.getByTestId('sun-icon')).toBeInTheDocument()
        expect(screen.getByTestId('moon-icon')).toBeInTheDocument()
    })

    it('renders accessible label', () => {
        render(<ThemeToggle />)
        expect(screen.getByText('Toggle theme')).toBeInTheDocument()
    })

    it('toggles from light to dark on click', () => {
        render(<ThemeToggle />)
        fireEvent.click(screen.getByRole('button'))
        expect(mockSetTheme).toHaveBeenCalledWith('dark')
    })
})
