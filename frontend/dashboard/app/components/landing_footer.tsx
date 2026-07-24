"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "../utils/shadcn_utils";
import { buttonVariants } from "./button_variants";
import { CookiePreferencesLink } from "./cookie_preferences_link";
import TrackGithubLink from "./analytics/track_github_link";

export default function LandingFooter() {
  return (
    <footer className="w-full bg-background text-foreground border-t border-border py-12">
      <div className="flex flex-col md:flex-row gap-12 md:gap-16 w-full px-16">
        <div className="flex flex-col items-center shrink-0">
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
          <p className="font-display text-sm text-center">
            &copy; {new Date().getFullYear()} Measure, Inc. All rights reserved.
          </p>
          <div className="py-4" />
          <TrackGithubLink
            target="_blank"
            href="https://github.com/measure-sh/measure"
            className={cn(buttonVariants({ variant: "outline" }), "group px-2")}
          >
            <Image
              src="/images/github_logo_black.svg"
              width={24}
              height={24}
              className="w-4 h-4 dark:hidden"
              alt={"GitHub logo"}
            />
            <Image
              src="/images/github_logo_white.svg"
              width={24}
              height={24}
              className="w-4 h-4 hidden dark:block"
              alt={"GitHub logo"}
            />
            <span className="mt-0.5">Star us on Github</span>
          </TrackGithubLink>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-x-8 gap-y-12 flex-1 min-w-0">
          <div className="flex flex-col items-center md:items-start gap-4">
            <p className="font-display text-2xl md:px-2">Product</p>
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
              href="/product/app-health"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              App Health
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
              href="/product/network-performance"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Network Performance
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
            <Link
              href="/product/agent"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Measure Agent
            </Link>
            <Link
              href="/product/mcp"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              MCP Server
            </Link>
          </div>

          <div className="flex flex-col items-center md:items-start gap-4">
            <p className="font-display text-2xl md:px-2">Platforms</p>
            <Link
              href="/for/android"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Android
            </Link>
            <Link
              href="/for/ios"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              iOS
            </Link>
            <Link
              href="/for/ipados"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              iPadOS
            </Link>
            <Link
              href="/for/kmp"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Kotlin Multiplatform
            </Link>
            <Link
              href="/for/flutter"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Flutter
            </Link>
            <Link
              href="/for/react-native"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              React Native
            </Link>
          </div>

          <div className="flex flex-col items-center md:items-start gap-4">
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
              href="/pricing"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Pricing
            </Link>
            <Link
              href="/docs"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Docs
            </Link>
            <Link
              href="https://blog.measure.sh/"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Blog
            </Link>
            <TrackGithubLink
              href="https://github.com/measure-sh/measure"
              target="_blank"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              GitHub
            </TrackGithubLink>
          </div>

          <div className="flex flex-col items-center md:items-start gap-4">
            <p className="font-display text-2xl md:px-2">Alternatives</p>
            <Link
              href="/crashlytics-alternative"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Firebase Crashlytics
            </Link>
            <Link
              href="/sentry-alternative"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Sentry
            </Link>
            <Link
              href="/bugsnag-alternative"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Bugsnag
            </Link>
            <Link
              href="/embrace-alternative"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Embrace
            </Link>
            <Link
              href="/luciq-alternative"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Luciq
            </Link>
            <Link
              href="/datadog-alternative"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Datadog
            </Link>
            <Link
              href="/new-relic-alternative"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              New Relic
            </Link>
          </div>

          <div className="flex flex-col items-center md:items-start gap-4">
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
              target="_blank"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "font-display select-none w-full md:w-fit",
              )}
            >
              Contact Us
            </Link>
            <Link
              href="/media_kit/measure.sh_media_kit.zip"
              download={"measure.sh_media_kit.zip"}
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

          <div className="flex flex-col items-center md:items-start gap-4">
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
            <CookiePreferencesLink>
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "font-display select-none w-full md:w-fit",
                )}
              >
                Cookie Preferences
              </button>
            </CookiePreferencesLink>
          </div>

          <div className="flex flex-col items-center md:items-start gap-4">
            <p className="font-display text-2xl md:px-2">Connect</p>
            <div className="flex flex-row items-center">
              <Link
                href="https://www.linkedin.com/company/measure-sh"
                target="_blank"
                className={cn(buttonVariants({ variant: "ghost" }), "group")}
              >
                <Image
                  src={"/images/linkedin_logo_black.webp"}
                  alt="LinkedIn Logo"
                  width={20}
                  height={20}
                  className="dark:hidden"
                />
                <Image
                  src={"/images/linkedin_logo_white.webp"}
                  alt="LinkedIn Logo"
                  width={20}
                  height={20}
                  className="hidden dark:block"
                />
              </Link>
              <Link
                href="https://x.com/measure_sh"
                target="_blank"
                className={cn(buttonVariants({ variant: "ghost" }), "group")}
              >
                <Image
                  src={"/images/x_logo_black.webp"}
                  alt="X Logo"
                  width={18}
                  height={18}
                  className="dark:hidden"
                />
                <Image
                  src={"/images/x_logo_white.webp"}
                  alt="X Logo"
                  width={18}
                  height={18}
                  className="hidden dark:block"
                />
              </Link>
              <Link
                href="https://bsky.app/profile/measure.sh"
                target="_blank"
                className={cn(buttonVariants({ variant: "ghost" }), "group")}
              >
                <Image
                  src={"/images/bluesky_logo.svg"}
                  alt="Bluesky Logo"
                  width={20}
                  height={20}
                  className="dark:invert"
                />
              </Link>
              <Link
                href="https://discord.com/invite/f6zGkBCt42"
                target="_blank"
                className={cn(buttonVariants({ variant: "ghost" }), "group")}
              >
                <Image
                  src={"/images/discord_logo.svg"}
                  alt="Discord Logo"
                  width={24}
                  height={24}
                  className="dark:invert"
                />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
