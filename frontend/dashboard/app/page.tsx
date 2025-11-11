"use client"

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import landingHeroAnim from "./animations/landing_hero.json"
import { buttonVariants } from './components/button'
import LandingHeader from './components/landing_header'
import { cn } from './utils/shadcn_utils'

const Lottie = dynamic(() => import("lottie-react"), { ssr: false })

import { Badge } from './components/badge'
import LandingFooter from './components/landing_footer'

import AdaptiveCaptureDemo from './components/adaptive_capture_demo'
import TabSelect, { TabSize } from './components/tab_select'
import Typewriter from './components/typewriter'
import { underlineLinkStyle } from './utils/shared_styles'

const BugReport = dynamic(() => import('./components/bug_report'), { ssr: false })
const UserJourneys = dynamic(() => import('./components/user_journeys'), { ssr: false })
const Overview = dynamic(() => import('./components/overview'), { ssr: false })
const TraceDetails = dynamic(() => import('./components/trace_details'), { ssr: false })
const SessionTimeline = dynamic(() => import('./components/session_timeline'), { ssr: false })
const ExceptionsDetails = dynamic(
  () => import('./components/exceptions_details').then((mod) => (mod.ExceptionsDetails as unknown) as React.ComponentType<any>),
  { ssr: false }
)

const KukuFmLogo = ({ className }: { className?: string }) => (
  <svg
    width="559"
    height="561"
    viewBox="0 0 559 561"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M345.006 506.857C353.85 520.739 379.752 527.05 379.752 545.35V547.874C379.752 555.446 374.066 559.863 365.222 559.863H233.185C224.34 559.863 218.654 554.815 218.654 547.243V544.718C218.654 527.05 242.029 522.632 231.921 506.857L177.59 422.299C166.85 424.192 156.11 425.454 144.107 425.454V490.45C144.107 519.477 172.536 527.05 172.536 545.35V547.874C172.536 555.446 166.218 559.863 157.374 559.863H20.2826C11.438 559.863 5.12044 555.446 5.12044 547.874V545.35C5.12044 527.05 30.3907 519.477 30.3907 490.45V121.098C30.3907 91.4394 0.0664062 83.236 0.0664062 67.4603V64.9361C0.0664062 57.9948 5.75215 54.8397 14.5968 50.4224L115.678 3.72621C133.367 -4.47719 144.107 4.98825 144.107 16.9779V380.651C252.769 371.185 207.914 251.289 284.989 251.289C319.104 251.289 334.266 272.113 334.266 297.986C334.266 327.013 310.891 364.244 266.036 391.378L345.006 506.857Z"
      fill="currentColor"
    />
    <ellipse cx="469.054" cy="471.319" rx="89.0544" ry="89.053" fill="#EC1C24" />
  </svg>
);

