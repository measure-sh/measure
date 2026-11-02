import { newsletterListId } from "@/app/api/api_calls";
import Link from "next/link";
import MailingListSignup from "./mailing_list_signup";

/**
 * Mailing list signup panel, shown only when a Turnstile site key is set.
 */
export function NewsletterSignupPanel() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!turnstileSiteKey) {
    return null;
  }

  return (
    <footer className="mx-auto mt-12 flex w-full max-w-3xl flex-col items-center gap-3 rounded-lg bg-secondary p-8 text-center text-secondary-foreground">
      <MailingListSignup
        title="Subscribe to the Measure newsletter"
        description="Once a month, we'll share what we shipped and our favorite mobile engineering reads."
        listId={newsletterListId}
        attribution="blog"
        turnstileSiteKey={turnstileSiteKey}
      />
    </footer>
  );
}

/**
 * End-of-post footer: the mailing list signup when a Turnstile site key is
 * set, otherwise a thanks note.
 */
export default function PostFooter() {
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    return (
      <footer className="mt-12 border-t pt-10 pb-4">
        <p className="text-fd-muted-foreground">
          Thanks for reading!{" "}
          <Link href="/" className="text-fd-foreground underline">
            Measure
          </Link>{" "}
          helps mobile developers monitor and fix bugs, crashes and performance
          issues.
        </p>
      </footer>
    );
  }

  return <NewsletterSignupPanel />;
}
