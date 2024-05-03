import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, describe, it } from '@jest/globals'
import Accordion from '@/app/components/accordion'
import AlertDialogModal from '@/app/components/alert_dialog_modal'

describe('Alert Dialog Modal', () => {
    it('renders correctly in opened state', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'

        const container = render(<AlertDialogModal open={true} body={body} affirmativeText={affirmativeText} onAffirmativeAction={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly in closed state', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'

        const container = render(<AlertDialogModal open={false} body={body} affirmativeText={affirmativeText} onAffirmativeAction={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('calls listener on affirmative action click', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        let clicked = false
        let onAffirmativeAction = () => clicked = true

        render(<AlertDialogModal open={true} body={body} affirmativeText={affirmativeText} onAffirmativeAction={onAffirmativeAction} />)

        fireEvent.click(screen.getByText(affirmativeText))

        expect(clicked).toBe(true)
    })
})