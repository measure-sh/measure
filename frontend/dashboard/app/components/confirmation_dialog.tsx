"use client"

import { ReactNode } from "react"
import { Button } from "./button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog"

interface ConfirmationDialogProps {
    body: ReactNode,
    open: boolean,
    affirmativeText: string,
    cancelText: string,
    onAffirmativeAction: () => void,
    onCancelAction: () => void
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ body, open, affirmativeText, cancelText, onAffirmativeAction, onCancelAction }) => {
    return (
        <Dialog open={open} modal={true} onOpenChange={(open) => { if (!open) onCancelAction(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="font-display">Are you sure?</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                    {body}
                </DialogDescription>
                <DialogFooter>
                    <Button
                        variant="default"
                        className="font-display border border-black select-none"
                        onClick={onAffirmativeAction}
                    >
                        {affirmativeText}
                    </Button>
                    <Button
                        variant="outline"
                        className="font-display border border-black select-none"
                        onClick={onCancelAction}
                    >
                        {cancelText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default ConfirmationDialog