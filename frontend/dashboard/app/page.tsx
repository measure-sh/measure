import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import AdaptiveCaptureDemo from "./components/adaptive_capture_demo";
import { Badge } from "./components/badge";
import { buttonVariants } from "./components/button_variants";
import FeatureDemoCarousel from "./components/feature_demo_carousel";
import HandDrawnUnderline from "./components/hand_drawn_underline";
import LandingFooter from "./components/landing_footer";
import LandingHeader from "./components/landing_header";
import LandingHeroAnimation from "./components/landing_hero_animation";
import AIDemoCarousel from "./components/ai_demo_carousel";
import Testimonials from "./components/testimonials";
import TrackCtaLink from "./components/analytics/track_cta_link";
import TrackGithubLink from "./components/analytics/track_github_link";
import JsonLd from "./components/json_ld";
import {
  organizationJsonLd,
  softwareApplicationJsonLd,
  webSiteJsonLd,
} from "./utils/json_ld";
import { marketingPageMetadata } from "./utils/metadata";
import { cn } from "./utils/shadcn_utils";
import { underlineLinkStyle } from "./utils/shared_styles";

const seo = {
  title: "Open Source Mobile App Monitoring & Crash Reporting",
  description:
    "Measure helps mobile teams monitor and fix crashes, ANRs, bugs, and performance issues. The open source alternative to Firebase Crashlytics.",
  path: "/",
};

