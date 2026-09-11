"use client";

import dynamic from "next/dynamic";

const Demo = dynamic(
  () => import("../../components/overview").then((m) => m.OverviewDemo),
  { ssr: false },
);

export default function OverviewDemo() {
  return <Demo hideTitle />;
}
