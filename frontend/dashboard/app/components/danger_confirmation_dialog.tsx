"use client"

import { ReactNode } from "react"
import { Button } from "./button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog"

interface DangerConfirmationDialogProps {
    body: ReactNode,
    open: boolean,
    affirmativeText: string,
    cancelText: string,
    onAffirmativeAction: () => void,
    onCancelAction: () => void
}

const DangerConfirmationDialog: React.FC<DangerConfirmationDialogProps> = ({ body, open, affirmativeText, cancelText, onAffirmativeAction, onCancelAction }) => {
    return (
        <Dialog open={open} modal={true} onOpenChange={(open) => { if (!open) onCancelAction(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="font-display text-red-600">Are you sure?</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                    {body}
                </DialogDescription>
                <DialogFooter>
                    <Button
                        variant="destructive"
                        className="font-display select-none"
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

export default DangerConfirmationDialog