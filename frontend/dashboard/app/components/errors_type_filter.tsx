"use client";

import { ChevronsUpDown, Circle, CircleCheck } from "lucide-react";
import React, { useState } from "react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Switch } from "./switch";

interface ErrorsTypeFilterProps {
  selectedErrorTypes: string[];
  customErrorsOnly: boolean;
  onChangeErrorTypes: (types: string[]) => void;
  onChangeCustomErrorsOnly: (custom: boolean) => void;
  showCustomToggle?: boolean;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const ErrorsTypeFilter: React.FC<ErrorsTypeFilterProps> = ({
  selectedErrorTypes,
  customErrorsOnly,
  onChangeErrorTypes,
  onChangeCustomErrorsOnly,
  showCustomToggle = true,
  disabled = false,
  open: controlledOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };

  const errorChecked = selectedErrorTypes.includes("error");
  const anrChecked = selectedErrorTypes.includes("anr");

  const toggleError = (checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...selectedErrorTypes, "error"]))
      : selectedErrorTypes.filter((t) => t !== "error");
    onChangeErrorTypes(next);
    if (!checked && customErrorsOnly) {
      onChangeCustomErrorsOnly(false);
    }
  };

  const toggleAnr = (checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...selectedErrorTypes, "anr"]))
      : selectedErrorTypes.filter((t) => t !== "anr");
    onChangeErrorTypes(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} asChild>
        <Button
          variant="outline"
          className="flex justify-between w-fit min-w-[150px] select-none"
        >
          <span className="truncate">Type</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2 w-64" align="start">
        <div className="flex flex-col">
          <div className="flex items-center px-2 py-2 rounded hover:bg-accent">
            <button
              type="button"
              role="checkbox"
              aria-checked={errorChecked}
              onClick={() => toggleError(!errorChecked)}
              className="flex items-center gap-2 cursor-pointer select-none font-display text-sm flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center justify-center w-4 h-4">
                {errorChecked ? (
                  <CircleCheck className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4 opacity-50" />
                )}
              </span>
              <span className="flex-1 truncate">Error</span>
            </button>
            {showCustomToggle && (
              <label
                className={`flex items-center gap-2 select-none font-display text-xs ml-2 ${
                  errorChecked ? "cursor-pointer" : "opacity-50"
                }`}
              >
                <span className="pr-1">Custom Only</span>
                <Switch
                  disabled={!errorChecked}
                  checked={customErrorsOnly}
                  onCheckedChange={(checked) =>
                    onChangeCustomErrorsOnly(checked === true)
                  }
                />
              </label>
            )}
          </div>
          <button
            type="button"
            role="checkbox"
            aria-checked={anrChecked}
            onClick={() => toggleAnr(!anrChecked)}
            className="flex items-center gap-2 cursor-pointer select-none font-display text-sm px-2 py-2 rounded hover:bg-accent text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center justify-center w-4 h-4">
              {anrChecked ? (
                <CircleCheck className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4 opacity-50" />
              )}
            </span>
            <span className="flex-1 truncate">ANR</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ErrorsTypeFilter;
