import TrackableCodeBlock from "@/app/components/analytics/trackable_code_block";
import TrackGithubLink from "@/app/components/analytics/track_github_link";
import {
  CODE_BLOCK_LANGUAGES,
  type CodeBlockLanguage,
  PLAINTEXT_LANGUAGE,
} from "@/app/utils/highlighter";
import { cn } from "@/app/utils/shadcn_utils";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import React from "react";
import type { Components } from "react-markdown";

const MEASURE_REPO_URL = "https://github.com/measure-sh/measure";

// Map markdown fence aliases to the Shiki language names we load in highlighter.ts.
const LANG_ALIASES: Record<string, CodeBlockLanguage> = {
  sh: "shellscript",
  shell: "shellscript",
  bash: "shellscript",
  objc: "objective-c",
  ts: "typescript",
};

const SUPPORTED_LANGUAGES: ReadonlySet<CodeBlockLanguage> = new Set(
  CODE_BLOCK_LANGUAGES,
);

function resolveLanguage(
  className: string | undefined,
): CodeBlockLanguage | null {
  if (!className) {
    return null;
  }
  const match = className.match(/(?:^|\s)language-(\S+)/);
  if (!match) {
    return null;
  }
  const raw = match[1].toLowerCase();
  const mapped = (LANG_ALIASES[raw] ?? raw) as CodeBlockLanguage;
  return SUPPORTED_LANGUAGES.has(mapped) ? mapped : null;
}

/**
 * Rewrite relative markdown links to /docs/... routes.
 *
 * `isIndex` indicates whether the current page is rendered from a README.md.
 * For README pages, currentSlug already represents the directory the page lives
 * in, so we resolve siblings relative to currentSlug directly. For file pages
 * (e.g. /docs/features/feature-X) the directory is one level up.
 */
export function rewriteHref(
  href: string,
  currentSlug: string[],
  isIndex = false,
): string {
  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:")
  ) {
    return href;
  }

  const currentDir = isIndex
    ? [...currentSlug]
    : currentSlug.length > 0
      ? currentSlug.slice(0, -1)
      : [];

  // Relative .md link
  if (href.includes(".md")) {
    const [pathPart, anchor] = href.split("#");
    const segments = pathPart.split("/");
    const resolved: string[] = [...currentDir];

    for (const seg of segments) {
      if (seg === "." || seg === "") {
        continue;
      }
      if (seg === "..") {
        if (resolved.length === 0) {
          const remainingSegments = segments.slice(segments.indexOf(seg));
          const githubPath = resolveGitHubPath(currentDir, remainingSegments);
          return `https://github.com/measure-sh/measure/blob/main/${githubPath}`;
        }
        resolved.pop();
      } else {
        resolved.push(seg);
      }
    }

    const last = resolved[resolved.length - 1];
    if (last === "README.md") {
      resolved.pop();
    } else if (last?.endsWith(".md")) {
      resolved[resolved.length - 1] = last.replace(/\.md$/, "");
    }

    const route =
      "/docs" + (resolved.length > 0 ? "/" + resolved.join("/") : "");
    return anchor ? `${route}#${anchor}` : route;
  }

  // Relative path with ../ that escapes the docs tree — link to GitHub
  if (href.includes("..")) {
    const segments = href.replace(/^\.\//, "").split("/");
    const resolved = [...currentDir];
    for (const seg of segments) {
      if (seg === "." || seg === "") {
        continue;
      }
      if (seg === "..") {
        if (resolved.length === 0) {
          const remainingSegments = segments.slice(segments.indexOf(seg));
          const githubPath = resolveGitHubPath(currentDir, remainingSegments);
          return `https://github.com/measure-sh/measure/blob/main/${githubPath}`;
        }
        resolved.pop();
      } else {
        resolved.push(seg);
      }
    }
  }

  return href;
}

function resolveGitHubPath(currentDir: string[], segments: string[]): string {
  const repoPath = ["docs", ...currentDir];
  for (const seg of segments) {
    if (seg === "..") {
      repoPath.pop();
    } else if (seg !== "." && seg !== "") {
      repoPath.push(seg);
    }
  }
  return repoPath.join("/");
}

export function rewriteImgSrc(src: string): string {
  if (
    !src ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("/")
  ) {
    return src;
  }

  // Extract the assets/... portion from any relative path (e.g. features/assets/foo.png, ./assets/foo.png)
  const assetsIndex = src.indexOf("assets/");
  if (assetsIndex !== -1) {
    return `/docs/${src.slice(assetsIndex)}`;
  }

  return src;
}

