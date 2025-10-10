"use client"

import { KeyRound } from 'lucide-react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState } from 'react'
import landingHeroAnim from "./animations/landing_hero.json"
import { buttonVariants } from './components/button'
import LandingHeader from './components/landing_header'
import VideoPlayButton from './components/video_play_button'
import { cn } from './utils/shadcn_utils'

const Lottie = dynamic(() => import("lottie-react"), { ssr: false })

type VideoName = 'session' | 'bugReport' | 'perf' | 'journey' | 'appHealth' | 'exceptions'

type IsPlayingState = {
  [K in VideoName]: boolean;
}

type VideoRefs = {
  [K in VideoName]: React.RefObject<HTMLVideoElement>;
}

export default function Home() {

  const [isPlaying, setIsPlaying] = useState<IsPlayingState>({
    session: false,
    bugReport: false,
    perf: false,
    journey: false,
    appHealth: false,
    exceptions: false,
  })

  const videoRefs: VideoRefs = {
    session: useRef<HTMLVideoElement>(null),
    bugReport: useRef<HTMLVideoElement>(null),
    perf: useRef<HTMLVideoElement>(null),
    journey: useRef<HTMLVideoElement>(null),
    appHealth: useRef<HTMLVideoElement>(null),
    exceptions: useRef<HTMLVideoElement>(null),
  }

  const handlePlay = (videoName: VideoName) => {
    const video = videoRefs[videoName].current;
    if (video) {
      if (video.paused) {
        video.play();
        setIsPlaying(prev => ({ ...prev, [videoName]: true }));
      } else {
        video.pause();
        setIsPlaying(prev => ({ ...prev, [videoName]: false }));
      }
    }
  }

  return (
    <main className="flex flex-col items-center justify-between selection:bg-yellow-200/75">
      <LandingHeader />
      <div className="flex flex-col items-center md:w-4/5 px-16">
        <div className="py-16" />
        <p className="font-display font-regular text-black text-8xl max-w-6xl text-center">measure</p>
        <div className="py-2" />
        <p className="text-lg leading-relaxed font-body text-black max-w-4xl text-center">open source tool to monitor mobile apps</p>
        <div className="py-8" />
        <div className='w-80 h-80 md:w-[56rem] md:h-[40rem]'>
          <Lottie animationData={landingHeroAnim} />
        </div>
        <div className="py-12 md:py-32" />
        <div className="flex flex-col md:w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-6xl font-regular text-black font-display text-center">Session Timelines</p>
            <div className="py-2" />
            <p className="text-lg text-center leading-relaxed font-body text-black">Debug issues easily with full session timelines. Get the complete context with automatic tracking for clicks, navigations, http calls and more.</p>
          </div>
          <div className="py-8" />
          <div className='border border-cyan-400 rounded-3xl p-4 w-80 h-80 md:w-[56rem] md:h-[40rem] bg-cyan-200'>
            <div className='relative flex bg-white rounded-3xl h-full border border-cyan-400 items-center justify-center overflow-hidden'>
              <video
                ref={videoRefs.session}
                src="/videos/session.webm"
                poster='/images/session_poster.png'
                preload='none'
                loop
                muted
                playsInline
                className="w-full h-full rounded-3xl"
                onPlay={() => setIsPlaying(prev => ({ ...prev, session: true }))}
                onPause={() => setIsPlaying(prev => ({ ...prev, session: false }))}
              />
              {!isPlaying.session &&
                <VideoPlayButton onClick={() => handlePlay('session')} />
              }
            </div>
          </div>
        </div>
        <div className="py-12 md:py-16" />
        <div className="flex flex-col md:w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-6xl font-regular text-black font-display text-center">Bug Reports</p>
            <div className="py-2" />
            <p className="text-lg text-center leading-relaxed font-body text-black">Capture bug reports with a device shake or SDK call. Get full history of user actions leading to the bug.</p>
          </div>
          <div className="py-8" />
          <div className='border border-amber-400 rounded-3xl p-4 w-80 h-80 md:w-[56rem] md:h-[40rem] bg-amber-200'>
            <div className='relative flex bg-white rounded-3xl h-full border border-amber-400 items-center justify-center overflow-hidden'>
              <video
                ref={videoRefs.bugReport}
                src="/videos/bug_report.webm"
                poster='/images/bug_report_poster.png'
                preload='none'
                loop
                muted
                playsInline
                className="w-full h-full rounded-3xl"
                onPlay={() => setIsPlaying(prev => ({ ...prev, bugReport: true }))}
                onPause={() => setIsPlaying(prev => ({ ...prev, bugReport: false }))}
              />
              {!isPlaying.bugReport &&
                <VideoPlayButton onClick={() => handlePlay('bugReport')} />
              }
            </div>
          </div>
        </div>
        <div className="py-12 md:py-16" />
        <div className="flex flex-col md:w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-6xl font-regular text-black font-display text-center">Performance Traces</p>
            <div className="py-2" />
            <p className="text-lg text-center leading-relaxed font-body text-black">Analyze app performance with traces and spans. Break down complex issues and intelligently smoothen out bottlenecks.</p>
          </div>
          <div className="py-8" />
          <div className='border border-pink-400 rounded-3xl p-4 w-80 h-80 md:w-[56rem] md:h-[40rem] bg-pink-200'>
            <div className='relative flex bg-white rounded-3xl h-full border border-pink-400 items-center justify-center overflow-hidden'>
              <video
                ref={videoRefs.perf}
                src="/videos/perf.webm"
                poster='/images/perf_poster.png'
                preload='none'
                loop
                muted
                playsInline
                className="w-full h-full rounded-3xl"
                onPlay={() => setIsPlaying(prev => ({ ...prev, perf: true }))}
                onPause={() => setIsPlaying(prev => ({ ...prev, perf: false }))}
              />
              {!isPlaying.perf &&
                <VideoPlayButton onClick={() => handlePlay('perf')} />
              }
            </div>
          </div>
        </div>
        <div className="py-12 md:py-16" />
        <div className="flex flex-col md:w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-6xl font-regular text-black font-display text-center">User Journeys</p>
            <div className="py-2" />
            <p className="text-lg text-center leading-relaxed font-body text-black">Understand how users move through your app. Easily visualise screens most affected by issues.</p>
          </div>
          <div className="py-8" />
          <div className='border border-emerald-400 rounded-3xl p-4 w-80 h-80 md:w-[56rem] md:h-[40rem] bg-emerald-200'>
            <div className='relative flex bg-white rounded-3xl h-full border border-emerald-400 items-center justify-center overflow-hidden'>
              <video
                ref={videoRefs.journey}
                src="/videos/journey.webm"
                poster='/images/journey_poster.png'
                preload='none'
                loop
                muted
                playsInline
                className="w-full h-full rounded-3xl"
                onPlay={() => setIsPlaying(prev => ({ ...prev, journey: true }))}
                onPause={() => setIsPlaying(prev => ({ ...prev, journey: false }))}
              />
              {!isPlaying.journey &&
                <VideoPlayButton onClick={() => handlePlay('journey')} />
              }
            </div>
          </div>
        </div>
        <div className="py-12 md:py-16" />
        <div className="flex flex-col md:w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-6xl font-regular text-black font-display text-center">App Health</p>
            <div className="py-2" />
            <p className="text-lg text-center leading-relaxed font-body text-black">Monitor important metrics to stay on top of app health. Quickly see deltas to make sure you&apos;re moving in the right direction.</p>
          </div>
          <div className="py-8" />
          <div className='border border-violet-400 rounded-3xl p-4 w-80 h-80 md:w-[56rem] md:h-[40rem] bg-violet-200'>
            <div className='relative flex bg-white rounded-3xl h-full border border-violet-400 items-center justify-center overflow-hidden'>
              <video
                ref={videoRefs.appHealth}
                src="/videos/app_health.webm"
                poster='/images/app_health_poster.png'
                preload='none'
                loop
                muted
                playsInline
                className="w-full h-full rounded-3xl"
                onPlay={() => setIsPlaying(prev => ({ ...prev, appHealth: true }))}
                onPause={() => setIsPlaying(prev => ({ ...prev, appHealth: false }))}
              />
              {!isPlaying.appHealth &&
                <VideoPlayButton onClick={() => handlePlay('appHealth')} />
              }
            </div>
          </div>
        </div>
        <div className="py-12 md:py-16" />
        <div className="flex flex-col md:w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-6xl font-regular text-black font-display text-center">Crashes and ANRs</p>
            <div className="py-2" />
            <p className="text-lg text-center leading-relaxed font-body text-black">Automatically track Crashes and ANRs. Dive deeper with screenshots, filters and detailed stacktraces.</p>
          </div>
          <div className="py-8" />
          <div className='border border-rose-400 rounded-3xl p-4 w-80 h-80 md:w-[56rem] md:h-[40rem] bg-rose-200'>
            <div className='relative flex bg-white rounded-3xl h-full border border-rose-400 items-center justify-center overflow-hidden'>
              <video
                ref={videoRefs.exceptions}
                src="/videos/exceptions.webm"
                poster='/images/exceptions_poster.png'
                preload='none'
                loop
                muted
                playsInline
                className="w-full h-full rounded-3xl"
                onPlay={() => setIsPlaying(prev => ({ ...prev, exceptions: true }))}
                onPause={() => setIsPlaying(prev => ({ ...prev, exceptions: false }))}
              />
              {!isPlaying.exceptions &&
                <VideoPlayButton onClick={() => handlePlay('exceptions')} />
              }
            </div>
          </div>
        </div>
        <div className="py-12 md:py-16" />
        <p className="font-display font-regular text-black text-6xl max-w-4xl text-center">Open Source</p>
        <div className="py-4" />
        <p className="text-lg text-center leading-relaxed max-w-4xl font-body text-black">Full transparency with a welcoming community led by experienced mobile devs who have shipped apps to hundreds of millions of users since the early days of iOS and Android.</p>
        <div className="py-12 md:py-16" />
        <p className="font-display font-regular text-black text-6xl max-w-4xl text-center">Self host or Cloud</p>
        <div className="py-4" />
        <p className="text-lg text-center leading-relaxed max-w-4xl font-body text-black">Self host for full data privacy or use our cloud offering and avoid infra headaches.</p>
        <div className="py-16" />
        <p className="font-display font-regular text-black text-6xl max-w-4xl text-center">Measure on every platform</p>
        <div className="py-4 md:py-8" />
        <div className="flex flex-col md:flex-row items-center">
          <div className="flex flex-col items-center font-display text-black border border-black rounded-md py-4 px-8">
            <p className="text-center">Android</p>
          </div>
          <div className="py-2 md:px-4" />
          <div className="flex flex-col items-center font-display text-black border border-black rounded-md py-4 px-8">
            <p className="text-center">iOS</p>
          </div>
          <div className="py-2 md:px-4" />
          <div className="flex flex-col items-center font-display text-black border border-black rounded-md py-4 px-8">
            <p className="text-center">Flutter</p>
          </div>
          <div className="py-2 md:px-4" />
          <div className="flex flex-col items-center font-display text-neutral-400 border border-neutral-400 rounded-md py-2 px-8">
            <p className="text-center">React Native</p>
            <p className="text-xs text-center">In progress</p>
          </div>
        </div>
        <div className="py-12 md:py-16" />
        <p className="font-body text-black text-lg leading-relaxed max-w-4xl text-center">Let&apos;s get to the root cause...</p>
        <div className="py-2" />
        <div className='flex flex-row items-center'>
          <Link href="https://github.com/measure-sh/measure" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "m-4 font-display border border-black rounded-md select-none")}>
            <Image
              src='/images/github_logo.svg'
              width={16}
              height={16}
              alt={'Github logo'} />
            <p className='mt-1'>Self Host</p>
          </Link>
          <div className="px-2" />
          <Link
            href="/auth/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "font-display border border-black rounded-md select-none w-32",
            )}
          >
            <KeyRound />Login
          </Link>
        </div>
        <div className="py-24" />
      </div>
    </main>
  )
}
