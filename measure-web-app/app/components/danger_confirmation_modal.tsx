"use client"

interface DangerConfirmationModalProps {
    title: string,
    open: boolean,
    affirmativeText: string,
    cancelText: string,
    onAffirmativeAction: () => void,
    onCancelAction: () => void;
}

const DangerConfirmationModal: React.FC<DangerConfirmationModalProps> = ({ title, open, affirmativeText, cancelText, onAffirmativeAction, onCancelAction }) => {
    return (
        <div id="popup-DangerConfirmationmodal" tabIndex={-1} className={`flex overflow-y-auto bg-neutral-950 bg-opacity-90 overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-full ${open ? '' : 'hidden'}`}>
            <div className="w-fit">
                <div className="flex flex-col bg-white rounded-lg border border-black py-4 px-8">
                    <p className="font-sans">{title}</p>
                    <div className="py-2" />
                    <div className="flex flex-row">
                        <button data-DangerConfirmationmodal-hide="popup-DangerConfirmationmodal" type="button" className="outline-none bg-red-600 hover:bg-red-700 focus-visible:bg-red-700 active:bg-red-800 font-display text-white rounded-md border border-black transition-colors duration-100 py-2 px-4" onClick={onAffirmativeAction}>{affirmativeText}</button>
                        <div className="px-1" />
                        <button data-DangerConfirmationmodal-hide="popup-DangerConfirmationmodal" type="button" className="outline-none hover:bg-yellow-200 focus-visible:bg-yellow-200 active:bg-yellow-300 font-display border border-black rounded-md transition-colors duration-100 py-2 px-4" onClick={onCancelAction}>{cancelText}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DangerConfirmationModal;