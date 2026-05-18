"use client";

import dynamic from "next/dynamic";

const NetworkOverview = dynamic(
  () => import("../../components/network_overview"),
  { ssr: false },
);

export default function NetworkDemo() {
  return <NetworkOverview demo={true} hideDemoTitle={true} />;
}
