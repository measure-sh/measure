import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, describe, it } from '@jest/globals'
import AlertDialog from '@/app/components/alert_dialog'

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