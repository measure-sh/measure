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
  title: "Open Source Firebase Crashlytics Alternative",
  description:
    "Open source alternative to Firebase Crashlytics. Unifies crashes, ANRs, performance, network and full session timelines for mobile engineering teams.",
  alternates: { canonical: "/crashlytics-alternative" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Open Source Firebase Crashlytics Alternative | Measure",
    description:
      "Open source alternative to Firebase Crashlytics. Unifies crashes, ANRs, performance, network and full session timelines for mobile engineering teams.",
    url: "/crashlytics-alternative",
  },
};

const differentiators: AlternativeDifferentiator[] = [
  {
    heading: "Beyond Crashes",
    icon: <LucideLayers className="w-48 h-48 text-indigo-500 p-4" />,
    body: (
      <>
        Crashlytics handles basic crash reporting but requires more tooling to
        complete the mobile app monitoring picture.
        <br />
        <br />
        Want performance traces? You need the Firebase Performance Monitoring
        add-on. Want to understand what the user was doing when the crash
        happened? You&apos;ll need to enable Google Analytics and manually
        instrument breadcrumb logs for every kind of error you care about. Want
        users to report bugs? Buy a third-party tool or hack your own. Want to
        analyze your data? Export it to BigQuery and pay per query. The number
        of SDKs in your app and the tools you need to look at keep expanding.
        <br />
        <br />
        Measure unifies{" "}
        <Link href="/product/crashes-and-anrs" className={underlineLinkStyle}>
          Crashes &amp; ANRs
        </Link>
        ,{" "}
        <Link
          href="/product/network-performance"
          className={underlineLinkStyle}
        >
          Network Performance
        </Link>
        ,{" "}
        <Link href="/product/performance-traces" className={underlineLinkStyle}>
          Performance Traces
        </Link>
        ,{" "}
        <Link href="/product/app-health" className={underlineLinkStyle}>
          App Health
        </Link>
        ,{" "}
        <Link href="/product/bug-reports" className={underlineLinkStyle}>
          Bug Reports
        </Link>{" "}
        and{" "}
        <Link href="/product/user-journeys" className={underlineLinkStyle}>
          User Journeys
        </Link>{" "}
        in one product. Every issue comes with a full Session Timeline which is
        auto collected for you without having to manually instrument every user
        interaction in your app.
        <br />
        <br />
        One SDK, one dashboard, one place to look so you can stop stitching
        context and get to the root cause faster.
      </>
    ),
  },
  {
    heading: "Full session context, not just stack traces",
    icon: <LucideFilm className="w-48 h-48 text-rose-600 p-4" />,
    body: (
      <>
        When a crash hits in Crashlytics you get the stack trace plus breadcrumb
        logs. Those logs are powered by Google Analytics, so screen views are
        captured automatically but anything richer, like taps, navigation
        timing, network calls or lifecycle events, requires error-prone, manual
        instrumentation.
        <br />
        <br />
        Measure auto-captures gestures, navigation, lifecycle events, network
        calls and custom spans, and replays them as a{" "}
        <Link href="/product/session-timelines" className={underlineLinkStyle}>
          Session Timeline
        </Link>{" "}
        attached to every crash, ANR or error.
        <br />
        <br />
        You see exactly what the user did, what the app did and where things
        went wrong, without instrumenting every screen by hand.
      </>
    ),
  },
  {
    heading: "Open source",
    icon: <LucideGitPullRequest className="w-48 h-48 text-sky-500 p-4" />,
    body: (
      <>
        The Crashlytics SDKs are open source on GitHub, but the backend and
        dashboard are closed and run only on Google&apos;s infrastructure. Your
        users&apos; stack traces, device info and any breadcrumbs you log all
        flow through Firebase, and you can&apos;t see or change what happens
        once the data leaves the SDK.
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
        . Read the SDK, read the backend, file issues, contribute fixes. Your
        data is yours, the pipeline is auditable and you can be part of the
        community and help make it better.
      </>
    ),
  },
  {
    heading: "Predictable, transparent pricing",
    icon: <LucideCircleDollarSign className="w-48 h-48 text-green-500 p-4" />,
    body: (
      <>
        Crashlytics itself is free, and if free crash reporting is all you need,
        that&apos;s a good choice. The catch is that going further usually means
        stepping into the rest of the Firebase and GCP price list: BigQuery
        exports for analysis, Cloud Functions for alerting and other paid GCP
        services for anything you want to do with the data.
        <br />
        <br />
        Measure has a single, transparent{" "}
        <Link href="/pricing" className={underlineLinkStyle}>
          price
        </Link>{" "}
        based on how much data you use. No per-seat charges, no hidden product
        bundles. With{" "}
        <Link href="/product/adaptive-capture" className={underlineLinkStyle}>
          Adaptive Capture
        </Link>{" "}
        you can dial collection up or down without rolling out app updates.
      </>
    ),
  },
  {
    heading: "Built for mobile, by mobile devs",
    icon: <LucideSmartphone className="w-48 h-48 text-yellow-500 p-4" />,
    body: (
      <>
        Crashlytics sits inside the larger Firebase suite where mobile is one
        product line among many. The roadmap is opaque, and feature requests
        compete with the priorities of a much bigger platform.
        <br />
        <br />
        Measure is built by a mobile-first team. Every feature, every default
        and every trade-off is shaped by mobile devs solving real production
        issues. The roadmap and issue tracker are public on{" "}
        <TrackGithubLink
          href="https://github.com/measure-sh/measure"
          target="_blank"
          className={underlineLinkStyle}
        >
          GitHub
        </TrackGithubLink>
        . If something is missing, you can file a feature request, keep track of
        updates or send a pull request.
      </>
    ),
  },
];

