"use client";

import dynamic from "next/dynamic";

const SessionTimeline = dynamic(
  () => import("../../components/session_timeline"),
  { ssr: false },
);

export default function SessionTimelineDemo() {
  return <SessionTimeline demo={true} hideDemoTitle={true} />;
}
