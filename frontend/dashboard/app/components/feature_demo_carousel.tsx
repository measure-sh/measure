"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import TabSelect, { TabSize } from "./tab_select";
import ScaledPreview from "./scaled_preview";

const BugReport = dynamic(() => import("./bug_report"), { ssr: false });
const UserJourneys = dynamic(() => import("./user_journeys"), { ssr: false });
const Overview = dynamic(() => import("./overview"), { ssr: false });
const TraceDetails = dynamic(() => import("./trace/details"), { ssr: false });
const SessionReplay = dynamic(() => import("./session_replay"), {
  ssr: false,
});
const ErrorsDetails = dynamic(
  () =>
    import("./errors_details").then(
      (mod) => mod.ErrorsDetails as unknown as React.ComponentType<any>,
    ),
  { ssr: false },
);
const NetworkOverview = dynamic(() => import("./network_overview"), {
  ssr: false,
});

// Each demo renders at its own natural height; sizing the frame per feature
// keeps short demos from ending in dead space while the tall dashboards stay
// cropped previews. Heights fit the preview's maximum width, where the iframe
// scale is 0.8.
const features = [
  {
    title: "Session Replays",
    heightClassName: "h-[500px] md:h-[790px]",
    description: (
      <>
        Debug issues easily with full session replays{" "}
        <span aria-hidden="true">🎥</span>. Get rich, complete context with
        automatic tracking for clicks, navigations, logs, http calls, memory
        usage, cpu usage, stacktraces and more.
      </>
    ),
  },
  {
    title: "App Health",
    heightClassName: "h-[500px] md:h-[975px]",
    description: (
      <>
        Monitor important metrics to stay on top of app health{" "}
        <span aria-hidden="true">📈</span>. From app adoption to crash rates,
        launch times to app size, quickly see the most important metrics to make
        sure you&apos;re moving in the right direction.
      </>
    ),
  },
  {
    title: "Crashes and ANRs",
    heightClassName: "h-[500px] md:h-[1000px]",
    description: (
      <>
        Automatically track Crashes <span aria-hidden="true">💥</span> and ANRs{" "}
        <span aria-hidden="true">⏳</span>. Dive deeper with detailed
        stacktraces, common path analysis, complete session replays,
        distribution graphs and screenshots.
      </>
    ),
  },
  {
    title: "Performance Traces",
    heightClassName: "h-[500px] md:h-[505px]",
    description: (
      <>
        Analyze app performance with traces and spans{" "}
        <span aria-hidden="true">⚡️</span>. Break down complex operations with
        parent - child hierarchies to figure out bottlenecks and intelligently
        smooth them out.
      </>
    ),
  },
  {
    title: "Bug Reports",
    heightClassName: "h-[500px] md:h-[660px]",
    description: (
      <>
        Capture bug reports with a device shake or SDK function call{" "}
        <span aria-hidden="true">🐞</span>. Get full history of user actions
        leading to the bug along with detailed context of device, network and
        environment. Easily close bug reports when resolved or re-open them if
        needed.
      </>
    ),
  },
  {
    title: "User Journeys",
    heightClassName: "h-[500px] md:h-[815px]",
    description: (
      <>
        Understand how users move through your app{" "}
        <span aria-hidden="true">👣</span>. Use it to prioritize performance
        fixes in the most popular paths, see which routes are most affected by
        issues or see if that new feature you built is gaining traction.
      </>
    ),
  },
  {
    title: "Network Performance",
    heightClassName: "h-[500px] md:h-[1000px]",
    description: (
      <>
        Monitor Network request latency and status codes across your app{" "}
        <span aria-hidden="true">📡</span> . See HTTP status distributions over
        time, find the slowest and most error-prone endpoints and visualize when
        network requests happen during a session.
      </>
    ),
  },
];

export default function FeatureDemoCarousel() {
  const [featureIndex, setFeatureIndex] = useState(0);

  // Indices line up with `features`. Only the active demo is mounted — it's
  // swapped inside the single iframe rendered by ScaledPreview below.
  const demos = [
    <SessionReplay
      demo={true}
      hideDemoTitle={false}
      key="demo-session-replay"
    />,
    <Overview demo={true} hideDemoTitle={false} key="demo-overview" />,
    <ErrorsDetails demo={true} hideDemoTitle={false} key="demo-errors" />,
    <TraceDetails demo={true} hideDemoTitle={false} key="demo-trace" />,
    <BugReport demo={true} hideDemoTitle={false} key="demo-bugreport" />,
    <UserJourneys demo={true} hideDemoTitle={false} key="demo-journeys" />,
    <NetworkOverview demo={true} hideDemoTitle={false} key="demo-network" />,
  ];

  return (
    <>
      <div className="w-full scale-65 md:scale-100 flex items-center justify-center">
        <TabSelect
          size={TabSize.Large}
          items={Object.values(features.map((f) => f.title))}
          selected={features[featureIndex].title}
          onChangeSelected={(item) => {
            setFeatureIndex(features.findIndex((f) => f.title === item));
          }}
        />
      </div>
      <div className="py-2 md:py-4" />
      <p className="text-lg font-body md:w-5xl text-justify px-4">
        {features[featureIndex].description}
      </p>
      <div className="py-2 md:py-4" />

      <div
        className={`relative w-full max-w-[90vw] md:max-w-6xl ${features[featureIndex].heightClassName} mx-auto border border-border rounded-lg shadow-xl overflow-hidden`}
      >
        <ScaledPreview>
          {/* The demos' sticky charts use a -top-12 offset that cancels this
              py-12 padding so they pin flush to the top — keep them in sync. */}
          <div
            key={featureIndex}
            className="bg-background text-foreground min-h-screen px-8 py-12"
          >
            {demos[featureIndex]}
          </div>
        </ScaledPreview>
      </div>
    </>
  );
}
