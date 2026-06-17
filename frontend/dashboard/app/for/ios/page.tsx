import type { Metadata } from "next";
import Link from "next/link";
import { sharedOpenGraph } from "@/app/utils/metadata";
import ForPlatformPage, {
  type PlatformFeature,
} from "../../components/for_platform_page";
import { underlineLinkStyle } from "../../utils/shared_styles";

export const metadata: Metadata = {
  title: "iOS Crash Reporting and Performance Monitoring",
  description:
    "Reduce crashes and errors, improve performance and get better app store ratings with iOS performance monitoring & crash reporting.",
  alternates: { canonical: "/for/ios" },
  openGraph: {
    ...sharedOpenGraph,
    title: "iOS Crash Reporting and Performance Monitoring | Measure",
    description:
      "Reduce crashes and errors, improve performance and get better app store ratings with iOS performance monitoring & crash reporting.",
    url: "/for/ios",
  },
};

const features: PlatformFeature[] = [
  {
    heading: "Session Timelines",
    image: "/images/product_screenshots/session_timelines.png",
    imageAlt: "Session timeline for an iOS session in Measure",
    body: (
      <>
        Every crash and error in your iOS app gets a complete{" "}
        <Link href="/product/session-timelines" className={underlineLinkStyle}>
          Session Timeline
        </Link>{" "}
        attached. Step back through everything that led up to it — taps and
        gestures, screen navigation, network calls, logs and lifecycle events —
        with CPU and memory readings plotted right beside them.
        <br />
        <br />
        Instead of working backwards from a lone stack trace, you can see
        exactly what the user did and how the app responded in the moments
        before things broke.
      </>
    ),
  },
  {
    heading: "Detailed Stack Traces",
    image: "/images/product_screenshots/ios_ipad_stacktrace.png",
    imageAlt:
      "Detailed crash stack trace with all threads for an iOS app in Measure",
    body: (
      <>
        Every{" "}
        <Link href="/product/crashes-and-anrs" className={underlineLinkStyle}>
          crash report
        </Link>{" "}
        comes with a full stack trace captured across every thread, so you can
        see what each one was doing, not just the thread that crashed.
        <br />
        <br />
        Traces are symbolicated automatically, turning raw memory addresses back
        into the original function names, files and line numbers from your Swift
        and Objective-C sources. Upload your dSYMs through the Xcode build phase
        or straight from your .xcarchive and let Measure handle the
        symbolication so you can stay focused on the fix.
      </>
    ),
  },
  {
    heading: "Performance Monitoring",
    image: "/images/product_screenshots/performance_traces.png",
    imageAlt: "Performance trace waterfall for an iOS operation in Measure",
    body: (
      <>
        Put traces around the operations you care about with{" "}
        <Link href="/product/performance-traces" className={underlineLinkStyle}>
          Performance Traces
        </Link>
        . Watch how network requests, disk and database work, heavy code paths
        and screen rendering add up inside a single user flow or across millions
        of sessions with waterfall charts that make the slow parts jump out.
        <br />
        <br />
        Each trace carries detailed device and app context and links back to the
        full session timeline, so a slow operation always comes with the
        conditions it ran under.
      </>
    ),
  },
  {
    heading: "App Health",
    image: "/images/product_screenshots/app_health.png",
    imageAlt: "App health metrics dashboard for an iOS app in Measure",
    body: (
      <>
        Keep a close eye on every release with{" "}
        <Link href="/product/app-health" className={underlineLinkStyle}>
          App Health
        </Link>
        . Follow adoption, crash-free sessions, the error rates your users
        actually perceive, app size, and launch times across cold, warm and hot
        starts.
        <br />
        <br />
        Catch a bad rollout while it&apos;s still contained and fix it before it
        reaches the rest of your users.
      </>
    ),
  },
  {
    heading: "Bug Reports",
    image: "/images/product_screenshots/bug_reports.png",
    imageAlt: "Bug report with session context for an iOS app in Measure",
    body: (
      <>
        Let users flag problems the instant they hit them with{" "}
        <Link href="/product/bug-reports" className={underlineLinkStyle}>
          Bug Reports
        </Link>
        , triggered by a device shake or from your own button through the SDK.
        Every report bundles device details, app version, network conditions and
        a screenshot together with the user&apos;s note, and links straight to
        the matching session timeline.
        <br />
        <br />
        No more long email threads or support ticket ping-pong. Users describe
        the issue in their own words while you get all the context needed to fix
        it.
      </>
    ),
  },
  {
    heading: "User Journeys",
    image: "/images/product_screenshots/user_journeys.png",
    imageAlt: "User journey flow diagram for an iOS app in Measure",
    body: (
      <>
        Trace the actual routes people take through your app with{" "}
        <Link href="/product/user-journeys" className={underlineLinkStyle}>
          User Journeys
        </Link>
        . Screen-to-screen movement is mapped for you into clear flow diagrams,
        and the exception view shows you where issues degrade those flows.
        <br />
        <br />
        Not sure what to tackle first? See at a glance which paths matter most
        to your users so you can prioritize effectively.
      </>
    ),
  },
  {
    heading: "Network Monitoring",
    image: "/images/product_screenshots/network_performance.png",
    imageAlt: "Network performance monitoring for an iOS app in Measure",
    body: (
      <>
        Keep tabs on every request your app fires with{" "}
        <Link
          href="/product/network-performance"
          className={underlineLinkStyle}
        >
          Network Performance
        </Link>
        . Track how HTTP status codes trend over time and dig into your busiest
        endpoints, ranked by latency, error rate and call volume, to surface the
        requests dragging your app down.
        <br />
        <br />
        Spot failing endpoints early and tune the API calls that matter most to
        your users.
      </>
    ),
  },
  {
    heading: "Coding Agents",
    logos: [
      { src: "/images/coding_agents/claudecode.svg", alt: "Claude Code" },
      { src: "/images/coding_agents/cursor.svg", alt: "Cursor" },
      { src: "/images/coding_agents/codex.svg", alt: "Codex" },
      { src: "/images/coding_agents/gemini.svg", alt: "Gemini CLI" },
      { src: "/images/coding_agents/windsurf.svg", alt: "Windsurf" },
      { src: "/images/coding_agents/cline.svg", alt: "Cline" },
      { src: "/images/coding_agents/opencode.svg", alt: "opencode" },
      { src: "/images/coding_agents/kilocode.svg", alt: "Kilo Code" },
    ],
    body: (
      <>
        Pull all of Measure&apos;s context into the coding agents you already
        use. The{" "}
        <Link href="/product/mcp" className={underlineLinkStyle}>
          Measure MCP server
        </Link>{" "}
        opens up your crashes, performance traces and session timelines to any
        agent, right from your IDE, editor or terminal.
        <br />
        <br />
        Have it dig into a crash, walk through user sessions, or wire it into an
        agentic triage and debugging pipeline. Whether you lean on Claude Code
        or Codex, or prefer open source agents and models, Measure slots
        straight into your workflow.
      </>
    ),
  },
];

export default function ForiOS() {
  return (
    <ForPlatformPage
      title="Measure for iOS"
      logo={{
        src: "/images/ios_logo.svg",
        width: 1235,
        height: 1505,
        className: "h-12 mb-5",
      }}
      intro={
        <>
          Measure is an open source, mobile first monitoring platform built for
          iOS. Measure gives you the full context behind every crash and
          slowdown, so you can decrease crashes and errors, improve performance
          and deliver a smoother experience to your iOS app users.
        </>
      }
      features={features}
      ctaLocation="for_ios"
    />
  );
}
