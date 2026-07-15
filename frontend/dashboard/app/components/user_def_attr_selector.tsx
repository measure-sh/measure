"use client";

import { ChevronDown } from "lucide-react";
import React, { useEffect, useState } from "react";
import { UdAttrMatcher, UserDefAttr } from "../api/api_calls";
import { cn } from "../utils/shadcn_utils";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "./command";

export type { UdAttrMatcher } from "../api/api_calls";

interface UserDefAttrSelectorProps {
  attrs: UserDefAttr[];
  ops: Map<string, string[]>;
  initialSelected: UdAttrMatcher[];
  onChangeSelected?: (udattrMatchers: UdAttrMatcher[]) => void;
}

// Shared style for the operator and value controls.
const fieldClass =
  "p-1 text-sm bg-background text-foreground border border-border rounded-md w-full outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const fieldDisabledClass = "disabled:pointer-events-none disabled:opacity-50";

// Native select with a flat custom chevron: appearance-none suppresses the
// platform arrow, so the icon keeps the field's look consistent with the
// text and number inputs beside it. The wrapper is block-level so the
// select's w-full resolves against the surrounding column; margins belong
// on the wrapper (via wrapperClassName), not the select, or the chevron
// would anchor to the pre-margin box.
function FieldSelect({
  wrapperClassName,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
}) {
  return (
    <span className={cn("relative block", wrapperClassName)}>
      <select {...props} className={cn(className, "appearance-none pr-7")}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </span>
  );
}

const UserDefAttrSelector: React.FC<UserDefAttrSelectorProps> = ({
  attrs,
  ops,
  initialSelected,
  onChangeSelected,
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [selectedAttrs, setSelectedAttrs] = useState<UserDefAttr[]>(
    initialSelected.map((attr) => ({ key: attr.key, type: attr.type })),
  );

  const getDefaultValue = (type: string) => {
    switch (type) {
      case "bool":
        return false;
      case "string":
        return "";
      default:
        return 0;
    }
  };

  const [selectedKeyOpMap, setSelectedKeyOpMap] = useState<Map<string, string>>(
    () => {
      const map = new Map();
      attrs.forEach((attr) => map.set(attr.key, ops.get(attr.type)![0]));
      initialSelected.forEach((attr) => map.set(attr.key, attr.op));
      return map;
    },
  );
  const [selectedKeyValMap, setSelectedKeyValMap] = useState<
    Map<string, string | number | boolean>
  >(() => {
    const map = new Map();
    attrs.forEach((attr) => map.set(attr.key, getDefaultValue(attr.type)));
    initialSelected.forEach((attr) => map.set(attr.key, attr.value));
    return map;
  });

  const isAttrSelected = (item: UserDefAttr) => {
    return selectedAttrs.some((i) => i.key === item.key);
  };

  const toggleAttr = (attr: UserDefAttr) => {
    setSelectedAttrs((prev) =>
      isAttrSelected(attr)
        ? prev.filter((a) => a.key !== attr.key)
        : [...prev, attr],
    );
  };

  const clearAll = () => setSelectedAttrs([]);

  const updateSelectedOp = (key: string, op: string) => {
    setSelectedKeyOpMap((prev) => new Map(prev).set(key, op));
  };

  const updateSelectedValue = (key: string, val: string | number | boolean) => {
    setSelectedKeyValMap((prev) => new Map(prev).set(key, val));
  };

  const getUdAttrMatchers = (): UdAttrMatcher[] => {
    return selectedAttrs.map((attr) => ({
      key: attr.key,
      type: attr.type,
      op: selectedKeyOpMap.get(attr.key)!,
      value: selectedKeyValMap.get(attr.key)!,
    }));
  };

  useEffect(() => {
    onChangeSelected?.(getUdAttrMatchers());
  }, [selectedAttrs, selectedKeyOpMap, selectedKeyValMap]);

  const renderValueInput = (attr: UserDefAttr) => {
    const value = selectedKeyValMap.get(attr.key);
    const valueClass = cn("sm:ml-2 ml-0", fieldDisabledClass, fieldClass);

    switch (attr.type) {
      case "bool":
        return (
          <FieldSelect
            value={String(value)}
            onChange={(e) =>
              updateSelectedValue(attr.key, e.target.value === "true")
            }
            wrapperClassName="sm:ml-2 ml-0"
            className={cn(fieldDisabledClass, fieldClass)}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </FieldSelect>
        );
      case "int64":
        return (
          <input
            type="number"
            step="1"
            value={value as number}
            onChange={(e) =>
              updateSelectedValue(attr.key, parseInt(e.target.value, 10))
            }
            className={valueClass}
            onClick={(e) => e.stopPropagation()}
          />
        );
      case "float64":
        return (
          <input
            type="number"
            step="0.1"
            value={value as number}
            onChange={(e) =>
              updateSelectedValue(attr.key, parseFloat(e.target.value))
            }
            className={valueClass}
            onClick={(e) => e.stopPropagation()}
          />
        );
      default:
        return (
          <input
            type="text"
            value={value as string}
            onChange={(e) => updateSelectedValue(attr.key, e.target.value)}
            className={valueClass}
            onClick={(e) => e.stopPropagation()}
          />
        );
    }
  };

  const filteredAttrs = attrs.filter((attr) =>
    attr.key.toLowerCase().includes(searchValue.toLowerCase()),
  );

  return (
    <Command className="bg-transparent">
      <div className="flex items-center [&_[cmdk-input-wrapper]]:border-b-0">
        <div className="flex-1">
          <CommandInput
            placeholder="Search..."
            value={searchValue}
            onValueChange={setSearchValue}
            className="h-10 p-1 border border-0 rounded-md focus:ring-0 font-body text-sm"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="mr-2 text-xs text-muted-foreground"
        >
          Clear
        </Button>
      </div>

      <CommandEmpty>
        <div className="text-center py-2 text-sm font-display text-muted-foreground">
          No attributes found
        </div>
      </CommandEmpty>

      <CommandGroup>
        {filteredAttrs.map((attr) => (
          <CommandItem
            key={attr.key}
            onSelect={() => toggleAttr(attr)}
            className="flex flex-col items-start px-4 sm:px-4 px-0 sm:w-full w-fit data-[selected=true]:bg-muted data-[selected=true]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                toggleAttr(attr);
              }
            }}
          >
            <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
              <div className="flex items-center justify-center w-full sm:w-[5%]">
                <Checkbox
                  checked={isAttrSelected(attr)}
                  tabIndex={-1}
                  className="pointer-events-none"
                />
              </div>

              <div className="flex items-center w-full sm:w-[15%]">
                <span className="font-medium truncate">{attr.key}</span>
              </div>

              <div className="flex items-center w-full sm:w-[15%]">
                <span className="sm:ml-2 ml-0 text-xs text-muted-foreground whitespace-nowrap">
                  {attr.type}
                </span>
              </div>

              <div className="flex items-center w-full sm:w-[20%]">
                <FieldSelect
                  value={selectedKeyOpMap.get(attr.key)}
                  onChange={(e) => updateSelectedOp(attr.key, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className={fieldClass}
                >
                  {ops.get(attr.type)!.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </FieldSelect>
              </div>

              <div className="w-full sm:w-[45%]">{renderValueInput(attr)}</div>
            </div>
          </CommandItem>
        ))}
      </CommandGroup>
    </Command>
  );
};

export default UserDefAttrSelector;
