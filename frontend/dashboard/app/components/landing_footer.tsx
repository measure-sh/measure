"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "../utils/shadcn_utils";
import { buttonVariants } from "./button";

export default function LandingFooter() {
  return (
    <footer className="w-full bg-background text-foreground border-t border-border py-12">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-16 justify-between w-full px-16">
        <div className='flex flex-col items-center'>
          <Image
            src="/images/measure_logo_horizontal_black.svg"
            width={200}
            height={80}
            alt={"Measure logo"}
            className="dark:hidden"
          />
          <Image
            src="/images/measure_logo_horizontal_white.svg"
            width={200}
            height={80}
            alt={"Measure logo"}
            className="hidden dark:block"
          />
          <div className="py-2" />
          <p className='font-display text-sm text-center'>&copy; {new Date().getFullYear()} Measure, Inc. All rights reserved.</p>
          <div className="py-4" />
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

        <div className='flex flex-col items-center md:items-start gap-4'>
          <p className="font-display text-2xl md:px-2">Product</p>
          <Link
            href="/product/app-health"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            App Health
          </Link>
          <Link
            href="/product/session-timelines"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Session Timelines
          </Link>
          <Link
            href="/product/crashes-and-anrs"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Crashes & ANRs
          </Link>
          <Link
            href="/product/performance-traces"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Performance Traces
          </Link>
          <Link
            href="/product/bug-reports"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Bug Reports
          </Link>
          <Link
            href="/product/user-journeys"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            User Journeys
          </Link>
          <Link
            href="/product/adaptive-capture"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Adaptive Capture
          </Link>
        </div>

        {/* <div className='flex flex-col items-center md:items-start gap-4'>
          <p className="font-display text-2xl md:px-2">Alternatives</p>
          <Link
            href="/comparison/firebase-crashlytics"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Firebase Crashlytics
          </Link>
          <Link
            href="/comparison/sentry"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Sentry
          </Link>
          <Link
            href="/comparison/embrace"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Embrace
          </Link>
          <Link
            href="/comparison/bugsnag"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Bugsnag
          </Link>
          <Link
            href="/comparison/datadog"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Datadog
          </Link>
          <Link
            href="/comparison/new-relic"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            New Relic
          </Link>
        </div> */}

        <div className='flex flex-col items-center md:items-start gap-4'>
          <p className="font-display text-2xl md:px-2">Resources</p>
          <Link
            href="/why-measure"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Why Measure?
          </Link>
          <Link
            href="https://github.com/measure-sh/measure"
            target='_blank'
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            GitHub
          </Link>
          <Link
            href="https://github.com/measure-sh/measure?tab=readme-ov-file#docs"
            target="_blank"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Docs
          </Link>
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Pricing
          </Link>
        </div>

        <div className='flex flex-col items-center md:items-start gap-4'>
          <p className="font-display text-2xl md:px-2">Company</p>
          <Link
            href="/about"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            About
          </Link>
          <Link
            href="/security"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Security
          </Link>
          <Link
            href="mailto:hello@measure.sh"
            target='_blank'
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Contact Us
          </Link>
          <Link
            href="/media_kit/measure.sh_media_kit.zip"
            download={'measure.sh_media_kit.zip'}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Media Kit
          </Link>
        </div>

        <div className='flex flex-col items-center md:items-start gap-4'>
          <p className="font-display text-2xl md:px-2">Legal</p>
          <Link
            href="/privacy-policy"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms-of-service"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "font-display select-none w-full md:w-fit",
            )}
          >
            Terms of Service
          </Link>
        </div>

        <div className='flex flex-col items-center md:items-start gap-4'>
          <p className="font-display text-2xl md:px-2">Connect</p>
          <Link
            href="https://www.linkedin.com/company/measure-sh"
            target='_blank'
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "group w-full",
            )}
          >
            <Image
              src={'/images/linkedin_logo_black.png'}
              alt="LinkedIn Logo"
              width={22}
              height={22}
              className="dark:hidden group-hover:hidden"
            />
            <Image
              src={'/images/linkedin_logo_white.png'}
              alt="LinkedIn Logo"
              width={22}
              height={22}
              className="hidden dark:block group-hover:block"
            />
          </Link>
          <Link
            href="https://x.com/measure_sh"
            target='_blank'
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "group w-full py-2",
            )}
          >
            <Image
              src={'/images/x_logo_black.png'}
              alt="X Logo"
              width={20}
              height={20}
              className="dark:hidden group-hover:hidden"
            />
            <Image
              src={'/images/x_logo_white.png'}
              alt="X Logo"
              width={20}
              height={20}
              className="hidden dark:block group-hover:block"
            />
          </Link>
        </div>
      </div>
    </footer>
  );
}
