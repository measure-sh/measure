import type { GWPASanReport, GWPASanReportStack } from "../api/api_calls";

export type GWPASanReportStackSection = {
  title: string;
  stack: GWPASanReportStack;
};

// Names the thread when it was still running at the crash,
// as thread IDs alone mean little to a reader.
function threadLabel(stack: GWPASanReportStack): string {
  return stack.thread_name
    ? `${stack.thread_name} (${stack.thread_id})`
    : `thread ${stack.thread_id}`;
}

export function gwpAsanReportStackSections(
  report: GWPASanReport,
): GWPASanReportStackSection[] {
  const sections: GWPASanReportStackSection[] = [];
  if (report.deallocation) {
    sections.push({
      title: `Freed by: ${threadLabel(report.deallocation)}`,
      stack: report.deallocation,
    });
  }
  if (report.allocation) {
    sections.push({
      title: `Allocated by: ${threadLabel(report.allocation)}`,
      stack: report.allocation,
    });
  }
  return sections;
}
