"use client"

import { Button } from "../button";
import { Trash2 } from "lucide-react";

interface RuleBuilderConditionContainerProps {
    conditionId: string;
    onRemoveCondition: (conditionId: string) => void;
    children: React.ReactNode;
}

const ConditionContainer = ({
    conditionId,
    onRemoveCondition,
    children
}: RuleBuilderConditionContainerProps) => {
    return (
        <div className="group px-4 py-4 bg-sky-100 rounded-md">
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    {children}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveCondition(conditionId)}
                    className="h-6 w-6 p-2 hover:bg-yellow-200 focus:bg-yellow-200 focus:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 mt-1"
                >
                    <Trash2 className="h-3 w-3 data-testid={`delete-${conditionId}" />
                </Button>
            </div>
        </div>
    );
};

export default ConditionContainer;