import { parseStacktrace } from "./stacktraceParser";

const isHermesEnabled = (): boolean => !!(global as any).HermesInternal;

/**
 * Rewrites a raw filename from a JS stack frame to the app:// format
 * expected by the sentry-symbolicator.
 *
 * Release builds produce paths like:
 *   iOS:     /var/containers/.../AppName.app/main.jsbundle
 *   Android: index.android.bundle
 *
 * The symbolicator expects:
 *   app:///main.jsbundle
 *   app:///index.android.bundle
 */
function rewriteFilename(filename: string | undefined): string | undefined {
  if (!filename) return filename;

  let rewritten = filename
    .replace(/^file:\/\//, '')
    .replace(/^address at /, '')
    // Strip http(s)://host:port/ prefix from JSC dev-server URLs
    .replace(/^https?:\/\/[^/]*\//, '/')
    // Strip query string left over from dev-server URLs
    .replace(/\?[^/]*$/, '')
    // Strip the native app container path up to and including .app / CodePush dir
    .replace(/^.*\/[^.]+(\.app|CodePush|.*(?=\/))/, '');

  if (rewritten === '[native code]' || rewritten === 'native') {
    return rewritten;
  }

  const appPrefix = 'app://';
  rewritten = rewritten.startsWith('/')
    ? `${appPrefix}${rewritten}`
    : `${appPrefix}/${rewritten}`;

  return rewritten;
}

function isInApp(_filename: string | undefined): boolean {
  return true;
}

/**
 * Hermes bytecode frames always have line === 1 and use col as the bytecode
 * offset. Hermes columns are 0-based; the symbolicator expects 1-based.
 */
function rewriteColumn(line: number | undefined, col: number | undefined): number | undefined {
  if (col === undefined) return undefined;
  if (isHermesEnabled() && line === 1) {
    return col + 1;
  }
  return col;
}

export interface StackFrame {
  binary_name?: string;
  binary_address?: string;
  offset?: number;
  frame_index?: number;
  symbol_address?: string;
  in_app: boolean;
  class_name?: string;
  method_name?: string;
  file_name?: string;
  line_num?: number;
  col_num?: number;
  module_name?: string;
  instruction_address?: string;
}

export interface ExceptionDetail {
  type?: string;
  message?: string;
  frames?: StackFrame[];
  signal?: string;
  thread_name?: string;
  thread_sequence: number;
  os_build_number?: string;
}

export interface ThreadDetail {
  name: string;
  frames: StackFrame[];
  sequence: number;
}

export interface ExceptionPayload {
  severity: 'fatal' | 'handled' | 'unhandled';
  exceptions: ExceptionDetail[];
  foreground: boolean;
  threads?: ThreadDetail[];
  framework: string;
  is_custom: boolean;
  num_code?: number;
  code?: string;
  meta?: Record<string, unknown>;
}

/**
 * Builds a Measure exception payload from an Error or unknown object
 */
export function buildExceptionPayload(
  error: unknown,
  severity: 'fatal' | 'handled' | 'unhandled',
  isCustom: boolean = false
): ExceptionPayload {
  const parsed = parseStacktrace(error);

  const frames: StackFrame[] = parsed.stacktrace.map((frame, idx) => ({
    binary_name: undefined,
    in_app: isInApp(frame.file),
    method_name: frame.function,
    file_name: rewriteFilename(frame.file),
    line_num: frame.line ?? undefined,
    col_num: rewriteColumn(frame.line, frame.column),
    frame_index: idx,
  }));

  const exceptionDetail: ExceptionDetail = {
    type: parsed.type,
    message: parsed.message,
    frames,
    thread_name: "main",
    thread_sequence: 0,
    os_build_number: undefined,
  };

  return {
    severity,
    exceptions: [exceptionDetail],
    foreground: true,
    threads: [],
    framework: "js",
    is_custom: isCustom,
  };
}