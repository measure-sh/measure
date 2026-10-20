import type {
  MemoryError,
  MemoryErrorStack,
  MemoryErrorTool,
} from "../api/api_calls";

type MemoryErrorStackSection = {
  title: string;
  stack: MemoryErrorStack;
};

// Names the thread when it was still running at the crash,
// as thread IDs alone mean little to a reader.
function threadLabel(stack: MemoryErrorStack): string {
  return stack.thread_name
    ? `${stack.thread_name} (${stack.thread_id})`
    : `thread ${stack.thread_id}`;
}

const toolNames: Record<MemoryErrorTool, string> = {
  gwp_asan: "GWP-ASan",
  mte: "MTE",
};

export function memoryErrorToolName(tool: MemoryErrorTool): string {
  return toolNames[tool] ?? tool;
}

export function memoryErrorStackSections(
  memoryError: MemoryError,
): MemoryErrorStackSection[] {
  const sections: MemoryErrorStackSection[] = [];
  if (memoryError.deallocation) {
    sections.push({
      title: `Freed by: ${threadLabel(memoryError.deallocation)}`,
      stack: memoryError.deallocation,
    });
  }
  if (memoryError.allocation) {
    sections.push({
      title: `Allocated by: ${threadLabel(memoryError.allocation)}`,
      stack: memoryError.allocation,
    });
  }
  return sections;
}
