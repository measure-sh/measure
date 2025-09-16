import { parseStacktrace } from "./stacktraceParser";

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
  handled: boolean;
  exceptions: ExceptionDetail[];
  foreground?: boolean;
  threads?: ThreadDetail[];
  framework?: string;
  error?: unknown;
}

/**
 * Builds a Measure exception payload from an Error or unknown object
 */
export function buildExceptionPayload(
  error: unknown,
  handled: boolean
): ExceptionPayload {
  const parsed = parseStacktrace(error);

  const frames: StackFrame[] = parsed.stacktrace.map((frame, idx) => ({
    binary_name: undefined,
    in_app: false,
    method_name: frame.function,
    file_name: frame.file,
    line_num: frame.line ?? undefined,
    col_num: frame.column ?? undefined,
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

  const thread: ThreadDetail = {
    name: "main",
    frames,
    sequence: 0,
  };

  return {
    handled,
    exceptions: [exceptionDetail],
    foreground: true,
    threads: [thread],
    framework: "js",
  };
}