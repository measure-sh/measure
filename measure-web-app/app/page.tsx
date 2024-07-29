"use client"

import Image from 'next/image'
import LandingHeader from './components/landing_header'
import Link from 'next/link'
import Lottie from "lottie-react";
import landingHeroAnim from "./animations/landing_hero.json";


export default function Home() {
  return (
    <main className="flex flex-col items-center justify-between selection:bg-yellow-200/75">
      <LandingHeader />
      <div className="flex flex-col items-center md:w-4/5 2xl:w-3/5 px-16">
        <div className="py-16" />
        <p className="font-display font-regular text-black text-8xl max-w-6xl text-center">measure</p>
        <div className="py-2" />
        <p className="text-lg leading-relaxed font-sans text-black max-w-4xl text-center">open source app monitoring for mobile teams</p>
        <div className="py-8" />
        <Lottie animationData={landingHeroAnim} />
        <div className="py-4 md:py-8" />
        <div className="flex flex-col md:w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-6xl font-regular text-black font-display text-center">User Journeys</p>
            <div className="py-2" />
            <p className="text-lg text-center leading-relaxed font-sans text-black">Understand how users move through your app. Easily visualise screens most affected by issues.</p>
          </div>
          <div className="py-8" />
          <div className='border border-emerald-400 rounded-3xl p-4 w-96 h-96 md:w-[56rem] md:h-[40rem] bg-emerald-200'>
            <div className='flex bg-white rounded-3xl h-full border border-emerald-400 items-center justify-center'>
              <video src="/videos/journey.webm" autoPlay loop muted playsInline className="w-80 md:w-full h-72 md:h-full rounded-3xl" />
            </div>
          </div>
        </div>
        <div className="py-12 md:py-16" />
        <div className="flex flex-col md:w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-6xl font-regular text-black font-display text-center">App Health</p>
            <div className="py-2" />
            <p className="text-lg text-center leading-relaxed font-sans text-black">Monitor important metrics to stay on top of app health. Quickly see deltas to make sure you&apos;re moving in the right direction.</p>
          </div>
          <div className="py-8" />
          <div className='border border-emerald-400 rounded-3xl p-4 w-96 h-96 md:w-[56rem] md:h-[40rem] bg-violet-200'>
            <div className='flex bg-white rounded-3xl h-full border border-violet-400 items-center justify-center p-4'>
              <video src="/videos/app_health.webm" autoPlay loop muted playsInline className="w-80 md:w-full h-72 md:h-full rounded-3xl" />
            </div>
          </div>
        </div>
        <div className="py-12 md:py-16" />
        <div className="flex flex-col md:w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-6xl font-regular text-black font-display text-center">Crashes and App Hangs</p>
            <div className="py-2" />
            <p className="text-lg text-center leading-relaxed font-sans text-black">Automatically track Crashes and App hangs. Dive deeper with screenshots, filters and detailed stacktraces.</p>
          </div>
          <div className="py-8" />
          <div className='border border-emerald-400 rounded-3xl p-4 w-96 h-96 md:w-[56rem] md:h-[40rem] bg-cyan-200'>
            <div className='flex bg-white rounded-3xl h-full border border-cyan-400 items-center justify-center p-4'>
              <video src="/videos/exceptions.webm" autoPlay loop muted playsInline className="w-80 md:w-full h-72 md:h-full rounded-3xl" />
            </div>
          </div>
        </div>
        <div className="py-12 md:py-16" />
        <div className="flex flex-col md:w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-6xl font-regular text-black font-display text-center">Session timeline</p>
            <div className="py-2" />
            <p className="text-lg text-center leading-relaxed font-sans text-black">Debug issues easily with full session timelines. Get the full context with automatic tracking for clicks, navigations, http calls and more.</p>
          </div>
          <div className="py-8" />
          <div className='border border-emerald-400 rounded-3xl p-4 w-96 h-96 md:w-[56rem] md:h-[40rem] bg-pink-200'>
            <div className='flex bg-white rounded-3xl h-full border border-pink-400 items-center justify-center p-4'>
              <video src="/videos/session.webm" autoPlay loop muted playsInline className="w-80 md:w-full h-72 md:h-full rounded-3xl" />
            </div>
          </div>
        </div>
        <div className="py-12 md:py-16" />
        <p className="font-display font-regular text-black text-6xl max-w-4xl text-center">Open Source and Self hosted</p>
        <div className="py-4" />
        <p className="text-lg text-center leading-relaxed max-w-4xl font-sans text-black">Your data never leaves your servers. Open Source with a welcoming community led by experienced mobile devs who&apos;ve shipped apps to hundreds of millions of users since the early days of iOS and Android.</p>
        <div className="py-16" />
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
        <div className="py-12 md:py-16" />
        <p className="font-display font-regular text-black text-6xl max-w-4xl text-center">Get to the root cause</p>
        <div className="py-2" />
        <p className="font-sans text-black text-lg leading-relaxed max-w-4xl text-center">Check out our detailed guides on Github to get up and running with Measure!</p>
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
