import Link from "next/link";
import MailingListSignup from "./mailing_list_signup";

/**
 * End-of-post footer: the mailing list signup where a Turnstile site key is
 * set, which only Measure cloud does, and a thanks note elsewhere.
 */
export default function PostFooter() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!turnstileSiteKey) {
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

  return (
    <footer className="mt-12 flex flex-col items-center gap-3 rounded-lg bg-secondary p-8 text-center text-secondary-foreground">
      <MailingListSignup
        title="Subscribe to the Measure newsletter"
        description="Once a month, we'll share what we shipped and our favorite mobile engineering reads."
        attribution="blog"
        turnstileSiteKey={turnstileSiteKey}
      />
    </footer>
  );
}
