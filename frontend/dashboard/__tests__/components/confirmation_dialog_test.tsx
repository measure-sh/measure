import ConfirmationDialog from '@/app/components/confirmation_dialog'
import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

describe('Confirmation Dialog', () => {
    it('renders correctly in opened state', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'

        const container = render(<ConfirmationDialog open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly in closed state', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'

        const container = render(<ConfirmationDialog open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('calls listener on affirmative action click', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'
        let clicked = false
        let onAffirmativeAction = () => clicked = true

        render(<ConfirmationDialog open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={onAffirmativeAction} onCancelAction={() => { }} />)

        fireEvent.click(screen.getByText(affirmativeText))

        expect(clicked).toBe(true)
    })

    it('calls listener on cancel action click', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'
        let clicked = false
        let onCancelAction = () => clicked = true

        render(<ConfirmationDialog open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={onCancelAction} />)

        fireEvent.click(screen.getByText(cancelText))

        expect(clicked).toBe(true)
    })
})