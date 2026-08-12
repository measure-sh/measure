"use client";

import { Parentheses, Search } from "lucide-react";
import { useState } from "react";
import type { FilterKey } from "@/app/api/filter_types";
import { Button } from "../button";
import { Input } from "../input";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import TabSelect from "../tab_select";

interface KeyPickerProps {
  keys: FilterKey[];
  keyGroups: string[];
  selected: FilterKey | null;
  onSelect: (key: FilterKey) => void;
  onAddGroup?: () => void;
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "end";
  // Where focus goes when the list closes, for a caller that wants it
  // somewhere other than the control that opened it.
  focusOnClose?: React.RefObject<HTMLElement | null>;
}

export default function KeyPicker({
  keys,
  keyGroups,
  selected,
  onSelect,
  onAddGroup,
  trigger,
  open: controlledOpen,
  onOpenChange,
  align = "start",
  focusOnClose,
}: KeyPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };

  return (
    // modal keeps the TAB key inside the open list, and returns focus to
    // whatever opened it when the list closes.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        // Sized to its content, so an entity with few tabs does not open
        // a box built for many.
        className="p-0 w-auto min-w-96 max-w-[min(32rem,calc(100vw-2rem))]"
        align={align}
        onCloseAutoFocus={
          focusOnClose &&
          ((e) => {
            e.preventDefault();
            focusOnClose.current?.focus();
          })
        }
      >
        <KeyList
          keys={keys}
          keyGroups={keyGroups}
          selected={selected}
          onSelect={(key) => {
            onSelect(key);
            setOpen(false);
          }}
        />

        {onAddGroup && (
          <div className="border-t p-1">
            <button
              type="button"
              data-testid="filter-add-group"
              onClick={() => {
                onAddGroup();
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
            >
              <Parentheses className="h-4 w-4 text-muted-foreground" />
              <span className="font-display text-sm">Add Group</span>
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// This component exists only while the list is open, so the search text and
// the chosen group are cleared every time it closes.
function KeyList({
  keys,
  keyGroups,
  selected,
  onSelect,
}: {
  keys: FilterKey[];
  keyGroups: string[];
  selected: FilterKey | null;
  onSelect: (key: FilterKey) => void;
}) {
  const [search, setSearch] = useState("");
  const searching = search !== "";

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // The chosen group can disappear from the server's list, so the first group
  // stands in.
  const group =
    openGroup && keyGroups.includes(openGroup) ? openGroup : keyGroups[0];

  // A search covers the keys in every group, not only the group on screen.
  const matching = keys.filter((key) => {
    if (!searching) {
      return key.key_group === group;
    }
    const term = search.toLowerCase();
    return (
      key.label.toLowerCase().includes(term) ||
      key.description.toLowerCase().includes(term)
    );
  });

  // Search results can come from several groups, so each group name is shown
  // as a heading. Without a search there is one unnamed section, for the group
  // being browsed.
  const sections: [string, FilterKey[]][] = searching
    ? keyGroups
        .map((name): [string, FilterKey[]] => [
          name,
          matching.filter((key) => key.key_group === name),
        ])
        .filter(([, groupKeys]) => groupKeys.length > 0)
    : [[group ?? "", matching]];

  const found = sections.some(([, groupKeys]) => groupKeys.length > 0);

  return (
    <>
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            autoFocus
            placeholder="Search filters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="filter-key-search"
            className="pl-8 font-body text-sm"
          />
        </div>
      </div>

      {!searching && keyGroups.length > 1 && (
        <TabSelect
          items={keyGroups}
          selected={group ?? ""}
          onChangeSelected={setOpenGroup}
          className="flex-wrap border-b px-2 pb-2"
        />
      )}

      <div className="max-h-80 overflow-auto p-1">
        {!found && (
          <p className="text-center py-2 text-sm text-muted-foreground font-body">
            No filters found
          </p>
        )}

        {sections.map(([name, groupKeys]) => (
          <div key={name}>
            {searching && (
              <p className="px-2 py-1.5 font-display text-xs text-muted-foreground">
                {name}
              </p>
            )}
            {groupKeys.map((key) => (
              <button
                key={key.name}
                type="button"
                onClick={() => onSelect(key)}
                data-testid={`filter-key-${key.name}`}
                className={`flex flex-col items-start gap-0.5 w-full text-left px-2 py-1.5 rounded outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground ${
                  selected?.name === key.name ? "bg-accent" : ""
                }`}
              >
                <span className="font-display text-sm">{key.label}</span>
                <span className="font-body text-xs text-muted-foreground">
                  {key.description}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export function OperatorPicker({
  operators,
  selected,
  operatorLabels,
  onSelect,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  operators: string[];
  selected: string | null;
  operatorLabels: Record<string, string>;
  onSelect: (operator: string) => void;
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="p-1 w-48" align="start">
        <div className="flex flex-col">
          {operators.map((operator) => (
            <Button
              key={operator}
              variant="ghost"
              className={`justify-start font-display text-sm ${
                selected === operator ? "bg-accent" : ""
              }`}
              data-testid={`filter-op-${operator}`}
              onClick={() => {
                onSelect(operator);
                setOpen(false);
              }}
            >
              {operatorLabels[operator] ?? operator}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
