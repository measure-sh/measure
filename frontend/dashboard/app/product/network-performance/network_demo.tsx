"use client";

import dynamic from "next/dynamic";

const Demo = dynamic(
  () =>
    import("../../components/network_overview").then(
      (m) => m.NetworkOverviewDemo,
    ),
  { ssr: false },
);

export default function NetworkDemo() {
  return <Demo hideTitle />;
}
