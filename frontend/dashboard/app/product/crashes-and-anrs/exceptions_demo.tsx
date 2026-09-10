"use client";

import dynamic from "next/dynamic";

const ErrorsDetailsView = dynamic(
  () =>
    import("../../components/errors_details").then(
      (mod) => mod.ErrorsDetailsView as unknown as React.ComponentType<any>,
    ),
  { ssr: false },
);

export default function ExceptionsDemo() {
  return <ErrorsDetailsView demo={true} hideDemoTitle={true} />;
}
