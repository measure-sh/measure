import TrackableCodeBlock from "@/app/components/analytics/trackable_code_block";
import TrackGithubLink from "@/app/components/analytics/track_github_link";
import CodeTabs from "@/app/docs/components/code_tabs";
import { PLAINTEXT_LANGUAGE, resolveLanguage } from "@/app/utils/highlighter";
import { cn } from "@/app/utils/shadcn_utils";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import {
  ChevronRight,
  CircleAlert,
  Info,
  Lightbulb,
  type LucideIcon,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import React from "react";
import type { Components } from "react-markdown";

const MEASURE_REPO_URL = "https://github.com/measure-sh/measure";

// Content links sit in dimmed body copy, so they get full-strength text like
// headings and bold text do.
const contentLinkStyle = cn(underlineLinkStyle, "font-medium text-foreground");

// Display names for the code block header. Plaintext gets no label; the
// header still renders to hold the copy button.
const LANG_LABELS: Record<string, string> = {
  kotlin: "Kotlin",
  xml: "XML",
  swift: "Swift",
  dart: "Dart",
  yaml: "YAML",
  ruby: "Ruby",
  groovy: "Groovy",
  json: "JSON",
  jsonc: "JSON",
  "objective-c": "Objective-C",
  shellscript: "Shell",
  java: "Java",
  typescript: "TypeScript",
  c: "C",
  plaintext: "",
};

interface CalloutConfig {
  icon: LucideIcon;
  boxClassName: string;
  iconClassName: string;
}

const CALLOUTS: Record<string, CalloutConfig> = {
  note: {
    icon: Info,
    boxClassName: "border-blue-500/20 bg-blue-500/5",
    iconClassName: "text-blue-500",
  },
  tip: {
    icon: Lightbulb,
    boxClassName: "border-green-500/20 bg-green-500/5",
    iconClassName: "text-green-600 dark:text-green-400",
  },
  important: {
    icon: CircleAlert,
    boxClassName: "border-purple-500/20 bg-purple-500/5",
    iconClassName: "text-purple-500",
  },
  warning: {
    icon: TriangleAlert,
    boxClassName: "border-yellow-500/20 bg-yellow-500/5",
    iconClassName: "text-yellow-600 dark:text-yellow-500",
  },
  caution: {
    icon: OctagonAlert,
    boxClassName: "border-red-500/20 bg-red-500/5",
    iconClassName: "text-red-500",
  },
};

function isEmptyContent(node: React.ReactNode): boolean {
  if (node === null || node === undefined || typeof node === "boolean") {
    return true;
  }
  if (typeof node === "string") {
    return node.trim() === "";
  }
  if (Array.isArray(node)) {
    return node.every(isEmptyContent);
  }
  return false;
}

/**
 * Remove the leading "[!NOTE]"-style marker from a callout's children so it
 * doesn't render as literal text. Only the first matching text node is
 * touched; everything after it is returned unchanged. The marker's leftovers
 * are dropped with it: a <br> from a marker line ending in a hard break, and
 * the paragraph itself when the marker was its only content (a marker
 * written as its own blockquote line) — an empty <p> would otherwise render
 * as a blank first line that the icon aligns against.
 */
function stripAdmonitionMarker(children: React.ReactNode): React.ReactNode {
  let stripped = false;

  function transform(node: React.ReactNode): React.ReactNode {
    if (stripped) {
      return node;
    }
    if (typeof node === "string") {
      const replaced = node.replace(
        /^\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/,
        "",
      );
      if (replaced !== node) {
        stripped = true;
      }
      return replaced;
    }
    if (Array.isArray(node)) {
      const out: React.ReactNode[] = [];
      for (let i = 0; i < node.length; i++) {
        const wasStripped = stripped;
        const transformed = transform(node[i]);
        const strippedHere = !wasStripped && stripped;
        if (strippedHere && transformed === "") {
          const next = node[i + 1];
          if (React.isValidElement(next) && next.type === "br") {
            i++;
          }
          continue;
        }
        out.push(transformed);
      }
      return out;
    }
    if (React.isValidElement(node)) {
      const props = node.props as { children?: React.ReactNode };
      if (props.children === undefined) {
        return node;
      }
      const wasStripped = stripped;
      const transformedChildren = transform(props.children);
      if (!wasStripped && stripped && isEmptyContent(transformedChildren)) {
        return null;
      }
      return React.cloneElement(node, undefined, transformedChildren);
    }
    return node;
  }

  return transform(children);
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

// Heading bottom margins (mb-3) run smaller than the body rhythm suggests:
// Josefin leaves ~12px of empty line-box below its glyphs, so the rendered
// gap below headings is what lines up with the rest of the spacing scale.
export function createMarkdownComponents(
  currentSlug: string[],
  isIndex = false,
): Components {
  return {
    h1: ({ children, id }) => (
      <h1
        id={id}
        className="font-display text-3xl font-semibold leading-9 tracking-[-0.03125rem] text-foreground mt-12 mb-3 scroll-mt-8"
      >
        {children}
      </h1>
    ),
    h2: ({ children, id }) => (
      <h2
        id={id}
        className="font-display text-2xl font-semibold text-foreground mt-12 mb-3 scroll-mt-8 group"
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
        className="font-display text-xl font-semibold text-foreground mt-8 mb-3 scroll-mt-8 group"
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
        className="font-display text-base font-semibold text-foreground mt-6 mb-3 scroll-mt-8"
      >
        {children}
      </h4>
    ),
    p: ({ children }) => <p className="font-body leading-7 mb-5">{children}</p>,
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
              className={contentLinkStyle}
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
            className={contentLinkStyle}
            {...props}
          >
            {children}
          </a>
        );
      }

      return (
        <Link href={rewritten} className={contentLinkStyle}>
          {children}
        </Link>
      );
    },
    img: ({ src, alt, node, ...props }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={rewriteImgSrc(typeof src === "string" ? src : "")}
        alt={alt || ""}
        className="rounded-xl border border-border my-8 max-w-full"
        loading="lazy"
        {...props}
      />
    ),
    // The descendant [&_ul]/[&_ol] margins hit nested lists only (the
    // selector needs an ancestor list) and outweigh the direct mb-5 by
    // specificity, giving nested lists tighter spacing than top-level ones.
    ul: ({ children }) => (
      <ul className="list-disc pl-6 mb-5 space-y-2 font-body [&_ul]:my-3 [&_ol]:my-3">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-6 mb-5 space-y-2 font-body [&_ul]:my-3 [&_ol]:my-3">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-7">{children}</li>,
    blockquote: ({ children }) => {
      // The blockquote's children start with layout text nodes ("\n"), so the
      // marker check must tolerate leading whitespace.
      const childText = extractTextContent(children);
      const admonitionMatch = childText.match(
        /^\s*\[!(NOTE|WARNING|IMPORTANT|CAUTION|TIP)\]\s*/,
      );

      if (admonitionMatch) {
        const type = admonitionMatch[1].toLowerCase();
        const callout = CALLOUTS[type];
        const Icon = callout.icon;

        return (
          <div
            className={cn(
              "my-4 flex gap-3 rounded-2xl border px-5 py-4",
              callout.boxClassName,
            )}
          >
            <Icon
              className={cn("mt-1 h-4 w-4 shrink-0", callout.iconClassName)}
              aria-hidden="true"
            />
            {/* Callout copy is a size down from body copy, so the inherited
                paragraph/list line heights are normalized to match; without
                this the icon alignment drifts with the first line's height. */}
            <div className="min-w-0 flex-1 font-body text-sm leading-6 [&_p]:leading-6 [&_li]:leading-6 [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&>:last-child]:mb-0">
              {stripAdmonitionMarker(children)}
            </div>
          </div>
        );
      }

      return (
        <blockquote className="border-l-4 border-border pl-4 my-6 text-muted-foreground italic">
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
      // Fences naming a language we don't highlight still label the header
      // with their raw tag; unnamed fences get no label and render headerless.
      const rawTag = className?.match(/(?:^|\s)language-(\S+)/)?.[1];
      const label =
        language === PLAINTEXT_LANGUAGE
          ? (rawTag ?? "")
          : (LANG_LABELS[language] ?? language);
      return (
        <TrackableCodeBlock
          code={code}
          language={language}
          variant="framed"
          label={label}
          className="mt-5 mb-8"
        />
      );
    },
    code: ({ children, className }) => {
      if (!className) {
        return (
          <code className="font-code rounded-md border border-border bg-muted/50 px-1 py-0.5 text-[0.875em] text-foreground">
            {children}
          </code>
        );
      }
      return <code className={cn("font-code", className)}>{children}</code>;
    },
    table: ({ children }) => (
      <div className="my-7 overflow-x-auto">
        <table className="w-full text-sm font-body">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="text-left font-semibold text-foreground px-3 pb-2 first:pl-0 last:pr-0 border-b border-border align-bottom">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 first:pl-0 last:pr-0 border-b border-border/60 align-top">
        {children}
      </td>
    ),
    hr: () => <hr className="my-12 border-border" />,
    // Code blocks inside an accordion lose their outer frame (border, tinted
    // rim) so the accordion border is the only box; the header row with the
    // language label and copy button stays.
    details: ({ children }) => (
      <details className="group my-5 border border-border rounded-xl [&>*:not(summary)]:px-4 [&>summary+*]:pt-2 [&>*:not(summary):last-child]:mb-0 [&>*:not(summary):last-child]:pb-3 [&_.code-frame]:border-0 [&_.code-frame]:bg-transparent [&_.code-frame]:p-0">
        {children}
      </details>
    ),
    summary: ({ children }) => (
      <summary className="cursor-pointer font-semibold p-4 hover:bg-muted/50 rounded-xl flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="w-4 h-4 shrink-0 transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        <span>{children}</span>
      </summary>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    // Produced by rehypeCodeTabs from runs of single-code-fence <details>
    // blocks; not a real HTML element, so it needs the cast.
    ...({ "code-tabs": CodeTabs } as Partial<Components>),
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
