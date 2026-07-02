import type { Metadata } from "next";
import Link from "next/link";
import { sharedOpenGraph } from "@/app/utils/metadata";
import ForPlatformPage, {
  type PlatformFeature,
} from "../../components/for_platform_page";
import { underlineLinkStyle } from "../../utils/shared_styles";
import { codingAgents } from "../../utils/coding_agents";

export const metadata: Metadata = {
  title: "React Native Error Tracking and Performance Monitoring",
  description:
    "Reduce errors, improve performance and raise app ratings with React Native error tracking & performance monitoring.",
  alternates: { canonical: "/for/react-native" },
  openGraph: {
    ...sharedOpenGraph,
    title: "React Native Error Tracking and Performance Monitoring | Measure",
    description:
      "Reduce errors, improve performance and raise app ratings with React Native error tracking & performance monitoring.",
    url: "/for/react-native",
  },
};

const features: PlatformFeature[] = [
  {
    heading: "Session Timelines",
    image: "/images/product_screenshots/session_timelines.webp",
    imageAlt: "Session timeline for a React Native session in Measure",
    body: (
      <>
        Every error in your React Native app arrives with a complete{" "}
        <Link href="/product/session-timelines" className={underlineLinkStyle}>
          Session Timeline
        </Link>
        . Replay the exact path to the issue — gestures, navigation, network
        calls, logs and lifecycle events — with CPU and memory readings right
        alongside.
        <br />
        <br />
        Rather than piecing together a minified stack trace, you see exactly
        what the user did and how the app behaved in the moments before it
        broke.
      </>
    ),
  },
  {
    heading: "Detailed Stack Traces",
    image: "/images/product_screenshots/react_native_stacktrace.webp",
    imageAlt:
      "Detailed crash stack trace with all threads for a React Native app in Measure",
    body: (
      <>
        Every{" "}
        <Link href="/product/crashes-and-anrs" className={underlineLinkStyle}>
          crash and error
        </Link>{" "}
        comes with a complete stack trace. JavaScript errors are symbolicated
        from your sourcemaps, so you read your own functions, files and line
        numbers instead of minified output, and crashes from the native Android
        and iOS layers are captured and mapped too.
        <br />
        <br />
        Sourcemaps and native mapping files are uploaded automatically, so you
        can let Measure take care of the boring stuff and focus on fixing user
        issues.
      </>
    ),
  },
  {
    heading: "Performance Monitoring",
    image: "/images/product_screenshots/performance_traces.webp",
    imageAlt:
      "Performance trace waterfall for a React Native operation in Measure",
    body: (
      <>
        Put traces around the operations that matter with{" "}
        <Link href="/product/performance-traces" className={underlineLinkStyle}>
          Performance Traces
        </Link>
        . See how network requests, native modules, expensive JavaScript and
        screen rendering stack up within a single user flow or across millions
        of sessions with waterfall charts that make bottlenecks obvious.
        <br />
        <br />
        Each trace carries rich device and app context and links back to the
        full session timeline, so a slow operation always comes with the
        environment it ran in.
      </>
    ),
  },
  {
    heading: "App Health",
    image: "/images/product_screenshots/app_health.webp",
    imageAlt: "App health metrics dashboard for a React Native app in Measure",
    body: (
      <>
        Stay on top of every release with{" "}
        <Link href="/product/app-health" className={underlineLinkStyle}>
          App Health
        </Link>
        . Track adoption, crash-free sessions, app size, and launch times for
        your Android and iOS builds alike.
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
      "Bug report with session context for a React Native app in Measure",
    body: (
      <>
        Let users flag problems the moment they hit them with{" "}
        <Link href="/product/bug-reports" className={underlineLinkStyle}>
          Bug Reports
        </Link>
        , triggered by a device shake or a call to the SDK from your own button.
        Each report bundles device details, app version, network conditions and
        screenshots with the user&apos;s own words, with an easy link straight
        to the matching session timeline.
        <br />
        <br />
        Skip the email threads and support ticket back-and-forth. Your users
        describe the issue and you get all the context you need to solve it.
      </>
    ),
  },
  {
    heading: "User Journeys",
    image: "/images/product_screenshots/user_journeys.webp",
    imageAlt: "User journey flow diagram for a React Native app in Measure",
    body: (
      <>
        See the paths users take through your app with{" "}
        <Link href="/product/user-journeys" className={underlineLinkStyle}>
          User Journeys
        </Link>
        . Every screen transition is mapped automatically into clear flow
        diagrams, and the exception view shows where issues interrupt those
        flows.
        <br />
        <br />
        Short on time? See which paths matter most to your users so you can
        prioritize issues by user traffic.
      </>
    ),
  },
  {
    heading: "Network Monitoring",
    image: "/images/product_screenshots/network_performance.webp",
    imageAlt:
      "Network performance monitoring for a React Native app in Measure",
    body: (
      <>
        Watch every request your app makes with{" "}
        <Link
          href="/product/network-performance"
          className={underlineLinkStyle}
        >
          Network Performance
        </Link>
        . Track HTTP status codes over time and drill into your top endpoints,
        ranked by latency, error rate and request volume, to find the calls
        slowing your app down.
        <br />
        <br />
        Catch degraded endpoints early and tune the API calls that matter most
        to your users.
      </>
    ),
  },
  {
    heading: "Coding Agents",
    logos: codingAgents,
    body: (
      <>
        Bring all of Measure&apos;s context into the coding agents you already
        use. The{" "}
        <Link href="/product/mcp" className={underlineLinkStyle}>
          Measure MCP server
        </Link>{" "}
        gives any agent access to your crashes, errors, performance traces and
        session timelines, straight from your IDE, editor or terminal.
        <br />
        <br />
        Have it dig into a crash, work through user sessions, or wire it into an
        agentic triage and debugging pipeline. Whether you prefer commercial
        tools or open source agents and models, Measure fits right into your
        workflow.
        <br />
        <br />
        Works great with Claude Code, OpenAI Codex, Google Antigravity, Cursor,
        OpenCode, Pi, Devin, Kilo Code, Cline, Roo Code and others.
      </>
    ),
  },
];

export default function ForReactNative() {
  return (
    <ForPlatformPage
      title="Measure for React Native"
      logo={{
        src: "/images/react_native_logo.webp",
        width: 500,
        height: 445,
        className: "h-10 mb-4",
      }}
      intro={
        <>
          Measure is an open source, mobile first monitoring platform built for
          React Native. Whether you use vanilla React Native or Expo, Hermes or
          JavaScriptCore, Measure gives you the full context behind every error
          across your JavaScript and native layers, so you can cut crash rates,
          tighten performance and ship a smoother experience on both Android and
          iOS.
        </>
      }
      features={features}
      ctaLocation="for_react_native"
    />
  );
}
