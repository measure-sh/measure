"use client"

import Lottie from "lottie-react";
import heroAnim from "./animations/measure_hero.json";
import appHealth from "./animations/measure_app_health.json"
import crashDebugging from "./animations/crash_debugging.json"
import buterySmoothPerf from "./animations/buttery_smooth_performance.json"
import detailedLogging from "./animations/detailed_logging.json"
import EmailWaitlist from './components/email_waitlist'
import LandingHeader from './components/landing_header'

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-between selection:bg-yellow-200/75">
      <LandingHeader />
      <div className="flex flex-col items-center md:w-4/5 2xl:w-3/5 px-16">
        <div className="py-16" />
        <p className="font-display font-regular text-black text-8xl max-w-6xl text-center">measure</p>
        <div className="py-2" />
        <p className="text-lg leading-relaxed font-sans text-black max-w-2xl text-center">open source app monitoring for mobile teams</p>
        <div className="py-4 md:py-4" />
        <Lottie animationData={heroAnim} loop={true} className="aspect-square w-96 md:w-3/4" />
        <div className="py-12 md:py-16" />
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-regular text-black font-display text-center md:text-left">App health at a glance</p>
            <div className="py-2" />
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Monitor core user flows and important metrics to stay on top of app health. Filter by various system or custom attributes to dive deeper.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6" />
          <Lottie animationData={appHealth} loop={true} className="aspect-square w-96 md:w-2/6" />
        </div>
        <div className="py-12" />
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-regular text-black font-display text-center md:text-left">Crash debugging simplified</p>
            <div className="py-2" />
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Track crashes and app hangs automatically, prioritise them by impact and use detailed event timelines to zoom in on production issues.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6" />
          <Lottie animationData={crashDebugging} loop={true} className="aspect-square w-96 md:w-2/6" />
        </div>
        <div className="py-12" />
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-regular text-black font-display text-center md:text-left">Buttery smooth performance</p>
            <div className="py-2" />
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Automatically trace app startups, app hangs, network calls, database queries and slow page loads. Use custom traces to measure what matters in any part of your app.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6" />
          <Lottie animationData={buterySmoothPerf} loop={true} className="aspect-square w-96 md:w-2/6" />
        </div>
        <div className="py-12" />
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-regular text-black font-display text-center md:text-left">Detailed logging</p>
            <div className="py-2" />
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Capture standard output/Logcat output automatically. Add custom logs anywhere in your code for easy debugging in production.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6" />
          <Lottie animationData={detailedLogging} loop={true} className="aspect-square w-96 md:w-2/6" />
        </div>
        <div className="py-12" />
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-regular text-black font-display text-center md:text-left">Built by and for mobile devs</p>
            <div className="py-2" />
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Open source platform with a welcoming community. Built by mobile devs who have shipped apps to hundreds of millions of users since the early days of iOS and Android.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6" />
          <div className="border border-black w-96 md:w-2/6 aspect-square bg-indigo-200" />
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
        <p className="font-display font-regular text-black text-6xl max-w-4xl text-center">Early access</p>
        <div className="py-2" />
        <p className="font-sans text-black text-xl leading-relaxed max-w-4xl text-center">We are building measure for mobile devs like you. Help us make it the best tool for the job!</p>
        <div className="py-4" />
        <EmailWaitlist />
        <div className="py-24" />
      </div>

    </main>
  )
}
