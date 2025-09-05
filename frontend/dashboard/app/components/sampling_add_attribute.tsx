"use client"

import { Button } from "./button";

interface SamplingAddAttributeProps {
    title: string;
    onAdd: () => void;
    disabled?: boolean;
}

const SamplingAddAttribute = ({ title, onAdd, disabled = false }: SamplingAddAttributeProps) => {
    return (
        <div className="flex items-center gap-3">
            <p className="text-sm">{title}</p>
            <Button
                variant="ghost"
                size="sm"
                className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50 p-1 h-6"
                onClick={onAdd}
                disabled={disabled}
            >
                + Add
            </Button>
        </div>
    );
};

export default SamplingAddAttribute;