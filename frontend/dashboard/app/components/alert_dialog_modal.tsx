"use client"

import { ReactNode } from "react";

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
                    <button type="button" className="outline-hidden hover:bg-yellow-200 focus-visible:bg-yellow-200 active:bg-yellow-300 font-display border border-black rounded-md transition-colors duration-100 py-2 px-4" onClick={onAffirmativeAction}>{affirmativeText}</button>
                </div>
            </div>
        </div>
    );
};

export default AlertDialogModal;