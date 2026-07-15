"use client";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { useCopyButton } from "fumadocs-ui/utils/use-copy-button";
import { Check, ChevronDown, Copy, ExternalLinkIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { track } from "@/app/utils/analytics/track";
import { cn } from "@/app/utils/shadcn_utils";
import { deriveDocSection } from "./docs_tracking";

// Adapted from fumadocs-ui's page-actions (layouts/shared/page-actions.tsx).
// The packaged ViewOptionsPopover ships a fixed menu (Scira, Cursor, no
// Perplexity), so the popover is reimplemented here with our own set of
// assistants. Brand icons are from simple-icons.

// Fetched markdown per URL, shared across button instances so repeated
// copies don't refetch.
const markdownCache = new Map<string, Promise<string>>();

export function LLMCopyButton({ markdownUrl }: { markdownUrl: string }) {
  const [isLoading, setLoading] = useState(false);
  const docSection = deriveDocSection(usePathname());
  const [checked, onClick] = useCopyButton(async () => {
    track("docs_action_click", {
      action: "copy_markdown",
      doc_section: docSection,
    });
    const cached = markdownCache.get(markdownUrl);
    if (cached) {
      return navigator.clipboard.writeText(await cached);
    }
    setLoading(true);
    try {
      const promise = fetch(markdownUrl).then((res) => {
        if (!res.ok) {
          throw new Error(`Fetching ${markdownUrl} failed: ${res.status}`);
        }
        return res.text();
      });
      markdownCache.set(markdownUrl, promise);
      // A failed fetch must not stay cached, or every retry replays it.
      promise.catch(() => markdownCache.delete(markdownUrl));
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": promise }),
      ]);
    } finally {
      setLoading(false);
    }
  });

  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={onClick}
      className={cn(
        buttonVariants({ color: "secondary", size: "sm" }),
        "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
      )}
    >
      {checked ? <Check /> : <Copy />}
      Copy Markdown
    </button>
  );
}

export function ViewOptions({
  markdownUrl,
  githubUrl,
}: {
  markdownUrl: string;
  githubUrl: string;
}) {
  const docSection = deriveDocSection(usePathname());
  const items = useMemo(() => {
    // The prompt points the assistant at the raw markdown URL, which it
    // can fetch without wading through the page HTML. window is absent
    // during SSR, but the popover content only mounts on open, so the
    // absolute URL is always what ends up rendered.
    const absoluteMarkdownUrl =
      typeof window === "undefined"
        ? markdownUrl
        : String(new URL(markdownUrl, window.location.origin));
    const q = `Read ${absoluteMarkdownUrl}, I want to ask questions about it.`;

    return [
      {
        title: "Open in GitHub",
        action: "open_github",
        href: githubUrl,
        icon: <GitHubIcon />,
      },
      {
        title: "Open in ChatGPT",
        action: "open_chatgpt",
        href: `https://chatgpt.com/?${new URLSearchParams({ prompt: q, hints: "search" })}`,
        icon: <OpenAIIcon />,
      },
      {
        title: "Open in Claude",
        action: "open_claude",
        href: `https://claude.ai/new?${new URLSearchParams({ q })}`,
        icon: <AnthropicIcon />,
      },
      {
        title: "Open in Perplexity",
        action: "open_perplexity",
        href: `https://www.perplexity.ai/search?${new URLSearchParams({ q })}`,
        icon: <PerplexityIcon />,
      },
    ];
  }, [githubUrl, markdownUrl]);

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ color: "secondary", size: "sm" }),
          "gap-2 data-[state=open]:bg-fd-accent data-[state=open]:text-fd-accent-foreground",
        )}
      >
        Open
        <ChevronDown className="size-3.5 text-fd-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="flex flex-col">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            rel="noreferrer noopener"
            target="_blank"
            onClick={() =>
              track("docs_action_click", {
                action: item.action,
                doc_section: docSection,
              })
            }
            className="text-sm p-2 rounded-lg inline-flex items-center gap-2 hover:text-fd-accent-foreground hover:bg-fd-accent [&_svg]:size-4"
          >
            {item.icon}
            {item.title}
            <ExternalLinkIcon className="text-fd-muted-foreground size-3.5 ms-auto" />
          </a>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function GitHubIcon() {
  return (
    <svg fill="currentColor" role="img" viewBox="0 0 24 24">
      <title>GitHub</title>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function OpenAIIcon() {
  return (
    <svg fill="currentColor" role="img" viewBox="0 0 24 24">
      <title>OpenAI</title>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function AnthropicIcon() {
  return (
    <svg fill="currentColor" role="img" viewBox="0 0 24 24">
      <title>Anthropic</title>
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  );
}

function PerplexityIcon() {
  return (
    <svg fill="currentColor" role="img" viewBox="0 0 24 24">
      <title>Perplexity</title>
      <path d="M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904 0v7.0896H1.6023v10.3976h2.8882V24l6.932-6.3591v6.2005h1.1554v-6.0469l6.9318 6.1807v-6.4879h2.8882V7.0896zm-3.4657-4.531v4.531h-5.355l5.355-4.531zm-13.2862.0676 4.8691 4.4634H5.6458V2.6262zM2.7576 16.332V8.245h7.8476l-6.1149 6.1147v1.9723H2.7576zm2.8882 5.0404v-3.8852h.0001v-2.6488l5.7763-5.7764v7.0111l-5.7764 5.2993zm12.7086.0248-5.7766-5.1509V9.0618l5.7766 5.7766v6.5588zm2.8882-5.0652h-1.733v-1.9723L13.3948 8.245h7.8478v8.087z" />
    </svg>
  );
}
