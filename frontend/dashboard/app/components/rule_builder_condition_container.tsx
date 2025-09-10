"use client"

import { Button } from "./button";
import { Trash2 } from "lucide-react";

interface RuleBuilderConditionContainerProps {
    index: number;
    onRemoveCondition: (index: number) => void;
    children: React.ReactNode;
}

const ConditionContainer = ({
    index,
    onRemoveCondition,
    children
}: RuleBuilderConditionContainerProps) => {
    return (
        <div className="group px-4 py-4 bg-sky-50">
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    {children}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveCondition(index)}
                    className="h-6 w-6 p-2 hover:bg-yellow-200 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 mt-1"
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
};

export default ConditionContainer;