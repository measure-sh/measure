import { source } from "@/app/utils/docs_source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import Image from "next/image";
import AskAI from "./components/ai/ask_ai";
import DocsThemeSwitch from "./components/docs_theme_switch";
import DocsTracking from "./components/docs_tracking";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // RootProvider is scoped to the docs subtree so the search dialog and
    // fumadocs contexts stay out of the marketing pages and the dashboard.
    // The app's own next-themes provider in the root layout handles theming,
    // so fumadocs' bundled one is disabled; the themeSwitch slot renders the
    // app's toggle in place of fumadocs' light/dark/system pill.
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
        slots={{ themeSwitch: DocsThemeSwitch }}
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
