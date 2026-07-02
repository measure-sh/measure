import type { Metadata } from "next";
import Link from "next/link";
import { sharedOpenGraph } from "@/app/utils/metadata";
import ForPlatformPage, {
  type PlatformFeature,
} from "../../components/for_platform_page";
import { underlineLinkStyle } from "../../utils/shared_styles";
import { codingAgents } from "../../utils/coding_agents";

export const metadata: Metadata = {
  title: "Kotlin Multiplatform Crash Reporting and Performance Monitoring",
  description:
    "Decrease your crash rates, fix performance issues and ship smoother apps with Kotlin Multiplatform performance monitoring & crash reporting.",
  alternates: { canonical: "/for/kmp" },
  openGraph: {
    ...sharedOpenGraph,
    title:
      "Kotlin Multiplatform Crash Reporting and Performance Monitoring | Measure",
    description:
      "Decrease your crash rates, fix performance issues and ship smoother apps with Kotlin Multiplatform performance monitoring & crash reporting.",
    url: "/for/kmp",
  },
};

const features: PlatformFeature[] = [
  {
    heading: "Session Timelines",
    image: "/images/product_screenshots/session_timelines.webp",
    imageAlt: "Session timeline for a Kotlin Multiplatform session in Measure",
    body: (
      <>
        Every crash and error in your Kotlin Multiplatform app comes with a full{" "}
        <Link href="/product/session-timelines" className={underlineLinkStyle}>
          Session Timeline
        </Link>
        . Follow the sequence of events that led to the issue — gestures,
        navigation, network calls, logs and lifecycle events — with CPU and
        memory signals right alongside.
        <br />
        <br />
        Go beyond the stacktrace and see exactly what the user and the app did
        leading up to the moment things went wrong.
      </>
    ),
  },
  {
    heading: "Detailed Stack Traces",
    image: "/images/product_screenshots/android_stacktrace.webp",
    imageAlt:
      "Detailed crash stack trace with all threads for a Kotlin Multiplatform app in Measure",
    body: (
      <>
        Every{" "}
        <Link href="/product/crashes-and-anrs" className={underlineLinkStyle}>
          crash and error
        </Link>{" "}
        comes with a full stack trace captured across every thread, including
        frames from your shared Kotlin code so you know where the crash
        happened.
        <br />
        <br />
        Stack traces are deobfuscated on Android and symbolicated on iOS
        automatically, so you read your original Kotlin classes, methods and
        line numbers instead of minified or raw output. Mapping files are
        uploaded automatically, so you can let Measure handle the boring stuff
        and focus on fixing user issues.
      </>
    ),
  },
  {
    heading: "Performance Monitoring",
    image: "/images/product_screenshots/performance_traces.webp",
    imageAlt:
      "Performance trace waterfall for a Kotlin Multiplatform operation in Measure",
    body: (
      <>
        Instrument the operations that matter most with{" "}
        <Link href="/product/performance-traces" className={underlineLinkStyle}>
          Performance Traces
        </Link>
        . See how API fetches, database calls, expensive code paths and screen
        rendering stack up within a single user flow or across millions of
        sessions with waterfall charts that make bottlenecks obvious.
        <br />
        <br />
        Traces carry rich device and app context linking back to full session
        timelines, so you can tie slow operations to the environment they
        happened in.
      </>
    ),
  },
  {
    heading: "App Health",
    image: "/images/product_screenshots/app_health.webp",
    imageAlt:
      "App health metrics dashboard for a Kotlin Multiplatform app in Measure",
    body: (
      <>
        Stay on top of every release with{" "}
        <Link href="/product/app-health" className={underlineLinkStyle}>
          App Health
        </Link>
        . Track app adoption, crash-free sessions, error rates as your users
        actually perceive them, app size, and launch times across cold, warm and
        hot starts.
        <br />
        <br />
        Spot a bad rollout early and fix it before it reaches the rest of your
        users.
      </>
    ),
  },
  {
    heading: "Bug Reports",
    image: "/images/product_screenshots/bug_reports.webp",
    imageAlt:
      "Bug report with session context for a Kotlin Multiplatform app in Measure",
    body: (
      <>
        Let users report problems the moment they see them with{" "}
        <Link href="/product/bug-reports" className={underlineLinkStyle}>
          Bug Reports
        </Link>
        , triggered by a device shake or a call to the SDK from your own button.
        Each report captures device information, app version, network conditions
        and screenshots alongside the user&apos;s description, and links
        straight to the complete session timeline.
        <br />
        <br />
        Skip the email threads and support ticket back-and-forth. Your users
        describe the issue in their own words and you get all the context you
        need to solve it.
      </>
    ),
  },
  {
    heading: "User Journeys",
    image: "/images/product_screenshots/user_journeys.webp",
    imageAlt:
      "User journey flow diagram for a Kotlin Multiplatform app in Measure",
    body: (
      <>
        See the real paths users take through your app with{" "}
        <Link href="/product/user-journeys" className={underlineLinkStyle}>
          User Journeys
        </Link>
        . Every screen transition is mapped automatically into clear flow
        diagrams, and the exception view shows where issues interrupt those
        flows.
        <br />
        <br />
        Short on time and figuring out what issues to prioritize? Easily see
        which paths are important to users so you can unblock them first.
      </>
    ),
  },
  {
    heading: "Network Monitoring",
    image: "/images/product_screenshots/network_performance.webp",
    imageAlt:
      "Network performance monitoring for a Kotlin Multiplatform app in Measure",
    body: (
      <>
        Watch every request your app makes with{" "}
        <Link
          href="/product/network-performance"
          className={underlineLinkStyle}
        >
          Network Performance
        </Link>
        . See HTTP status code distributions over time and drill into your top
        endpoints ranked by latency, error rate and request frequency to find
        the calls slowing your app down.
        <br />
        <br />
        Catch degraded endpoints early and optimize the API calls that matter
        most to your users.
      </>
    ),
  },
  {
    heading: "Coding Agents",
    logos: codingAgents,
    body: (
      <>
        Bring all of Measure&apos;s context into your favorite coding agents.
        The{" "}
        <Link href="/product/mcp" className={underlineLinkStyle}>
          Measure MCP server
        </Link>{" "}
        gives any coding agent access to your crashes, errors, performance
        traces and session timelines, straight from your IDE, editor or
        terminal.
        <br />
        <br />
        Ask it to help you debug a crash, analyze user sessions or use it to set
        up an agentic issue triage and debug pipeline. Whether you prefer
        commercial tools or open source agents and models, Measure fits right
        into your workflows.
        <br />
        <br />
        Works great with Claude Code, OpenAI Codex, Google Antigravity, Cursor,
        OpenCode, Pi, Devin, Kilo Code, Cline, Roo Code and others.
      </>
    ),
  },
];

export default function ForKmp() {
  return (
    <ForPlatformPage
      title="Measure for Kotlin Multiplatform"
      logo={{
        src: "/images/kmp_logo.svg",
        width: 48,
        height: 48,
        className: "h-10 mb-2",
      }}
      intro={
        <>
          Measure is an open source, mobile first monitoring platform built for
          Kotlin Multiplatform. It brings together the full context behind every
          crash and error across your shared Kotlin code and platform code, so
          you can drive down crash and error rates, smooth out performance
          issues and deliver a delightful experience on both Android and iOS.
        </>
      }
      features={features}
      ctaLocation="for_kmp"
    />
  );
}
