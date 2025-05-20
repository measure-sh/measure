"use client"

import { ReactNode } from "react";
import { Button } from "./button";

interface AlertDialogModalProps {
    body: ReactNode,
    open: boolean,
    affirmativeText: string
    onAffirmativeAction: () => void
}

const AlertDialogModal: React.FC<AlertDialogModalProps> = ({ body, open, affirmativeText, onAffirmativeAction }) => {
    return (
        <div tabIndex={-1} className={`flex overflow-y-auto bg-neutral-950 bg-opacity-90 overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-full ${open ? '' : 'hidden'}`}>
            <div className="w-fit">
                <div className="flex flex-col bg-white rounded-lg border border-black py-4 px-8">
                    {body}
                    <div className="py-2" />
                    <Button
                        variant="outline"
                        className="font-display border border-black rounded-md select-none"
                        onClick={onAffirmativeAction}
                    >
                        {affirmativeText}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AlertDialogModal;