export function createMarkdownComponents(
  currentSlug: string[],
  isIndex = false,
): Components {
  return {
    h1: ({ children, id }) => (
      <h1
        id={id}
        className="font-display text-3xl font-bold mt-12 mb-6 scroll-mt-24"
      >
        {children}
      </h1>
    ),
    h2: ({ children, id }) => (
      <h2
        id={id}
        className="font-display text-2xl font-semibold mt-16 mb-6 pb-2 border-b border-border scroll-mt-24 group"
      >
        {children}
        {id && (
          <a
            href={`#${id}`}
            className="ml-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Link to section"
          >
            #
          </a>
        )}
      </h2>
    ),
    h3: ({ children, id }) => (
      <h3
        id={id}
        className="font-display text-xl font-semibold mt-12 mb-4 scroll-mt-24 group"
      >
        {children}
        {id && (
          <a
            href={`#${id}`}
            className="ml-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Link to section"
          >
            #
          </a>
        )}
      </h3>
    ),
    h4: ({ children, id }) => (
      <h4
        id={id}
        className="font-display text-lg font-semibold mt-8 mb-3 scroll-mt-24"
      >
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className="font-body leading-relaxed mb-4">{children}</p>
    ),
    a: ({ href, children, node, ...props }) => {
      const rewritten = rewriteHref(href || "", currentSlug, isIndex);
      const isExternal =
        rewritten.startsWith("http://") ||
        rewritten.startsWith("https://") ||
        rewritten.startsWith("mailto:");

      if (isExternal) {
        // Detect bare/canonical measure repo URLs and surface as github_repo_click;
        // deeper sub-paths (issues, releases, etc.) keep the plain external anchor.
        const normalized = rewritten.replace(/\/+$/, "").toLowerCase();
        const isMeasureRepoRoot =
          normalized === MEASURE_REPO_URL ||
          normalized === "http://github.com/measure-sh/measure" ||
          normalized === `${MEASURE_REPO_URL}.git`;
        if (isMeasureRepoRoot) {
          return (
            <TrackGithubLink
              href={rewritten}
              target="_blank"
              rel="noopener noreferrer"
              className={underlineLinkStyle}
            >
              {children}
            </TrackGithubLink>
          );
        }
        return (
          <a
            href={rewritten}
            target="_blank"
            rel="noopener noreferrer"
            className={underlineLinkStyle}
            {...props}
          >
            {children}
          </a>
        );
      }

      return (
        <Link href={rewritten} className={underlineLinkStyle}>
          {children}
        </Link>
      );
    },
    img: ({ src, alt, node, ...props }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={rewriteImgSrc(typeof src === "string" ? src : "")}
        alt={alt || ""}
        className="rounded-lg border border-border my-4 max-w-full"
        loading="lazy"
        {...props}
      />
    ),
    ul: ({ children }) => (
      <ul className="list-disc pl-6 mb-4 space-y-1 font-body">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-6 mb-4 space-y-1 font-body">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    blockquote: ({ children }) => {
      const childText = extractTextContent(children);
      const admonitionMatch = childText.match(
        /^\[!(NOTE|WARNING|IMPORTANT|CAUTION|TIP)\]\s*/,
      );

      if (admonitionMatch) {
        const type = admonitionMatch[1].toLowerCase();
        const styles: Record<string, string> = {
          note: "border-blue-500 bg-blue-500/10",
          tip: "border-green-500 bg-green-500/10",
          important: "border-purple-500 bg-purple-500/10",
          warning: "border-yellow-500 bg-yellow-500/10",
          caution: "border-red-500 bg-red-500/10",
        };
        const labels: Record<string, string> = {
          note: "Note",
          tip: "Tip",
          important: "Important",
          warning: "Warning",
          caution: "Caution",
        };

        return (
          <div className={cn("border-l-4 rounded-r-lg p-4 my-4", styles[type])}>
            <p className="font-display font-semibold text-sm mb-1">
              {labels[type]}
            </p>
            <div className="font-body text-sm [&>p]:mb-0">{children}</div>
          </div>
        );
      }

      return (
        <blockquote className="border-l-4 border-border pl-4 my-4 text-muted-foreground italic">
          {children}
        </blockquote>
      );
    },
    pre: ({ children }) => {
      // react-markdown wraps fenced code in <pre><code class="language-X">…</code></pre>.
      // Render every block through CodeBlock: the inner <code>'s language class
      // selects the grammar, and anything we don't highlight falls back to
      // Shiki's no-op "plaintext" so it still gets the same CodeBlock chrome.
      const child = React.Children.toArray(children)[0];
      const className = React.isValidElement(child)
        ? (child.props as { className?: string }).className
        : undefined;
      const code = extractTextContent(children).replace(/\n$/, "");
      const language = resolveLanguage(className) ?? PLAINTEXT_LANGUAGE;
      return (
        <TrackableCodeBlock
          code={code}
          language={language}
          className="font-code text-sm leading-relaxed rounded-lg overflow-hidden my-4 [&_pre]:p-4 [&_pre]:overflow-x-auto"
        />
      );
    },
    code: ({ children, className }) => {
      if (!className) {
        return (
          <code className="font-code bg-muted px-1.5 py-0.5 rounded text-sm">
            {children}
          </code>
        );
      }
      return <code className={cn("font-code", className)}>{children}</code>;
    },
    table: ({ children }) => (
      <div className="my-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm font-body">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
    th: ({ children }) => (
      <th className="text-left font-semibold px-4 py-2 border-b border-border">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 border-b border-border">{children}</td>
    ),
    hr: () => <hr className="my-10 border-border" />,
    details: ({ children }) => (
      <details className="group my-4 border border-border rounded-lg [&>*:not(summary)]:px-4 [&>summary+*]:pt-2 [&>*:not(summary):last-child]:mb-0 [&>*:not(summary):last-child]:pb-3">
        {children}
      </details>
    ),
    summary: ({ children }) => (
      <summary className="cursor-pointer font-semibold p-4 hover:bg-muted/50 rounded-lg flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="w-4 h-4 shrink-0 transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        <span>{children}</span>
      </summary>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold">{children}</strong>
    ),
  };
}

function extractTextContent(children: React.ReactNode): string {
  if (typeof children === "string") {
    return children;
  }
  if (Array.isArray(children)) {
    return children.map(extractTextContent).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    return extractTextContent(
      (children as React.ReactElement<{ children?: React.ReactNode }>).props
        .children,
    );
  }
  return "";
}
