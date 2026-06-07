import {
  LucideCircleDollarSign,
  LucideFilm,
  LucideGitPullRequest,
  LucideLayers,
  LucideSmartphone,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { sharedOpenGraph } from "@/app/utils/metadata";
import AlternativePage, {
  type AlternativeComparisonRow,
  type AlternativeDifferentiator,
} from "../components/alternative_page";
import TrackGithubLink from "../components/analytics/track_github_link";
import { underlineLinkStyle } from "../utils/shared_styles";

export const metadata: Metadata = {
  title: "Open Source Luciq (Instabug) Alternative",
  description:
    "Mobile focused open source alternative to Luciq (formerly Instabug). Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.",
  alternates: { canonical: "/luciq-alternative" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Open Source Luciq (Instabug) Alternative | Measure",
    description:
      "Mobile focused open source alternative to Luciq (formerly Instabug). Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.",
    url: "/luciq-alternative",
  },
};

const differentiators: AlternativeDifferentiator[] = [
  {
    heading: "Full session context on every issue",
    icon: <LucideFilm className="w-48 h-48 text-rose-600 p-4" />,
    body: (
      <>
        Measure and Luciq both record full session replays and attach logs,
        network calls, device details and repro steps to the issues you debug,
        so both give you far more than a stack trace.
        <br />
        <br />
        Measure captures gestures, navigation, network calls, lifecycle events
        and custom spans into a full{" "}
        <Link href="/product/session-timelines" className={underlineLinkStyle}>
          Session Timeline
        </Link>{" "}
        on every issue.
        <br />
        <br />
        The difference is transparency. With Measure, you can audit what happens
        to those collected sessions since our entire platform is open source.
        From the SDK to the backend processing and the storage layer, you can
        see what Measure does with your data and verify it yourself. No need for
        blind trust, just read the source.
      </>
    ),
  },
  {
    heading: "Adaptive capture, on your terms",
    icon: <LucideLayers className="w-48 h-48 text-indigo-500 p-4" />,
    body: (
      <>
        Measure captures full session context by default, and with{" "}
        <Link href="/product/adaptive-capture" className={underlineLinkStyle}>
          Adaptive Capture
        </Link>{" "}
        you tune what you collect remotely, without shipping an app update.
        <br />
        <br />
        Luciq does not give you the same remote control to widen capture while
        you chase a tricky bug and then pull it back to keep cost and noise
        down.
        <br />
        <br />
        Turn detail up on a risky release, down afterwards, and change it
        whenever you need to. With Measure, you always stay in control.
      </>
    ),
  },
  {
    heading: "Fully open source",
    icon: <LucideGitPullRequest className="w-48 h-48 text-sky-500 p-4" />,
    body: (
      <>
        Luciq is proprietary. Its SDK is published on GitHub, but under a
        license that forbids modifying it (use as is, all rights reserved), and
        the backend and dashboard are a closed SaaS you can neither run nor
        inspect.
        <br />
        <br />
        Measure is{" "}
        <TrackGithubLink
          href="https://github.com/measure-sh/measure"
          target="_blank"
          className={underlineLinkStyle}
        >
          fully open source
        </TrackGithubLink>
        . Read it, run it, self-host it, audit the pipeline end to end, and if
        something can be done better, send a pull request.
      </>
    ),
  },
  {
    heading: "Simple, predictable pricing",
    icon: <LucideCircleDollarSign className="w-48 h-48 text-green-500 p-4" />,
    body: (
      <>
        Luciq charges per daily active user and per seat, and its public pricing
        routes you to a sales call rather than a number, so what you actually
        pay comes down to a negotiation.
        <br />
        <br />
        Measure has a single, transparent{" "}
        <Link href="/pricing" className={underlineLinkStyle}>
          price
        </Link>{" "}
        based on how much data you use. No per-seat fees, no per-user charges,
        no quote required. With{" "}
        <Link href="/product/adaptive-capture" className={underlineLinkStyle}>
          Adaptive Capture
        </Link>{" "}
        you can tune collection to keep costs in check.
      </>
    ),
  },
  {
    heading: "Built for mobile, by mobile devs",
    icon: <LucideSmartphone className="w-48 h-48 text-yellow-500 p-4" />,
    body: (
      <>
        Luciq, like Measure, is mobile-only, so both are shaped around mobile
        rather than treating it as one platform among many. The difference is
        how they are built and run.
        <br />
        <br />
        Measure is open source and built in the open, with a public roadmap and
        issue tracker, made for mobile developers to read, self-host and extend.{" "}
        <Link href="/product/crashes-and-anrs" className={underlineLinkStyle}>
          Crashes &amp; ANRs
        </Link>
        ,{" "}
        <Link href="/product/app-health" className={underlineLinkStyle}>
          App Health
        </Link>
        ,{" "}
        <Link href="/product/performance-traces" className={underlineLinkStyle}>
          Performance Traces
        </Link>
        ,{" "}
        <Link
          href="/product/network-performance"
          className={underlineLinkStyle}
        >
          Network Performance
        </Link>
        ,{" "}
        <Link href="/product/bug-reports" className={underlineLinkStyle}>
          Bug Reports
        </Link>{" "}
        and{" "}
        <Link href="/product/user-journeys" className={underlineLinkStyle}>
          User Journeys
        </Link>{" "}
        are all shaped only by how mobile apps break in production.
        <br />
        <br />
        Measure is built with the community with constant feedback which we
        strongly believe leads to a better platform.
      </>
    ),
  },
];

const comparisonRows: AlternativeComparisonRow[] = [
  {
    feature: "Crash reporting with full session timelines",
    measure: true,
    competitor: true,
  },
  {
    feature: "ANR detection with full session timelines",
    measure: true,
    competitor: true,
  },
  { feature: "Performance traces", measure: true, competitor: true },
  { feature: "Network monitoring", measure: true, competitor: true },
  { feature: "User journeys", measure: true, competitor: true },
  { feature: "In-app bug reports", measure: true, competitor: true },
  {
    feature: "Session timeline on every issue",
    measure: true,
    competitor: true,
  },
  {
    feature: "Dynamic Sampling with Adaptive Capture",
    measure: true,
    competitor: false,
  },
  {
    feature: "Auto-captured context",
    measure: "Gestures, navigation, network, lifecycle",
    competitor: "Screen changes, interactions, network, logs",
  },
  {
    feature: "Pricing",
    measure: "Simple pricing based on data usage",
    competitor: "Per active user + seat, contact sales",
  },
  {
    feature: "Open Source",
    measure: "Apache 2.0 (OSI open source)",
    competitor: "Proprietary",
  },
  { feature: "Self-hostable", measure: true, competitor: false },
  {
    feature: "Public roadmap & issue tracker",
    measure: true,
    competitor: false,
  },
  { feature: "Mobile focus", measure: true, competitor: true },
];

export default function LuciqAlternative() {
  return (
    <AlternativePage
      title="Looking for Luciq alternatives?"
      intro={
        <>
          Luciq (formerly Instabug) originally started with bug reporting but
          later expanded to become a full mobile observability platform.
          <br />
          <br />
          Measure is a mobile first, open source Luciq alternative.
        </>
      }
      differentiators={differentiators}
      competitorName="Luciq"
      competitorColumnLabel="Luciq"
      comparisonRows={comparisonRows}
      ctaLocation="luciq_alternative"
    />
  );
}
