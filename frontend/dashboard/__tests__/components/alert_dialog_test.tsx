import AlertDialog from '@/app/components/alert_dialog'
import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

describe('Alert Dialog', () => {
    it('renders correctly in opened state', () => {
        const title = 'SOME TITLE TEXT'
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'

        const container = render(<AlertDialog open={true} title={title} body={body} affirmativeText={affirmativeText} onAffirmativeAction={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly in closed state', () => {
        const title = 'SOME TITLE TEXT'
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'

        const container = render(<AlertDialog open={false} title={title} body={body} affirmativeText={affirmativeText} onAffirmativeAction={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('calls listener on affirmative action click', () => {
        const title = 'SOME TITLE TEXT'
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        let clicked = false
        let onAffirmativeAction = () => clicked = true

        render(<AlertDialog open={true} title={title} body={body} affirmativeText={affirmativeText} onAffirmativeAction={onAffirmativeAction} />)

        fireEvent.click(screen.getByText(affirmativeText))

        expect(clicked).toBe(true)
    })
})