"use client"

import { buttonVariants } from '@/app/components/button'
import { cn } from '@/app/utils/shadcn_utils'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import LandingFooter from '../../components/landing_footer'
import LandingHeader from '../../components/landing_header'
const NetworkTrends = dynamic(() => import('../../components/network_trends'), { ssr: false })
const NetworkDetails = dynamic(() => import('../../components/network_details'), { ssr: false })

export default function ProductNetworkPerformance() {

  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">Network Performance</h1>
        <div className='py-2' />
        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          Monitor the health and performance of every network request your app makes. Instantly see which endpoints are the slowest, most error-prone, or most frequently called so you know exactly where to focus.
        </p>

        <div className="relative w-full max-w-[90vw] md:max-w-6xl h-[320px] md:h-[640px] mt-12 mb-32 mx-auto border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="w-[250%] h-[250%] md:w-[125%] md:h-[125%] origin-top-left transform scale-[0.4] md:scale-[0.8]">
            <div className="w-full h-full px-8 py-12 overflow-y-auto">
              <NetworkTrends demo={true} />
            </div>
          </div>
        </div>

        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          Drill into any endpoint to track latency percentiles (p50, p90, p95, p99) over time and catch regressions early. Visualize HTTP status code distributions to spot error spikes and ensure your backend is delivering the reliability your users expect.
        </p>

        <div className="relative w-full max-w-[90vw] md:max-w-6xl h-[500px] md:h-[980px] mt-12 mb-32 mx-auto border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="w-[250%] h-[250%] md:w-[125%] md:h-[125%] origin-top-left transform scale-[0.4] md:scale-[0.8]">
            <div className="w-full h-full px-8 py-12 overflow-y-auto">
              <NetworkDetails demo={true} hideDemoTitle={true} />
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
    </main >
  )
}
