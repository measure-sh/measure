"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState } from "react";
import ScaledPreview from "./scaled_preview";
import TabSelect, { TabSize } from "./tab_select";

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
    heightClassName: "h-[790px]",
    screenshot: {
      src: "/images/product_screenshots/session_replays.webp",
      alt: "A Measure session replay showing the replayed screen alongside a timeline of clicks, navigations and network calls",
      width: 2046,
      height: 1288,
    },
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
    heightClassName: "h-[975px]",
    screenshot: {
      src: "/images/product_screenshots/app_health.webp",
      alt: "The Measure app health dashboard showing crash rate, ANR rate, launch time and app size metrics with trends over time",
      width: 2300,
      height: 1996,
    },
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
    heightClassName: "h-[1000px]",
    screenshot: {
      src: "/images/product_screenshots/crashes_and_anrs.webp",
      alt: "A crash detail view in Measure showing the stacktrace, affected sessions and distribution across devices and app versions",
      width: 2300,
      height: 1996,
    },
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
    heightClassName: "h-[505px]",
    screenshot: {
      src: "/images/product_screenshots/performance_traces.webp",
      alt: "A performance trace in Measure showing parent and child spans laid out as a waterfall chart",
      width: 2280,
      height: 1208,
    },
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
    heightClassName: "h-[660px]",
    screenshot: {
      src: "/images/product_screenshots/bug_reports.webp",
      alt: "A bug report in Measure showing the reporter's screenshot, description and the device and network context captured with it",
      width: 2284,
      height: 1338,
    },
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
    heightClassName: "h-[815px]",
    screenshot: {
      src: "/images/product_screenshots/user_journeys.webp",
      alt: "A user journey graph in Measure showing how users move between screens and which routes are most affected by issues",
      width: 2300,
      height: 1996,
    },
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
    heightClassName: "h-[1000px]",
    screenshot: {
      src: "/images/product_screenshots/network_performance.webp",
      alt: "The Measure network performance view showing HTTP status distribution over time and the slowest endpoints by latency",
      width: 2278,
      height: 1916,
    },
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
      <div className="md:hidden max-w-6xl w-full mx-auto mt-8 px-4 font-body">
        {features.map((feature) => (
          <div key={feature.title} className="mt-24 first:mt-0">
            <h3 className="text-3xl font-display mb-4">{feature.title}</h3>
            <p className="text-justify text-lg">{feature.description}</p>
            <Image
              src={feature.screenshot.src}
              alt={feature.screenshot.alt}
              width={feature.screenshot.width}
              height={feature.screenshot.height}
              sizes="100vw"
              className="mt-8 w-full h-auto rounded-lg border border-border shadow-sm"
            />
          </div>
        ))}
      </div>

      <div className="hidden md:flex w-full items-center justify-center">
        <TabSelect
          size={TabSize.Large}
          items={Object.values(features.map((f) => f.title))}
          selected={features[featureIndex].title}
          onChangeSelected={(item) => {
            setFeatureIndex(features.findIndex((f) => f.title === item));
          }}
        />
      </div>
      <p className="hidden md:block max-w-5xl w-full px-4 my-8 text-justify text-lg font-body">
        {features[featureIndex].description}
      </p>

      <div className="w-full max-w-6xl mx-auto">
        <ScaledPreview heightClassName={features[featureIndex].heightClassName}>
          {demos[featureIndex]}
        </ScaledPreview>
      </div>
    </>
  );
}
