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
  title: "Open Source Embrace Alternative",
  description:
    "Open source, self-hostable alternative to Embrace. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.",
  alternates: { canonical: "/embrace-alternative" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Open Source Embrace Alternative | Measure",
    description:
      "Open source, self-hostable alternative to Embrace. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.",
    url: "/embrace-alternative",
  },
};

const differentiators: AlternativeDifferentiator[] = [
  {
    heading: "Full session context on every issue",
    icon: <LucideFilm className="w-48 h-48 text-rose-600 p-4" />,
    body: (
      <>
        This is where Embrace and Measure are most alike. Both attach a full
        session view to every crash, ANR and error, and both capture it
        automatically.
        <br />
        <br />
        Measure records gestures, navigation, network calls, lifecycle events
        and custom spans into a full{" "}
        <Link href="/product/session-timelines" className={underlineLinkStyle}>
          Session Timeline
        </Link>{" "}
        on every issue.
        <br />
        <br />
        The difference is what happens to that data. With Measure the SDK and
        the backend that stores your timelines are both open source and run
        wherever you choose, so full session context never means handing your
        sessions to a proprietary system you cannot see inside.
      </>
    ),
  },
  {
    heading: "Adaptive capture, not all-or-nothing",
    icon: <LucideLayers className="w-48 h-48 text-indigo-500 p-4" />,
    body: (
      <>
        Like Measure, Embrace captures full sessions with no sampling, so
        neither makes you trade away data to hit a quota. Where they differ is
        control: Embrace captures everything and bills per session, so full
        fidelity means paying for every session your app generates.
        <br />
        <br />
        Measure captures full session context by default too, but with{" "}
        <Link href="/product/adaptive-capture" className={underlineLinkStyle}>
          Adaptive Capture
        </Link>{" "}
        you tune what you collect remotely, without shipping an app update.
        <br />
        <br />
        Dial up on a risky release, dial down to cut cost or noise. You decide
        how much you collect, and change it whenever you need to.
      </>
    ),
  },
  {
    heading: "Fully open source",
    icon: <LucideGitPullRequest className="w-48 h-48 text-sky-500 p-4" />,
    body: (
      <>
        Embrace open sources its SDKs but the backend and dashboard that ingest,
        store and surface your data are a proprietary SaaS.
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
        . Run the entire stack yourself, audit the pipeline end to end, keep
        your data on your own infrastructure if you choose, and if something can
        be done better, send a pull request.
      </>
    ),
  },
  {
    heading: "Simple, predictable pricing",
    icon: <LucideCircleDollarSign className="w-48 h-48 text-green-500 p-4" />,
    body: (
      <>
        Embrace charges per session which means a session with barely any
        activity matters the same as one with lots of interactions.
        <br />
        <br />
        Measure has a single, transparent{" "}
        <Link href="/pricing" className={underlineLinkStyle}>
          price
        </Link>{" "}
        based on how much data you actually ingest which is a much simpler and
        more practical metric since it relates proportionally to usage of the
        platform without meaningless sessions costing more than they need to.
        With{" "}
        <Link href="/product/adaptive-capture" className={underlineLinkStyle}>
          Adaptive Capture
        </Link>{" "}
        you can also tune collection anytime to keep costs in check.
      </>
    ),
  },
  {
    heading: "Built for mobile, by mobile devs",
    icon: <LucideSmartphone className="w-48 h-48 text-yellow-500 p-4" />,
    body: (
      <>
        Embrace, like Measure, grew through mobile roots. Embrace has since
        expanded into web RUM and broader observability that plugs into backend
        tooling.
        <br />
        <br />
        Measure is mobile first and focused on mobile developers.{" "}
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
        Mobile is not a part of our product, it is the whole product.
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
  { feature: "In-app bug reports", measure: true, competitor: false },
  {
    feature: "Session timeline on every issue",
    measure: true,
    competitor: true,
  },
  {
    feature: "Dynamic Sampling with Adaptive Capture",
    measure: true,
    competitor: "Always-on full capture",
  },
  {
    feature: "Auto-captured context",
    measure: "Gestures, navigation, network, lifecycle",
    competitor: "Taps, views, network, lifecycle",
  },
  {
    feature: "Pricing",
    measure: "Simple pricing based on data usage",
    competitor: "Per session, retention tied to plan",
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
    feature: "Mobile focus",
    measure: true,
    competitor: "Mobile and web",
  },
];

export default function EmbraceAlternative() {
  return (
    <AlternativePage
      title="Looking for Embrace alternatives?"
      intro={
        <>
          Embrace is an observability platform which started out in mobile and
          has expanded to add web support.
          <br />
          <br />
          Measure is a mobile first, open source Embrace alternative.
        </>
      }
      differentiators={differentiators}
      competitorName="Embrace"
      competitorColumnLabel="Embrace"
      comparisonRows={comparisonRows}
      ctaLocation="embrace_alternative"
    />
  );
}
