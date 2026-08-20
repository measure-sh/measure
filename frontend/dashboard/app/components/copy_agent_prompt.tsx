"use client";

import { ChevronDown, Copy } from "lucide-react";
import { DateTime } from "luxon";
import React, { useState } from "react";
import {
  emptyErrorGroupDetails,
  fetchSessionReplayFromServer,
} from "../api/api_calls";
import { replayEventsFrom, type ReplayEvent } from "../utils/replay_events";
import { formatDateToHumanReadableDateTime } from "../utils/time_utils";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import SimpleTooltip from "./simple_tooltip";
import { Switch } from "./switch";
import { toastNegative, toastPositive } from "./toast";

export interface CopyPromptPreferences {
  includeReplay: boolean;
  replayEventCount: number;
}

const COPY_PROMPT_STORAGE_KEY = "measure-copy-prompt";

const defaultCopyPromptPreferences: CopyPromptPreferences = {
  includeReplay: false,
  replayEventCount: 200,
};

const MIN_REPLAY_EVENT_COUNT = 1;
const MAX_REPLAY_EVENT_COUNT = 10000;

function readCopyPromptPreferences(): CopyPromptPreferences {
  const preferences = { ...defaultCopyPromptPreferences };
  if (typeof window === "undefined") {
    return preferences;
  }
  try {
    const raw = localStorage.getItem(COPY_PROMPT_STORAGE_KEY);
    if (!raw) {
      return preferences;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return preferences;
    }
    if (typeof parsed.includeReplay === "boolean") {
      preferences.includeReplay = parsed.includeReplay;
    }
    if (
      typeof parsed.replayEventCount === "number" &&
      Number.isFinite(parsed.replayEventCount) &&
      parsed.replayEventCount >= MIN_REPLAY_EVENT_COUNT
    ) {
      preferences.replayEventCount = Math.min(
        MAX_REPLAY_EVENT_COUNT,
        Math.floor(parsed.replayEventCount),
      );
    }
    return preferences;
  } catch {
    return preferences;
  }
}

