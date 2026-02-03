"use client"

import AdaptiveCaptureDemo from '@/app/components/adaptive_capture_demo'
import { buttonVariants } from '@/app/components/button'
import { cn } from '@/app/utils/shadcn_utils'
import Link from 'next/link'
import LandingFooter from '../../components/landing_footer'
import LandingHeader from '../../components/landing_header'

export default function ProductAdaptiveCapture() {

  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">Adaptive Capture</h1>
        <div className='py-2' />
        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          Most monitoring data is never read but ends up inflating your costs 💰. Adaptive Capture lets you capture what matters based on changing needs.
          <br /><br />Need more data during a product launch or incident? Simply tweak your collection parameters to capture additional context when it matters most and collect only the essentials when things are running smoothly.
          <br /><br />The best part? No need to roll out app updates! When you change your captures settings, our servers propagate the changes to our SDK seamlessly.
          <br /><br />No more worrying about bloated costs or wasted data, Adaptive Capture lets you get the data you need, when you need it.
        </p>
        <div className="w-full md:w-6xl md:h-full p-8 rounded-lg shadow-lg mt-12 mb-32 overflow-y-auto border border-border rounded-lg shadow-xl overflow-hidden">
          <AdaptiveCaptureDemo showTitle={false} />
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