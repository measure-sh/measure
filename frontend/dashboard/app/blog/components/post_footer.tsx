import { isCloud } from "@/app/utils/env_utils";
import Link from "next/link";
import MailingListSignup from "./mailing_list_signup";

/**
 * End-of-post footer: a thanks note and, on Measure cloud, the mailing list
 * signup.
 */
export default function PostFooter() {
  const mailingList = isCloud();

  return (
    <footer className="mt-12 flex flex-col items-start gap-6 border-t pt-10 pb-4">
      <p className="text-fd-muted-foreground">
        Thanks for reading!{" "}
        <Link href="/" className="text-fd-foreground underline">
          Measure
        </Link>{" "}
        helps mobile developers monitor and fix bugs, crashes and performance
        issues.
        {mailingList &&
          " If you enjoyed this post, subscribe to the Measure newsletter to get the next one in your inbox."}
      </p>
      {mailingList && <MailingListSignup attribution="blog" />}
    </footer>
  );
}
