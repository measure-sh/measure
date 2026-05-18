"use client";

import dynamic from "next/dynamic";

const TraceDetails = dynamic(() => import("../../components/trace_details"), {
  ssr: false,
});

export default function TraceDemo() {
  return <TraceDetails demo={true} hideDemoTitle={true} />;
}
