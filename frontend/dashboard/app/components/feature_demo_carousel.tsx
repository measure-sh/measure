"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import TabSelect, { TabSize } from "./tab_select";

const BugReport = dynamic(() => import("./bug_report"), { ssr: false });
const UserJourneys = dynamic(() => import("./user_journeys"), { ssr: false });
const Overview = dynamic(() => import("./overview"), { ssr: false });
const TraceDetails = dynamic(() => import("./trace_details"), { ssr: false });
const SessionTimeline = dynamic(() => import("./session_timeline"), {
  ssr: false,
});
const ExceptionsDetails = dynamic(
  () =>
    import("./exceptions_details").then(
      (mod) => mod.ExceptionsDetails as unknown as React.ComponentType<any>,
    ),
  { ssr: false },
);
const NetworkOverview = dynamic(() => import("./network_overview"), {
  ssr: false,
});

const features = [
  {
    title: "Session Timelines",
    description: (
      <>
        Debug issues easily with full session timelines{" "}
        <span aria-hidden="true">🎥</span>. Get rich, complete context with
        automatic tracking for clicks, navigations, logs, http calls, memory
        usage, cpu usage, stacktraces and more.
      </>
    ),
  },
  {
    title: "App Health",
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
    description: (
      <>
        Automatically track Crashes <span aria-hidden="true">💥</span> and ANRs{" "}
        <span aria-hidden="true">⏳</span>. Dive deeper with detailed
        stacktraces, common path analysis, complete session timelines,
        distribution graphs and screenshots.
      </>
    ),
  },
  {
    title: "Performance Traces",
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
      <p className="text-lg leading-relaxed font-body md:w-5xl text-justify px-4">
        {features[featureIndex].description}
      </p>
      <div className="py-2 md:py-4" />

      <div className="relative w-full max-w-[90vw] md:max-w-6xl h-[500px] md:h-[1000px] mx-auto border border-border rounded-lg shadow-xl overflow-hidden">
        {[
          <SessionTimeline
            demo={true}
            hideDemoTitle={false}
            key={`demo-session-timeline`}
          />,
          <Overview demo={true} hideDemoTitle={false} key={`demo-overview`} />,
          <ExceptionsDetails
            demo={true}
            hideDemoTitle={false}
            key={`demo-exceptions`}
          />,
          <TraceDetails demo={true} hideDemoTitle={false} key={`demo-trace`} />,
          <BugReport
            demo={true}
            hideDemoTitle={false}
            key={`demo-bugreport`}
          />,
          <UserJourneys
            demo={true}
            hideDemoTitle={false}
            key={`demo-journeys`}
          />,
          <NetworkOverview
            demo={true}
            hideDemoTitle={false}
            key={`demo-network`}
          />,
        ].map((DemoComponent, idx) => (
          <div
            key={idx}
            aria-hidden={featureIndex !== idx}
            className={`absolute inset-0 w-full h-full transition-opacity duration-300 ease-in-out ${
              featureIndex === idx
                ? "opacity-100 z-20"
                : "opacity-0 pointer-events-none z-10"
            }`}
          >
            <div className="w-[250%] h-[250%] md:w-[125%] md:h-[125%] origin-top-left transform scale-[0.4] md:scale-[0.8]">
              <div className="w-full h-full px-8 py-12 overflow-y-auto">
                {DemoComponent}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
