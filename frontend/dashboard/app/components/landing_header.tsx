"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useScrollDirection } from "../utils/scroll_utils";
import { cn } from "../utils/shadcn_utils";
import { buttonVariants } from "./button";
import { ThemeToggle } from "./theme_toggle";

// Hook to detect if we're on a small screen
function useIsSmallScreen() {
  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {
    const checkSize = () => setIsSmall(window.innerWidth < 768); // md breakpoint
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  return isSmall;
}

export default function LandingHeader() {
  const scrollDir = useScrollDirection();
  const [isFocused, setIsFocused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isSmallScreen = useIsSmallScreen();
  const router = useRouter();

  // Disable scroll hide/show on small screens
  const shouldHide =
    !isSmallScreen &&
    scrollDir === "scrolling down" &&
    !isFocused &&
    !isMenuOpen;

  return (
    <header
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn(
        "w-full flex flex-col z-50 bg-background border-b border-border fixed top-0 transition-transform duration-100 ease-in-out",
        shouldHide ? "-translate-y-full" : "translate-y-0"
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
            className="dark:hidden group-hover:hidden"
          />
          <Image
            src="/images/measure_logo_horizontal_white.svg"
            width={120}
            height={40}
            alt={"Measure logo"}
            className="hidden dark:block group-hover:block"
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
        <div className="hidden md:flex md:flex-row items-center justify-center md:ml-24">
          <Link
            href="https://github.com/measure-sh/measure?tab=readme-ov-file#docs"
            target="_blank"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "w-24"
            )}
          >
            Docs
          </Link>
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "w-24"
            )}
          >
            Pricing
          </Link>
          <Link
            href="/about"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "w-24"
            )}
          >
            About
          </Link>
        </div>

        {/* Desktop actions - hidden on small screens */}
        <div className="hidden md:flex md:flex-row items-center justify-center">
          <ThemeToggle />
          <div className="px-2" />
          <Link
            target="_blank"
            href="https://github.com/measure-sh/measure"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "group px-2"
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
            <span className="mt-0.5">1.1k</span>
          </Link>
          <div className="px-1" />
          <Link
            href="/auth/login"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "px-4"
            )}
          >
            Sign In
          </Link>
          <div className="px-1" />
          <Link
            href="/auth/login"
            className={cn(
              buttonVariants({ variant: "default" })
            )}
          >
            Get Started
          </Link>
        </div>
      </div>

      {/* Mobile menu - collapsible */}
      <div
        className={cn(
          "md:hidden flex flex-col items-center overflow-hidden transition-all duration-200 ease-in-out",
          isMenuOpen ? "max-h-96 pb-4" : "max-h-0"
        )}
      >
        <Link
          href="https://github.com/measure-sh/measure?tab=readme-ov-file#docs"
          target="_blank"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "w-full justify-center"
          )}
          onClick={() => setIsMenuOpen(false)}
        >
          Docs
        </Link>
        <Link
          href="/pricing"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "w-full justify-center"
          )}
          onClick={() => setIsMenuOpen(false)}
        >
          Pricing
        </Link>
        <Link
          href="/about"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "font-display select-none w-full justify-center"
          )}
          onClick={() => setIsMenuOpen(false)}
        >
          About
        </Link>
        <div className="py-2" />
        <ThemeToggle />
        <div className="py-1" />
        <Link
          target="_blank"
          href="https://github.com/measure-sh/measure"
          className={cn(
            buttonVariants({ variant: "ghost" })
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
          <span className="mt-0.5">1.1k</span>
        </Link>
        <div className="py-1" />
        <Link
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "ghost" })
          )}
          onClick={() => setIsMenuOpen(false)}
        >
          Sign In
        </Link>
        <div className="py-1" />
        <Link
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" })
          )}
          onClick={() => setIsMenuOpen(false)}
        >
          Get Started
        </Link>
      </div>
    </header>
  );
}