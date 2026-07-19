import LandingHeader from "@/app/components/landing_header";
import { RootProvider } from "fumadocs-ui/provider/next";
import BlogTracking from "./components/blog_tracking";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // RootProvider supplies the fumadocs contexts the MDX components in
    // post bodies rely on; its theme provider is disabled because the
    // app's root next-themes provider handles theming, and the fumadocs
    // search dialog is disabled because the blog index has its own title
    // and tag filter. The header is the landing one, without the middle
    // nav links and sign-in links; the top padding clears its fixed
    // position.
    <RootProvider theme={{ enabled: false }} search={{ enabled: false }}>
      <BlogTracking />
      <LandingHeader showNavLinks={false} showCtas={false} showRssFeed />
      <div className="pt-24">{children}</div>
    </RootProvider>
  );
}
