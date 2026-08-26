import {
  LucideArrowRightLeft,
  LucideCircleDollarSign,
  LucideFilm,
  LucideGitPullRequest,
  LucideLayers,
  LucideSmartphone,
  LucideUsers,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { pageMetadata } from "@/app/utils/metadata";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/accordion";
import {
  type AlternativeComparisonRow,
  ComparisonCell,
} from "../components/alternative_page";
import TrackCtaLink from "../components/analytics/track_cta_link";
import TrackGithubLink from "../components/analytics/track_github_link";
import { buttonVariants } from "../components/button_variants";
import JsonLd from "../components/json_ld";
import LandingFooter from "../components/landing_footer";
import LandingHeader from "../components/landing_header";
import { faqPageJsonLd, webPageJsonLd } from "../utils/json_ld";
import { cn } from "../utils/shadcn_utils";
import { underlineLinkStyle } from "../utils/shared_styles";

const seo = {
  title: "Firebase Crashlytics Alternative - Open Source",
  description:
    "Measure is the open-source, Firebase Crashlytics alternative for mobile - crashes, ANRs, performance and full session replays for mobile engineering teams with simple pricing.",
  path: "/crashlytics-alternative",
};

export const metadata: Metadata = pageMetadata(seo);

const comparisonRows: AlternativeComparisonRow[] = [
  {
    feature: "Crash reporting",
    measure: "Yes, with Session Replay on every crash",
    competitor: "Yes, with manually instrumented breadcrumbs",
  },
  {
    feature: "ANR detection",
    measure: "Yes, with Session Replay attached",
    competitor: "Yes, with manually instrumented breadcrumbs",
  },
  {
    feature: "Session context on every issue",
    measure: "Auto-captured",
    competitor: "Manual breadcrumbs",
  },
  {
    feature: "Session Replay",
    measure: "Yes, on every issue",
    competitor: false,
  },
  {
    feature: "Auto-captured context",
    measure: "Gestures, navigation, network calls, lifecycle events",
    competitor: "Screen views when Google Analytics is enabled; rest is manual",
  },
  {
    feature: "Network monitoring",
    measure: "Yes, with full dynamic sampling control",
    competitor:
      "Separate Firebase Performance Monitoring product, with no user-controlled sampling",
  },
  {
    feature: "Performance traces",
    measure: "Yes, with full dynamic sampling control",
    competitor:
      "Separate Firebase Performance Monitoring product, with no user-controlled sampling",
  },
  {
    feature: "In-app bug reports",
    measure: true,
    competitor: "No, needs a third-party tool",
  },
  {
    feature: "User journeys",
    measure: true,
    competitor: "Requires Google Analytics",
  },
  {
    feature: "Open source",
    measure: "Yes, Apache 2.0 end to end",
    competitor: "SDKs only; backend and dashboard are proprietary",
  },
  { feature: "Self-hostable", measure: true, competitor: false },
  {
    feature: "Public roadmap and issue tracker",
    measure: true,
    competitor: "SDK repositories only",
  },
  {
    feature: "Raw data export",
    measure: "To any destination, in Enterprise plans",
    competitor: "Paid export to BigQuery only",
  },
  {
    feature: "Platforms",
    measure:
      "Android, iOS, iPadOS, Flutter, React Native, Kotlin Multiplatform",
    competitor: "Apple platforms, Android, Flutter, Unity",
  },
  {
    feature: "Product focus",
    measure: "Mobile only",
    competitor: "One of many Firebase products",
  },
];

const faqs = [
  {
    question: "Is there an open-source alternative to Firebase Crashlytics?",
    answer:
      "Yes. Measure is a fully open-source alternative to Firebase Crashlytics, licensed under Apache 2.0. Crashlytics publishes its SDKs as open source, but its backend and dashboard are proprietary. Measure's entire stack is open, so you can read the code, self-host it and audit how data is collected and stored. It covers crashes, ANRs, performance, network monitoring and session context, and is built only for mobile.",
  },
  {
    question: "Is Firebase Crashlytics open source?",
    answer:
      "Partially. The Crashlytics SDKs are open source on GitHub, but the backend and dashboard are closed and run only on Google's infrastructure. That means you cannot self-host Crashlytics, run its servers yourself, or audit the full ingestion pipeline. If an end-to-end open-source stack matters to your team, Measure is 100% open source.",
  },
  {
    question: "Is Firebase Crashlytics free?",
    answer:
      "Yes. Crashlytics crash reporting is free to use. Costs start when you go further: Exporting your data to BigQuery for custom analysis and Cloud Functions for custom alerting are separately billed services. Measure has a single usage-based price and generous free tier to get you started.",
  },
  {
    question: "Is Measure free?",
    answer:
      "Measure has a generous free tier which is sufficient for most small teams and solo developers. For teams hitting scale, we offer a pro plan with a simple usage-based pricing.",
  },
  {
    question: "Does Firebase Crashlytics report ANRs?",
    answer:
      "Yes, for Android apps. Crashlytics collects ANRs and attaches breadcrumbs if you've taken the time to manually instrument them. Measure reports ANRs with a Session Replay attached, so you can see the user interactions and device activity that lead to them making debugging easier.",
  },
  {
    question: "Can Measure replace Firebase Crashlytics?",
    answer:
      "Yes, it can. Measure covers the core Crashlytics job of crash and ANR reporting, and adds session context, network monitoring, performance traces and in-app bug reports in the same SDK. You can run both side by side during evaluation. Teams that only need free crash reporting inside the Google ecosystem may still prefer Crashlytics but for teams looking for advanced mobile performance monitoring and issue debugging, Measure offers a better platform.",
  },
  {
    question:
      "Does Measure support Android, iOS, Flutter, React Native and Kotlin Multiplatform?",
    answer:
      "Yes. Measure has SDKs for Android, iOS, iPadOS, Flutter, React Native and Kotlin Multiplatform. Crashes, ANRs, performance traces, network monitoring and session context all feed into one dashboard, so cross-platform teams can monitor and debug in one unified tool.",
  },
  {
    question:
      "Does Measure support Claude Code, Codex, Pi, OpenCode and other coding agents?",
    answer:
      "Yes. Measure has an MCP server that is specifically designed to give your coding agents deep app context so they can help you fix issues faster. You can also set up automated workflows such as loops to have your agents fix issues on their own using the MCP integration.",
  },
  {
    question: "Can Measure be self-hosted?",
    answer:
      "Yes. Because Measure is open source under Apache 2.0, you can self-host the entire stack, backend and dashboard included, on infrastructure you control. Crashlytics cannot be self-hosted, since its backend is proprietary. Self-hosting keeps crash and real-user session data in your own environment, which certain terms need. Our hosted cloud option is a better option for most teams who would rather not manage and scale the platform themselves.",
  },
];

function SideIconSection({
  heading,
  icon,
  children,
}: {
  heading: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row w-full items-center gap-8 mt-24">
      <div className="flex flex-col flex-1">
        <h2 className="text-3xl font-display mb-4">{heading}</h2>
        <div className="text-justify text-lg space-y-6">{children}</div>
      </div>
      <div className="flex items-center justify-center w-full md:w-64 shrink-0">
        {icon}
      </div>
    </div>
  );
}

export default function CrashlyticsAlternative() {
  return (
    <main className="flex flex-col items-center justify-between">
      <JsonLd data={webPageJsonLd(seo)} />
      <JsonLd data={faqPageJsonLd(faqs)} />
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="max-w-6xl w-full mx-auto px-4 py-8 font-body">
          {/* Header */}
          <div className="py-16" />
          <h1 className="text-5xl font-display mb-2">
            The open-source Firebase Crashlytics alternative, built for mobile
          </h1>
          <div className="py-4" />
          <p className="text-justify text-lg">
            Measure gives mobile teams crashes, ANRs, performance, network
            monitoring and full session context in one thoughtful platform.
            Every issue gets an auto-captured{" "}
            <Link
              href="/product/session-replays"
              className={underlineLinkStyle}
            >
              Session Replay
            </Link>
            , so you and your coding agents have the deep context needed to fix
            issues fast. Measure is fully open-source and gives you complete
            control over your data with no sampling.
          </p>

          <div className="mt-24">
            <h2 className="text-3xl font-display mb-4">
              Why mobile teams look for a Firebase Crashlytics alternative
            </h2>
            <div className="text-justify text-lg space-y-6">
              <p>
                Crashlytics is free, widely deployed and a sensible place to
                start. For most apps, its basic crash reporting is enough to get
                going. Teams tend to start looking due to the following reasons:
              </p>
              <ol className="list-decimal pl-6 space-y-4">
                <li>
                  <span className="font-semibold">
                    Limited context makes solving issues harder.
                  </span>{" "}
                  A stack trace tells you where the app crashed, but
                  doesn&apos;t tell you what the user and device were doing when
                  it happened. Crashlytics requires manually instrumenting
                  breadcrumbs and keeping them in sync with every release.
                  Individually instrumenting every possible user interaction,
                  device signal, network event and navigation change is
                  cumbersome and hard to keep up with as the app evolves. Teams
                  often find out in production that they are missing logs and
                  events which could have helped them debug issues quicker.
                </li>
                <li>
                  <span className="font-semibold">
                    No control over sampling.
                  </span>{" "}
                  To keep crash reporting and performance monitoring free,
                  Firebase applies internal sampling which developers cannot
                  change. Production issues are affected by device, network, app
                  versions, OS versions and many other factors. The ability to
                  collect and analyze data across multiple dimensions
                  dynamically is necessary to hone in on issues as apps scale.
                </li>
                <li>
                  <span className="font-semibold">
                    Toolset Fragmentation hides the true cost.
                  </span>{" "}
                  Performance traces go in Firebase Performance Monitoring, a
                  separate product with a separate SDK. Analytics events which
                  are useful for debugging end up in Google Analytics. Custom
                  analysis of your own data needs paid BigQuery export and only
                  happens in delayed batches. Custom alerting needs Cloud
                  Functions. In-app bug reports require a third-party tool. The
                  number of SDKs in your app, the dashboards you look at and the
                  MCP integrations your agents need keep climbing, with the
                  context you need for any single investigation spread across
                  multiple sources.
                </li>
                <li>
                  <span className="font-semibold">Platform Lock-In.</span> The
                  Crashlytics SDKs are open source, but the backend and
                  dashboard are proprietary. You cannot audit the code, verify
                  the data pipeline, or move your raw data out to any
                  destination except BigQuery with a paid export.
                </li>
              </ol>
              <p>
                Measure was built to close these gaps: full session context by
                default, dynamic sampling with user control, one platform for
                everything mobile teams need, and an open stack you can
                contribute to.
              </p>
            </div>
          </div>

          {/* Comparison table */}
          <div className="mt-24">
            <h2 className="text-3xl font-display mb-8">
              Measure vs Firebase Crashlytics: The Full Comparison
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-140 border-collapse text-left">
                <thead>
                  <tr className="">
                    <th
                      scope="col"
                      className="w-1/2 py-4 px-4 sm:px-6 font-display text-base font-normal"
                    >
                      <span className="sr-only">Capability</span>
                    </th>
                    <th
                      scope="col"
                      className="bg-green-500/5 w-1/4 py-4 px-4 sm:px-6 text-center font-display text-base text-primary-foreground dark:text-white"
                    >
                      Measure
                    </th>
                    <th
                      scope="col"
                      className="w-1/4 py-4 px-4 sm:px-6 text-center font-display text-base text-muted-foreground"
                    >
                      Firebase Crashlytics
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.feature} className="border-t border-border">
                      <th
                        scope="row"
                        className="py-3 px-4 sm:px-6 text-left font-normal align-middle"
                      >
                        {row.feature}
                      </th>
                      <td className="py-3 px-4 sm:px-6 text-center align-middle bg-green-500/5">
                        <ComparisonCell value={row.measure} emphasis />
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-center align-middle">
                        <ComparisonCell value={row.competitor} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <SideIconSection
            heading="Go Beyond crash reports with full session context"
            icon={<LucideFilm className="w-48 h-48 text-rose-600 p-4" />}
          >
            <p>
              A Crashlytics crash report gives you a stack trace and whatever
              breadcrumbs you instrumented ahead of time. Taps, navigations,
              network calls and lifecycle transitions each need their own
              instrumentation, and this needs to keep up with code changes
              resulting in an error prone process with missing context as the
              app evolves.
            </p>
            <p>
              Measure auto-captures gestures, navigation, lifecycle events,
              network calls and traces, then replays them as a{" "}
              <Link
                href="/product/session-replays"
                className={underlineLinkStyle}
              >
                Session Replay
              </Link>{" "}
              attached to every crash, ANR and error.
            </p>
            <p>
              The debugging process changes from guesses about what happened to
              facts you can observe. Instead of reading a stack trace, forming a
              hypothesis, shipping breadcrumbs and waiting a release cycle to
              test it, you just open the issue and watch what happened. Even
              better, just point your agent at the issue and it can use our{" "}
              <Link href="/product/mcp" className={underlineLinkStyle}>
                MCP Server
              </Link>{" "}
              to fetch deep context across several occurrences to help you find
              the root cause. The hardest to reproduce issues: a crash that only
              happens on a certain device in a specific navigation path, an
              error that only occurs when a background request times out before
              completion, a failure that depends on state built up over several
              screens, become easier than ever to fix.
            </p>
          </SideIconSection>

          <SideIconSection
            heading="Performance, Crash and ANR monitoring built only for mobile"
            icon={
              <LucideSmartphone className="w-48 h-48 text-yellow-500 p-4" />
            }
          >
            <p>
              Crashlytics is part of Firebase, where mobile is one product line
              among many and roadmap decisions compete with everything else on
              the platform.
            </p>
            <p>
              Measure is built only for mobile.{" "}
              <Link
                href="/product/crashes-and-anrs"
                className={underlineLinkStyle}
              >
                Crashes &amp; ANRs
              </Link>
              ,{" "}
              <Link href="/product/app-health" className={underlineLinkStyle}>
                App Health
              </Link>
              ,{" "}
              <Link
                href="/product/performance-traces"
                className={underlineLinkStyle}
              >
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
              <Link
                href="/product/user-journeys"
                className={underlineLinkStyle}
              >
                User Journeys
              </Link>{" "}
              are all designed around the failure modes mobile apps experience
              in production: memory pressure, main-thread blocking, errors
              during background and foreground transitions, and unstable network
              conditions.
            </p>
            <p>Mobile is not a part of our product. It is the whole product.</p>
          </SideIconSection>

          <SideIconSection
            heading="The self-hostable, open-source Crashlytics alternative"
            icon={
              <LucideGitPullRequest className="w-48 h-48 text-sky-500 p-4" />
            }
          >
            <p>
              Crashlytics publishes its SDKs on GitHub, but the backend and
              dashboard are proprietary and run only on Google&apos;s
              infrastructure.
            </p>
            <p>
              Measure is{" "}
              <TrackGithubLink
                href="https://github.com/measure-sh/measure"
                target="_blank"
                className={underlineLinkStyle}
              >
                open source end to end
              </TrackGithubLink>{" "}
              under an Apache 2.0 license. You can read the code, run it,
              self-host it, and audit how data is collected and stored. If you
              have ideas on how to make it better, you can open an issue or send
              a pull request.
            </p>
            <p>
              Open source software is better for transparency because you can
              see the code handling your data. It&apos;s better for security
              since more eyes on the code lead to more discovered
              vulnerabilities. It is better for flexibility, since you can raise
              issues and PRs to improve the platform or host it yourself if you
              have the need. Being open source also makes Measure easier to use
              with coding agents - just point your agent at the code or docs and
              it can figure out everything it needs to make full use of
              everything the platform offers without poking around a black box.
            </p>
          </SideIconSection>

          <SideIconSection
            heading="One platform for Android, iOS, iPadOS, Flutter, React Native and KMP"
            icon={<LucideLayers className="w-48 h-48 text-indigo-500 p-4" />}
          >
            <p>
              Measure supports{" "}
              <Link href="/for/android" className={underlineLinkStyle}>
                Android
              </Link>
              ,{" "}
              <Link href="/for/ios" className={underlineLinkStyle}>
                iOS
              </Link>
              ,{" "}
              <Link href="/for/ipados" className={underlineLinkStyle}>
                iPadOS
              </Link>
              ,{" "}
              <Link href="/for/flutter" className={underlineLinkStyle}>
                Flutter
              </Link>
              ,{" "}
              <Link href="/for/react-native" className={underlineLinkStyle}>
                React Native
              </Link>{" "}
              and{" "}
              <Link href="/for/kmp" className={underlineLinkStyle}>
                Kotlin Multiplatform
              </Link>
              .
            </p>
            <p>
              Our SDKs are designed to be thoughtful, flexible, lightweight and
              performant across all platforms. Crashes, ANRs, performance
              traces, network monitoring and session context are tracked,
              symbolicated and collected with platform-specific best practices
              in mind so that observability doesn&apos;t impact the performance
              of the app itself.
            </p>
            <p>
              {" "}
              Data across all your Android, iOS and cross-platform apps, along
              with their dev, staging and production variants feeds into a
              single unified dashboard so you can ship and monitor your apps
              with confidence.
            </p>
          </SideIconSection>

          <SideIconSection
            heading="Simple, transparent pricing with full data ownership"
            icon={
              <LucideCircleDollarSign className="w-48 h-48 text-green-500 p-4" />
            }
          >
            <p>
              Crashlytics crash reporting is free but data export and advanced
              analysis depend on separate products with independent pricing.
              Products like BigQuery export for custom analysis, Cloud Functions
              for custom alerting, Google analytics for user interaction events
              lead to platform lock-in and hard to predict costs as apps scale.
            </p>
            <p>
              Measure has a single{" "}
              <Link href="/pricing" className={underlineLinkStyle}>
                price
              </Link>{" "}
              based on how much data you send. No per-seat charges, no arbitrary
              feature bundles. Raw data export is available in enterprise plans
              to a destination you choose without restriction to a particular
              cloud or vendor. With{" "}
              <Link
                href="/product/adaptive-capture"
                className={underlineLinkStyle}
              >
                Adaptive Capture
              </Link>{" "}
              you can adjust data collection rates without shipping an app
              update, which makes it easy to scale telemetry when your app needs
              to while keeping costs under control.
            </p>
          </SideIconSection>

          <SideIconSection
            heading="Who is Measure right for?"
            icon={<LucideUsers className="w-48 h-48 text-purple-500 p-4" />}
          >
            <p>
              Measure is useful for any mobile app but it fits best for apps
              with growing users, complexity and scale. If production issues are
              getting harder to debug due to missing information about the
              states that led to them, or if users are complaining about
              performance and network issues and your current setup lacks deep
              telemetry and context to fix them, Measure will fit like a
              glove.{" "}
            </p>
            <p>
              Measure can also be a good choice if data ownership, auditability
              of the platform and avoiding platform lock-in to a single
              ecosystem matters to you for security or compliance reasons.
            </p>
            <p>
              If simple crash reporting is all you need, and your team is
              already comfortable inside the Google ecosystem, Crashlytics is a
              decent option. Measure is designed for growing mobile teams that
              need production observability at scale. With deep telemetry,
              Measure makes fixing issues with agents and shipping amazing
              mobile experiences easier and faster.
            </p>
          </SideIconSection>

          <SideIconSection
            heading="Migrating from Crashlytics"
            icon={
              <LucideArrowRightLeft className="w-48 h-48 text-orange-500 p-4" />
            }
          >
            <p>
              Switching to Measure does not have to be a rip-and-replace. You
              can install the Measure SDK and run it alongside Crashlytics while
              you evaluate. A generous free tier lets you integrate your app,
              send telemetry data, use session replays, performance traces and
              MCP server integration to debug issues and see how Measure helps
              improve your app.
            </p>
            <p>
              Many teams use both Crashlytics and Measure together until they
              make the switch. Setup and per-platform guides are in the{" "}
              <Link href="/docs" className={underlineLinkStyle}>
                docs
              </Link>
              .
            </p>
          </SideIconSection>

          {/* FAQs */}
          <div className="mt-24">
            <h2 className="text-3xl font-display mb-8">
              Firebase Crashlytics alternative FAQs
            </h2>
            <Accordion type="single" collapsible>
              {faqs.map((faq) => (
                <AccordionItem key={faq.question} value={faq.question}>
                  <AccordionTrigger className="text-xl font-display font-normal hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-justify text-lg">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-24" />
        <TrackCtaLink
          location="crashlytics_alternative"
          destination="signup"
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get Started For Free
        </TrackCtaLink>
        <p className="text-center text-sm px-4 mt-4">
          or checkout the{" "}
          <Link href="/docs" className={underlineLinkStyle}>
            docs
          </Link>{" "}
        </p>
        <div className="py-16" />
      </div>

      <LandingFooter />
    </main>
  );
}
