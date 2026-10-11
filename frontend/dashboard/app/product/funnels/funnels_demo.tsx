"use client";

import dynamic from "next/dynamic";

const Demo = dynamic(
  () =>
    import("../../components/funnel/details").then((m) => m.FunnelDetailsDemo),
  { ssr: false },
);

export default function FunnelsDemo() {
  return <Demo hideTitle />;
}