export const metadata: Metadata = marketingPageMetadata(seo);

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
    <ellipse
      cx="469.054"
      cy="471.319"
      rx="89.0544"
      ry="89.053"
      fill="#EC1C24"
    />
  </svg>
);

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-between">
      <JsonLd
        data={{
          "@graph": [
            organizationJsonLd,
            webSiteJsonLd,
            softwareApplicationJsonLd(seo.description),
          ],
        }}
      />
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        {/* Hero */}
        <div className="py-24" />
        <h1 className="text-4xl font-display md:w-4xl text-center px-4">
          Mobile apps <HandDrawnUnderline color="red">break</HandDrawnUnderline>
          , get to the{" "}
          <HandDrawnUnderline color="green">root cause</HandDrawnUnderline>{" "}
          faster.
        </h1>
        <div className="py-12" />
        <LandingHeroAnimation />

        {/* Main description */}
        <div className="py-8 md:py-14" />
        <h2 className="text-xl font-body md:w-4xl text-center px-4">
          Measure helps mobile teams monitor and fix crashes, ANRs, bugs, and
          performance issues. The open source alternative to{" "}
          <span className="font-semibold">Firebase Crashlytics</span>.
        </h2>

        {/* CTA 1 */}
        <div className="py-4 md:py-12" />
        <TrackCtaLink
          location="hero"
          destination="signup"
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get To The Root Cause
        </TrackCtaLink>

        {/* Trusted By */}
        <div className="py-16" />
        <div className="flex flex-col w-full items-center">
          <div className="flex flex-col items-center max-w-4xl">
            <p className="text-sm font-display text-center">
              TRUSTED BY HIGH GROWTH MOBILE TEAMS
            </p>
          </div>
          <div className="py-8" />
          <div
            className="w-full max-w-6xl overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
            }}
          >
            <div
              className="flex items-center w-max"
              style={{ animation: "marquee 30s linear infinite" }}
            >
              {[...Array(2)].map((_, i) => (
                <Fragment key={i}>
                  <div className="w-[40px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <KukuFmLogo className="w-full h-full object-contain grayscale brightness-0 dark:invert" />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/hoichoi_logo.svg"
                      alt="Hoichoi Logo"
                      fill
                      className="object-contain grayscale brightness-0 dark:invert"
                    />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/country_delight_logo.webp"
                      alt="Country Delight Logo"
                      fill
                      className="object-contain grayscale"
                    />
                  </div>
                  <div className="w-[140px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/dashreels_logo.webp"
                      alt="Dashreels Logo"
                      fill
                      className="object-contain grayscale brightness-0 dark:invert"
                    />
                  </div>
                  <div className="w-[120px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/turtlemint_logo.svg"
                      alt="Turtelmint Logo"
                      fill
                      className="object-contain grayscale brightness-0 dark:invert"
                    />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/astro_logo.webp"
                      alt="Astro Logo"
                      fill
                      className="object-contain grayscale brightness-0 dark:invert"
                    />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/allofresh_logo.webp"
                      alt="Allofresh Logo"
                      fill
                      className="object-contain grayscale brightness-0 dark:invert"
                    />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/smcindia_logo.webp"
                      alt="SMC India Logo"
                      fill
                      className="object-contain dark:hidden grayscale brightness-0 dark:invert"
                    />
                    <Image
                      src="/images/smcindia_logo_dark.webp"
                      alt="SMC India Logo"
                      fill
                      className="object-contain hidden dark:block grayscale brightness-0 dark:invert"
                    />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/even_logo.webp"
                      alt="Even Logo"
                      fill
                      className="object-contain grayscale brightness-0 dark:invert"
                    />
                  </div>
                  <div className="w-[100px] h-[50px] relative flex items-center justify-center shrink-0 mr-48">
                    <Image
                      src="/images/karya_logo.webp"
                      alt="Karya Logo"
                      fill
                      className="object-contain grayscale brightness-0 dark:invert"
                    />
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
        <div className="py-8" />

        {/* Feature Demos */}
        <div className="w-full flex flex-col items-center py-16 md:py-24">
          <h2 className="font-display font-regular text-4xl md:w-4xl text-center px-4">
            One dashboard, Complete context
          </h2>
          <div className="py-2 md:py-4" />
          <FeatureDemoCarousel />
        </div>

        {/* Intelligent debugging — Measure Agent + MCP Server */}
        <div className="w-full flex items-center flex-col py-16 md:py-24">
          <h2 className="font-display font-regular text-4xl max-w-4xl text-center px-4">
            Intelligent debugging, Seamless integration
          </h2>
          <div className="py-2 md:py-4" />
          <AIDemoCarousel />
        </div>

        {/* Adaptive Capture */}
        <div className="w-full flex items-center flex-col py-16 md:py-24">
          <h2 className="font-display font-regular text-4xl max-w-4xl text-center px-4">
            Collect what you need, Only when you need it
          </h2>
          <div className="py-4" />
          <p className="text-lg font-body text-justify max-w-4xl px-4">
            Most monitoring data rots away in a warehouse and runs up your costs
            💰. Our{" "}
            <Link
              href="/product/adaptive-capture"
              className={underlineLinkStyle}
            >
              Adaptive Capture
            </Link>{" "}
            feature lets you control and dynamically change what data to collect
            without needing to roll out app updates.
          </p>
          <div className="py-8" />
          <div className="max-w-6xl">
            <AdaptiveCaptureDemo showTitle={false} />
          </div>
        </div>

        {/* Testimonials */}
        <div className="w-full flex items-center flex-col py-16 md:py-24">
          <h2 className="font-display font-regular text-4xl max-w-4xl text-center px-4">
            Tried it, Loved it ❤️
          </h2>
          <div className="py-4" />
          <Testimonials />
        </div>

        {/* For Mobile Developers */}
        <div className="w-full flex items-center flex-col py-16 md:py-24">
          <h2 className="font-display font-regular text-4xl max-w-4xl text-center px-4">
            Built For Mobile Devs
          </h2>
          <div className="py-2" />
          <p className="text-lg font-body md:w-4xl text-justify px-4">
            For us, Mobile is not an add-on to an observability product. It{" "}
            <b>is</b> the product. Measure is built by mobile engineers, for
            mobile engineers.
          </p>
          <div className="py-8" />
          <div className="flex flex-col md:flex-row bg-card text-card-foreground items-center justify-items-center w-full max-w-6xl">
            <div className="flex flex-col items-center justify-center w-full md:w-1/2 h-32 border-r md:border-r-0 border-l border-t border-border">
              <p className="text-4xl font-body text-center">Open Source</p>
              <div className="py-1" />
              <TrackGithubLink
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
            <div className="flex flex-col items-center justify-center w-full md:w-1/2 h-32 border-l border-t border-r border-border">
              <p className="text-4xl font-body text-center">Simple Pricing</p>
              <p className="text-sm font-display text-center mt-4">
                Pay only for the{" "}
                <Link href="/pricing" className={underlineLinkStyle}>
                  data you use.
                </Link>{" "}
                No seat limits or feature restrictions.
              </p>
            </div>
          </div>
          <div className="w-full bg-card text-card-foreground border border-border p-12 max-w-6xl">
            <p className="text-4xl font-body text-center">
              Every mobile platform
            </p>
            <div className="py-4" />
            <div className="flex flex-row gap-16 items-start justify-center flex-wrap">
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 flex items-center">
                  <Image
                    src="/images/android_logo.svg"
                    alt=""
                    width={152}
                    height={89}
                    className="h-8 w-auto object-contain"
                  />
                </div>
                <span className="font-body text-sm">Android</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 flex items-center">
                  <Image
                    src="/images/ios_logo.svg"
                    alt=""
                    width={46}
                    height={56}
                    className="h-12 mb-2 w-auto object-contain"
                  />
                </div>
                <span className="font-body text-sm">iOS & iPadOS</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 flex items-center">
                  <Image
                    src="/images/kmp_logo.svg"
                    alt=""
                    width={48}
                    height={48}
                    className="h-10 w-auto object-contain"
                  />
                </div>
                <span className="font-body text-sm text-center">
                  Kotlin
                  <br />
                  Multiplatform
                </span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 flex items-center">
                  <Image
                    src="/images/flutter_logo.svg"
                    alt=""
                    width={300}
                    height={371}
                    className="h-10 w-auto object-contain"
                  />
                </div>
                <span className="font-body text-sm">Flutter</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 flex items-center">
                  <Image
                    src="/images/react_native_logo.webp"
                    alt=""
                    width={500}
                    height={445}
                    className="h-10 w-auto object-contain"
                  />
                </div>
                <span className="font-body text-sm">React Native</span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA 2 */}
        <div className="py-8 md:py-12" />
        <TrackCtaLink
          location="landing_bottom"
          destination="signup"
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get To The Root Cause
        </TrackCtaLink>
        <div className="py-12 md:py-18" />
      </div>
      <LandingFooter />
    </main>
  );
}
