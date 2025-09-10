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
                size="lg"
                className="text-sm hover:bg-yellow-200 p-2 h-6 select-none"
                onClick={onAdd}
                disabled={disabled}
            >
                + Add
            </Button>
        </div>
    );
};

export default SamplingAddAttribute;