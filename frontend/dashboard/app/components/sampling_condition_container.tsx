"use client"

import { Button } from "./button";
import { Trash2 } from "lucide-react";

interface SamplingConditionContainerProps {
    index: number;
    onRemoveCondition: (index: number) => void;
    children: React.ReactNode;
}

const SamplingConditionContainer = ({
    index,
    onRemoveCondition,
    children
}: SamplingConditionContainerProps) => {
    return (
        <div className="group p-3 rounded-lg border mx-4">
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    {children}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveCondition(index)}
                    className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 mt-1"
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
};

export default SamplingConditionContainer;