const RapidoLogo = ({ className }: { className?: string }) => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 122.1 65"
    className={className}
  >
    <g>
      <path
        fill="currentColor"
        d="M6.6,51.9c-0.2,2.6-0.7,3.6-3.1,3.6c-1.7,0-1.1,0-2.8,0c-0.4,0-0.6-0.1-0.6-0.6c0-4.5-0.2-9.1,0.3-13.6
        C1,36.2,4.6,33,10,32.3c1.2-0.2,2.3-0.2,3.5-0.2c0.5,0,0.7,0.1,0.7,0.6c0,1.7-0.1,3.4,0,5c0,0.5-0.2,0.7-0.7,0.7c-1,0-2-0.1-3,0.1
        c-2.3,0.4-3.6,1.7-3.7,4c0,0.4-0.1,0.9-0.1,1.3c0,1.6,0,3.3,0,4.9"
      />
      <path
        fill="currentColor"
        d="M71.7,52.2c0,2.2-1.6,3.8-3.7,3.8c-2.1,0-3.7-1.5-3.8-3.7c0-4.8,0-9.6,0.1-14.4c0-1.9,1.8-3.4,3.7-3.5c2,0,3.7,1.5,3.7,3.5
        c0.1,2.4,0,4.8,0,7.2"
      />
      <path
        fill="#FFCA20"
        d="M58.3,10.6c-1.8-1.5-3.3-2.9-4.8-4.2c-0.4-0.3-0.7-0.1-1.1,0c-1.7,0.4-3.4-0.3-4.2-1.6
        c-0.8-1.3-0.5-2.9,0.7-3.9c1.3-1.1,3.5-1.2,4.9-0.2c1.4,1,1.8,2.7,0.9,4.1c-0.4,0.5-0.2,0.8,0.2,1.1c1.7,1.4,3.4,2.9,5,4.3
        c0.3,0.2,0.6,0.4,0.9,0.5c0.8,0.3,1.3,1,1.1,1.8c-0.1,0.9-0.7,1.5-1.6,1.5c-2.9,0.1-5.8,0-8.7,0c-1.1,0-1.8-0.9-1.7-1.8
        c0-1,0.8-1.7,2-1.7c1.7,0,3.3,0,5,0C57.2,10.6,57.6,10.6,58.3,10.6z"
      />
      <path
        fill="#FFCA20"
        d="M77.6,10.8c2.2,0,4.3,0,6.4,0c1.4,0,2.2,0.7,2.2,1.8c0,1-0.9,1.7-2.2,1.7c-2.7,0-5.4,0.1-8.1-0.1
        c-1-0.1-1.6-0.5-1.8-1.4c-0.2-0.9,0.2-1.6,1.1-2c0.3-0.1,0.6-0.3,0.8-0.6c1.6-1.5,3.1-3,4.7-4.5c0.4-0.4,0.5-0.7,0.3-1.2
        c-0.6-1.5-0.1-3,1.3-3.9C83.9-0.1,86,0,87.3,1.2c1.1,1,1.4,2.5,0.6,3.8c-0.8,1.3-2.7,2.2-4.2,1.6c-1.3-0.5-1.9,0-2.6,0.7
        c-1.1,1.1-2.2,2.1-3.3,3.1C77.7,10.5,77.7,10.5,77.6,10.8z"
      />
      <path
        fill="#FFCA20"
        d="M72.8,10.4c0,2.4-2.3,4.4-5,4.4c-2.7,0-5-2-5-4.4c0-2.4,2.4-4.5,5.1-4.4C70.7,6,72.9,8,72.8,10.4z"
      />
      <path
        fill="currentColor"
        d="M44.7,53c1.9,2,2.6,2.5,4.2,2.9c4.8,1.2,9.2-0.8,11.3-5.2c0.9-1.9,1.3-4,1.4-6c0-0.9,0-1.7,0-2.6c0.1-2.6-0.8-5-2.5-7.1
        c-0.7-0.8-1.4-1.6-2.6-1.7c-3.1-1.5-6.3-1.9-9.7-1.1c-4,0.9-7.4,2.6-8.3,6.8c-0.2,1.1-0.3,2.1-0.3,3.2c0,3.5,0,7-0.1,10.6
        c0,3.7-0.1,7.4-0.1,11.1c0,0.4,0.1,0.6,0.6,0.6c0.9,0,1.8,0,2.8,0c1.8-0.1,3-1.3,3-3 M54.3,48.2C53.5,50,52,51,49.9,50.9
        c-2.2,0-3.6-1.1-4.5-2.9c-0.6-1.2-0.7-2.6-0.7-3.9c0.1-1.5,0.1-2.9,0.7-4.2c0.8-1.9,2.2-2.9,4.4-3c2.1-0.1,3.7,0.8,4.6,2.6
        C55.6,42.5,55.6,45.4,54.3,48.2z"
      />
      <path
        fill="currentColor"
        d="M97.7,28.4c0-1.4-1.2-2.6-2.7-2.8c-0.9-0.1-1.8,0-2.8-0.1c-0.7,0-0.9,0.1-0.9,0.8c0.1,1.7,0,3.4,0,5c0,1.3,0,2.4,0,3.6
        c-1.7-1.9-3.2-2.8-6.2-3.1c-2-0.2-3.9,0.3-5.6,1.2c-0.9,0.5-0.8,0.6-1.2,0.9c-1.2,1-2,2.3-2.8,3.7c-0.9,1.8-1.2,3.4-1.3,5.3
        c-0.1,1.8,0,3.6,0.4,5.3c0.8,3.5,2.5,6.4,6.5,7.5c2.6,0.7,5.2,0.9,7.8,0.2c5.7-1.4,8.3-3.5,8.5-9.2C97.8,40.7,97.7,34.5,97.7,28.4z
        M90.5,48.2c-0.8,1.8-2.1,2.9-4.2,3c-2.1,0.1-3.8-0.7-4.6-2.6c-1.3-2.8-1.4-5.7-0.1-8.6c0.8-1.9,2.4-2.9,4.7-2.8
        c2.1,0.1,3.7,1.2,4.4,3.2c0.5,1.1,0.6,2.3,0.6,3.6C91.2,45.4,91.1,46.9,90.5,48.2z"
      />
      <path
        fill="currentColor"
        d="M36.3,38.4c0-2.9-1.4-4.9-4.3-5.9c-3.2-1.1-6.5-1.2-9.8-0.5c-3,0.6-5.1,2.4-6,5.3c-0.2,0.7-0.1,1,0.7,0.9
        c1.1-0.1,2.3,0,3.4,0c1,0,2.1,0.2,2.8-0.9c0.1-0.2,0.5-0.3,0.8-0.4c1.7-0.5,3.4-0.4,5.1,0.2c0.7,0.2,1,0.7,1.1,1.4
        c0.1,0.7-0.3,1.2-0.8,1.5c-0.8,0.5-1.7,0.7-2.7,0.9c-1.9,0.3-3.9,0.4-5.7,1c-1.9,0.6-3.7,1.3-4.7,3c-2.8,4.7,0,10.3,5.7,11.1
        c2,0.3,4,0.1,5.9-0.1c4.5-0.5,7.7-2.9,8.2-6.7c0.3-2.5,0.2-4.4,0.3-6.2C36.3,41.1,36.3,39.8,36.3,38.4z M30.1,45.7
        c0,3.7-2.3,5.8-5.9,5.6c-1.6-0.1-2.6-0.9-2.8-2.2c-0.3-1.5,0.4-2.7,1.8-3.3c1-0.4,2.1-0.6,3.2-0.8c0.7-0.2,1.4-0.3,2.1-0.5
        C30.1,44,30.1,43.9,30.1,45.7z"
      />
      <path
        fill="#FFCA20"
        d="M79.6,33.1c-3.3,2.2-4.7,5.4-5.1,9.1c0,0.3-0.1,0.5-0.1,0.8c0-1.6,0-3.3,0-4.9c0-3.7-2.1-5.6-6-5.8
        c-2.2-0.1-4.2,0.3-5.6,2c-0.8,1-1.1,2.1-1.1,3.3c0,2.3,0,4.7-0.1,7c-0.1-2.2-0.1-4.3-0.9-6.4c-0.8-2.1-2-3.9-4.1-5
        c0-3.7,0.1-7.5,0.1-11.2c0-3.2,2.5-5.6,5.9-5.7c3.7,0,7.4,0,11.2,0c3.5,0,5.9,2.6,5.9,5.8C79.5,25.9,79.6,29.5,79.6,33.1z"
      />
      <path
        fill="currentColor"
        d="M121.9,41.5c-0.8-5.8-4.8-9.3-10.9-9.4c-5.3-0.1-9.1,2.2-10.7,6.4c-0.7,1.8-1,3.8-0.9,5.6c0,0.4,0,0.7,0,1
        c0.2,2.7,0.5,5.4,2.3,7.6c2.7,3.3,6.6,4.2,10.7,3.8c4.8-0.5,7.8-3.1,9.1-7.5C122.2,46.5,122.3,44,121.9,41.5z M115.7,43.9
        c0,1.6-0.2,3-0.7,4.3c-1.1,2.9-4.1,4-6.8,2.5c-0.9-0.5-1.5-1.3-1.8-2.2c-0.8-2.4-1-4.9-0.4-7.3c0.6-2.6,2.4-4,5-3.9
        c2.2,0.1,4,1.7,4.5,4.2C115.7,42.4,115.8,43.2,115.7,43.9z"
      />
      <g fill="currentColor">
        <path d="M64.2,58.3h2.1c0.9,0,1.6,0.1,2.1,0.4C68.8,59,69,59.4,69,60c0,0.4-0.1,0.7-0.3,1c-0.2,0.3-0.4,0.4-0.7,0.5v0
          c0.4,0.1,0.7,0.3,0.9,0.5c0.2,0.3,0.3,0.6,0.3,1c0,0.6-0.2,1.1-0.7,1.4c-0.4,0.3-1,0.5-1.8,0.5h-2.5V58.3L64.2,58.3z M65.6,60.9
          h0.8c0.4,0,0.7-0.1,0.8-0.2c0.2-0.1,0.3-0.3,0.3-0.6c0-0.3-0.1-0.4-0.3-0.6c-0.2-0.1-0.5-0.2-0.9-0.2h-0.7L65.6,60.9L65.6,60.9z
          M65.6,62.1v1.7h0.9c0.4,0,0.7-0.1,0.9-0.2c0.2-0.1,0.3-0.4,0.3-0.7c0-0.6-0.4-0.8-1.2-0.8H65.6z" />
        <path d="M72.4,65v-6.7h1.4V65H72.4z" />
        <path d="M82.8,65h-1.6l-1.8-2.8l-0.6,0.4V65h-1.4v-6.7h1.4v3.1l0.6-0.8l1.8-2.3h1.6l-2.3,3L82.8,65z" />
        <path d="M89.3,65h-3.9v-6.7h3.9v1.2h-2.4v1.5h2.3v1.2h-2.3v1.7h2.4V65z" />
        <path d="M99.5,65h-1.4v-5.5h-1.8v-1.2h5.1v1.2h-1.8L99.5,65L99.5,65z" />
        <path d="M108.3,65l-0.5-1.6h-2.4l-0.5,1.6h-1.5l2.4-6.7h1.7l2.4,6.7H108.3z M107.5,62.2c-0.4-1.4-0.7-2.3-0.8-2.5
          c-0.1-0.2-0.1-0.3-0.1-0.4c-0.1,0.4-0.4,1.4-0.9,2.9H107.5z" />
        <path d="M118,65h-1.6l-1.6-2.5l-1.6,2.5h-1.5l2.2-3.5l-2.1-3.2h1.6l1.4,2.4l1.4-2.4h1.5l-2.1,3.3L118,65z" />
        <path d="M120.7,65v-6.7h1.4V65H120.7z" />
      </g>
    </g>
  </svg>
);

