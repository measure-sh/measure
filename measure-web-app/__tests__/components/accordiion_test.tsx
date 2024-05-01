import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, describe, it } from '@jest/globals'
import Accordion from '@/app/components/accordion'

describe('Accordion', () => {
    it('renders correctly in collapsed state', () => {
        const title = 'TITLE'
        const id = 'ID'
        const body = 'SOME BODY TEXT'

        const container = render(<Accordion title={title} id={id}>{body}</Accordion>)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly in opened state', () => {
        const title = 'TITLE'
        const id = 'ID'
        const body = 'SOME BODY TEXT'

        const container = render(<Accordion title={title} id={id}>{body}</Accordion>)

        fireEvent.click(screen.getByText(title))

        expect(container).toMatchSnapshot()
    })
})