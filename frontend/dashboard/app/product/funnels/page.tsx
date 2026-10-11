import ProductPage from "@/app/components/product_page";
import { pageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import FunnelsDemo from "./funnels_demo";

const seo = {
  title: "Mobile App Conversion Funnels",
  description:
    "Track conversion through the important flows in your mobile app, see how it changes over time, and find the crashes, errors and slow requests that cause drop-offs.",
  path: "/product/funnels",
};

export const metadata: Metadata = pageMetadata(seo);

export default function ProductFunnels() {
  return (
    <ProductPage
      seo={seo}
      title="Funnels"
      intro={
        <>
          Track your app’s core flows, where users drop off, and what gets in
          their way.
          <br />
          <br />
          Build funnels from custom events to track how many users reach each
          step, where they leave, and how long it takes them to move forward.
          <br />
          <br />
          Track conversion over days, weeks, or months, with every build upload
          marked on the chart to see how each release impacts performance. Use
          the Cadence view to explore conversion by hour and weekday, spot
          recurring patterns, and catch anomalies.
          <br />
          <br />
          When conversion drops, use the Friction view to investigate why. See
          the crashes, errors, slow traces, and network requests users encounter
          at each step. Open session replays from users who dropped off to
          understand what happened before they left.
          <br />
          <br />
          Keep your most important funnels pinned at the top of the Funnels page
          for quick access, or explore them with your coding agent through
          Measure’s MCP server.
        </>
      }
      demo={{
        frame: "scaled",
        heightClassName: "h-[1080px]",
        content: <FunnelsDemo />,
        screenshot: {
          src: "/images/product_screenshots/funnels.webp",
          alt: "A Measure funnel showing how many users reach each step of a checkout, with the errors, traces and network requests that can cause drop-offs",
          width: 2300,
          height: 2268,
        },
      }}
      ctaLocation="product_funnels"
    />
  );
}
