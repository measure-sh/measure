import type { Metadata } from "next";
import Link from "next/link";
import { sharedOpenGraph } from "@/app/utils/metadata";
import ForPlatformPage, {
  type PlatformFeature,
} from "../../components/for_platform_page";
import { underlineLinkStyle } from "../../utils/shared_styles";

export const metadata: Metadata = {
  title: "Android Crash Reporting and Performance Monitoring",
  description:
    "Decrease your crash rates, fix performance issues and improve play store ratings with Android performance monitoring & crash reporting.",
  alternates: { canonical: "/for/android" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Android Crash Reporting and Performance Monitoring | Measure",
    description:
      "Decrease your crash rates, fix performance issues and improve play store ratings with Android performance monitoring & crash reporting.",
    url: "/for/android",
  },
};

const features: PlatformFeature[] = [
  {
    heading: "Session Timelines",
    image: "/images/product_screenshots/session_timelines.webp",
    imageAlt: "Session timeline for an Android session in Measure",
    body: (
      <>
        Every crash and ANR in your Android app arrives with a full{" "}
        <Link href="/product/session-timelines" className={underlineLinkStyle}>
          Session Timeline
        </Link>
        . Replay the exact sequence of events that led to the issue — gestures,
        navigation, network calls, logs and lifecycle events — with CPU and
        memory signals right alongside.
        <br />
        <br />
        Stop guessing from a stack trace and see exactly what the user and the
        app did leading up to the moment things went wrong.
      </>
    ),
  },
  {
    heading: "Detailed Stack Traces",
    image: "/images/product_screenshots/android_stacktrace.webp",
    imageAlt:
      "Detailed crash stack trace with all threads for an Android app in Measure",
    body: (
      <>
        Every{" "}
        <Link href="/product/crashes-and-anrs" className={underlineLinkStyle}>
          crash and ANR
        </Link>{" "}
        comes with a full stack trace captured across every thread, so you can
        figure out what each thread was doing, not just the one that threw the
        error.
        <br />
        <br />
        Stack traces are automatically deobfuscated, mapping minified R8 and
        ProGuard output back to your original class and method names with their
        intact line numbers. Mapping files are automatically uploaded by our
        Gradle plugin so you can focus on fixing issues and let Measure handle
        the boring stuff.
      </>
    ),
  },
  {
    heading: "Performance Monitoring",
    image: "/images/product_screenshots/performance_traces.webp",
    imageAlt: "Performance trace waterfall for an Android operation in Measure",
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
    imageAlt: "App health metrics dashboard for an Android app in Measure",
    body: (
      <>
        Stay on top of every release with{" "}
        <Link href="/product/app-health" className={underlineLinkStyle}>
          App Health
        </Link>
        . Track app adoption, crash-free and ANR-free sessions, error rates as
        your users actually perceive them, app size, and launch times across
        cold, warm and hot starts.
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
    imageAlt: "Bug report with session context for an Android app in Measure",
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
    imageAlt: "User journey flow diagram for an Android app in Measure",
    body: (
      <>
        See the real paths users take through your app with{" "}
        <Link href="/product/user-journeys" className={underlineLinkStyle}>
          User Journeys
        </Link>
        . Every screen transition is mapped automatically into clear flow
        diagrams, and the exception view shows exactly where issues interrupt
        those flows.
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
    imageAlt: "Network performance monitoring for an Android app in Measure",
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
        Bring all of Measure&apos;s context into your favorite coding agents.
        The{" "}
        <Link href="/product/mcp" className={underlineLinkStyle}>
          Measure MCP server
        </Link>{" "}
        gives any coding agent access to your crashes, ANRs, performance traces
        and session timelines, straight from your IDE, editor or terminal.
        <br />
        <br />
        Ask it to help you debug a crash, analyze user sessions or use it to set
        up an agentic issue triage and debug pipeline. Whether you&apos;re team
        Claude Code or Codex, or prefer open source agents and models, Measure
        fits right into your workflows.
      </>
    ),
  },
];

export default function ForAndroid() {
  return (
    <ForPlatformPage
      title="Measure for Android"
      logo={{
        src: "/images/android_logo.svg",
        width: 152,
        height: 89,
        className: "h-10 mb-4",
      }}
      intro={
        <>
          Measure is an open source, mobile first monitoring platform built for
          Android. Measure gives you all the context you need to decrease crash
          rates, increase app performance and deliver smoother experiences for
          your Android app users.
        </>
      }
      features={features}
      ctaLocation="for_android"
    />
  );
}
