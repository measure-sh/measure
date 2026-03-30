"use client"

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { Fragment, useState } from 'react'
import landingHeroAnim from "./animations/landing_hero.json"
import { buttonVariants } from './components/button'
import LandingHeader from './components/landing_header'
import { cn } from './utils/shadcn_utils'

const Lottie = dynamic(() => import("lottie-react"), { ssr: false })

import { Badge } from './components/badge'
import LandingFooter from './components/landing_footer'

import AdaptiveCaptureDemo from './components/adaptive_capture_demo'
import MCPDemo from './components/mcp_demo'
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
const NetworkOverview = dynamic(() => import('./components/network_overview'), { ssr: false })

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
    {
      title: "Network Performance",
      description: "Monitor network request latency and status codes across your app 🌐. See HTTP status distributions over time, find the slowest and most error-prone endpoints and visualize when network requests happen during a session."
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
        <div className="flex flex-col w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-sm font-display text-center">TRUSTED BY HIGH GROWTH MOBILE TEAMS</p>
          </div>
          <div className="py-8" />
          <div className="w-full max-w-6xl overflow-hidden" style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
            <div className="flex items-center w-max" style={{ animation: 'marquee 30s linear infinite' }}>
              {[...Array(2)].map((_, i) => (
                <Fragment key={i}>
                  <div className="w-[40px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <KukuFmLogo className="w-full h-full object-contain" />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/hoichoi_logo.svg"
                      alt="Hoichoi Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/country_delight_logo.png"
                      alt="Country Delight Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="w-[140px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/dashreels_logo.png"
                      alt="Dashreels Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="w-[120px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/turtlemint_logo.svg"
                      alt="Turtelmint Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/astro_logo.png"
                      alt="Astro Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/allofresh_logo.png"
                      alt="Allofresh Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/smcindia_logo.png"
                      alt="SMC India Logo"
                      fill
                      className="object-contain dark:hidden"
                    />
                    <Image
                      src="/images/smcindia_logo_dark.png"
                      alt="SMC India Logo"
                      fill
                      className="object-contain hidden dark:block"
                    />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/even_logo.png"
                      alt="Even Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/karya_logo.png"
                      alt="Karya Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                </Fragment>
              ))}
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
              <NetworkOverview demo={true} hideDemoTitle={false} key={`demo-network`} />,
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

        {/* Adaptive Capture */}
        <div className='w-full flex items-center flex-col py-16 md:py-24'>
          <h2 className="font-display font-regular text-4xl max-w-4xl text-center px-4">Collect what you need, Only when you need it</h2>
          <div className="py-4" />
          <p className="text-lg leading-relaxed font-body text-justify max-w-4xl px-4">Most monitoring data rots away in a warehouse and runs up your costs 💰. Our <Link href="/product/adaptive-capture" className={underlineLinkStyle}>Adaptive Capture</Link> feature lets you control and dynamically change what data to collect without needing to roll out app updates.</p>
          <div className="py-8" />
          <div className='max-w-6xl'>
            <AdaptiveCaptureDemo showTitle={false} />
          </div>
        </div>

        {/* MCP */}
        <div className='w-full flex items-center flex-col py-16 md:py-24'>
          <h2 className="font-display font-regular text-4xl max-w-4xl text-center px-4">Intelligent debugging, Seamless integration</h2>
          <div className="py-4" />
          <p className="text-lg leading-relaxed font-body text-justify max-w-4xl px-4">Connect Measure with your favorite coding agents through our <Link href="/product/mcp" className={underlineLinkStyle}>MCP</Link> server. Let your coding agent query errors, traces, and session timelines directly in your development workflow.</p>
          <div className="py-8" />
          <div className='w-full md:w-6xl'>
            <MCPDemo />
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
              <p className='text-sm font-display text-center mt-4'><Link href="/auth/login" className={underlineLinkStyle}>Measure Cloud</Link> for convenience or <Link href="/docs/hosting" className={underlineLinkStyle}>Self Host</Link></p>
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