const comparisonRows: AlternativeComparisonRow[] = [
  {
    feature: "Crash reporting with full session timelines",
    measure: true,
    competitor: "Crash reports with manual breadcrumbs",
  },
  {
    feature: "ANR detection with full session timelines",
    measure: true,
    competitor: "ANRs with manual breadcrumbs",
  },
  {
    feature: "Performance traces without sampling",
    measure: true,
    competitor: "Sampled with no control",
  },
  {
    feature: "Network monitoring without sampling",
    measure: true,
    competitor: "Sampled with no control",
  },
  {
    feature: "User journeys",
    measure: true,
    competitor: "Needs Google Analytics",
  },
  { feature: "In-app bug reports", measure: true, competitor: false },
  {
    feature: "Session timeline on every issue",
    measure: true,
    competitor: false,
  },
  {
    feature: "Dynamic Sampling with Adaptive Capture",
    measure: true,
    competitor: false,
  },
  {
    feature: "Auto-captured context",
    measure: "Gestures, navigation, network, lifecycle",
    competitor:
      "Screen views via Google Analytics but rest needs manual instrumentation",
  },
  {
    feature: "Pricing",
    measure: "Simple pricing on data usage",
    competitor:
      "Free crash reporting but complicated Google Analytics + BigQuery pricing for advanced users",
  },
  {
    feature: "Open Source",
    measure: "Apache 2.0 (OSI open source)",
    competitor: "SDKs only",
  },
  { feature: "Self-hostable", measure: true, competitor: false },
  {
    feature: "Public roadmap & issue tracker",
    measure: true,
    competitor: "SDK repos only",
  },
  {
    feature: "Raw data access",
    measure: "Data export whenever you need it",
    competitor: "BigQuery export only, locking you into Google's ecosystem",
  },
  {
    feature: "Mobile focus",
    measure: true,
    competitor: "One of many Firebase products",
  },
];

export default function CrashlyticsAlternative() {
  return (
    <AlternativePage
      title="Looking for Firebase Crashlytics alternatives?"
      intro={
        <>
          Firebase Crashlytics gives you basic crash reporting but why the crash
          happened, what the user was doing, what state the app was in and all
          the surrounding context is up to you to figure out with additional
          tools.
          <br />
          <br />
          Measure is an open-source Crashlytics alternative that gives you the
          full context you need to fix issues faster.
        </>
      }
      differentiators={differentiators}
      competitorName="Firebase Crashlytics"
      competitorColumnLabel="Crashlytics"
      comparisonRows={comparisonRows}
      ctaLocation="crashlytics_alternative"
    />
  );
}
