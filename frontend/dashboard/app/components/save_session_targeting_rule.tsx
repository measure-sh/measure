"use client"

import { Button } from "./button";

interface SaveSessionTargetingProps {
    isEditMode: boolean;
    isDisabled: boolean;
    onPublish: () => void;
    onUpdate: () => void;
}

const SaveSessionTargetingRule = ({ 
    isEditMode, 
    isDisabled, 
    onPublish, 
    onUpdate 
}: SaveSessionTargetingProps) => {

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

export default SaveSessionTargetingRule;