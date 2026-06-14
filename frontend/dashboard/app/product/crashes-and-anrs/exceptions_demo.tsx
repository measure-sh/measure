"use client";

import dynamic from "next/dynamic";

const ErrorsDetails = dynamic(
  () =>
    import("../../components/errors_details").then(
      (mod) => mod.ErrorsDetails as unknown as React.ComponentType<any>,
    ),
  { ssr: false },
);

export default function ExceptionsDemo() {
  return <ErrorsDetails demo={true} hideDemoTitle={true} />;
}
