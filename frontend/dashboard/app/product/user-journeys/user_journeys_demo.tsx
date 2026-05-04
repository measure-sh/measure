"use client";

import dynamic from "next/dynamic";

const UserJourneys = dynamic(() => import("../../components/user_journeys"), {
  ssr: false,
});

export default function UserJourneysDemo() {
  return <UserJourneys demo={true} hideDemoTitle={true} />;
}
