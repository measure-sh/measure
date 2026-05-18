"use client";

import { Check } from "lucide-react";
import React from "react";
import { cn } from "../utils/shadcn_utils";

interface CheckChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

// A toggleable filter option. Larger hit target and clearer selected state
// than a checkbox, and it stacks horizontally so many options stay scannable.
const CheckChip: React.FC<CheckChipProps> = ({ label, selected, onToggle }) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-xs whitespace-nowrap select-none outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring/50",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {selected && <Check className="h-3 w-3 shrink-0" />}
      {label}
    </button>
  );
};

interface CheckChipGroupProps<T> {
  items: T[];
  selected: T[];
  getLabel: (item: T) => string;
  isEqual: (a: T, b: T) => boolean;
  onChange: (selected: T[]) => void;
}

// Renders a multi-select as a wrapping row of check chips so every option is
// visible at a glance — no dropdown to open.
function CheckChipGroup<T>({
  items,
  selected,
  getLabel,
  isEqual,
  onChange,
}: CheckChipGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => {
        const isSelected = selected.some((s) => isEqual(s, item));
        return (
          <CheckChip
            key={index}
            label={getLabel(item)}
            selected={isSelected}
            onToggle={() =>
              onChange(
                isSelected
                  ? selected.filter((s) => !isEqual(s, item))
                  : [...selected, item],
              )
            }
          />
        );
      })}
    </div>
  );
}

export { CheckChip, CheckChipGroup };
