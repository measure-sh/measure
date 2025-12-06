"use client"

import { buttonVariants } from '@/app/components/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { cn } from '@/app/utils/shadcn_utils'
import { LucideBug, LucideGitPullRequest } from 'lucide-react'
import Link from 'next/link'
import LandingFooter from '../../components/landing_footer'
import LandingHeader from '../../components/landing_header'

export default function ComparisonFirebaseCrashlytics() {

  const features = [
    {
      name: "App Monitoring",
      measure: "✅ Full Session timelines, App Health metrics, Performance traces, Crash & ANR tracking, Bug Reports and User Journeys.",
      competitor: " ⚠️ Basic Crash & ANR tracking, Performance traces and App health metrics.",
    },
    {
      name: "Adaptive Capture",
      measure: (
        <>
          ✅ {" "}
          <Link
            href="/product/adaptive-capture"
            className="underline decoration-2 underline-offset-2 decoration-yellow-200 hover:decoration-yellow-500"
          >
            Dynamically change
          </Link>{" "}
          collection parameters to capture what you need, when you need it.
        </>
      ),
      competitor: "❌ Static data collection configured at build time.",
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
            className="underline decoration-2 underline-offset-2 decoration-yellow-200 hover:decoration-yellow-500"
          >
            pricing
          </Link>{" "}
          based on events and retention.
        </>
      ),
      competitor: "✅ Free - but with limitations on retention and sampling.",
    }
  ];

  return (
    <main className="flex flex-col items-center justify-between selection:bg-yellow-200/75">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">

        <div className="max-w-6xl mx-auto px-4 py-8 font-body">
          {/* Header */}
          <div className="py-16" />
          <h1 className="text-5xl font-display text-black mb-2">Measure vs Firebase Crashlytics</h1>
          <div className='py-4' />
          <p className="text-justify text-lg">
            Firebase Crashlytics is a great beginner app monitoring tool and it comes with the unbeatable price of &quot;Free&quot; (with limited retention and sampling). However, it has limitations when it comes to advanced features.
            <br /><br /> Measure is the next step up once Firebase Crashlytics is no longer sufficient.
          </p>

          {/* Differentiator 1 */}
          <div className='flex flex-col md:flex-row w-full items-center gap-8 mt-24'>
            <div className='flex flex-col flex-1'>
              <h2 className="text-3xl font-display text-black mb-4">Comprehensive Monitoring vs Error tracking</h2>
              <p className="text-justify text-lg">
                Measure is focused on giving the full picture of apps in production to mobile developers.
                With advanced capture techniques and full session timelines, Measure allows you to get the full context of how users interact with your app and where issues arise.
                <br /><br />Firebase Crashlytics, in contrast, is primarily focused on error tracking and performance monitoring with limited ability to get the full picture when issues fall outside of traditional mobile app monitoring parameters.
              </p>
            </div>
            <div className='flex items-center justify-center w-full md:w-64 flex-shrink-0'>
              <LucideBug className='w-48 h-48 text-sky-500 p-4' />
            </div>
          </div>

          {/* Differentiator 2 */}
          <div className='flex flex-col md:flex-row w-full items-center gap-8 mt-24'>
            <div className='flex flex-col flex-1'>
              <h2 className="text-3xl font-display text-black mb-4">Open Source vs Proprietary Code</h2>
              <p className="text-justify text-lg">
                Measure is fully open-source and can be self-hosted or used via Measure Cloud. This means our code is open to scrutiny and community contributions which leads to a better product. Firebase Crashlytics is proprietary software with no access to the core platform source code, limiting transparency and agility.
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
                <TableHead>Firebase Crashlytics</TableHead>
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