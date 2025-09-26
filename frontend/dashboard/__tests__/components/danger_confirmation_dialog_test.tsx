import DangerConfirmationModal from '@/app/components/danger_confirmation_dialog'
import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

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

        const container = render(<DangerConfirmationModal open={false} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={() => { }} />)

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

    it('renders confirmation text input when confirmationText prop is provided', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'
        const confirmationText = 'DELETE'

        render(<DangerConfirmationModal open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={() => { }} confirmationText={confirmationText} />)

        expect(screen.getByText(/Type/i)).toBeInTheDocument()
        expect(screen.getByText(confirmationText)).toBeInTheDocument()
        expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('does not render confirmation text input when confirmationText prop is not provided', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'

        render(<DangerConfirmationModal open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={() => { }} />)

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('disables affirmative button when confirmationText does not match input', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'
        const confirmationText = 'DELETE'

        render(<DangerConfirmationModal open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={() => { }} confirmationText={confirmationText} />)

        const affirmativeButton = screen.getByText(affirmativeText)
        expect(affirmativeButton).toBeDisabled()
    })

    it('enables affirmative button when confirmationText matches input', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'
        const confirmationText = 'DELETE'

        render(<DangerConfirmationModal open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={() => { }} confirmationText={confirmationText} />)

        const input = screen.getByRole('textbox')
        const affirmativeButton = screen.getByText(affirmativeText)

        fireEvent.change(input, { target: { value: confirmationText } })

        expect(affirmativeButton).not.toBeDisabled()
    })

    it('does not call affirmative action when button is clicked while disabled', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'
        const confirmationText = 'DELETE'
        let clicked = false
        let onAffirmativeAction = () => clicked = true

        render(<DangerConfirmationModal open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={onAffirmativeAction} onCancelAction={() => { }} confirmationText={confirmationText} />)

        const affirmativeButton = screen.getByText(affirmativeText)
        fireEvent.click(affirmativeButton)

        expect(clicked).toBe(false)
    })

    it('calls affirmative action when button is clicked after entering correct confirmation text', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'
        const confirmationText = 'DELETE'
        let clicked = false
        let onAffirmativeAction = () => clicked = true

        render(<DangerConfirmationModal open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={onAffirmativeAction} onCancelAction={() => { }} confirmationText={confirmationText} />)

        const input = screen.getByRole('textbox')
        const affirmativeButton = screen.getByText(affirmativeText)

        fireEvent.change(input, { target: { value: confirmationText } })
        fireEvent.click(affirmativeButton)

        expect(clicked).toBe(true)
    })

    it('resets input value when dialog is closed', () => {
        const body = 'SOME BODY TEXT'
        const affirmativeText = 'SOME AFFIRMATIVE TEXT'
        const cancelText = 'SOME CANCEL TEXT'
        const confirmationText = 'DELETE'

        const { rerender } = render(<DangerConfirmationModal open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={() => { }} confirmationText={confirmationText} />)

        const input = screen.getByRole('textbox') as HTMLInputElement
        fireEvent.change(input, { target: { value: 'TEST' } })

        expect(input.value).toBe('TEST')

        rerender(<DangerConfirmationModal open={false} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={() => { }} confirmationText={confirmationText} />)
        rerender(<DangerConfirmationModal open={true} body={body} affirmativeText={affirmativeText} cancelText={cancelText} onAffirmativeAction={() => { }} onCancelAction={() => { }} confirmationText={confirmationText} />)

        const newInput = screen.getByRole('textbox') as HTMLInputElement
        expect(newInput.value).toBe('')
    })
})