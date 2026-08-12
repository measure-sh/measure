type TraceSource =
  | {
      exception?: { stacktrace: string } | null;
      anr?: { stacktrace: string; art_thread_dump: string } | null;
    }
  | null
  | undefined;

type ErrorTrace = {
  /** The trace to show: the system's thread dump if one arrived, else the SDK's own capture. */
  trace: string;
  /** Whether [trace] is a thread dump, which already covers every thread in the process. */
  isThreadDump: boolean;
};

/**
 * Picks the trace to show for an error. Kept here so the detail page and the AI
 * context cannot drift apart and describe the same error differently.
 */
export function selectErrorTrace(errorEvent: TraceSource): ErrorTrace {
  const artThreadDump = errorEvent?.anr?.art_thread_dump ?? "";
  return {
    trace:
      artThreadDump ||
      errorEvent?.exception?.stacktrace ||
      errorEvent?.anr?.stacktrace ||
      "",
    isThreadDump: artThreadDump !== "",
  };
}
