import React from "react";
import { emptyErrorGroupDetails } from "../api/api_calls";
import { formatDateToHumanReadableDateTime } from "../utils/time_utils";
import { toastPositive } from "../utils/use_toast";
import { Button } from "./button";
import SimpleTooltip from "./simple_tooltip";

type ErrorEvent = (typeof emptyErrorGroupDetails)["results"][number];

interface CopyAiContextProps {
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
// Markdown bullets carry the same data as a JSON object with a fraction of the
// punctuation, which is what makes the output token efficient.
const bulletList = (entries: [string, unknown][]): string =>
  entries
    .filter(([, value]) => hasValue(value))
    .map(([key, value]) => `- ${key}: ${formatValue(value)}`)
    .join("\n");

// Stack traces and thread dumps go in fenced blocks. A code fence preserves the
// multi-line layout without indenting every line (the previous JSON/indented
// format spent tokens on per-line whitespace and escaped newlines).
const codeBlock = (content: string): string =>
  "```\n" + content.trim() + "\n```";

const CopyAiContext: React.FC<CopyAiContextProps> = ({
  appName,
  errorEvent,
}) => {
  const buildMarkdown = () => {
    const title =
      errorEvent.exception?.title ||
      errorEvent.anr?.title ||
      errorEvent.type ||
      "Error";

    const sections: string[] = [
      `# ${title}`,
      "I'm debugging this error in my app. The full context is below.",
    ];

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

    sections.push("Please help me identify the root cause and suggest a fix.");

    return sections.join("\n\n");
  };

  return (
    <SimpleTooltip content="Copy error context as token efficient markdown for your coding agent">
      <Button
        variant="outline"
        onClick={() => {
          navigator.clipboard.writeText(buildMarkdown());
          toastPositive("AI context copied to clipboard");
        }}
      >
        Copy AI Context
      </Button>
    </SimpleTooltip>
  );
};

export default CopyAiContext;
