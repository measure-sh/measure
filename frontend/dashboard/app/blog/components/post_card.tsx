import { cn } from "@/app/utils/shadcn_utils";
import Image from "next/image";
import Link from "next/link";

/**
 * Post fields the index and tag pages render. Kept to plain values so the
 * list can cross into client components; built by toPostSummary in
 * app/utils/blog_source.ts.
 */
export interface BlogPostSummary {
  url: string;
  slug: string;
  title: string;
  description?: string;
  image?: string;
  authorName: string;
  dateISO: string;
  dateFormatted: string;
  tags: string[];
}

/**
 * One blog post card. The title link is stretched over the whole card via
 * its after pseudo-element; the tag links are raised above it so both stay
 * clickable.
 */
export function PostCard({ post }: { post: BlogPostSummary }) {
  return (
    <article className="relative flex flex-col overflow-hidden rounded-xl border bg-fd-card text-fd-card-foreground transition-colors hover:bg-fd-accent/50">
      {post.image ? (
        <div className="relative aspect-5/2 w-full">
          <Image
            src={post.image}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-6">
        <h2 className="text-lg font-semibold">
          <Link href={post.url} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h2>
        {post.description ? (
          <p className="text-sm text-fd-muted-foreground">{post.description}</p>
        ) : null}
        <div className="mt-auto flex flex-col gap-3 pt-2">
          <p className="text-sm text-fd-muted-foreground">
            <span className="text-fd-foreground">{post.authorName}</span>
            {" · "}
            <time dateTime={post.dateISO}>{post.dateFormatted}</time>
          </p>
          {post.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <TagChip key={tag} tag={tag} className="relative z-10" />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function TagChip({
  tag,
  label,
  className,
}: {
  tag: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={`/blog/tags/${tag}`}
      className={cn(
        "rounded-full border px-3 py-1 text-xs text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground",
        className,
      )}
    >
      {label ?? tag}
    </Link>
  );
}
