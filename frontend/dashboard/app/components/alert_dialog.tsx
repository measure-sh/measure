"use client"

import { ReactNode } from "react"
import { Button } from "./button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog"

interface AlertDialogProps {
    title: string,
    body: ReactNode,
    open: boolean,
    affirmativeText: string
    onAffirmativeAction: () => void
}

const AlertDialog: React.FC<AlertDialogProps> = ({ title, body, open, affirmativeText, onAffirmativeAction }) => {
    return (
        <Dialog open={open} modal={true} onOpenChange={onAffirmativeAction}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="font-display">{title}</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                    {body}
                </DialogDescription>
                <DialogFooter>
                    <Button
                        variant="outline"
                        className="font-display border border-black select-none"
                        onClick={onAffirmativeAction}
                    >
                        {affirmativeText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AlertDialog