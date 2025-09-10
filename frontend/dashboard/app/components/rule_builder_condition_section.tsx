"use client"

import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

interface RuleBuilderConditionSectionProps {
    title: string;
    conditionCount: number;
    maxConditions: number;
    onAddCondition: () => void;
    children: React.ReactNode;
}

const RuleBuilderConditionSection = ({
    title,
    conditionCount,
    maxConditions,
    onAddCondition,
    children
}: RuleBuilderConditionSectionProps) => {
    const handleAddCondition = () => {
        onAddCondition();
    };

    return (
        <div className="py-2">
            <div className="flex items-center justify-between cursor-pointer select-none p-2 rounded">
                <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl">{title}</h2>
                </div>
                <Button
                    variant="outline"
                    className="font-display border border-black select-none"
                    disabled={conditionCount >= maxConditions}
                    loading={false}
                    onClick={handleAddCondition}
                >
                    + Add condition
                </Button>
            </div>
            <div className="mt-2">
                {children}
            </div>
        </div>
    );
};

export default RuleBuilderConditionSection;