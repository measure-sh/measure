"use client"

import { buttonVariants } from '@/app/components/button'
import { cn } from '@/app/utils/shadcn_utils'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import LandingFooter from '../../components/landing_footer'
import LandingHeader from '../../components/landing_header'
const UserJourneys = dynamic(() => import('../../components/user_journeys'), { ssr: false })

export default function ProductUserJourneys() {

  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">User Journeys</h1>
        <div className='py-2' />
        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          See the full picture of user behavior with beautiful flow diagrams that reveal the actual paths users take through your app.
          <br /><br />User Journeys automatically map every screen transition, showing you which flows are most popular, where users drop off, and which navigation patterns you never anticipated. Easily add your own screens and views to enrich them further.
          <br /><br />Toggle between normal path analysis and exception view to see exactly where crashes and ANRs interrupt user flows. If users consistently crash when navigating from Product List to Product Detail screens, you&apos;ll see it highlighted with crash counts and session volumes. Click any path or exception to drill into the details and investigate further.
          <br /><br /> Whether you&apos;re redesigning navigation, prioritizing feature work or debugging issues in conversion funnels, User Journeys transforms complex behavioral data into clear, actionable visualizations that help you build better experiences.
        </p>

        <div className="relative w-full max-w-[90vw] md:max-w-6xl h-[400px] md:h-[840px] mt-12 mb-32 mx-auto border border-border rounded-lg shadow-xl overflow-hidden">
          {/* SCALING WRAPPER */}
          {/* Mobile: Scale 0.4 (40%) -> requires Width 250% (100/0.4) */}
          {/* Desktop: Scale 0.8 (80%) -> requires Width 125% (100/0.8) */}
          <div className="w-[250%] h-[250%] md:w-[125%] md:h-[125%] origin-top-left transform scale-[0.4] md:scale-[0.8]">
            <div className="w-full h-full px-8 py-12 overflow-y-auto">
              <UserJourneys demo={true} hideDemoTitle={true} />
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