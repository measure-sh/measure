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
 * Signup form for the mailing list `listId`. `attribution` records where it
 * is shown, like "blog".
 */
export default function MailingListSignup({
  title,
  description,
  listId,
  attribution,
  turnstileSiteKey,
}: {
  title: string;
  description: string;
  listId: string;
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
      { email, listId, attribution, turnstileToken },
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

  const checkMessage =
    waitingForCheck && !turnstileToken
      ? checkShown
        ? 'Tick "Verify you are human" below, then subscribe.'
        : "Checking your browser. Please try again in a moment."
      : null;
  const message = error ?? checkMessage;

  if (subscribe.isSuccess) {
    return (
      <div role="status" className="flex flex-col items-center gap-3">
        <h2 className="font-display text-2xl">Check your inbox</h2>
        <p className="text-balance text-fd-muted-foreground">
          We sent a link to{" "}
          <span className="font-medium text-fd-foreground">{email}</span>. Open
          it to confirm your subscription.
        </p>
      </div>
    );
  }

  return (
    <>
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="text-balance text-fd-muted-foreground">{description}</p>
      <form
        onSubmit={handleSubmit}
        className="mt-3 flex w-full max-w-md flex-col items-center gap-2"
        aria-label="Newsletter signup"
      >
        <div className="flex w-full items-start gap-2">
          <div className="flex flex-1 flex-col gap-1.5 text-left">
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
            {message && (
              <p
                id="mailing-list-error"
                className="text-sm text-red-600"
                role="alert"
              >
                {message}
              </p>
            )}
          </div>
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
      </form>
    </>
  );
}
