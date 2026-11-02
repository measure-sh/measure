"use client";

import { ApiError } from "@/app/api/api_error";
import { Button } from "@/app/components/button";
import { Skeleton } from "@/app/components/skeleton";
import {
  useMailingListLinkSubscriptionsQuery,
  useUnsubscribeFromMailingListMutation,
} from "@/app/query/hooks";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";

function param(
  searchParams: { [key: string]: string | string[] | undefined },
  name: string,
) {
  const raw = searchParams[name];
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again later.";
}

/**
 * Linked from every mailing list email, with the subscriber's signed link and
 * the list the email was sent to. Unsubscribing takes a click, so mail
 * scanners that open links can't unsubscribe anyone.
 */
export default function Unsubscribe(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = use(props.searchParams);
  const link = {
    id: param(searchParams, "id"),
    sig: param(searchParams, "sig"),
  };
  const listId = param(searchParams, "list");
  const subscriptions = useMailingListLinkSubscriptionsQuery(link);
  const unsubscribe = useUnsubscribeFromMailingListMutation(link);

  const list = subscriptions.data?.lists.find((l) => l.list_id === listId);
  const invalid =
    !link.id ||
    !link.sig ||
    subscriptions.isError ||
    (subscriptions.isSuccess && !list);

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

        {invalid ? (
          <p className="font-body text-sm text-red-600" role="alert">
            {subscriptions.isError
              ? errorMessage(subscriptions.error)
              : "This unsubscribe link is invalid."}
          </p>
        ) : !list ? (
          <div className="flex w-full flex-col items-center gap-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-56" />
          </div>
        ) : !list.subscribed || unsubscribe.isSuccess ? (
          <div className="flex flex-col gap-2" role="status">
            <p className="font-display text-2xl">You&apos;re unsubscribed</p>
            <p className="font-body text-muted-foreground">
              You won&apos;t get the {list.name} anymore.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="font-display text-2xl">
              Unsubscribe from the {list.name}
            </p>
            <p className="font-body text-muted-foreground">
              You can subscribe again from the{" "}
              <Link href="/blog" className={underlineLinkStyle}>
                blog
              </Link>{" "}
              at any time.
            </p>
            <Button
              size="lg"
              loading={unsubscribe.isPending}
              onClick={() => unsubscribe.mutate(list.list_id)}
            >
              Unsubscribe
            </Button>
            {unsubscribe.isError && (
              <p className="font-body text-sm text-red-600" role="alert">
                {errorMessage(unsubscribe.error)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
