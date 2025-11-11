"use client"

import { buttonVariants } from '@/app/components/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { cn } from '@/app/utils/shadcn_utils'
import { underlineLinkStyle } from '@/app/utils/shared_styles'
import { LucideGitPullRequest, LucideReceipt, LucideSmartphone } from 'lucide-react'
import Link from 'next/link'
import LandingFooter from '../../components/landing_footer'
import LandingHeader from '../../components/landing_header'

export default function ComparisonEmbrace() {

  const features = [
    {
      name: "App Monitoring",
      measure: "✅ Full Session timelines, App Health metrics, Performance traces, Crash & ANR tracking, Bug Reports and User Journeys.",
      competitor: " ⚠️ Pretty much eveything we have except for Bug reports",
    },
    {
      name: "Adaptive Capture",
      measure: (
        <>
          ✅ {" "}
          <Link
            href="/product/adaptive-capture"
            className={underlineLinkStyle}
          >
            Dynamically change
          </Link>{" "}
          collection parameters to capture what you need, when you need it.
        </>
      ),
      competitor: "❌ Static data collection configured at build time.",
    },
    {
      name: "Mobile Focus",
      measure: "✅ Fully focused on mobile app monitoring to meet the specific needs of mobile developers.",
      competitor: "⚠️ Mobile and Web, not specifically focused on mobile.",
    },
    {
      name: "Open Telemetry Support",
      measure: "❌ We don't support exporting to Open Telemetry at the moment but we will.",
      competitor: "✅ Pioneer in Open Telemetry support on mobile platforms.",
    },
    {
      name: "Open Source",
      measure: "✅ Fully open-source, allowing for transparency and community contributions.",
      competitor: "❌ Proprietary platform with only open SDKs.",
    },
    {
      name: "Price",
      measure: (
        <>
          ✅ Free for self-host. Clear and transparent{" "}
          <Link
            href="/pricing"
            className={underlineLinkStyle}
          >
            pricing
          </Link>{" "}
          based on events and retention.
        </>
      ),
      competitor: "⚠️ Session based pricing which can get expensive as you scale.",
    }
  ];

  return (
    <main className="flex flex-col items-center justify-between selection:bg-yellow-200/75">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">

        <div className="max-w-6xl mx-auto px-4 py-8 font-body">
          {/* Header */}
          <div className="py-16" />
          <h1 className="text-5xl font-display text-black mb-2">Measure vs Embrace</h1>
          <div className='py-4' />
          <p className="text-justify text-lg">
            Embrace started as a mobile only platform with a similar philosophy to ours - go beyond simple issue reporting and aim to provide the full picture to mobile developers. They also pioneered Open Telemetry support on mobile and if you are looking to share telemetry between mobile and backend systems, Embrace might be a great fit! There are key areas where we believe Measure offers significant advantages over Embrace.
          </p>

          {/* Differentiator 1 */}
          <div className='flex flex-col md:flex-row w-full items-center gap-8 mt-24'>
            <div className='flex flex-col flex-1'>
              <h2 className="text-3xl font-display text-black mb-4">Mobile Focus</h2>
              <p className="text-justify text-lg">
                While Embrace provides an application monitoring solution across web and mobile, Measure is specifically designed for mobile app monitoring. This allows us to double down on what matters to mobile developers and not bloat our platform for a wider audience whose interests can often overshadow the needs of our core users. <br /><br /> Mobile is not an add-on or a side revenue stream for us. Mobile is our entire product.
              </p>
            </div>
            <div className='flex items-center justify-center w-full md:w-64 flex-shrink-0'>
              <LucideSmartphone className='w-48 h-48 text-emerald-500 p-4' />
            </div>
          </div>

          {/* Differentiator 2 */}
          <div className='flex flex-col md:flex-row w-full items-center gap-8 mt-24'>
            <div className='flex flex-col flex-1'>
              <h2 className="text-3xl font-display text-black mb-4">Event based vs Session based pricing</h2>
              <p className="text-justify text-lg">
                Measure pricing is based on events and data retention, making it predictable and scalable for mobile development teams of all sizes. Embrace uses a session-based pricing model which can become expensive as your user base grows, especially for apps with high session counts but lower event volumes.
                <br /><br />
                Only want crashes? With Measure, you pay for what you use. Session based pricing would require you to pay for all sessions regardless of whether they contain issues or not.
              </p>
            </div>
            <div className='flex items-center justify-center w-full md:w-64 flex-shrink-0'>
              <LucideReceipt className='w-48 h-48 text-sky-500 p-4' />
            </div>
          </div>

          {/* Differentiator 3 */}
          <div className='flex flex-col md:flex-row w-full items-center gap-8 mt-24'>
            <div className='flex flex-col flex-1'>
              <h2 className="text-3xl font-display text-black mb-4">Open Source vs Proprietary Code</h2>
              <p className="text-justify text-lg">
                Measure is fully open-source with an Apache 2.0 license and can be self-hosted or used via Measure Cloud. This means our code is open to scrutiny and community contributions which leads to a better product. Embrace&apos;s core platform is proprietary, with only their SDKs being open source.
              </p>
            </div>
            <div className='flex items-center justify-center w-full md:w-64 flex-shrink-0'>
              <LucideGitPullRequest className='w-48 h-48 text-violet-500 p-4' />
            </div>
          </div>

          {/* Features table */}
          <Table className="font-display text-lg my-24">
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Measure</TableHead>
                <TableHead>Embrace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((feature) => {
                return (
                  <TableRow
                    key={`${feature.name}`}
                    className="font-body text-base"
                  >
                    <TableCell>
                      <p>{feature.name}</p>
                    </TableCell>
                    <TableCell>
                      <p >{feature.measure}</p>
                    </TableCell>
                    <TableCell>
                      <p >{feature.competitor}</p>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* CTA */}
        <Link
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "font-display border border-black rounded-md select-none text-2xl px-8 py-8",
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