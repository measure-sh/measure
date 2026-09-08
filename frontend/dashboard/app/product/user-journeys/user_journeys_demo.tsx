"use client";

import dynamic from "next/dynamic";

const Demo = dynamic(
  () =>
    import("../../components/user_journeys").then((m) => m.UserJourneysDemo),
  { ssr: false },
);

export default function UserJourneysDemo() {
  return <Demo hideTitle />;
}
