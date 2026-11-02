"use client";

import { ApiError } from "@/app/api/api_error";
import { Button } from "@/app/components/button";
import { useConfirmMailingListMutation } from "@/app/query/hooks";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";

/**
 * Linked from the confirmation email. Confirming takes a click, so mail
 * scanners that open links can't subscribe anyone.
 */
export default function ConfirmMailingList(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = use(props.searchParams);
  const raw = searchParams["token"];
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const confirm = useConfirmMailingListMutation();

  const error = !token
    ? "This confirmation link is invalid."
    : confirm.isError
      ? confirm.error instanceof ApiError
        ? confirm.error.message
        : "Something went wrong. Please try again later."
      : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background text-foreground">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <Image
          src="/images/measure_logo_horizontal_black.svg"
          width={200}
          height={80}
          alt="Measure logo"
          className="dark:hidden"
        />
        <Image
          src="/images/measure_logo_horizontal_white.svg"
          width={200}
          height={80}
          alt="Measure logo"
          className="hidden dark:block"
        />

        {confirm.isSuccess ? (
          <div className="flex flex-col gap-2" role="status">
            <p className="font-display text-2xl">You&apos;re subscribed</p>
            <p className="font-body text-muted-foreground">
              You&apos;ll get the Measure newsletter in your inbox. Every email
              has a link to unsubscribe.
            </p>
            <Link href="/blog" className={underlineLinkStyle}>
              Back to the blog
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="font-display text-2xl">Confirm your subscription</p>
            <p className="font-body text-muted-foreground">
              Get the Measure newsletter in your inbox.
            </p>
            <Button
              size="lg"
              disabled={!token}
              loading={confirm.isPending}
              onClick={() => confirm.mutate(token)}
            >
              Confirm subscription
            </Button>
            {error && (
              <p className="font-body text-sm text-red-600" role="alert">
                {error}{" "}
                <Link href="/blog" className={underlineLinkStyle}>
                  Subscribe from the blog
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
