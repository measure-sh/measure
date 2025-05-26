import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, describe, it } from '@jest/globals'
import DangerConfirmationModal from '@/app/components/danger_confirmation_dialog'

describe('Danger Confirmation Dialog', () => {
    it('renders correctly in opened state', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'

        const container = render(<DangerConfirmationModal open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly in closed state', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'

        const container = render(<DangerConfirmationModal open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('calls listener on affirmative action click', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'
        let clicked = false
        let onAffirmativeAction = () => clicked = true

        render(<DangerConfirmationModal open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={onAffirmativeAction} onCancelAction={() => { }} />)

        fireEvent.click(screen.getByText(affirmativeText))

        expect(clicked).toBe(true)
    })

    it('calls listener on cancel action click', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'
        let clicked = false
        let onCancelAction = () => clicked = true

        render(<DangerConfirmationModal open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={onCancelAction} />)

        fireEvent.click(screen.getByText(cancelText))

        expect(clicked).toBe(true)
    })
})