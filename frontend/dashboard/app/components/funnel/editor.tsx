"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Plus, X } from "lucide-react";
import Link from "next/link";
import { type SubmitEventHandler, useEffect, useState } from "react";
import type { Funnel, FunnelDraft } from "../../api/api_calls";
import {
  useFunnelEventNamesQuery,
  useSaveFunnelMutation,
} from "../../query/hooks";
import { CONVERSION_WINDOW_UNITS, splitConversionWindow } from "./format";
import { underlineLinkStyle } from "../../utils/shared_styles";
import { Button } from "../button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "../command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../dialog";
import DropdownSelect, { DropdownSelectType } from "../dropdown_select";
import { Input } from "../input";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { toastNegative, toastPositive } from "../toast";

const MIN_FUNNEL_STEPS = 2;
const MAX_FUNNEL_STEPS = 30;
const DEFAULT_CONVERSION_WINDOW_SECONDS = 86_400;
const MIN_CONVERSION_WINDOW_SECONDS = 60;
const MAX_CONVERSION_WINDOW_SECONDS = 30 * 86_400;

function EventPicker({
  appId,
  selected,
  onChange,
}: {
  appId: string;
  selected: string;
  onChange: (eventName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const eventNamesQuery = useFunnelEventNamesQuery(appId, debouncedSearch);

  const changeOpen = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setSearch("");
    }
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className="flex justify-between flex-1 min-w-0 font-body"
        >
          <span
            className={`truncate ${selected === "" ? "text-muted-foreground" : ""}`}
          >
            {selected === "" ? "Select event" : selected}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72" align="start">
        {/* Search is handled by server so we turn it off locally */}
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search events..."
            className="h-10 p-1 border-0 rounded-md focus:ring-0 font-body text-sm"
          />
          <CommandEmpty>
            <div className="text-center px-4 py-2 text-sm text-muted-foreground font-body">
              {eventNamesQuery.isPending ? (
                "Loading..."
              ) : eventNamesQuery.isError ? (
                "Failed to load events"
              ) : debouncedSearch === "" ? (
                <>
                  No custom events were sent in the last 30 days.{" "}
                  <Link
                    href="/docs/custom-events"
                    className={underlineLinkStyle}
                  >
                    Learn how
                  </Link>{" "}
                  to send them from your app.
                </>
              ) : (
                "No events found"
              )}
            </div>
          </CommandEmpty>
          <CommandGroup className="max-h-72 overflow-auto">
            {(eventNamesQuery.data ?? []).map((name) => (
              <CommandItem
                key={name}
                value={name}
                onSelect={() => {
                  onChange(name);
                  changeOpen(false);
                }}
                className="font-body text-sm"
              >
                {name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function draftOf(funnel: Funnel | null): FunnelDraft {
  return funnel === null
    ? {
        name: "",
        steps: [{ event_name: "" }, { event_name: "" }],
        conversion_window_seconds: DEFAULT_CONVERSION_WINDOW_SECONDS,
      }
    : {
        name: funnel.name,
        steps: funnel.steps.map((step) => ({ ...step })),
        conversion_window_seconds: funnel.conversion_window_seconds,
      };
}

function draftProblem(draft: FunnelDraft): string | null {
  if (draft.name.trim() === "") {
    return "Give the funnel a name";
  }
  if (draft.steps.some((step) => step.event_name === "")) {
    return "Select an event for each step";
  }
  const seconds = draft.conversion_window_seconds;
  if (
    seconds < MIN_CONVERSION_WINDOW_SECONDS ||
    seconds > MAX_CONVERSION_WINDOW_SECONDS
  ) {
    return "The conversion window must be between 1 minute and 30 days";
  }
  // The editor can show a saved window only in whole minutes, hours or days.
  if (seconds % 60 !== 0) {
    return "The conversion window must be a whole number of minutes";
  }
  return null;
}

function draftChanged(draft: FunnelDraft, funnel: Funnel | null): boolean {
  if (funnel === null) {
    return true;
  }
  return (
    draft.name.trim() !== funnel.name ||
    draft.conversion_window_seconds !== funnel.conversion_window_seconds ||
    draft.steps.length !== funnel.steps.length ||
    draft.steps.some(
      (step, i) => step.event_name !== funnel.steps[i].event_name,
    )
  );
}

interface FunnelEditorProps {
  appId: string;
  // The funnel to edit, or null to create one.
  funnel: Funnel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (funnel: Funnel) => void;
}

export default function FunnelEditor(props: FunnelEditorProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="bg-background text-foreground sm:max-w-xl">
        {/* Mounted only while open, so every opening starts from the saved
            funnel and drops edits that were cancelled. */}
        {props.open && <FunnelEditorForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function FunnelEditorForm({
  appId,
  funnel,
  onOpenChange,
  onSaved,
}: FunnelEditorProps) {
  const saveFunnel = useSaveFunnelMutation();
  const [draft, setDraft] = useState(() => draftOf(funnel));
  // The amount is stored as the text in the field. A number would turn an
  // empty field into 0, and the user could not clear the field to type a
  // new amount.
  const [windowAmount, setWindowAmount] = useState(() =>
    String(splitConversionWindow(draft.conversion_window_seconds).amount),
  );
  const [windowUnit, setWindowUnit] = useState(
    () => splitConversionWindow(draft.conversion_window_seconds).unit.label,
  );

  const setWindow = (amount: string, unit: string) => {
    setWindowAmount(amount);
    setWindowUnit(unit);
    const seconds = CONVERSION_WINDOW_UNITS.find(
      (u) => u.label === unit,
    )!.seconds;
    setDraft((d) => ({
      ...d,
      conversion_window_seconds: Math.round(Number(amount) * seconds) || 0,
    }));
  };

  const setStep = (index: number, eventName: string) =>
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((step, i) =>
        i === index ? { event_name: eventName } : step,
      ),
    }));

  const moveStep = (index: number, by: number) =>
    setDraft((d) => {
      const steps = [...d.steps];
      const [step] = steps.splice(index, 1);
      steps.splice(index + by, 0, step);
      return { ...d, steps };
    });

  const removeStep = (index: number) =>
    setDraft((d) => ({ ...d, steps: d.steps.filter((_, i) => i !== index) }));

  const addStep = () =>
    setDraft((d) => ({ ...d, steps: [...d.steps, { event_name: "" }] }));

  const problem = draftProblem(draft);
  const changed = draftChanged(draft, funnel);

  const handleSave: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (problem !== null || !changed) {
      return;
    }
    try {
      const saved = await saveFunnel.mutateAsync({
        appId,
        funnelId: funnel?.id ?? null,
        draft: { ...draft, name: draft.name.trim() },
      });
      toastPositive(`Funnel ${saved.name} has been saved`);
      onOpenChange(false);
      onSaved?.(saved);
    } catch (error) {
      toastNegative(
        `Error saving funnel: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">
          {funnel === null ? "Create funnel" : "Edit funnel"}
        </DialogTitle>
        <DialogDescription>
          A user is considered converted when each event is sent in order within
          the conversion window.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSave} className="flex flex-col gap-6 font-body">
        <div className="flex flex-col gap-2">
          <label htmlFor="funnel-name" className="text-sm font-display">
            Name
          </label>
          <Input
            id="funnel-name"
            placeholder="e.g. Checkout"
            value={draft.name}
            maxLength={256}
            onChange={(event) =>
              setDraft((d) => ({ ...d, name: event.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-display">Steps</p>
          {draft.steps.map((step, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-6 text-center text-sm text-muted-foreground">
                {index + 1}
              </span>
              <EventPicker
                appId={appId}
                selected={step.event_name}
                onChange={(eventName) => setStep(index, eventName)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Move step up"
                disabled={index === 0}
                onClick={() => moveStep(index, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Move step down"
                disabled={index === draft.steps.length - 1}
                onClick={() => moveStep(index, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove step"
                disabled={draft.steps.length <= MIN_FUNNEL_STEPS}
                onClick={() => removeStep(index)}
              >
                <X />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit ml-8"
            disabled={draft.steps.length >= MAX_FUNNEL_STEPS}
            onClick={addStep}
          >
            <Plus /> Add step
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="funnel-window" className="text-sm font-display">
            Conversion window
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="funnel-window"
              type="number"
              min={1}
              className="w-24"
              value={windowAmount}
              onChange={(event) => setWindow(event.target.value, windowUnit)}
            />
            <DropdownSelect
              title="Unit"
              type={DropdownSelectType.SingleString}
              items={CONVERSION_WINDOW_UNITS.map((u) => u.label)}
              initialSelected={windowUnit}
              onChangeSelected={(unit) =>
                setWindow(windowAmount, unit as string)
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              type="submit"
              loading={saveFunnel.isPending}
              disabled={saveFunnel.isPending || problem !== null || !changed}
            >
              {funnel === null ? "Create funnel" : "Save changes"}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
          {problem !== null && (
            <p className="text-xs text-muted-foreground">{problem}</p>
          )}
        </div>
      </form>
    </>
  );
}
