"use client";

import { buttonVariants } from "@/app/components/button_variants";
import { track } from "@/app/utils/analytics/track";
import { cn } from "@/app/utils/shadcn_utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { deriveBlogSection } from "./blog_tracking";

/**
 * End-of-post footer: a thanks note with a Share button (native share
 * sheet where the browser has one, copy-link fallback elsewhere).
 */
export default function PostFooter({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const blogSection = deriveBlogSection(usePathname());

  async function share() {
    track("blog_action_click", { action: "share", blog_section: blogSection });
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch {
        // The user closed the share sheet.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <footer className="mt-12 flex flex-col items-start gap-6 border-t pt-10 pb-4">
      <p className="text-fd-muted-foreground">
        Thanks for reading!{" "}
        <Link href="/" className="text-fd-foreground underline">
          Measure
        </Link>{" "}
        helps mobile developers monitor and fix bugs, crashes and performance
        issues. If you enjoyed this post, please share it with your friends!
      </p>
      <button
        type="button"
        onClick={share}
        className={cn(buttonVariants({ variant: "default" }))}
      >
        {copied ? "Link copied" : "Share"}
      </button>
    </footer>
  );
}
