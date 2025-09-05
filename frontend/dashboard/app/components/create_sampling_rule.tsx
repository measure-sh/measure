"use client"

import { useState } from "react";
import { Button } from "@/app/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/popover";
import { Plus } from "lucide-react";

export type SamplingRuleType = "session" | "trace";

interface CreateSamplingRuleProps {
  onSelect?: (type: SamplingRuleType) => void;
}

const CreateSamplingRule: React.FC<CreateSamplingRuleProps> = ({ onSelect }) => {
  const [open, setOpen] = useState(false);

  const showPopup = () => setOpen(true);
  const handleSelect = (type: SamplingRuleType) => {
    setOpen(false);
    if (onSelect) onSelect(type);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="font-display border border-black select-none"
          onClick={showPopup}
        >
          <Plus /> Create rule
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2 w-56" align="end">
        <ul className="flex flex-col gap-1">
          <li
            className="cursor-pointer px-3 py-2 rounded hover:bg-yellow-200/75 font-display text-sm"
            onClick={() => handleSelect("session")}
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') { handleSelect("session") } }}
          >
            Session targeting rule
          </li>
          <li
            className="cursor-pointer px-3 py-2 rounded hover:bg-yellow-200/75 font-display text-sm"
            onClick={() => handleSelect("trace")}
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') { handleSelect("trace") } }}
          >
            Trace sampling rule
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
};

export default CreateSamplingRule;
