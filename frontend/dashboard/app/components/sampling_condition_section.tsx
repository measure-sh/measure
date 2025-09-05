"use client"

import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

interface SamplingConditionSectionProps {
    title: string;
    description: string;
    conditionCount: number;
    maxConditions: number;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onAddCondition: () => void;
    children: React.ReactNode;
}

const SamplingConditionSection = ({
    title,
    description,
    conditionCount,
    maxConditions,
    isCollapsed,
    onToggleCollapse,
    onAddCondition,
    children
}: SamplingConditionSectionProps) => {
    const handleAddCondition = () => {
        if (isCollapsed) {
            onToggleCollapse();
        }
        onAddCondition();
    };

    return (
        <div className="py-2">
            <div 
                className="flex items-center justify-between cursor-pointer select-none hover:bg-gray-50 p-2 rounded"
                onClick={onToggleCollapse}
            >
                <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <p className="font-display text-xl max-w-6xl leading-none">{title}</p>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="font-display max-w-xs text-sm text-white fill-neutral-800 bg-neutral-800">
                            <div className="p-2">
                                {description.split('. Example: ').map((part, index) => (
                                    index === 0 ? (
                                        <p key={index}>{part}.</p>
                                    ) : (
                                        <p key={index} className="mt-2 text-gray-300">
                                            <span className="font-semibold">Example:</span> {part}
                                        </p>
                                    )
                                ))}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                    {isCollapsed && conditionCount > 0 && (
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                            {conditionCount}
                        </span>
                    )}
                </div>
                <Button
                    variant="outline"
                    className="m-2 font-display border border-black select-none"
                    disabled={conditionCount >= maxConditions}
                    loading={false}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleAddCondition();
                    }}
                >
                    + Add condition
                </Button>
            </div>
            {!isCollapsed && (
                <div className="mt-2">
                    {children}
                </div>
            )}
        </div>
    );
};

export default SamplingConditionSection;