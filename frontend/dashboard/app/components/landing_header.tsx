"use client";

import { ChevronRight, Rss } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useScrollDirection } from "../utils/scroll_utils";
import { siteXUrl } from "../utils/metadata";
import { cn } from "../utils/shadcn_utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";
import { buttonVariants } from "./button_variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown_menu";
import { ThemeToggle } from "./theme_toggle";
import TrackCtaLink from "./analytics/track_cta_link";
import TrackGithubLink from "./analytics/track_github_link";

const capabilityLinks = [
  { href: "/product/session-replays", label: "Session Replays" },
  { href: "/product/app-health", label: "App Health" },
  { href: "/product/crashes-and-anrs", label: "Crashes & ANRs" },
  { href: "/product/performance-traces", label: "Performance Traces" },
  { href: "/product/bug-reports", label: "Bug Reports" },
  { href: "/product/user-journeys", label: "User Journeys" },
  { href: "/product/network-performance", label: "Network Performance" },
  { href: "/product/adaptive-capture", label: "Adaptive Capture" },
];

const aiDebuggingLinks = [
  { href: "/product/agent", label: "Measure Agent" },
  { href: "/product/mcp", label: "MCP Server" },
];

const platformLinks = [
  { href: "/for/android", label: "Android" },
  { href: "/for/ios", label: "iOS" },
  { href: "/for/ipados", label: "iPadOS" },
  { href: "/for/react-native", label: "React Native" },
  { href: "/for/flutter", label: "Flutter" },
  { href: "/for/kmp", label: "Kotlin Multiplatform" },
];

const learnLinks = [{ href: "/why-measure", label: "Why Measure?" }];

const companyLinks = [
  { href: "/about", label: "About" },
  { href: "mailto:hello@measure.sh", label: "Contact Us" },
];

const alternativeLinks = [
  { href: "/crashlytics-alternative", label: "Firebase Crashlytics" },
  { href: "/sentry-alternative", label: "Sentry" },
  { href: "/bugsnag-alternative", label: "Bugsnag" },
  { href: "/embrace-alternative", label: "Embrace" },
  { href: "/luciq-alternative", label: "Luciq" },
  { href: "/datadog-alternative", label: "Datadog" },
  { href: "/new-relic-alternative", label: "New Relic" },
];

const socialLinks = [
  {
    href: "https://www.linkedin.com/company/measure-sh",
    label: "LinkedIn",
    lightSrc: "/images/linkedin_logo_black.webp",
    darkSrc: "/images/linkedin_logo_white.webp",
    size: 16,
  },
  {
    href: siteXUrl,
    label: "X",
    lightSrc: "/images/x_logo_black.webp",
    darkSrc: "/images/x_logo_white.webp",
    size: 14,
  },
  {
    href: "https://bsky.app/profile/measure.sh",
    label: "Bluesky",
    lightSrc: "/images/bluesky_logo.svg",
    darkSrc: null,
    size: 16,
  },
  {
    href: "https://discord.com/invite/f6zGkBCt42",
    label: "Discord",
    lightSrc: "/images/discord_logo.svg",
    darkSrc: null,
    size: 18,
  },
];

const githubUrl = "https://github.com/measure-sh/measure";

// Hook to detect if we're on a small screen.
function subscribeToResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function useIsSmallScreen() {
  return useSyncExternalStore(
    subscribeToResize,
    () => window.innerWidth < 768, // md breakpoint
    () => false,
  );
}

// Renders the light and dark variants of a social logo. Logos that ship as a
// single SVG have no dark file and are inverted with CSS instead. These load
// eagerly because the dropdown mounts them in a portal, where the lazy loader
// never sees them come into view and leaves the icons blank.
function SocialLogo({ link }: { link: (typeof socialLinks)[number] }) {
  if (link.darkSrc === null) {
    return (
      <Image
        src={link.lightSrc}
        alt={`${link.label} logo`}
        width={link.size}
        height={link.size}
        loading="eager"
        className="dark:invert"
      />
    );
  }

  return (
    <>
      <Image
        src={link.lightSrc}
        alt={`${link.label} logo`}
        width={link.size}
        height={link.size}
        loading="eager"
        className="dark:hidden"
      />
      <Image
        src={link.darkSrc}
        alt={`${link.label} logo`}
        width={link.size}
        height={link.size}
        loading="eager"
        className="hidden dark:block"
      />
    </>
  );
}

const navLinkClassName = cn(
  buttonVariants({ variant: "ghost" }),
  "w-full justify-start",
);

const dropdownItemClassName =
  "font-display h-9 px-4 py-2 rounded-md cursor-pointer";

const navSectionTitleClassName =
  "font-display px-4 py-2 text-sm text-muted-foreground select-none";

const mobileSectionLinkClassName =
  "font-display flex items-center py-4 text-sm font-medium transition-all hover:underline";

interface NavDropdownProps {
  label: string;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function NavDropdown({ label, onOpenChange, children }: NavDropdownProps) {
  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "gap-1 data-[state=open]:bg-accent [&[data-state=open]>svg]:rotate-90",
        )}
      >
        {label}
        <ChevronRight className="w-4 h-4 mb-0.5 transition-transform duration-200" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="flex flex-row items-start p-2"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavDropdownSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-w-48">
      <p className={navSectionTitleClassName}>{title}</p>
      {children}
    </div>
  );
}

