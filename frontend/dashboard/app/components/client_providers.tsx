"use client";

import { queryClient } from "@/app/query/query_client";
import { MeasureStoreProvider } from "@/app/stores/provider";
import { reloadPage } from "@/app/utils/navigation";
import { isSandboxPath } from "@/app/utils/sandbox";
import { QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useState } from "react";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const sandbox = isSandboxPath(usePathname());
  const [initialSandbox] = useState(sandbox);
  const crossing = sandbox !== initialSandbox;

  // A client-side navigation between the sandbox and a real team would carry
  // the query cache and stores across, so a crossing reloads the browser.
  useEffect(() => {
    if (crossing) {
      reloadPage();
    }
  }, [crossing]);

  // PostHog keeps super properties and the team group in browser storage across
  // page loads, so each path change sets both: sandbox pages clear the team
  // group and add the sandbox tag, and every other page removes the tag.
  useEffect(() => {
    if (sandbox) {
      posthog.resetGroups();
      posthog.register({ sandbox: true });
    } else {
      posthog.unregister("sandbox");
    }
  }, [sandbox]);

  return (
    <QueryClientProvider client={queryClient}>
      <MeasureStoreProvider>{crossing ? null : children}</MeasureStoreProvider>
    </QueryClientProvider>
  );
}
