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
 * Extract trailing `:line:col` from a string using lastIndexOf.
 * O(n), no regex backtracking.
 */
function extractTrailingLineCol(
  s: string
): { prefix: string; line: number; col: number } | null {
  const colSep = s.lastIndexOf(':');
  if (colSep < 1) return null;
  const col = parseInt(s.slice(colSep + 1), 10);
  if (!Number.isFinite(col)) return null;

  const lineSep = s.lastIndexOf(':', colSep - 1);
  if (lineSep < 0) return null;
  const line = parseInt(s.slice(lineSep + 1, colSep), 10);
  if (!Number.isFinite(line)) return null;

  return { prefix: s.slice(0, lineSep), line, col };
}

/**
 * Parse a single stack frame line into a ParsedFrame.
 * Handles V8/Hermes and JSC/Safari formats without regex backtracking.
 */
function parseFrameLine(raw: string): ParsedFrame | null {
  const line = raw.trim();

  // V8/Hermes: "at functionName (file:line:col)" or "at file:line:col"
  if (line.startsWith('at ')) {
    const inner = line.slice(3).trim();

    // "at functionName (file:line:col)"
    if (inner.endsWith(')')) {
      const parenOpen = inner.lastIndexOf('(');
      if (parenOpen !== -1) {
        const fn = inner.slice(0, parenOpen).trim() || '<anonymous>';
        const loc = inner.slice(parenOpen + 1, -1);
        const parsed = extractTrailingLineCol(loc);
        if (parsed) {
          return { function: fn, file: parsed.prefix, line: parsed.line, column: parsed.col };
        }
      }
    }

    // "at file:line:col"
    const parsed = extractTrailingLineCol(inner);
    if (parsed) {
      return { function: '<anonymous>', file: parsed.prefix, line: parsed.line, column: parsed.col };
    }

    return null;
  }

  // JSC/Safari: "functionName@file:line:col"
  const atIdx = line.indexOf('@');
  if (atIdx !== -1) {
    const fn = line.slice(0, atIdx);
    const rest = line.slice(atIdx + 1);
    const parsed = extractTrailingLineCol(rest);
    if (parsed) {
      return { function: fn || '<anonymous>', file: parsed.prefix, line: parsed.line, column: parsed.col };
    }
    return null;
  }

  // JSC/Safari anonymous: "file:line:col" (no 'at' prefix, no '@', no spaces)
  if (!line.includes(' ')) {
    const parsed = extractTrailingLineCol(line);
    if (parsed && parsed.prefix) {
      return { function: '<anonymous>', file: parsed.prefix, line: parsed.line, column: parsed.col };
    }
  }

  return null;
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
