"use client"

import { buttonVariants } from '@/app/components/button'
import { cn } from '@/app/utils/shadcn_utils'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import LandingFooter from '../../components/landing_footer'
import LandingHeader from '../../components/landing_header'
const Overview = dynamic(() => import('../../components/overview'), { ssr: false })

export default function ProductAppHealth() {

  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">App Health</h1>
        <div className='py-2' />
        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          Keep your finger on the pulse of your app&apos;s performance with comprehensive health monitoring that goes beyond the basics.
          <br /><br />App Health gives you fast insights into the metrics that matter most - from error rates, error rates as perceived by users, app adoption and app size to precise launch time measurements across cold, warm and hot starts.
          <br /><br />With App Health, you can proactively identify and address performance issues before they impact your users leading to a smooth rollout every time.
        </p>

        <div className="relative w-full max-w-[90vw] md:max-w-6xl h-[600px] md:h-[940px] mt-12 mb-32 mx-auto border border-border rounded-lg shadow-xl overflow-hidden">
          {/* SCALING WRAPPER */}
          {/* Mobile: Scale 0.4 (40%) -> requires Width 250% (100/0.4) */}
          {/* Desktop: Scale 0.8 (80%) -> requires Width 125% (100/0.8) */}
          <div className="w-[250%] h-[250%] md:w-[125%] md:h-[125%] origin-top-left transform scale-[0.4] md:scale-[0.8]">
            <div className="w-full h-full px-8 py-12 overflow-y-auto">
              <Overview demo={true} hideDemoTitle={true} key={`demo-overview`} />
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