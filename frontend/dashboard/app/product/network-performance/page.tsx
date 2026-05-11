import { buttonVariants } from "@/app/components/button_variants";
import { sharedOpenGraph } from "@/app/utils/metadata";
import { cn } from "@/app/utils/shadcn_utils";
import type { Metadata } from "next";
import Link from "next/link";
import LandingFooter from "../../components/landing_footer";
import LandingHeader from "../../components/landing_header";
import NetworkDemo from "./network_demo";

export const metadata: Metadata = {
  title: "Mobile Network Performance Monitoring",
  description: "Monitor mobile API call latency, HTTP status codes and slow endpoints. Find and fix the network calls killing your app's performance.",
  alternates: { canonical: "/product/network-performance" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Mobile Network Performance Monitoring",
    description: "Monitor mobile API call latency, HTTP status codes and slow endpoints. Find and fix the network calls killing your app's performance.",
    url: "/product/network-performance",
  },
};

export default function ProductNetworkPerformance() {
  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">
          Network Performance
        </h1>
        <div className="py-2" />
        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          Monitor the health and performance of every network request your app
          makes. Instantly see HTTP status code distributions over time, giving
          you a clear picture of how your API layer is performing at a glance.
          <br />
          <br />
          Drill into your top endpoints ranked by latency, error rate, and
          request frequency to pinpoint exactly which calls are slowing down
          your app or failing silently. Visualize when specific endpoints are
          called during a session to understand request patterns and timing.
          <br />
          <br />
          With Network Performance, you can proactively catch degraded
          endpoints, reduce error rates, and optimize the API calls that matter
          most to your users.
        </p>

        <div className="relative w-full max-w-[90vw] md:max-w-6xl h-[380px] md:h-[760px] mt-12 mb-32 mx-auto border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="w-[250%] h-[250%] md:w-[125%] md:h-[125%] origin-top-left transform scale-[0.4] md:scale-[0.8]">
            <div className="w-full h-full px-8 py-12 overflow-y-auto">
              <NetworkDemo />
            </div>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get To The Root Cause
        </Link>
        <div className="py-16" />
      </div>
      <LandingFooter />
    </main>
  );
}
