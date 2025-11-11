"use client"

import { buttonVariants } from '@/app/components/button'
import { cn } from '@/app/utils/shadcn_utils'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import LandingFooter from '../../components/landing_footer'
import LandingHeader from '../../components/landing_header'
const BugReport = dynamic(() => import('../../components/bug_report'), { ssr: false })

export default function ProductBugReports() {

  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">Bug Reports</h1>
        <div className='py-2' />
        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          Empower your users to report issues directly from your app with a device shake or using your own custom button.
          <br /><br />Bug Reports automatically capture everything that matters - device information, app version, network conditions and the exact timestamp alongside the user&apos;s description and screenshots.
          <br /><br />Every bug report links directly to the complete session timeline, so you can see exactly what the user experienced, review the sequence of events, and identify the root cause without stumbling around in the dark.
          <br /><br />Bug Reports allows you to skip the email threads, support tickets and the back-and-forth asking users to remember what they were doing - your users describe the problem in their own words and you get all the technical data you need to solve it.
        </p>

        <div className="relative w-full max-w-[90vw] md:max-w-6xl h-[400px] md:h-[740px] mt-12 mb-32 mx-auto border border-border rounded-lg shadow-xl overflow-hidden">
          {/* SCALING WRAPPER */}
          {/* Mobile: Scale 0.4 (40%) -> requires Width 250% (100/0.4) */}
          {/* Desktop: Scale 0.8 (80%) -> requires Width 125% (100/0.8) */}
          <div className="w-[250%] h-[250%] md:w-[125%] md:h-[125%] origin-top-left transform scale-[0.4] md:scale-[0.8]">
            <div className="w-full h-full px-8 py-12 overflow-y-auto">
              <BugReport demo={true} hideDemoTitle={true} />
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