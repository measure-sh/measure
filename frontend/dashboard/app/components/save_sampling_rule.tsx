"use client"

import { Button } from "./button";

interface SaveSamplingRuleProps {
    isEditMode: boolean;
    isReady: boolean;
    isDisabled: boolean;
    onPublish: () => void;
    onUpdate: () => void;
}

const SaveSamplingRule = ({ 
    isEditMode, 
    isReady, 
    isDisabled, 
    onPublish, 
    onUpdate 
}: SaveSamplingRuleProps) => {
    if (!isReady) return null;

    const handleClick = () => {
        if (isEditMode) {
            onUpdate();
        } else {
            onPublish();
        }
    };

    return (
        <Button
            variant="outline"
            className="font-display border border-black select-none"
            disabled={isDisabled}
            onClick={handleClick}
        >
            {isEditMode ? 'Update Rule' : 'Publish Rule'}
        </Button>
    );
};

export default SaveSamplingRule;