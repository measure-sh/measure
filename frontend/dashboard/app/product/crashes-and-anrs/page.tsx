"use client"

import { buttonVariants } from '@/app/components/button'
import { cn } from '@/app/utils/shadcn_utils'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import LandingFooter from '../../components/landing_footer'
import LandingHeader from '../../components/landing_header'
const ExceptionsDetails = dynamic(
  () => import('../../components/exceptions_details').then((mod) => (mod.ExceptionsDetails as unknown) as React.ComponentType<any>),
  { ssr: false }
)

export default function ProductCrashesAndANRs() {

  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">Crashes and ANRs</h1>
        <div className='py-2' />
        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          Get instant visibility into every exception with detailed crash reports that include full stack traces, device information, OS versions, and intelligent analysis of the sequence of user actions that led to the failure.
          <br /><br />Our Common Path feature reconstructs the user journey before each crash, showing you what screens they visited, which actions they took, what API calls were and several other important signals.
          <br /><br />Path analysis combined with comprehensive stack traces and thread-level details, gives you everything you need to reproduce issues effectively and ship fixes with confidence.
        </p>

        <div className="relative w-full max-w-[90vw] md:max-w-6xl h-[600px] md:h-[1000px] mt-12 mb-32 mx-auto border border-border rounded-lg shadow-xl overflow-hidden">
          {/* SCALING WRAPPER */}
          {/* Mobile: Scale 0.4 (40%) -> requires Width 250% (100/0.4) */}
          {/* Desktop: Scale 0.8 (80%) -> requires Width 125% (100/0.8) */}
          <div className="w-[250%] h-[250%] md:w-[125%] md:h-[125%] origin-top-left transform scale-[0.4] md:scale-[0.8]">
            <div className="w-full h-full px-8 py-12 overflow-y-auto">
              <ExceptionsDetails demo={true} hideDemoTitle={true} />
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