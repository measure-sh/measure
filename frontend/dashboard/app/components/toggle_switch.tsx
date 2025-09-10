"use client"

interface ToggleSwitchProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    disabled?: boolean;
}

const ToggleSwitch = ({ enabled, onChange, disabled = false }: ToggleSwitchProps) => {
    return (
        <div className="flex items-center h-9">
            <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => !disabled && onChange(!enabled)}
                disabled={disabled}
                className={`
                    relative inline-flex h-6 w-10 items-center rounded-full border transition-all duration-200 ease-in-out
                    focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-hidden
                    ${enabled
                        ? 'bg-yellow-200 hover:bg-yellow-300 border-yellow-400 hover:border-yellow-500'
                        : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 hover:border-neutral-400'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <span
                    className={`
                        inline-block h-6 w-6 transform rounded-full transition-all duration-200 ease-in-out shadow-sm bg-yellow-600 border border-yellow-800
                        ${enabled ? 'translate-x-5' : 'translate-x-0'}
                    `}
                />
            </button>
        </div>
    );
};

export default ToggleSwitch;