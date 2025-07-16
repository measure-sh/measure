import Paginator from '@/app/components/paginator'
import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

describe('Paginator', () => {
    it('renders correctly when prev and next buttons are enabled', () => {
        const displayText = 'TITLE'

        const container = render(<Paginator displayText={displayText} prevEnabled={true} nextEnabled={true} onNext={() => { }} onPrev={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly when prev and next buttons are disabled', () => {
        const displayText = 'TITLE'

        const container = render(<Paginator displayText={displayText} prevEnabled={false} nextEnabled={false} onNext={() => { }} onPrev={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly when prev button is enabled and next button is disabled', () => {
        const displayText = 'TITLE'

        const container = render(<Paginator displayText={displayText} prevEnabled={true} nextEnabled={false} onNext={() => { }} onPrev={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly when prev button is disabled and next button is enabled', () => {
        const displayText = 'TITLE'

        const container = render(<Paginator displayText={displayText} prevEnabled={false} nextEnabled={true} onNext={() => { }} onPrev={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('calls next click listener when next button is enabled and is clicked', () => {
        const displayText = 'TITLE'
        let clicked = false

        render(<Paginator displayText={displayText} prevEnabled={false} nextEnabled={true} onNext={() => { clicked = true }} onPrev={() => { }} />)

        fireEvent.click(screen.getByText('Next'))

        expect(clicked).toBe(true)
    })

    it('does not call next click listener when next button is disabled and is clicked', () => {
        const displayText = 'TITLE'
        let clicked = false

        render(<Paginator displayText={displayText} prevEnabled={false} nextEnabled={false} onNext={() => { clicked = true }} onPrev={() => { }} />)

        fireEvent.click(screen.getByText('Next'))

        expect(clicked).toBe(false)
    })

    it('calls prev click listener when prev button is enabled and is clicked', () => {
        const displayText = 'TITLE'
        let clicked = false

        render(<Paginator displayText={displayText} prevEnabled={true} nextEnabled={false} onNext={() => { }} onPrev={() => { clicked = true }} />)

        fireEvent.click(screen.getByText('Previous'))

        expect(clicked).toBe(true)
    })

    it('does not call prev click listener when prev button is disabled and is clicked', () => {
        const displayText = 'TITLE'
        let clicked = false

        render(<Paginator displayText={displayText} prevEnabled={false} nextEnabled={false} onNext={() => { }} onPrev={() => { clicked = true }} />)

        fireEvent.click(screen.getByText('Previous'))

        expect(clicked).toBe(false)
    })
})