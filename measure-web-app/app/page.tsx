"use client"

import Image from 'next/image'
import LandingHeader from './components/landing_header'
import PhoneECG from './components/phone_ecg'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-between selection:bg-yellow-200/75">
      <LandingHeader />
      <div className="flex flex-col items-center md:w-4/5 2xl:w-3/5 px-16">
        <div className="py-16" />
        <p className="font-display font-regular text-black text-8xl max-w-6xl text-center">measure</p>
        <div className="py-2" />
        <p className="text-lg leading-relaxed font-sans text-black max-w-2xl text-center">open source app monitoring for mobile teams</p>
        <div className="py-8" />
        <PhoneECG />
        <div className="py-12 md:py-16" />
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-regular text-black font-display text-center md:text-left">User Journeys</p>
            <div className="py-2" />
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Understand how users move through your app. Easily visualise screens most affected by issues.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6" />
          <video src="/videos/journey.webm" autoPlay loop muted playsInline className="w-96 md:w-3/6" />
        </div>
        <div className="py-12" />
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-regular text-black font-display text-center md:text-left">App Health</p>
            <div className="py-2" />
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Monitor important metrics to stay on top of app health. Quickly see deltas to make sure you&apos;re moving in the right direction.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6" />
          <video src="/videos/app_health.webm" autoPlay loop muted playsInline className="aspect-square w-96 md:w-3/6" />
        </div>
        <div className="py-12" />
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-regular text-black font-display text-center md:text-left">Crashes and App Hangs</p>
            <div className="py-2" />
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Automatically track Crashes and App hangs. Dive deeper with screenshots, filters and detailed stacktraces.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6" />
          <video src="/videos/exceptions.webm" autoPlay loop muted playsInline className="aspect-square w-96 md:w-3/6" />
        </div>
        <div className="py-12" />
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-regular text-black font-display text-center md:text-left">Session timeline</p>
            <div className="py-2" />
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Get to the root cause easily with full session timelines. Debug with automatic tracking for clicks, navigations, http calls and more.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6" />
          <video src="/videos/session.webm" autoPlay loop muted playsInline className="aspect-square w-96 md:w-3/6" />
        </div>
        <div className="py-12" />
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-regular text-black font-display text-center md:text-left">Open source and Self-hosted</p>
            <div className="py-2" />
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Open source and fully self-hosted so your data never leaves your severs. Built by mobile devs who have shipped apps to hundreds of millions of users since the early days of iOS and Android.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6" />
          <Image className='w-96 md:w-3/6 aspect-square p-8 md:p-24'
            src='/images/osi_logo.svg'
            width={96}
            height={96}
            alt={'Open Source Initiative logo'} />
        </div>
        <div className="py-12 md:py-24" />
        <p className="font-display font-regular text-black text-6xl max-w-4xl text-center">Measure on every platform</p>
        <div className="py-4 md:py-8" />
        <div className="flex flex-col md:flex-row items-center">
          <div className="flex flex-col items-center font-display text-neutral-400 border border-neutral-400 rounded-md py-2 px-8">
            <p className="text-center">Android</p>
            <p className="text-xs text-center">In progress</p>
          </div>
          <div className="py-2 md:px-4" />
          <div className="flex flex-col items-center font-display text-neutral-400 border border-neutral-400 rounded-md py-2 px-8">
            <p className="text-center">iOS</p>
            <p className="text-xs text-center">In progress</p>
          </div>
          <div className="py-2 md:px-4" />
          <div className="flex flex-col items-center font-display text-neutral-400 border border-neutral-400 rounded-md py-2 px-8">
            <p className="text-center">Flutter</p>
            <p className="text-xs text-center">In progress</p>
          </div>
          <div className="py-2 md:px-4" />
          <div className="flex flex-col items-center font-display text-neutral-400 border border-neutral-400 rounded-md py-2 px-8">
            <p className="text-center">React Native</p>
            <p className="text-xs text-center">In progress</p>
          </div>
          <div className="py-2 md:px-4" />
          <div className="flex flex-col items-center font-display text-neutral-400 border border-neutral-400 rounded-md py-2 px-8">
            <p className="text-center">Unity</p>
            <p className="text-xs text-center">In progress</p>
          </div>
        </div>
        <div className="py-12 md:py-24" />
        <p className="font-display font-regular text-black text-6xl max-w-4xl text-center">Set up your first app</p>
        <div className="py-2" />
        <p className="font-sans text-black text-xl leading-relaxed max-w-4xl text-center">Check out our detailed guides on Github to get up and running with Measure!</p>
        <div className="py-2" />
        <Link href="https://github.com/measure-sh/measure" className='m-4 outline-none flex flex-row place-items-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4'>
          <Image
            src='/images/github_logo.svg'
            width={24}
            height={24}
            alt={'Github logo'} />
          <div className='px-1' />
          <p className='mt-1'>Get Started</p>
        </Link>
        <div className="py-24" />
      </div>
    </main>
  )
}
