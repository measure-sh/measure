"use client";

import dynamic from "next/dynamic";

const BugReport = dynamic(() => import("../../components/bug_report"), {
  ssr: false,
});

export default function BugReportDemo() {
  return <BugReport demo={true} hideDemoTitle={true} />;
}
