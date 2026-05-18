"use client";

import dynamic from "next/dynamic";

const Overview = dynamic(() => import("../../components/overview"), {
  ssr: false,
});

export default function OverviewDemo() {
  return <Overview demo={true} hideDemoTitle={true} />;
}