function NavDropdownLink({
  href,
  label,
  onSelect,
}: {
  href: string;
  label: string;
  onSelect?: () => void;
}) {
  const external = !href.startsWith("/");
  return (
    <DropdownMenuItem className={dropdownItemClassName} asChild>
      {href === githubUrl ? (
        <TrackGithubLink href={href} target="_blank" onClick={onSelect}>
          {label}
        </TrackGithubLink>
      ) : (
        <Link
          href={href}
          target={external ? "_blank" : undefined}
          onClick={onSelect}
        >
          {label}
        </Link>
      )}
    </DropdownMenuItem>
  );
}

interface LandingHeaderProps {
  /** Middle nav links (Product, Resources, Docs, Pricing). */
  showNavLinks?: boolean;
  /** Sign In and Get Started links. */
  showCtas?: boolean;
  /** Icon link to the blog RSS feed. */
  showRssFeed?: boolean;
}

export default function LandingHeader({
  showNavLinks = true,
  showCtas = true,
  showRssFeed = false,
}: LandingHeaderProps) {
  const scrollDir = useScrollDirection();
  const [isFocused, setIsFocused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const isSmallScreen = useIsSmallScreen();

  // Disable scroll hide/show on small screens
  const shouldHide =
    !isSmallScreen &&
    scrollDir === "scrolling down" &&
    !isFocused &&
    !isMenuOpen &&
    !isDropdownOpen;

  const closeMobileMenu = () => setIsMenuOpen(false);

  return (
    <header
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn(
        "w-full flex flex-col z-50 bg-background border-b border-border fixed top-0 transition-transform duration-100 ease-in-out",
        shouldHide ? "-translate-y-full" : "translate-y-0",
      )}
    >
      <div className="w-full flex flex-row justify-between items-center py-4 px-4">
        <Link
          className={cn(buttonVariants({ variant: "ghost" }), "group py-2")}
          href="/"
        >
          <Image
            src="/images/measure_logo_horizontal_black.svg"
            width={120}
            height={40}
            alt={"Measure logo"}
            className="dark:hidden"
          />
          <Image
            src="/images/measure_logo_horizontal_white.svg"
            width={120}
            height={40}
            alt={"Measure logo"}
            className="hidden dark:block"
          />
        </Link>

        {/* Hamburger button - visible only on small screens */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 focus:outline-none text-foreground"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>

        {/* Desktop nav - hidden on small screens */}
        {showNavLinks && (
          <div className="hidden ml-16 md:flex md:flex-row md:gap-4 items-center justify-center">
            <NavDropdown label="Product" onOpenChange={setIsDropdownOpen}>
              <NavDropdownSection title="Features">
                {capabilityLinks.map((link) => (
                  <NavDropdownLink key={link.href} {...link} />
                ))}
              </NavDropdownSection>
              <NavDropdownSection title="AI Debugging">
                {aiDebuggingLinks.map((link) => (
                  <NavDropdownLink key={link.href} {...link} />
                ))}
              </NavDropdownSection>
              <NavDropdownSection title="Platforms">
                {platformLinks.map((link) => (
                  <NavDropdownLink key={link.href} {...link} />
                ))}
              </NavDropdownSection>
            </NavDropdown>
            <Link
              href="/blog"
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              Blog
            </Link>
            <NavDropdown label="Resources" onOpenChange={setIsDropdownOpen}>
              <div className="flex flex-col gap-3 min-w-48">
                <NavDropdownSection title="Learn">
                  {learnLinks.map((link) => (
                    <NavDropdownLink key={link.href} {...link} />
                  ))}
                </NavDropdownSection>
                <NavDropdownSection title="Company">
                  {companyLinks.map((link) => (
                    <NavDropdownLink key={link.href} {...link} />
                  ))}
                </NavDropdownSection>
                <NavDropdownSection title="Connect">
                  {/* pl-4 plus the items' own px-2 starts the first glyph a
                      step inside the section title, matching the footer. */}
                  <div className="flex flex-row items-center pl-4">
                    {socialLinks.map((link) => (
                      <DropdownMenuItem
                        key={link.href}
                        className={cn(dropdownItemClassName, "px-2")}
                        asChild
                      >
                        <Link
                          href={link.href}
                          target="_blank"
                          aria-label={link.label}
                        >
                          <SocialLogo link={link} />
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </div>
                </NavDropdownSection>
              </div>
              <NavDropdownSection title="Alternatives">
                {alternativeLinks.map((link) => (
                  <NavDropdownLink key={link.href} {...link} />
                ))}
              </NavDropdownSection>
            </NavDropdown>
            <Link
              href="/docs"
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              Docs
            </Link>
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              Pricing
            </Link>
          </div>
        )}

        {/* Desktop actions - hidden on small screens */}
        <div className="hidden md:flex md:flex-row items-center justify-center">
          <ThemeToggle />
          {showRssFeed && (
            <>
              <a
                href="/blog/rss.xml"
                aria-label="RSS feed"
                className={cn(buttonVariants({ variant: "ghost" }))}
              >
                <Rss className="w-4 h-4" />
              </a>
            </>
          )}
          <TrackGithubLink
            target="_blank"
            href={githubUrl}
            className={cn(buttonVariants({ variant: "ghost" }), "px-3")}
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
          </TrackGithubLink>
          {showCtas && (
            <>
              <div className="px-1" />
              <TrackCtaLink
                location="header"
                destination="signup"
                href="/auth/login"
                className={cn(buttonVariants({ variant: "ghost" }), "px-4")}
              >
                Sign In
              </TrackCtaLink>
              <div className="px-1" />
              <TrackCtaLink
                location="header"
                destination="signup"
                href="/auth/login"
                className={cn(buttonVariants({ variant: "default" }))}
              >
                Get Started
              </TrackCtaLink>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu - collapsible */}
      <div
        className={cn(
          "md:hidden flex flex-col transition-all duration-200 ease-in-out",
          isMenuOpen
            ? "max-h-[calc(100vh-5rem)] overflow-y-auto pb-4"
            : "max-h-0 overflow-hidden",
        )}
      >
        {showNavLinks && (
          <>
            <Accordion type="single" collapsible className="w-full px-4">
              <AccordionItem value="product" className="border-b-0">
                <AccordionTrigger className="font-display">
                  Product
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-4">
                  <p className={navSectionTitleClassName}>Features</p>
                  {capabilityLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={navLinkClassName}
                      onClick={closeMobileMenu}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <p className={cn(navSectionTitleClassName, "mt-4")}>
                    AI Debugging
                  </p>
                  {aiDebuggingLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={navLinkClassName}
                      onClick={closeMobileMenu}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <p className={cn(navSectionTitleClassName, "mt-4")}>
                    Platforms
                  </p>
                  {platformLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={navLinkClassName}
                      onClick={closeMobileMenu}
                    >
                      {link.label}
                    </Link>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <div className="w-full px-4 flex flex-col">
              <Link
                href="/blog"
                className={mobileSectionLinkClassName}
                onClick={closeMobileMenu}
              >
                Blog
              </Link>
            </div>
            <Accordion type="single" collapsible className="w-full px-4">
              <AccordionItem value="resources" className="border-b-0">
                <AccordionTrigger className="font-display">
                  Resources
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-4">
                  <p className={navSectionTitleClassName}>Learn</p>
                  {learnLinks.map((link) =>
                    link.href === githubUrl ? (
                      <TrackGithubLink
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        className={navLinkClassName}
                        onClick={closeMobileMenu}
                      >
                        {link.label}
                      </TrackGithubLink>
                    ) : (
                      <Link
                        key={link.href}
                        href={link.href}
                        target={
                          link.href.startsWith("/") ? undefined : "_blank"
                        }
                        className={navLinkClassName}
                        onClick={closeMobileMenu}
                      >
                        {link.label}
                      </Link>
                    ),
                  )}
                  <p className={cn(navSectionTitleClassName, "mt-4")}>
                    Company
                  </p>
                  {companyLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      target={link.href.startsWith("/") ? undefined : "_blank"}
                      className={navLinkClassName}
                      onClick={closeMobileMenu}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <p className={cn(navSectionTitleClassName, "mt-4")}>
                    Alternatives
                  </p>
                  {alternativeLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={navLinkClassName}
                      onClick={closeMobileMenu}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <p className={cn(navSectionTitleClassName, "mt-4")}>
                    Connect
                  </p>
                  <div className="flex flex-row items-center px-2">
                    {socialLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        aria-label={link.label}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon" }),
                        )}
                        onClick={closeMobileMenu}
                      >
                        <SocialLogo link={link} />
                      </Link>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <div className="w-full px-4 flex flex-col">
              <Link
                href="/docs"
                className={mobileSectionLinkClassName}
                onClick={closeMobileMenu}
              >
                Docs
              </Link>
              <Link
                href="/pricing"
                className={mobileSectionLinkClassName}
                onClick={closeMobileMenu}
              >
                Pricing
              </Link>
            </div>
          </>
        )}
        <div className="w-full pt-2 flex flex-row items-center justify-center">
          <ThemeToggle />
          {showRssFeed && (
            <a
              href="/blog/rss.xml"
              aria-label="RSS feed"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            >
              <Rss className="w-4 h-4" />
            </a>
          )}
          <TrackGithubLink
            target="_blank"
            href={githubUrl}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
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
          </TrackGithubLink>
        </div>
        {showCtas && (
          <div className="w-full pt-4 flex flex-col px-4 items-center gap-4">
            <TrackCtaLink
              location="header"
              destination="signup"
              href="/auth/login"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              onClick={closeMobileMenu}
            >
              Sign In
            </TrackCtaLink>
            <TrackCtaLink
              location="header"
              destination="signup"
              href="/auth/login"
              className={cn(buttonVariants({ variant: "default" }), "w-full")}
              onClick={closeMobileMenu}
            >
              Get Started
            </TrackCtaLink>
          </div>
        )}
      </div>
    </header>
  );
}
