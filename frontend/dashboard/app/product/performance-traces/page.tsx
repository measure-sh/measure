"use client"

import { buttonVariants } from '@/app/components/button'
import { cn } from '@/app/utils/shadcn_utils'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import LandingFooter from '../../components/landing_footer'
import LandingHeader from '../../components/landing_header'
const TraceDetails = dynamic(() => import('../../components/trace_details'), { ssr: false })

export default function ProductPerformanceTraces() {

  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">Performance Traces</h1>
        <div className='py-2' />
        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          Measure exactly what matters for your app&apos;s user experience by instrumenting critical operations in your codebase.
          <br /><br />Performance traces let you understand how API fetches, complex code operations and UI rendering stack up within a single user flow or aggregrate across millions of sessions, with waterfall charts that make bottlenecks immediately obvious.
          <br /><br />Every trace includes rich context such as device type and network conditions and links to a full session timeline so you can spot patterns and correlate slowdowns within specific environments.
          <br /><br />Whether you&apos;re reducing checkout time, speeding up content loading, or improving screen transitions, Performance Traces give you the quantitative data you need to make precise improvements.
        </p>

        <div className="relative w-full max-w-[90vw] md:max-w-6xl h-[400px] md:h-[780px] mt-12 mb-32 mx-auto border border-border rounded-lg shadow-xl overflow-hidden">
          {/* SCALING WRAPPER */}
          {/* Mobile: Scale 0.4 (40%) -> requires Width 250% (100/0.4) */}
          {/* Desktop: Scale 0.8 (80%) -> requires Width 125% (100/0.8) */}
          <div className="w-[250%] h-[250%] md:w-[125%] md:h-[125%] origin-top-left transform scale-[0.4] md:scale-[0.8]">
            <div className="w-full h-full px-8 py-12 overflow-y-auto">
              <TraceDetails demo={true} hideDemoTitle={true} />
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