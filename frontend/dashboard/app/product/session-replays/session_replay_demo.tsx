"use client";

import dynamic from "next/dynamic";

const SessionReplay = dynamic(() => import("../../components/session_replay"), {
  ssr: false,
});

export default function SessionReplayDemo() {
  return <SessionReplay demo={true} hideDemoTitle={true} />;
}
