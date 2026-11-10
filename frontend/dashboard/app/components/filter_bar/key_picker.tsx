"use client";

import { Parentheses, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { FilterKey } from "@/app/api/filter_types";
import { useFilterKeysQuery } from "@/app/query/hooks";
import { Button } from "../button";
import { Input } from "../input";
import { Skeleton } from "../skeleton";
import TabSelect from "../tab_select";
import { PickerPopover } from "./picker_popover";

// The group containing the app's user-defined attribute keys.
const customKeyGroup = "Custom";

const noKeyNames: string[] = [];

interface KeyPickerProps {
  appId: string;
  entity: string;
  keys: FilterKey[];
  keyGroups: string[];
  // True when the app has more custom keys than are listed in `keys`.
  customKeysTruncated: boolean;
  selected: FilterKey | null;
  onSelect: (key: FilterKey) => void;
  onAddGroup?: () => void;
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align?: "start" | "end";
  // Where focus goes when the list closes, for a caller that wants it
  // somewhere other than the control that opened it.
  focusOnClose?: React.RefObject<HTMLElement | null>;
  stayOpenWithin?: React.RefObject<HTMLElement | null>;
}

export default function KeyPicker({
  appId,
  entity,
  keys,
  keyGroups,
  customKeysTruncated,
  selected,
  onSelect,
  onAddGroup,
  trigger,
  open,
  onOpenChange,
  align = "start",
  focusOnClose,
  stayOpenWithin,
}: KeyPickerProps) {
  return (
    <PickerPopover
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      // Sized to its content, so an entity with few tabs does not open
      // a box built for many.
      className="p-0 w-auto min-w-96 max-w-[min(32rem,calc(100vw-2rem))]"
      align={align}
      focusOnClose={focusOnClose}
      stayOpenWithin={stayOpenWithin}
    >
      <KeyList
        appId={appId}
        entity={entity}
        keys={keys}
        keyGroups={keyGroups}
        customKeysTruncated={customKeysTruncated}
        selected={selected}
        onSelect={onSelect}
      />

      {onAddGroup && (
        <div className="border-t p-1">
          <button
            type="button"
            data-testid="filter-add-group"
            onClick={onAddGroup}
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
          >
            <Parentheses className="h-4 w-4 text-muted-foreground" />
            <span className="font-display text-sm">Add Group</span>
          </button>
        </div>
      )}
    </PickerPopover>
  );
}

// This component exists only while the list is open, so the search text and
// the chosen group are cleared every time it closes.
function KeyList({
  appId,
  entity,
  keys,
  keyGroups,
  customKeysTruncated,
  selected,
  onSelect,
}: {
  appId: string;
  entity: string;
  keys: FilterKey[];
  keyGroups: string[];
  customKeysTruncated: boolean;
  selected: FilterKey | null;
  onSelect: (key: FilterKey) => void;
}) {
  const [search, setSearch] = useState("");
  const term = search.trim();
  const searching = term !== "";

  const [debouncedTerm, setDebouncedTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), 500);
    return () => clearTimeout(timer);
  }, [term]);

  // When opened from a condition key, start with that key's group.
  // Without a selected key, start with the first group.
  const [openGroup, setOpenGroup] = useState<string | null>(
    selected?.key_group ?? null,
  );

  // The chosen group can disappear from the server's list, so the first group
  // stands in.
  const group =
    openGroup && keyGroups.includes(openGroup) ? openGroup : keyGroups[0];

  // The server searches custom keys because the app may have more than
  // `keys` contains. Fixed keys are already in `keys` and are filtered
  // here as the user types.
  const searchesCustomKeys = searching && keyGroups.includes(customKeyGroup);
  const customKeysQuery = useFilterKeysQuery(
    searchesCustomKeys && debouncedTerm === term ? appId : undefined,
    entity,
    noKeyNames,
    debouncedTerm,
  );
  // While the next search loads, the query keeps the previous response, which
  // may not match the current search text.
  const customKeysLoading =
    searchesCustomKeys &&
    (debouncedTerm !== term ||
      customKeysQuery.isPending ||
      customKeysQuery.isPlaceholderData);
  const customKeysFailed =
    searchesCustomKeys && !customKeysLoading && customKeysQuery.isError;
  const foundCustomKeys =
    searchesCustomKeys && !customKeysLoading && customKeysQuery.isSuccess
      ? customKeysQuery.data.keys.filter(
          (key) => key.key_group === customKeyGroup,
        )
      : [];

  // A search covers the keys in every group, not only the group on screen.
  const loweredTerm = term.toLowerCase();
  const matching = searching
    ? [
        ...keys.filter(
          (key) =>
            key.key_group !== customKeyGroup &&
            (key.label.toLowerCase().includes(loweredTerm) ||
              key.description.toLowerCase().includes(loweredTerm)),
        ),
        ...foundCustomKeys,
      ]
    : keys.filter((key) => key.key_group === group);

  const showsTruncatedNote = searching
    ? !customKeysLoading &&
      (customKeysQuery.data?.custom_keys_truncated ?? false)
    : customKeysTruncated && group === customKeyGroup;
  const customKeyCount = matching.filter(
    (key) => key.key_group === customKeyGroup,
  ).length;

  // Search results can come from several groups, so each group name is shown
  // as a heading. Without a search there is one unnamed section, for the group
  // being browsed.
  const sections = (searching ? keyGroups : [group ?? ""])
    .map((name): [string, FilterKey[]] => [
      name,
      matching.filter((key) => key.key_group === name),
    ])
    .filter(
      ([name, groupKeys]) =>
        groupKeys.length > 0 ||
        (name === customKeyGroup && (customKeysLoading || customKeysFailed)),
    );

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
        {sections.length === 0 && (
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
            {name === customKeyGroup && customKeysLoading && (
              <div className="flex flex-col gap-2 p-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            )}
            {name === customKeyGroup && customKeysFailed && (
              <p className="font-body text-sm p-2">
                Couldn&apos;t load custom filters. Close and open this list to
                try again
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

      {showsTruncatedNote && (
        <p className="font-body text-xs text-muted-foreground border-t px-3 py-2">
          Showing the first {customKeyCount} custom filters. Keep typing to
          narrow
        </p>
      )}
    </>
  );
}

export function OperatorPicker({
  operators,
  selected,
  operatorLabels,
  onSelect,
  trigger,
  open,
  onOpenChange,
  stayOpenWithin,
}: {
  operators: string[];
  selected: string | null;
  operatorLabels: Record<string, string>;
  onSelect: (operator: string) => void;
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stayOpenWithin?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <PickerPopover
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      className="p-1 w-48"
      stayOpenWithin={stayOpenWithin}
    >
      <div className="flex flex-col">
        {operators.map((operator) => (
          <Button
            key={operator}
            variant="ghost"
            className={`justify-start font-display text-sm ${
              selected === operator ? "bg-accent" : ""
            }`}
            data-testid={`filter-op-${operator}`}
            onClick={() => onSelect(operator)}
          >
            {operatorLabels[operator] ?? operator}
          </Button>
        ))}
      </div>
    </PickerPopover>
  );
}