export default function Home() {
  const testimonials = [
    {
      name: "Hussain Mustafa",
      profile_pic_url: "/images/testimonial_pics/hussain.jpg",
      content: "I've been using measure.sh lately to monitor my mobile apps and host it myself and it has been a delight. Definitely recommend it to anyone looking for an open source mobile app monitoring tool.",
      url: 'https://x.com/husslingaround/status/1855983892294983980',
      platform: 'x',
    },
    {
      name: "Aditya Pahilwani",
      profile_pic_url: "/images/testimonial_pics/aditya.jpg",
      content: "I'm surprised this hasn't gained more attention yet—it's incredibly exciting for the mobile space, where we definitely lack observability and measure addresses so many of those gaps.",
      url: 'https://x.com/AdityaPahilwani/status/1843561672188821520',
      platform: 'x',
    },
    {
      name: "Sutirth Chakravarty",
      profile_pic_url: "/images/testimonial_pics/sutirth.jpeg",
      content: "When I stumbled upon measure.sh, I was blown away!\n\n🚀Crash-free sessions improved dramatically—now hitting a mythical 99.99% consistently.\n📊 Logs, metrics, traces—finally stitched together in one view.\n⚡️ Our hot & warm app startup times? Looking great!",
      url: 'https://www.linkedin.com/posts/sutirthchakravarty_circa-early-2024-i-had-the-chance-to-attend-activity-7317570327520124928-yo1s',
      platform: 'linkedin',
    },
    {
      name: "Ragunath Jawahar",
      profile_pic_url: "/images/testimonial_pics/raghunath.jpg",
      content: "The good folks at measure.sh have been working on a mobile app monitoring platform for several months now and have open-sourced it. Do check it out and show it some love!\n\nThis is quite a strong team that led several mobile platform initiatives at Gojek.",
      url: 'https://x.com/ragunathjawahar/status/1825490936857522290',
      platform: 'x',
    },
    {
      name: "Iniyan Murugavel",
      profile_pic_url: "/images/testimonial_pics/iniyan.jpeg",
      content: "I'm personally a fan. Not just of the product, but of the minds behind it.\n\nIt's built by some of the sharpest mobile engineers I've admired for years. Folks who live and breathe performance, scaling, and observability.\n\nThis isn't just another tool. It's crafted with intent, care, and deep expertise.",
      url: 'https://www.linkedin.com/posts/iniyanarul_crashes-were-observed-first-on-measure-activity-7316853914589413377-gFd_/',
      platform: 'linkedin',
    },
    {
      name: "Tuist",
      profile_pic_url: "/images/testimonial_pics/tuist.jpeg",
      content: "Looking for a way to keep tabs on your mobile apps? How about using a free and open-source solution? Consider exploring measure.sh!",
      url: 'https://www.linkedin.com/posts/tuistio_github-measure-shmeasure-measure-is-an-activity-7312413362292719616-DUlU',
      platform: 'linkedin',
    }
  ];

  const features = [
    {
      title: "App Health",
      description: "Monitor important metrics to stay on top of app health 📈. From app adoption to crash rates, launch times to app size, quickly see the most important metrics to make sure you're moving in the right direction."
    },
    {
      title: "Session Timelines",
      description: "Debug issues easily with full session timelines 🎥. Get rich, complete context with automatic tracking for clicks, navigations, logs, http calls, memory usage, cpu usage, stacktraces and more."
    },
    {
      title: "Crashes and ANRs",
      description: "Automatically track Crashes and ANRs 💥. Dive deeper with detailed stacktraces, common path analysis,  complete session timelines, distribution graphs and screenshots."
    },
    {
      title: "Performance Traces",
      description: "Analyze app performance with traces and spans 🔍. Break down complex operations with parent - child hierarchies to figure out bottlenecks and intelligently smooth them out."
    },
    {
      title: "Bug Reports",
      description: "Capture bug reports 🐞 with a device shake or SDK function call. Get full history of user actions leading to the bug along with detailed context of device, network and environment. Easily close bug reports when resolved or re-open them if needed.",
    },
    {
      title: "User Journeys",
      description: "Understand how users move through your app 🧭. Use it to prioritize performance fixes in the most popular paths, see which routes are most affected by issues or see if that new feature you built is gaining traction."
    },
  ];

  const [featureIndex, setFeatureIndex] = useState(0);

  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        {/* Hero */}
        <div className="py-16" />
        <h1 className="text-4xl leading-relaxed font-body md:w-4xl text-center px-4">
          <span className="font-medium">Open Source Mobile App Monitoring to&nbsp;</span>
          <br />
          <Typewriter
            phrases={[
              { normal: 'upgrade from', highlighted: 'Firebase Crashlytics' },
              { normal: 'track', highlighted: 'Crashes' },
              { normal: 'track', highlighted: 'ANRs' },
              { normal: 'trace', highlighted: 'Performance' },
              { normal: 'collect', highlighted: 'Bug Reports' },
              { normal: 'analyze', highlighted: 'User Journeys' },
              { normal: 'debug with', highlighted: 'Complete Context' },
            ]}
            typingSpeed={180}
            deletingSpeed={10}
            pause={1200}
          />
        </h1>
        <div className="py-6" />
        <div className='w-80 h-80 md:w-[28rem] md:h-[20rem]'>
          <Lottie animationData={landingHeroAnim} className='dark:sepia dark:invert' />
        </div>

        {/* Main description */}
        <div className="py-8 md:py-14" />
        <h2 className="text-4xl leading-relaxed font-display md:w-3xl text-center px-4">
          Stop stitching context. Fix issues faster.
        </h2>
        <div className="py-2" />
        <p className="text-lg leading-relaxed font-body md:w-3xl text-justify px-4">
          Crashes, bug reports, performance signals and logs shouldn&apos;t be scattered across tools. Measure automatically captures all the info you need to get the full picture.
        </p>

        {/* CTA 1 */}
        <div className="py-4 md:py-8" />
        <Link
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get To The Root Cause
        </Link>


        {/* Trusted By */}
        <div className="py-16" />
        <div className="flex flex-col md:w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-sm font-display text-center">TRUSTED BY HIGH GROWTH MOBILE TEAMS</p>
          </div>
          <div className="py-2" />
          <div className="rounded-md grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-16 items-center justify-items-center p-8">
            <div className="w-[100px] h-[50px] relative flex items-center justify-center">
              <RapidoLogo className="w-full h-full object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all" />
            </div>
            <div className="w-[140px] h-[50px] relative flex items-center justify-center">
              <Image
                src="/images/turtlemint_logo.svg"
                alt="Turtelmint Logo"
                fill
                className="object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all"
              />
            </div>
            <div className="w-[100px] h-[50px] relative flex items-center justify-center">
              <KukuFmLogo className="w-full h-full object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all" />
            </div>
            <div className="w-[100px] h-[50px] relative flex items-center justify-center">
              <Image
                src="/images/country_delight_logo.webp"
                alt="Country Delight Logo"
                fill
                className="object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all"
              />
            </div>
            <div className="w-[100px] h-[50px] relative flex items-center justify-center">
              <Image
                src="/images/hoichoi_logo.svg"
                alt="Hoichoi Logo"
                fill
                className="object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all"
              />
            </div>
            <div className="w-[100px] h-[50px] relative flex items-center justify-center">
              <Image
                src="/images/even_logo.png"
                alt="Even Logo"
                fill
                className="object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all"
              />
            </div>
            <div className="w-[100px] h-[50px] relative flex items-center justify-center">
              <Image
                src="/images/vance_logo.svg"
                alt="Vance Logo"
                fill
                className="object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all"
              />
            </div>
            <div className="w-[100px] h-[50px] relative flex items-center justify-center">
              <Image
                src="/images/scapia_logo.png"
                alt="Scapia Logo"
                fill
                className="object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all"
              />
            </div>
            <div className="w-[100px] h-[50px] relative flex items-center justify-center">
              <Image
                src="/images/kolo_logo.svg"
                alt="Kolo Logo"
                fill
                className="object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all"
              />
            </div>
            <div className="w-[140px] h-[50px] relative flex items-center justify-center">
              <Image
                src="/images/dashreels_logo.png"
                alt="Dashreels Logo"
                fill
                className="object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all"
              />
            </div>
          </div>
        </div>
        <div className="py-8" />

        {/* Feature Demos */}
        <div className='w-full flex flex-col items-center py-16 md:py-24'>
          <h2 className="font-display font-regular text-4xl md:w-4xl text-center px-4">One dashboard, Complete context</h2>
          <div className="py-2 md:py-4" />
          <div className='w-full scale-65 md:scale-100 flex items-center justify-center'>
            <TabSelect size={TabSize.Large} items={Object.values(features.map(f => f.title))} selected={features[featureIndex].title}
              onChangeSelected={(item) => {
                setFeatureIndex(features.findIndex(f => f.title === item))
              }} />
          </div>
          <div className="py-2 md:py-4" />
          <p className="text-lg leading-relaxed font-body md:w-5xl text-justify px-4">{features[featureIndex].description}</p>
          <div className="py-2 md:py-4" />

          {/* MAIN DEMO CONTAINER */}
          {/* 1. mx-auto centers it. 
              2. relative keeps it in flow (below text). 
              3. overflow-hidden clips the "large" inner content.
           */}
          <div className="relative w-full max-w-[90vw] md:max-w-6xl h-[500px] md:h-[1000px] mx-auto border border-border rounded-lg shadow-xl overflow-hidden">
            {[
              <Overview demo={true} hideDemoTitle={false} key={`demo-overview`} />,
              <SessionTimeline demo={true} hideDemoTitle={false} key={`demo-session-timeline`} />,
              <ExceptionsDetails demo={true} hideDemoTitle={false} key={`demo-exceptions`} />,
              <TraceDetails demo={true} hideDemoTitle={false} key={`demo-trace`} />,
              <BugReport demo={true} hideDemoTitle={false} key={`demo-bugreport`} />,
              <UserJourneys demo={true} hideDemoTitle={false} key={`demo-journeys`} />,
            ].map((DemoComponent, idx) => (
              <div
                key={idx}
                aria-hidden={featureIndex !== idx}
                // Fade transition wrapper
                className={`absolute inset-0 w-full h-full transition-opacity duration-300 ease-in-out ${featureIndex === idx ? 'opacity-100 z-20' : 'opacity-0 pointer-events-none z-10'
                  }`}
              >
                {/* SCALING WRAPPER */}
                {/* Mobile: Scale 0.4 (40%) -> requires Width 250% (100/0.4) */}
                {/* Desktop: Scale 0.8 (80%) -> requires Width 125% (100/0.8) */}
                <div className="w-[250%] h-[250%] md:w-[125%] md:h-[125%] origin-top-left transform scale-[0.4] md:scale-[0.8]">
                  <div className="w-full h-full px-8 py-12 overflow-y-auto">
                    {DemoComponent}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Capture */}
        <div className='w-full flex items-center flex-col py-16 md:py-24'>
          <h2 className="font-display font-regular text-4xl max-w-4xl text-center px-4">Collect what you need, Only when you need it</h2>
          <div className="py-4" />
          <p className="text-lg leading-relaxed font-body text-justify max-w-4xl px-4">Most monitoring data rots away in a warehouse and runs up your costs 💰. Our <Link href="/product/adaptive-capture" className={underlineLinkStyle}>Adaptive Capture</Link> feature lets you control and dynamically change what data to collect without needing to roll out app updates.</p>
          <div className="py-8" />
          <div className='max-w-6xl'>
            <AdaptiveCaptureDemo showTitle={false} />
          </div>
        </div>

        {/* Testimonials */}
        <div className='w-full flex items-center flex-col py-16 md:py-24'>
          <h2 className="font-display font-regular text-4xl max-w-4xl text-center px-4">Tried it, Loved it ❤️</h2>
          <div className="py-4" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 md:gap-6 lg:gap-8 p-4 md:p-6 lg:p-8 w-full max-w-6xl">
            {testimonials.map((testimonial, index) => (
              <Link href={testimonial.url} key={index} target="_blank" rel="noopener noreferrer" className="h-full">
                <div className="flex flex-col h-full border border-border p-8 rounded-md bg-card text-card-foreground shadow-sm">
                  <div className='flex flex-row items-center gap-1 pt-2'>
                    <Image
                      src={testimonial.profile_pic_url}
                      alt={`${testimonial.name} Profile Picture`}
                      width={32}
                      height={32}
                      className="rounded-full border border-gray-300"
                    />
                    <p className='font-body text-sm'>{testimonial.name}</p>
                    <div className='flex grow' />
                    <Image
                      src={testimonial.platform === 'x' ? '/images/x_logo_black.png' : '/images/linkedin_logo_black.png'}
                      alt={`Social platform logo`}
                      width={32}
                      height={32}
                      className={`dark:hidden object-contain ${testimonial.platform === 'x' ? 'w-5 h-5' : 'w-8 h-8'}`}
                    />
                    <Image
                      src={testimonial.platform === 'x' ? '/images/x_logo_white.png' : '/images/linkedin_logo_white.png'}
                      alt={`Social platform logo`}
                      width={32}
                      height={32}
                      className={`hidden dark:block object-contain ${testimonial.platform === 'x' ? 'w-5 h-5' : 'w-8 h-8'}`}
                    />
                  </div>
                  <p className='mt-8 mb-4 font-sans flex-1 whitespace-pre-line'>{testimonial.content}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* For Mobile Developers */}
        <div className='w-full flex items-center flex-col py-16 md:py-24'>
          <h2 className="font-display font-regular text-4xl max-w-4xl text-center px-4">Built For Mobile Devs</h2>
          <div className="py-2" />
          <p className="text-lg leading-relaxed font-body md:w-4xl text-justify px-4">
            For us, Mobile is not an add-on to an observability product. It <b>is</b> the product. Measure is built by mobile engineers, for mobile engineers.
          </p>
          <div className="py-8" />
          <div className="flex flex-col md:flex-row bg-card text-card-foreground items-center justify-items-center w-full max-w-6xl">
            <div className='flex flex-col items-center justify-center w-full md:w-1/2 h-32 border-r md:border-r-0 border-l border-t border-border'>
              <p className='text-4xl font-body text-center'>Open Source</p>
              <div className="py-1" />
              <Link
                target="_blank"
                href="https://github.com/measure-sh/measure"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "group px-2",
                )}
              >
                <Image
                  src="/images/github_logo_black.svg"
                  width={24}
                  height={24}
                  className="w-4 h-4 dark:hidden group-hover:hidden"
                  alt={"GitHub logo"}
                />
                <Image
                  src="/images/github_logo_white.svg"
                  width={24}
                  height={24}
                  className="w-4 h-4 hidden dark:block group-hover:block"
                  alt={"GitHub logo"}
                />
                <span className="mt-0.5">Star us on Github</span>
              </Link>
            </div>
            <div className='flex flex-col items-center justify-center w-full md:w-1/2 h-32 border-l border-t border-r border-border'>
              <p className='text-4xl font-body text-center'>Flexible Hosting</p>
              <p className='text-sm font-display text-center mt-4'><Link href="/auth/login" className={underlineLinkStyle}>Measure Cloud</Link> for convenience or <Link href="https://github.com/measure-sh/measure/blob/main/docs/hosting/README.md" target='_blank' className={underlineLinkStyle}>Self Host</Link></p>
            </div>
          </div>
          <div className='w-full bg-card text-card-foreground border border-border p-12 max-w-6xl'>
            <p className='text-4xl font-body text-center'>Every mobile platform</p>
            <div className="py-4" />
            <div className='flex flex-row gap-16 items-center justify-center flex-wrap'>
              <div className="w-[64px] h-[64px] relative flex items-center justify-center">
                <Image
                  src="/images/android_logo.svg"
                  alt="Android Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="w-[64px] h-[64px] relative flex items-center justify-center">
                <Image
                  src="/images/ios_logo.svg"
                  alt="iOS Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="w-[64px] h-[48px] relative flex items-center justify-center">
                <Image
                  src="/images/flutter_logo.svg"
                  alt="Flutter Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="w-[64px] h-[48px] relative flex items-center justify-center">
                <Badge variant="outline" className='select-none absolute -bottom-8 font-body text-[10px]'>Coming Soon</Badge>
                <Image
                  src="/images/react_native_logo.png"
                  alt="React Native Logo"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CTA 2 */}
        <div className="py-8 md:py-12" />
        <Link
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get To The Root Cause
        </Link>
        <div className="py-12 md:py-18" />
      </div>
      <LandingFooter />
    </main>
  )
}
