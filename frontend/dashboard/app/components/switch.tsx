"use client"

import React from 'react';

interface SwitchToggleProps {
    toggled: boolean;
    onToggle: (isToggled: boolean) => void;
    disabled?: boolean;
    className?: string;
}

const SwitchToggle: React.FC<SwitchToggleProps> = ({
    toggled,
    onToggle,
    disabled = false,
    className = '',
}) => {
    const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!disabled) {
            onToggle(e.target.checked);
        }
    };

    const trackClasses = toggled
        ? 'bg-yellow-300'
        : 'bg-slate-300';

    const thumbClasses = toggled
        ? 'translate-x-5'
        : 'translate-x-0';

    const disabledClasses = disabled
        ? 'cursor-not-allowed opacity-50'
        : 'cursor-pointer';

    return (
        <label className={`flex items-center ${disabledClasses} ${className}`}>
            <div className="relative">
                <input
                    type="checkbox"
                    className="sr-only"
                    checked={toggled}
                    onChange={handleToggle}
                    disabled={disabled}
                    aria-checked={toggled}
                    role="switch"
                />
                <div className={`block w-12 h-7 rounded-full transition-colors duration-200 ease-in-out ${trackClasses}`}></div>
                <div
                    className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow-md transition-transform duration-200 ease-in-out ${thumbClasses}`}
                ></div>
            </div>
        </label>
    );
};

export default SwitchToggle;