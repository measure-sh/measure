"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { Button } from "./components/button";
import { ThemeProvider } from "./components/theme_provider";
import "./globals.css";
import { isCloud } from "./utils/env_utils";
import { fira_code, josefin_sans, work_sans } from "./utils/fonts";

// Rendered in place of the root layout when an error reaches the root
// boundary, so it applies the layout's font variables, theme handling and
// global styles itself.
export default function Error({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Empty string until posthog initializes; self-host never initializes it.
  const posthogSessionId = isCloud() ? posthog.get_session_id() : "";

  // GitHub rejects issue titles longer than 256 characters.
  const reportIssueTitle = error.message
    ? `Error: ${error.message}`.slice(0, 256)
    : "";

  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${josefin_sans.variable} ${work_sans.variable} ${fira_code.variable}`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex flex-col items-center justify-center font-body p-24 w-full h-screen">
            <p className="font-display font-regular text-4xl">
              Something went wrong!
            </p>
            <div className="py-2" />
            {isCloud() && (
              <>
                <p className="w-fit text-center">
                  A bug report has been submitted and we are looking into the
                  issue. Thanks for your patience!
                </p>
                <div className="py-2" />
              </>
            )}
            {error.message && (
              <p className="w-fit text-left text-sm text-muted-foreground whitespace-pre-wrap">
                {posthogSessionId
                  ? `Error: ${error.message}, Session: ${posthogSessionId}`
                  : `Error: ${error.message}`}
              </p>
            )}
            <div className="py-4" />
            <div className="flex flex-row items-center gap-4">
              {/* Plain anchor instead of Link so the app boots fresh after a
                  fatal error; the login page forwards signed-in users to
                  their team overview. */}
              <Button asChild>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/auth/login">Go to Dashboard</a>
              </Button>
              {!isCloud() && (
                <Button variant="secondary" asChild>
                  <a
                    target="_blank"
                    href={`https://github.com/measure-sh/measure/issues/new?assignees=&labels=bug&projects=&template=bug_report.md&title=${encodeURIComponent(reportIssueTitle)}`}
                  >
                    Report Issue
                  </a>
                </Button>
              )}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
