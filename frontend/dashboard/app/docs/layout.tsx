import { source } from "@/app/utils/docs_source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import Image from "next/image";
import AskAI from "./components/ai/ask_ai";
import DocsTracking from "./components/docs_tracking";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // RootProvider is scoped to the docs subtree so the search dialog and
    // fumadocs contexts stay out of the marketing pages and the dashboard.
    // The app's own next-themes provider in the root layout handles theming,
    // so fumadocs' bundled one is disabled; its theme switch still works
    // because both resolve the same next-themes context.
    // Search uses /docs/search because fumadocs' default /api/search would
    // be captured by the /api/* reverse proxy in proxy.ts.
    <RootProvider
      theme={{ enabled: false }}
      search={{ options: { api: "/docs/search" } }}
    >
      <DocsTracking />
      <DocsLayout
        tree={source.getPageTree()}
        githubUrl="https://github.com/measure-sh/measure"
        nav={{
          title: (
            <>
              <Image
                src="/images/measure_logo_horizontal_black.svg"
                width={120}
                height={40}
                alt="Measure logo"
                className="dark:hidden"
              />
              <Image
                src="/images/measure_logo_horizontal_white.svg"
                width={120}
                height={40}
                alt="Measure logo"
                className="hidden dark:block"
              />
            </>
          ),
        }}
      >
        {children}
        <AskAI />
      </DocsLayout>
    </RootProvider>
  );
}
