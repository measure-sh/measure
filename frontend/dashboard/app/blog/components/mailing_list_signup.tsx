"use client";

import { ApiError } from "@/app/api/api_error";
import { Button } from "@/app/components/button";
import { Input } from "@/app/components/input";
import { useSubscribeToMailingListMutation } from "@/app/query/hooks";
import { track } from "@/app/utils/analytics/track";
import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { deriveBlogSection } from "./blog_tracking";

/**
 * Mailing list signup form. `attribution` says where it is shown, like
 * "blog". The address is only subscribed once its owner confirms by email.
 */
export default function MailingListSignup({
  attribution,
}: {
  attribution: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const subscribe = useSubscribeToMailingListMutation();
  const blogSection = deriveBlogSection(usePathname());

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    track("blog_action_click", {
      action: "subscribe",
      blog_section: blogSection,
    });

    subscribe.mutate(
      { email, attribution },
      {
        onError: (err) => {
          setError(
            err instanceof ApiError
              ? err.message
              : "Something went wrong. Please try again later.",
          );
        },
      },
    );
  }

  if (subscribe.isSuccess) {
    return (
      <p className="text-fd-muted-foreground" role="status">
        Check your inbox. We sent a link to {email} to confirm your
        subscription.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-2"
      aria-label="Newsletter signup"
    >
      <div className="flex gap-2">
        <Input
          id="mailing-list-email"
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@company.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={subscribe.isPending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "mailing-list-error" : undefined}
        />
        <Button type="submit" loading={subscribe.isPending}>
          Subscribe
        </Button>
      </div>
      {error && (
        <p
          id="mailing-list-error"
          className="text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}
