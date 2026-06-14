import ScaledPreview from "@/app/components/scaled_preview";
import { buttonVariants } from "@/app/components/button_variants";
import TrackCtaLink from "@/app/components/analytics/track_cta_link";
import { sharedOpenGraph } from "@/app/utils/metadata";
import { cn } from "@/app/utils/shadcn_utils";
import type { Metadata } from "next";
import LandingFooter from "../../components/landing_footer";
import LandingHeader from "../../components/landing_header";
import SessionTimelineDemo from "./session_timeline_demo";

export const metadata: Metadata = {
  title: "Mobile Session Timelines & Replay",
  description:
    "See every click, navigation, network call, log, error and CPU/memory signal stitched into a single mobile session timeline to diagnose issues faster.",
  alternates: { canonical: "/product/session-timelines" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Mobile Session Timelines & Replay | Measure",
    description:
      "See every click, navigation, network call, log, error and CPU/memory signal stitched into a single mobile session timeline to diagnose issues faster.",
    url: "/product/session-timelines",
  },
};

export default function ProductSessionTimelines() {
  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">
          Session Timelines
        </h1>
        <div className="py-2" />
        <p className="text-lg font-body md:w-6xl text-justify px-4">
          Debug issues faster by replaying the exact sequence of events that led
          to a crash or performance problem.
          <br />
          <br />
          Session Timeline captures the complete story - see which API call
          failed, what the user clicked right before an error occurred and how
          your app&apos;s resources were behaving at that precise moment.
          <br />
          <br />
          With Session Timelines, you can stop guessing and have the full
          context you need to identify and fix root causes in an
          easy-to-navigate timeline.
        </p>

        <div className="relative w-full max-w-[90vw] md:max-w-6xl h-[500px] md:h-[980px] mt-12 mb-32 mx-auto border border-border rounded-lg shadow-xl overflow-hidden">
          <ScaledPreview>
            {/* The demo's sticky charts use a -top-12 offset that cancels this
                py-12 padding so they pin flush to the top — keep the two in sync. */}
            <div className="bg-background text-foreground min-h-screen px-8 py-12">
              <SessionTimelineDemo />
            </div>
          </ScaledPreview>
        </div>

        {/* CTA */}
        <TrackCtaLink
          location="product_session_timelines"
          destination="signup"
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get To The Root Cause
        </TrackCtaLink>
        <div className="py-16" />
      </div>
      <LandingFooter />
    </main>
  );
}
