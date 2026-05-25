"use client";

import { X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { cn } from "../../utils/shadcn_utils";
import {
  formatDateToHumanReadableDateTime,
  formatMillisToHumanReadable,
} from "../../utils/time_utils";
import { Input } from "../input";
import TabSelect from "../tab_select";
import { PreparedSpan, resolveSpanColor, statusLabel } from "./model";

interface FieldRow {
  key: string;
  value: string;
  valueClass?: string;
}

interface TraceSidebarProps {
  span: PreparedSpan | undefined;
  showErrorAsRed: boolean;
  onClose: () => void;
}

const FIELDS_TAB = "Attributes";
const CHECKPOINTS_TAB = "Checkpoints";

const TraceSidebar: React.FC<TraceSidebarProps> = ({
  span,
  showErrorAsRed,
  onClose,
}) => {
  const [tab, setTab] = useState<string>(FIELDS_TAB);
  const [filter, setFilter] = useState("");

  const fields = useMemo<FieldRow[]>(() => {
    if (!span) {
      return [];
    }
    const status = statusLabel(span.status);
    const statusClass =
      span.status === 1
        ? "text-emerald-600 dark:text-emerald-400"
        : span.status === 2
          ? "text-red-600 dark:text-red-400"
          : "";
    const base: FieldRow[] = [
      { key: "Span Name", value: span.span_name },
      { key: "Span Id", value: span.span_id },
      { key: "Parent Id", value: span.parent_id ? span.parent_id : "--" },
      { key: "Thread Name", value: span.thread_name },
      { key: "Span Status", value: status, valueClass: statusClass },
      {
        key: "Start Time",
        value: formatDateToHumanReadableDateTime(span.start_time),
      },
      {
        key: "End Time",
        value: formatDateToHumanReadableDateTime(span.end_time),
      },
      { key: "Duration", value: formatMillisToHumanReadable(span.duration) },
    ];
    if (span.user_defined_attributes) {
      for (const [k, v] of Object.entries(span.user_defined_attributes)) {
        base.push({ key: k, value: v == null ? "" : String(v) });
      }
    }
    return base;
  }, [span]);

  const filteredFields = useMemo(() => {
    if (!filter) {
      return fields;
    }
    const q = filter.toLowerCase();
    return fields.filter(
      (f) =>
        f.key.toLowerCase().includes(q) || f.value.toLowerCase().includes(q),
    );
  }, [fields, filter]);

  const filteredCheckpoints = useMemo(() => {
    if (!span?.checkpoints) {
      return [];
    }
    if (!filter) {
      return span.checkpoints;
    }
    const q = filter.toLowerCase();
    return span.checkpoints.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.timestamp.toLowerCase().includes(q),
    );
  }, [span, filter]);

  if (!span) {
    return null;
  }

  const color = resolveSpanColor(span, showErrorAsRed);
  const checkpointCount = span.checkpoints?.length ?? 0;
  const hasCheckpoints = checkpointCount > 0;

  return (
    <div className="flex flex-col h-full w-full bg-card">
      <div className="flex flex-col gap-2 px-3 py-3 border-b">
        <div className="flex flex-row items-start justify-between gap-2">
          <p
            className="font-display text-sm truncate min-w-0"
            title={span.span_name}
          >
            {span.span_name}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded-sm hover:bg-accent focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
            title="Close"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="flex flex-row items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "inline-block w-2 h-2 rounded-full shrink-0",
              color.bg,
            )}
          />
          <span className="truncate">{span.thread_name}</span>
          <span>•</span>
          <span>{formatMillisToHumanReadable(span.duration)}</span>
        </div>
        <TabSelect
          items={[FIELDS_TAB, CHECKPOINTS_TAB]}
          selected={tab}
          onChangeSelected={setTab}
        />
        <Input
          type="text"
          placeholder={
            tab === CHECKPOINTS_TAB
              ? "Search checkpoints..."
              : "Search attributes..."
          }
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === FIELDS_TAB && (
          <div className="flex flex-col py-1">
            {filteredFields.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground">
                No attributes match the filter.
              </p>
            )}
            {filteredFields.map((f) => (
              <div
                key={f.key}
                className="flex flex-col gap-0.5 px-3 py-2 border-b border-border/40 last:border-b-0"
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground select-none">
                  {f.key}
                </p>
                <p
                  className={cn("text-xs break-words font-code", f.valueClass)}
                >
                  {f.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === CHECKPOINTS_TAB && (
          <div className="flex flex-col py-1">
            <div className="px-3 py-2 flex flex-row items-center gap-2 border-b border-border/40">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground select-none">
                Checkpoints
              </p>
              <span className="text-xs text-muted-foreground">
                {hasCheckpoints ? `: ${checkpointCount}` : ": []"}
              </span>
            </div>
            {filteredCheckpoints.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground">
                {hasCheckpoints
                  ? "No checkpoints match the filter."
                  : "This span has no checkpoints."}
              </p>
            )}
            {filteredCheckpoints.map((c) => (
              <div
                key={c.name + c.timestamp}
                className="flex flex-col gap-1 px-3 py-2 border-b border-border/40 last:border-b-0"
              >
                <div className="flex flex-row items-center gap-2">
                  <span
                    className={cn(
                      "inline-block w-1.5 h-1.5 rounded-full",
                      color.bg,
                    )}
                  />
                  <p className="text-xs font-code break-words">{c.name}</p>
                </div>
                <div className="flex flex-row gap-2 ml-3.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground select-none">
                    Time
                  </p>
                  <p className="text-[11px] font-code break-words text-muted-foreground">
                    {formatDateToHumanReadableDateTime(c.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TraceSidebar;
