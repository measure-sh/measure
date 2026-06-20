import type { Metadata } from "next";
import Link from "next/link";
import { sharedOpenGraph } from "@/app/utils/metadata";
import ForPlatformPage, {
  type PlatformFeature,
} from "../../components/for_platform_page";
import { underlineLinkStyle } from "../../utils/shared_styles";

export const metadata: Metadata = {
  title: "iPadOS Crash Reporting and Performance Monitoring",
  description:
    "Reduce crashes and errors, improve performance and boost app store ratings with iPadOS performance monitoring & crash reporting.",
  alternates: { canonical: "/for/ipados" },
  openGraph: {
    ...sharedOpenGraph,
    title: "iPadOS Crash Reporting and Performance Monitoring | Measure",
    description:
      "Reduce crashes and errors, improve performance and boost app store ratings with iPadOS performance monitoring & crash reporting.",
    url: "/for/ipados",
  },
};

const features: PlatformFeature[] = [
  {
    heading: "Session Timelines",
    image: "/images/product_screenshots/session_timelines.webp",
    imageAlt: "Session timeline for an iPadOS session in Measure",
    body: (
      <>
        Every crash and error on iPad comes with a complete{" "}
        <Link href="/product/session-timelines" className={underlineLinkStyle}>
          Session Timeline
        </Link>{" "}
        you can replay. Walk back through the exact run-up to the failure —
        gestures, screen navigation, network calls, logs and lifecycle events —
        with CPU and memory readings plotted right alongside.
        <br />
        <br />A stack trace only tells you where things broke. The timeline
        shows how your app got there and what the user was doing in the moments
        before failure.
      </>
    ),
  },
  {
    heading: "Detailed Stack Traces",
    image: "/images/product_screenshots/ios_ipad_stacktrace.webp",
    imageAlt:
      "Detailed crash stack trace with all threads for an iPadOS app in Measure",
    body: (
      <>
        Every{" "}
        <Link href="/product/crashes-and-anrs" className={underlineLinkStyle}>
          crash report
        </Link>{" "}
        carries a complete, multi-threaded stack trace, so you can inspect what
        each thread was up to, not just the one that failed.
        <br />
        <br />
        Measure symbolicates them for you, mapping raw memory addresses back to
        the original function names, files and line numbers in your Swift and
        Objective-C code. Upload your dSYMs through the Xcode build phase or
        straight from your .xcarchive and let Measure worry about the
        symbolication so you can stay focused on the fix.
      </>
    ),
  },
  {
    heading: "Performance Monitoring",
    image: "/images/product_screenshots/performance_traces.webp",
    imageAlt: "Performance trace waterfall for an iPadOS app in Measure",
    body: (
      <>
        Wrap the operations that matter in{" "}
        <Link href="/product/performance-traces" className={underlineLinkStyle}>
          Performance Traces
        </Link>
        . See how network requests, disk and database access, expensive code
        paths and the rendering of those larger iPad layouts accumulate within a
        single flow or across millions of sessions with waterfall views that
        make the slow parts obvious.
        <br />
        <br />
        Every trace comes with full device and app context and ties back to its
        session timeline, so a slow span never shows up without the conditions
        that produced it.
      </>
    ),
  },
  {
    heading: "App Health",
    image: "/images/product_screenshots/app_health.webp",
    imageAlt: "App health metrics dashboard for an iPadOS app in Measure",
    body: (
      <>
        Track the health of every release in one place with{" "}
        <Link href="/product/app-health" className={underlineLinkStyle}>
          App Health
        </Link>
        . Monitor adoption, error rates, launch times and more core app metrics
        in one unified view.
        <br />
        <br />
        Notice a shaky rollout early and patch it before it spreads to the rest
        of your users.
      </>
    ),
  },
  {
    heading: "Bug Reports",
    image: "/images/product_screenshots/bug_reports.webp",
    imageAlt: "Bug report with session context for an iPadOS app in Measure",
    body: (
      <>
        Let people report a problem the second they run into it with{" "}
        <Link href="/product/bug-reports" className={underlineLinkStyle}>
          Bug Reports
        </Link>
        , triggered by a shake or from a button you wire up through the SDK.
        Each one packages device details, app version, network conditions and a
        screenshot next to the user&apos;s own description, and allows you to
        jump straight to the matching session timeline.
        <br />
        <br />
        Forget the back-and-forth of email and support tickets. Your users
        explain the issue in their own words and you get every bit of context
        needed to resolve it.
      </>
    ),
  },
  {
    heading: "User Journeys",
    image: "/images/product_screenshots/user_journeys.webp",
    imageAlt: "User journey flow diagram for an iPadOS app in Measure",
    body: (
      <>
        Follow the real paths people take through your app with{" "}
        <Link href="/product/user-journeys" className={underlineLinkStyle}>
          User Journeys
        </Link>
        . Every screen transition is charted automatically into clear flow
        diagrams, and the exception view marks exactly where issues derail those
        flows.
        <br />
        <br />
        Deciding what to fix first? See which routes carry the most users so you
        can unblock the busiest ones ahead of the rest.
      </>
    ),
  },
  {
    heading: "Network Monitoring",
    image: "/images/product_screenshots/network_performance.webp",
    imageAlt: "Network performance monitoring for an iPadOS app in Measure",
    body: (
      <>
        See every request your app makes with{" "}
        <Link
          href="/product/network-performance"
          className={underlineLinkStyle}
        >
          Network Performance
        </Link>
        . Follow how HTTP status codes shift over time and drill into your
        heaviest endpoints ranked by latency, error rate and call volume to find
        the requests degrading your app performance.
        <br />
        <br />
        Catch endpoints going bad early and take care of the API calls your
        users depend on most.
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
        Bring Measure&apos;s full context into the coding agents you already
        work with. The{" "}
        <Link href="/product/mcp" className={underlineLinkStyle}>
          Measure MCP server
        </Link>{" "}
        hands any agent your crashes, performance traces and session timelines,
        directly from your IDE, editor or terminal.
        <br />
        <br />
        Point it at a crash, have it work through user sessions, or build it
        into an agentic triage and debugging pipeline. Whether you&apos;re on
        Claude Code or Codex, or you prefer open source agents and models,
        Measure drops straight into your workflow.
      </>
    ),
  },
];

export default function ForiPadOS() {
  return (
    <ForPlatformPage
      title="Measure for iPadOS"
      logo={{
        src: "/images/ios_logo.svg",
        width: 1235,
        height: 1505,
        className: "h-12 mb-5",
      }}
      intro={
        <>
          Measure is an open source, mobile first monitoring platform with full
          support for iPadOS. It surfaces the complete context behind every
          crash and performance issue to help you cut crash and error rates,
          sharpen performance and keep your iPad app feeling effortless.
        </>
      }
      features={features}
      ctaLocation="for_ipados"
    />
  );
}
