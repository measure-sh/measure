"use client";

import { Circle, CircleCheck, Search } from "lucide-react";
import { useState } from "react";
import {
  type FilterValue,
  numberBoxAttributes,
  type ValueSuggestionMode,
} from "@/app/api/filter_types";
import { useFilterValuesQuery } from "@/app/query/hooks";
import DebounceTextInput from "../debounce_text_input";
import { Input } from "../input";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Skeleton } from "../skeleton";

interface ValuePickerProps {
  appId: string;
  entity: string;
  keyName: string;
  valueType: string;
  valueSuggestionMode: ValueSuggestionMode;
  // The operator matches part of a value, so the value is typed even when the
  // key offers a list.
  takesTypedText: boolean;
  // A one-value operator replaces its selection instead of adding to it.
  takesOneValue: boolean;
  selected: FilterValue[];
  onChange: (values: FilterValue[]) => void;
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function ValuePicker({
  appId,
  entity,
  keyName,
  valueType,
  valueSuggestionMode,
  takesTypedText,
  takesOneValue,
  selected,
  onChange,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: ValuePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };

  const listed =
    !takesTypedText &&
    (valueSuggestionMode === "full_list" || valueSuggestionMode === "sample");
  const takesTyped = valueSuggestionMode === "sample";

  const isSelected = (value: FilterValue) =>
    selected.some((chosen) => chosen.text === value.text);

  const toggle = (value: FilterValue) => {
    if (takesOneValue) {
      onChange([value]);
      setOpen(false);
      return;
    }
    if (isSelected(value)) {
      onChange(selected.filter((chosen) => chosen.text !== value.text));
      return;
    }
    onChange([...selected, value]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="p-0 w-auto min-w-72 max-w-[min(24rem,calc(100vw-2rem))]"
        align="start"
      >
        {listed ? (
          <ValueList
            appId={appId}
            entity={entity}
            keyName={keyName}
            takesOneValue={takesOneValue}
            takesTyped={takesTyped}
            selected={selected}
            isSelected={isSelected}
            onToggle={toggle}
          />
        ) : (
          <TypedValue
            initial={selected[0]?.text ?? ""}
            valueType={valueType}
            onApply={(text) => {
              onChange([{ text }]);
              setOpen(false);
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

// The server narrows the list as the person types, so a key with thousands of
// values stays usable.
function ValueList({
  appId,
  entity,
  keyName,
  takesOneValue,
  takesTyped,
  selected,
  isSelected,
  onToggle,
}: {
  appId: string;
  entity: string;
  keyName: string;
  takesOneValue: boolean;
  takesTyped: boolean;
  selected: FilterValue[];
  isSelected: (value: FilterValue) => boolean;
  onToggle: (value: FilterValue) => void;
}) {
  const [search, setSearch] = useState("");

  const query = useFilterValuesQuery(appId, entity, keyName, search);
  const values = query.data?.values ?? [];

  // The list holds only recent values, up to a limit, so what was typed is
  // offered as an option of its own.
  const typed: FilterValue[] =
    takesTyped &&
    search !== "" &&
    !values.some((value) => value.text === search)
      ? [{ text: search }]
      : [];

  // Keep selected values visible even if they aren't in the fetched options, so
  // they can still be removed. Show them only when there is no active search,
  // keeping search results limited to matching options.
  const chosenAndUnlisted =
    search === ""
      ? selected.filter(
          (value) => !values.some((listed) => listed.text === value.text),
        )
      : [];

  return (
    <>
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <DebounceTextInput
            id={`filter-value-search-${keyName}`}
            placeholder="Search values..."
            initialValue=""
            onChange={setSearch}
            className="pl-8 font-body text-sm"
          />
        </div>
      </div>

      <div className="max-h-72 overflow-auto p-1">
        {query.isPending && (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        )}
        {query.isError && (
          <p className="font-body text-sm p-2">
            Couldn&apos;t load values. Close and open this list to try again
          </p>
        )}
        {query.isSuccess &&
          values.length === 0 &&
          typed.length === 0 &&
          chosenAndUnlisted.length === 0 && (
            <p className="font-body text-sm text-muted-foreground p-2">
              No values match
            </p>
          )}
        {[...chosenAndUnlisted, ...typed, ...values].map((value) => (
          <button
            key={value.text}
            type="button"
            role={takesOneValue ? "radio" : "checkbox"}
            aria-checked={isSelected(value)}
            data-testid={`filter-value-${value.text}`}
            onClick={() => onToggle(value)}
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground font-display text-sm"
          >
            <span className="flex items-center justify-center w-4 h-4 shrink-0">
              {isSelected(value) ? (
                <CircleCheck className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4 opacity-50" />
              )}
            </span>
            <span className="truncate">{value.label ?? value.text}</span>
          </button>
        ))}
      </div>

      {query.data?.truncated && (
        <p className="font-body text-xs text-muted-foreground border-t px-3 py-2">
          Showing the first {query.data.values.length}. Keep typing to narrow
        </p>
      )}
    </>
  );
}

// Holds the edit until it is applied, so closing the box without applying
// leaves the value unchanged.
function TypedValue({
  initial,
  valueType,
  onApply,
}: {
  initial: string;
  valueType: string;
  onApply: (text: string) => void;
}) {
  const [typed, setTyped] = useState(initial);
  const numberBox = numberBoxAttributes(valueType);

  return (
    <form
      className="p-2 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (typed.trim() === "") {
          return;
        }
        onApply(typed.trim());
      }}
    >
      <Input
        autoFocus
        {...(numberBox ?? {})}
        type={numberBox ? "number" : "text"}
        value={typed}
        placeholder={numberBox ? "Type a number" : "Type a value"}
        onChange={(e) => setTyped(e.target.value)}
        data-testid="filter-value-input"
      />
      <p className="font-body text-xs text-muted-foreground">
        Press enter to apply
      </p>
    </form>
  );
}
