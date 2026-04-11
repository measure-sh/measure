import { cn } from "@/app/utils/shadcn_utils";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import Link from "next/link";
import type { Components } from "react-markdown";

/**
 * Rewrite relative markdown links to /docs/... routes.
 */
export function rewriteHref(href: string, currentSlug: string[]): string {
  if (!href || href.startsWith("#") || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
    return href;
  }

  // Relative .md link
  if (href.includes(".md")) {
    const [pathPart, anchor] = href.split("#");
    const currentDir = currentSlug.length > 0 ? currentSlug.slice(0, -1) : [];
    const segments = pathPart.split("/");
    const resolved: string[] = [...currentDir];

    for (const seg of segments) {
      if (seg === "." || seg === "") {
        continue;
      }
      if (seg === "..") {
        if (resolved.length === 0) {
          const remainingSegments = segments.slice(segments.indexOf(seg));
          const githubPath = resolveGitHubPath(currentSlug, remainingSegments);
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

    const route = "/docs" + (resolved.length > 0 ? "/" + resolved.join("/") : "");
    return anchor ? `${route}#${anchor}` : route;
  }

  // Relative path with ../ that escapes the docs tree — link to GitHub
  if (href.includes("..")) {
    const segments = href.replace(/^\.\//, "").split("/");
    const resolved = [...(currentSlug.length > 0 ? currentSlug.slice(0, -1) : [])];
    for (const seg of segments) {
      if (seg === "." || seg === "") {
        continue;
      }
      if (seg === "..") {
        if (resolved.length === 0) {
          const remainingSegments = segments.slice(segments.indexOf(seg));
          const githubPath = resolveGitHubPath(currentSlug, remainingSegments);
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

function resolveGitHubPath(currentSlug: string[], segments: string[]): string {
  const repoPath = ["docs", ...currentSlug.slice(0, -1)];
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
  if (!src || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) {
    return src;
  }

  // Extract the assets/... portion from any relative path (e.g. features/assets/foo.png, ./assets/foo.png)
  const assetsIndex = src.indexOf("assets/");
  if (assetsIndex !== -1) {
    return `/docs/${src.slice(assetsIndex)}`;
  }

  return src;
}

export function createMarkdownComponents(currentSlug: string[]): Components {
  return {
    h1: ({ children, id }) => (
      <h1 id={id} className="font-display text-3xl font-bold mt-12 mb-6 scroll-mt-24">
        {children}
      </h1>
    ),
    h2: ({ children, id }) => (
      <h2 id={id} className="font-display text-2xl font-semibold mt-16 mb-6 pb-2 border-b border-border scroll-mt-24 group">
        {children}
        {id && (
          <a href={`#${id}`} className="ml-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Link to section">
            #
          </a>
        )}
      </h2>
    ),
    h3: ({ children, id }) => (
      <h3 id={id} className="font-display text-xl font-semibold mt-12 mb-4 scroll-mt-24 group">
        {children}
        {id && (
          <a href={`#${id}`} className="ml-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Link to section">
            #
          </a>
        )}
      </h3>
    ),
    h4: ({ children, id }) => (
      <h4 id={id} className="font-display text-lg font-semibold mt-8 mb-3 scroll-mt-24">
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className="font-body leading-7 mb-4">
        {children}
      </p>
    ),
    a: ({ href, children, node, ...props }) => {
      const rewritten = rewriteHref(href || "", currentSlug);
      const isExternal = rewritten.startsWith("http://") || rewritten.startsWith("https://") || rewritten.startsWith("mailto:");

      if (isExternal) {
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
        src={rewriteImgSrc(src || "")}
        alt={alt || ""}
        className="rounded-lg border border-border my-4 max-w-full"
        loading="lazy"
        {...props}
      />
    ),
    ul: ({ children }) => (
      <ul className="list-disc pl-6 mb-4 space-y-1 font-body">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-6 mb-4 space-y-1 font-body">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-7">
        {children}
      </li>
    ),
    blockquote: ({ children }) => {
      const childText = extractTextContent(children);
      const admonitionMatch = childText.match(/^\[!(NOTE|WARNING|IMPORTANT|CAUTION|TIP)\]\s*/);

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
            <p className="font-display font-semibold text-sm mb-1">{labels[type]}</p>
            <div className="font-body text-sm [&>p]:mb-0">
              {children}
            </div>
          </div>
        );
      }

      return (
        <blockquote className="border-l-4 border-border pl-4 my-4 text-muted-foreground italic">
          {children}
        </blockquote>
      );
    },
    pre: ({ children }) => (
      <pre className="font-code bg-muted rounded-lg p-4 my-4 overflow-x-auto text-sm">
        {children}
      </pre>
    ),
    code: ({ children, className }) => {
      if (!className) {
        return (
          <code className="font-code bg-muted px-1.5 py-0.5 rounded text-sm">
            {children}
          </code>
        );
      }
      return (
        <code className={cn("font-code", className)}>
          {children}
        </code>
      );
    },
    table: ({ children }) => (
      <div className="my-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm font-body">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-muted">
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th className="text-left font-semibold px-4 py-2 border-b border-border">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 border-b border-border">
        {children}
      </td>
    ),
    hr: () => <hr className="my-10 border-border" />,
    details: ({ children }) => (
      <details className="my-4 border border-border rounded-lg">
        {children}
      </details>
    ),
    summary: ({ children }) => (
      <summary className="cursor-pointer font-semibold p-4 hover:bg-muted/50 rounded-lg">
        {children}
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
    return extractTextContent((children as React.ReactElement).props.children);
  }
  return "";
}
