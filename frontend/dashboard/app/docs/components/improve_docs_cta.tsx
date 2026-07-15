"use client";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { ExternalLinkIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { track } from "@/app/utils/analytics/track";
import { cn } from "@/app/utils/shadcn_utils";
import { deriveDocSection } from "./docs_tracking";

// The link names the docs issue template explicitly: on repos with issue
// templates, a bare /issues/new?title=... lands on the template chooser
// and the prefilled title is lost.
const NEW_ISSUE_URL = "https://github.com/measure-sh/measure/issues/new";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://measure.sh";

export function ImproveDocsCta() {
  const pathname = usePathname();
  // The body overrides the template's, mirroring its shape with the Page
  // field filled in; the template's labels still apply. The labels param
  // repeats the template's label: GitHub only honors it for users with
  // triage permission and ignores it for everyone else.
  const href = `${NEW_ISSUE_URL}?${new URLSearchParams({
    template: "docs_improvement.md",
    title: `Improve doc: ${pathname}`,
    body: `**Page**\n\n${SITE_URL}${pathname}\n\n**What could be better?**\n`,
    labels: "docs",
  })}`;

  return (
    <div className="flex flex-row flex-wrap items-center gap-3 border-y py-3">
      <p className="text-sm font-medium">Think this page can be better?</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        onClick={() =>
          track("docs_action_click", {
            action: "open_issue",
            doc_section: deriveDocSection(pathname),
          })
        }
        className={cn(
          buttonVariants({ color: "secondary", size: "sm" }),
          "gap-2",
        )}
      >
        Open an issue
        <ExternalLinkIcon className="size-3.5 text-fd-muted-foreground" />
      </a>
    </div>
  );
}
