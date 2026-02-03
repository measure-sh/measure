"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

interface FilterPillProps {
  title: string,
}

const tooltipChars = 1000

const FilterPill: React.FC<FilterPillProps> = ({ title }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className="px-2 py-1 max-w-72 whitespace-nowrap text-ellipsis overflow-hidden font-display text-xs border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:hover:bg-input/50 rounded-full outline-hidden transition ease-in-out transition-colors duration-100 select-none">
          {title}
        </p>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="font-display max-w-96 text-sm text-accent-foreground fill-accent bg-accent">
        {title.length <= tooltipChars ? title : title.slice(0, tooltipChars) + "..."}
      </TooltipContent>
    </Tooltip>
  );
};

export default FilterPill