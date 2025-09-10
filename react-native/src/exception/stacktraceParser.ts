export interface ParsedFrame {
  function?: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface ParsedStacktrace {
  type?: string;
  message?: string;
  stacktrace: ParsedFrame[];
}

/**
 * Regex patterns based on V8-style stack traces (used in RN Hermes & JSC).
 */
const CHROME_REGEX = /^\s*at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)$/;
const CHROME_ALT_REGEX = /^\s*at\s+(.*?):(\d+):(\d+)$/;

/**
 * Parse a single stack frame line into a ParsedFrame.
 */
function parseFrameLine(line: string): ParsedFrame | null {
  let fn: string | undefined;
  let file: string | undefined;
  let lineNum: number | undefined;
  let colNum: number | undefined;

  let match = line.match(CHROME_REGEX);
  if (match) {
    fn = match[1] || "<anonymous>";
    file = match[2];
    lineNum = match[3] ? parseInt(match[3], 10) : undefined;
    colNum = match[4] ? parseInt(match[4], 10) : undefined;
  } else {
    match = line.match(CHROME_ALT_REGEX);
    if (match) {
      fn = "<anonymous>";
      file = match[1];
      lineNum = match[2] ? parseInt(match[2], 10) : undefined;
      colNum = match[3] ? parseInt(match[3], 10) : undefined;
    }
  }

  if (!file) return null;

  return {
    function: fn,
    file,
    line: lineNum,
    column: colNum,
  };
}

/**
 * Parse a JS error into a structured stacktrace
 */
export function parseStacktrace(error: unknown): ParsedStacktrace {
  if (!error) {
    return { type: "UnknownError", message: String(error), stacktrace: [] };
  }

  if (error instanceof Error) {
    const { name, message, stack } = error;

    const frames: ParsedFrame[] =
      stack
        ?.split("\n")
        .slice(1) // skip "Error: message"
        .map(parseFrameLine)
        .filter((f): f is ParsedFrame => f !== null) || [];

    return { type: name, message, stacktrace: frames };
  }

  // Non-Error thrown values (e.g., throw "string")
  return {
    type: typeof error,
    message: String(error),
    stacktrace: [],
  };
}