"use client";

import dynamic from "next/dynamic";

const Demo = dynamic(
  () => import("../../components/journey/overview").then((m) => m.JourneysDemo),
  { ssr: false },
);

export default function UserJourneysDemo() {
  return <Demo hideTitle />;
}
