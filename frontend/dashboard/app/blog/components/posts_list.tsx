"use client";

import { useMemo, useState } from "react";
import { PostCard, TagChip, type BlogPostSummary } from "./post_card";

interface PostsListProps {
  posts: BlogPostSummary[];
  tags: { tag: string; count: number }[];
}

/** Blog index list with a client-side title and tag filter. */
export default function PostsList({ posts, tags }: PostsListProps) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") {
      return posts;
    }
    return posts.filter(
      (post) =>
        post.title.toLowerCase().includes(q) ||
        post.tags.some((tag) => tag.includes(q)),
    );
  }, [posts, query]);

  return (
    <div className="flex flex-col gap-6">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search posts by title or tag"
        aria-label="Search posts by title or tag"
        className="w-full rounded-lg border bg-fd-secondary/50 px-4 py-2 text-sm outline-none placeholder:text-fd-muted-foreground focus:border-fd-primary"
      />
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map(({ tag, count }) => (
            <TagChip key={tag} tag={tag} label={`${tag} (${count})`} />
          ))}
        </div>
      ) : null}
      {visible.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">
          No posts match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
