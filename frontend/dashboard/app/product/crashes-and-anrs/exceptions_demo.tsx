"use client";

import dynamic from "next/dynamic";

const ExceptionsDetails = dynamic(
  () =>
    import("../../components/exceptions_details").then(
      (mod) => mod.ExceptionsDetails as unknown as React.ComponentType<any>,
    ),
  { ssr: false },
);

export default function ExceptionsDemo() {
  return <ExceptionsDetails demo={true} hideDemoTitle={true} />;
}
