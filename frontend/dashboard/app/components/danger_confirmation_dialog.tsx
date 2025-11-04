"use client"

import { ReactNode, useEffect, useState } from "react"
import { Button } from "./button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog"
import { Input } from "./input"

interface DangerConfirmationDialogProps {
    body: ReactNode,
    open: boolean,
    affirmativeText: string,
    cancelText: string,
    onAffirmativeAction: () => void,
    onCancelAction: () => void,
    confirmationText?: string // Optional text user must type to confirm
}

const DangerConfirmationDialog: React.FC<DangerConfirmationDialogProps> = ({
    body,
    open,
    affirmativeText,
    cancelText,
    onAffirmativeAction,
    onCancelAction,
    confirmationText
}) => {
    const [inputValue, setInputValue] = useState("")
    const isConfirmationValid = confirmationText ? inputValue === confirmationText : true

    // Reset input when dialog opens/closes
    useEffect(() => {
        if (!open) {
            setInputValue("")
        }
    }, [open])

    return (
        <Dialog open={open} modal={true} onOpenChange={(open) => { if (!open) onCancelAction(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="font-display text-red-600">Are you sure?</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                    {body}
                </DialogDescription>
                {confirmationText && (
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                            Type <span className="font-semibold text-foreground">{confirmationText}</span> to confirm
                        </p>
                        <div className="py-1" />
                        <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                    </div>
                )}
                <DialogFooter>
                    <Button
                        variant="destructive"
                        className="font-display select-none"
                        onClick={onAffirmativeAction}
                        disabled={!isConfirmationValid}
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