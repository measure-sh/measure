import type { Metadata } from "next";
import Link from "next/link";
import { sharedOpenGraph } from "@/app/utils/metadata";
import ForPlatformPage, {
  type PlatformFeature,
} from "../../components/for_platform_page";
import { underlineLinkStyle } from "../../utils/shared_styles";

export const metadata: Metadata = {
  title: "Flutter Crash Reporting and Performance Monitoring",
  description:
    "Reduce crashes and error rates, improve performance and get better app ratings with Flutter performance monitoring & crash reporting.",
  alternates: { canonical: "/for/flutter" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Flutter Crash Reporting and Performance Monitoring | Measure",
    description:
      "Reduce crashes and error rates, improve performance and get better app ratings with Flutter performance monitoring & crash reporting.",
    url: "/for/flutter",
  },
};

const features: PlatformFeature[] = [
  {
    heading: "Session Timelines",
    image: "/images/product_screenshots/session_timelines.png",
    imageAlt: "Session timeline for a Flutter session in Measure",
    body: (
      <>
        Every crash and error in your Flutter app comes with a complete{" "}
        <Link href="/product/session-timelines" className={underlineLinkStyle}>
          Session Timeline
        </Link>{" "}
        you can replay. Step back through the exact lead-up — gestures,
        navigation, network calls, logs and lifecycle events — with CPU and
        memory readings plotted right beside them.
        <br />
        <br />
        Instead of reading an out-of-context Dart stack trace, you can see
        exactly what the user did and how the app responded just before things
        went wrong.
      </>
    ),
  },
  {
    heading: "Detailed Stack Traces",
    image: "/images/product_screenshots/flutter_stacktrace.png",
    imageAlt:
      "Detailed crash stack trace with all threads for a Flutter app in Measure",
    body: (
      <>
        Every{" "}
        <Link href="/product/crashes-and-anrs" className={underlineLinkStyle}>
          crash and error
        </Link>{" "}
        carries a complete Dart stack trace, alongside any native crash from the
        Android or iOS side.
        <br />
        <br />
        Stack traces are automatically deobfuscated, mapping both native and
        Dart code to your original class and method names with their intact line
        numbers. Let Measure deal with the tedious part so you can focus on
        debugging issues.
      </>
    ),
  },
  {
    heading: "Performance Monitoring",
    image: "/images/product_screenshots/performance_traces.png",
    imageAlt: "Performance trace waterfall for a Flutter operation in Measure",
    body: (
      <>
        Wrap the operations that matter in{" "}
        <Link href="/product/performance-traces" className={underlineLinkStyle}>
          Performance Traces
        </Link>
        . See how network requests, platform channels, expensive widget builds
        and rendering stack up within a single flow or across millions of
        sessions with waterfall charts that make the slow parts obvious.
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
    image: "/images/product_screenshots/app_health.png",
    imageAlt: "App health metrics dashboard for a Flutter app in Measure",
    body: (
      <>
        Keep a close eye on every release with{" "}
        <Link href="/product/app-health" className={underlineLinkStyle}>
          App Health
        </Link>
        . Follow adoption, crash-free sessions, user perceived error rates, app
        size, and launch times across your Android and iOS builds.
        <br />
        <br />
        Notice a buggy rollout early and fix it before it spreads to the rest of
        your users.
      </>
    ),
  },
  {
    heading: "Bug Reports",
    image: "/images/product_screenshots/bug_reports.png",
    imageAlt: "Bug report with session context for a Flutter app in Measure",
    body: (
      <>
        Let users report a problem the second they notice it with{" "}
        <Link href="/product/bug-reports" className={underlineLinkStyle}>
          Bug Reports
        </Link>
        , triggered by a device shake or from your own button through the SDK.
        Each report packages device details, app version, network conditions and
        a screenshot next to the user&apos;s description, and makes it easy to
        jump straight to the matching session timeline.
        <br />
        <br />
        Forget the email threads and support ticket back-and-forth — your users
        explain the issue in their own words and you get every bit of context
        needed to resolve it.
      </>
    ),
  },
  {
    heading: "User Journeys",
    image: "/images/product_screenshots/user_journeys.png",
    imageAlt: "User journey flow diagram for a Flutter app in Measure",
    body: (
      <>
        Follow the paths people take through your production app with{" "}
        <Link href="/product/user-journeys" className={underlineLinkStyle}>
          User Journeys
        </Link>
        . Every screen transition is charted automatically into clear flow
        diagrams, and the exception view marks exactly where issues derail those
        flows.
        <br />
        <br />
        Deciding what to fix first? See which routes carry the most users so you
        can clear the most frequent blockers.
      </>
    ),
  },
  {
    heading: "Network Monitoring",
    image: "/images/product_screenshots/network_performance.png",
    imageAlt: "Network performance monitoring for a Flutter app in Measure",
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
        heaviest endpoints, ranked by latency, error rate and call volume, to
        find the requests slowing down your app.
        <br />
        <br />
        Catch failing endpoints early and tune the API calls your users depend
        on most.
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
        hands any agent your crashes, errors, performance traces and session
        timelines, directly from your IDE, editor or terminal.
        <br />
        <br />
        Point it at a crash, work through user sessions, or build it into an
        agentic triage and debugging pipeline. Whether you&apos;re on Claude
        Code or Codex, or you prefer open source agents and models, Measure
        drops straight into your workflow.
      </>
    ),
  },
];

export default function ForFlutter() {
  return (
    <ForPlatformPage
      title="Measure for Flutter"
      logo={{
        src: "/images/flutter_logo.svg",
        width: 300,
        height: 371,
        className: "h-10 mb-3",
      }}
      intro={
        <>
          Measure is an open source, mobile first monitoring platform built for
          Flutter. It brings together the full context behind every crash and
          error across your Dart and native code, so you can drive down crash
          and error rates, smooth out performance issues and deliver a
          delightful experience on both Android and iOS.
        </>
      }
      features={features}
      ctaLocation="for_flutter"
    />
  );
}
