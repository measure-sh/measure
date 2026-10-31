"use client";

import { ApiError } from "@/app/api/api_error";
import { Button } from "@/app/components/button";
import { Input } from "@/app/components/input";
import Turnstile, { type TurnstileHandle } from "@/app/components/turnstile";
import { useSubscribeToMailingListMutation } from "@/app/query/hooks";
import { track } from "@/app/utils/analytics/track";
import { usePathname } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { deriveBlogSection } from "./blog_tracking";

/**
 * Mailing list signup form. `attribution` says where it is shown, like
 * "blog". A Turnstile check guards it, and the address is only subscribed
 * once its owner confirms by email.
 */
export default function MailingListSignup({
  attribution,
  turnstileSiteKey,
}: {
  attribution: string;
  turnstileSiteKey: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [checkShown, setCheckShown] = useState(false);
  const [waitingForCheck, setWaitingForCheck] = useState(false);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const subscribe = useSubscribeToMailingListMutation();
  const blogSection = deriveBlogSection(usePathname());

  function handleToken(token: string | null) {
    setTurnstileToken(token);
    if (token) {
      setWaitingForCheck(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    track("blog_action_click", {
      action: "subscribe",
      blog_section: blogSection,
    });

    if (!turnstileToken) {
      setWaitingForCheck(true);
      return;
    }

    subscribe.mutate(
      { email, attribution, turnstileToken },
      {
        onError: (err) => {
          turnstileRef.current?.reset();
          setError(
            err instanceof ApiError
              ? err.message
              : "Something went wrong. Please try again later.",
          );
        },
      },
    );
  }

  // Shown until the check passes, unlike server errors, which stay until the
  // next submit.
  const checkMessage =
    waitingForCheck && !turnstileToken
      ? checkShown
        ? 'Tick "Verify you are human" below, then subscribe.'
        : "Checking your browser. Please try again in a moment."
      : null;
  const message = error ?? checkMessage;

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
          aria-describedby={message ? "mailing-list-error" : undefined}
        />
        <Button type="submit" loading={subscribe.isPending}>
          Subscribe
        </Button>
      </div>
      <Turnstile
        ref={turnstileRef}
        siteKey={turnstileSiteKey}
        onToken={handleToken}
        onCheckShown={() => setCheckShown(true)}
      />
      {message && (
        <p
          id="mailing-list-error"
          className="text-sm text-red-600"
          role="alert"
        >
          {message}
        </p>
      )}
    </form>
  );
}
