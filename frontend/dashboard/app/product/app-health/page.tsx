import ScaledPreview from "@/app/components/scaled_preview";
import { buttonVariants } from "@/app/components/button_variants";
import TrackCtaLink from "@/app/components/analytics/track_cta_link";
import { sharedOpenGraph } from "@/app/utils/metadata";
import { cn } from "@/app/utils/shadcn_utils";
import type { Metadata } from "next";
import LandingFooter from "../../components/landing_footer";
import LandingHeader from "../../components/landing_header";
import OverviewDemo from "./overview_demo";

export const metadata: Metadata = {
  title: "Mobile App Health Metrics & Dashboards",
  description:
    "Track mobile app health metrics that matter: crash-free sessions, ANR-free sessions, app launch times, release adoption and more.",
  alternates: { canonical: "/product/app-health" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Mobile App Health Metrics & Dashboards | Measure",
    description:
      "Track mobile app health metrics that matter: crash-free sessions, ANR-free sessions, app launch times, release adoption and more.",
    url: "/product/app-health",
  },
};

export default function ProductAppHealth() {
  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">
          App Health
        </h1>
        <div className="py-2" />
        <p className="text-lg font-body md:w-6xl text-justify px-4">
          Keep your finger on the pulse of your app&apos;s performance with
          comprehensive health monitoring that goes beyond the basics.
          <br />
          <br />
          App Health gives you fast insights into the metrics that matter most -
          from error rates, error rates as perceived by users, app adoption and
          app size to precise launch time measurements across cold, warm and hot
          starts.
          <br />
          <br />
          With App Health, you can proactively identify and address performance
          issues before they impact your users leading to a smooth rollout every
          time.
        </p>

        <div className="relative w-full max-w-[90vw] md:max-w-6xl h-[600px] md:h-[940px] mt-12 mb-32 mx-auto border border-border rounded-lg shadow-xl overflow-hidden">
          <ScaledPreview>
            <div className="bg-background text-foreground min-h-screen px-8 py-12">
              <OverviewDemo />
            </div>
          </ScaledPreview>
        </div>

        {/* CTA */}
        <TrackCtaLink
          location="product_app_health"
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