function writeCopyPromptPreferences(preferences: CopyPromptPreferences): void {
  try {
    localStorage.setItem(COPY_PROMPT_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore errors. Best effort.
  }
}

type ErrorEvent = (typeof emptyErrorGroupDetails)["results"][number];

interface CopyAgentPromptProps {
  appId: string;
  appName: string;
  errorEvent: ErrorEvent;
}

const hasValue = (value: unknown): boolean =>
  value !== null && value !== undefined && value !== "";

const formatValue = (value: unknown): string =>
  typeof value === "object" && value !== null
    ? JSON.stringify(value)
    : String(value);

// Renders key/value pairs as a markdown bullet list, dropping empty values.
const bulletList = (entries: [string, unknown][]): string =>
  entries
    .filter(([, value]) => hasValue(value))
    .map(([key, value]) => `- ${key}: ${formatValue(value)}`)
    .join("\n");

// Stack traces and thread dumps go in fenced blocks.
const codeBlock = (content: string): string =>
  "```\n" + content.trim() + "\n```";

const CopyAgentPrompt: React.FC<CopyAgentPromptProps> = ({
  appId,
  appName,
  errorEvent,
}) => {
  const [preferences, setPreferences] = useState(readCopyPromptPreferences);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  // The count field keeps its own text. The stored preference only follows
  // the field when the text parses to a valid count, so an empty or malformed
  // field leaves the last valid value.
  const [countText, setCountText] = useState(() =>
    String(preferences.replayEventCount),
  );
  const countInputId = React.useId();

  const updatePreferences = (update: Partial<CopyPromptPreferences>) => {
    const next = { ...preferences, ...update };
    setPreferences(next);
    writeCopyPromptPreferences(next);
  };

  const onCountChange = (text: string, value: number) => {
    if (!Number.isFinite(value)) {
      setCountText(text);
      return;
    }
    if (value > MAX_REPLAY_EVENT_COUNT) {
      setCountText(String(MAX_REPLAY_EVENT_COUNT));
      updatePreferences({ replayEventCount: MAX_REPLAY_EVENT_COUNT });
      toastPositive(
        `Replay event count set to the maximum of ${MAX_REPLAY_EVENT_COUNT}`,
      );
      return;
    }
    if (value < MIN_REPLAY_EVENT_COUNT) {
      setCountText(String(MIN_REPLAY_EVENT_COUNT));
      updatePreferences({ replayEventCount: MIN_REPLAY_EVENT_COUNT });
      toastPositive(
        `Replay event count set to the minimum of ${MIN_REPLAY_EVENT_COUNT}`,
      );
      return;
    }
    setCountText(text);
    updatePreferences({ replayEventCount: Math.floor(value) });
  };

  // Selects the events described by the prompt up to the error,
  // preserving chronological order. Events after the error are excluded;
  // if all events are after it, the full session is kept.
  const selectReplayEvents = (session: any): ReplayEvent[] => {
    const allEvents = replayEventsFrom(session);
    if (allEvents.length === 0) {
      return [];
    }
    const errorTimeMs = DateTime.fromISO(errorEvent.timestamp, {
      zone: "utc",
    }).toMillis();
    const beforeError = allEvents.filter(
      (event) => event.timeAbsMs <= errorTimeMs,
    );
    const pool = beforeError.length > 0 ? beforeError : allEvents;
    return pool.slice(-Math.max(1, preferences.replayEventCount));
  };

  const buildMarkdown = (replayEvents: ReplayEvent[]) => {
    const title =
      errorEvent.exception?.title ||
      errorEvent.anr?.title ||
      errorEvent.type ||
      "Error";

    const intro =
      "I'm debugging this error in my app. The full context is below.";

    const sections: string[] = [`# ${title}`, intro];

    const summary = bulletList([
      ["app", appName],
      ["type", errorEvent.type],
      ["severity", errorEvent.severity],
      ["message", errorEvent.exception?.message],
      ["code", errorEvent.code],
      ["num_code", errorEvent.num_code],
      ["timestamp", formatDateToHumanReadableDateTime(errorEvent.timestamp)],
      ["session_id", errorEvent.session_id],
      ["event_id", errorEvent.id],
    ]);
    if (summary) {
      sections.push("## Summary\n" + summary);
    }

    const attributes = bulletList(Object.entries(errorEvent.attribute));
    if (attributes) {
      sections.push("## Attributes\n" + attributes);
    }

    if (errorEvent.user_defined_attribute) {
      const userAttributes = bulletList(
        Object.entries(errorEvent.user_defined_attribute),
      );
      if (userAttributes) {
        sections.push("## User-defined attributes\n" + userAttributes);
      }
    }

    if (errorEvent.meta) {
      const meta = bulletList(Object.entries(errorEvent.meta));
      if (meta) {
        sections.push("## Meta\n" + meta);
      }
    }

    const attachments = (errorEvent.attachments ?? [])
      .filter(
        (a) => hasValue(a.name) || hasValue(a.location) || hasValue(a.key),
      )
      .map((a) => `- ${a.name || a.key} (${a.type}): ${a.location || a.key}`)
      .join("\n");
    if (attachments) {
      sections.push("## Attachments\n" + attachments);
    }

    const stacktrace =
      errorEvent.exception?.stacktrace ?? errorEvent.anr?.stacktrace ?? "";
    if (hasValue(stacktrace)) {
      sections.push(
        `## Stack trace (thread: ${errorEvent.attribute.thread_name})\n` +
          codeBlock(stacktrace),
      );
    }

    const threads = (errorEvent.threads ?? []).filter(
      (t) => hasValue(t.name) && t.frames.some(hasValue),
    );
    if (threads.length > 0) {
      const threadBlocks = threads
        .map((t) => `### ${t.name}\n` + codeBlock(t.frames.join("\n")))
        .join("\n\n");
      sections.push("## All threads\n" + threadBlocks);
    }

    if (replayEvents.length > 0) {
      const bullets = replayEvents
        .map(
          (event) =>
            `- ${formatDateToHumanReadableDateTime(event.timestamp)} | ${event.eventType} | ${event.thread} | ${JSON.stringify(event.details)}`,
        )
        .join("\n");
      sections.push(
        "## Session replay events\n" +
          `The latest ${replayEvents.length} replay events recorded before the error, in ascending time order. Each line is timestamp | event type | thread | details JSON.\n` +
          bullets,
      );
    }

    const closing = "Please help me identify the root cause and suggest a fix.";
    sections.push(closing);

    return sections.join("\n\n");
  };

  const handleCopy = async () => {
    try {
      let replayEvents: ReplayEvent[] = [];
      let replayFetchFailed = false;
      if (preferences.includeReplay && hasValue(errorEvent.session_id)) {
        setLoading(true);
        try {
          const session = await fetchSessionReplayFromServer(
            appId,
            errorEvent.session_id,
          );
          replayEvents = session ? selectReplayEvents(session) : [];
        } catch {
          replayFetchFailed = true;
        } finally {
          setLoading(false);
        }
      }
      await navigator.clipboard.writeText(buildMarkdown(replayEvents));
      if (replayFetchFailed) {
        toastPositive("AI context copied without replay events");
      } else {
        toastPositive("AI context copied to clipboard");
      }
    } catch {
      setLoading(false);
      toastNegative("Failed to copy AI context");
    }
  };

  const buttonLabel = "Copy Agent Prompt";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex flex-row items-center">
        <SimpleTooltip content="Copy prompt + context, with optional session replay events, for your coding agent to help you debug this error">
          <Button
            variant="outline"
            className="rounded-r-none"
            loading={loading}
            onClick={handleCopy}
          >
            <Copy />
            {buttonLabel}
          </Button>
        </SimpleTooltip>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-l-none border-l-0"
            disabled={loading}
            aria-label="Copy prompt options"
          >
            <ChevronDown />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="end" className="w-fit p-2">
        <div className="flex flex-row w-full items-center justify-between gap-3">
          <label
            htmlFor={countInputId}
            className="flex flex-row items-center gap-1.5 text-sm text-muted-foreground"
          >
            Include{" "}
            <Input
              id={countInputId}
              type="number"
              min={MIN_REPLAY_EVENT_COUNT}
              max={MAX_REPLAY_EVENT_COUNT}
              className="h-7 w-20 px-2"
              value={countText}
              onChange={(event) =>
                onCountChange(event.target.value, event.target.valueAsNumber)
              }
            />{" "}
            latest available replay events
          </label>
          <Switch
            checked={preferences.includeReplay}
            onCheckedChange={(checked) =>
              updatePreferences({ includeReplay: checked })
            }
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CopyAgentPrompt;
