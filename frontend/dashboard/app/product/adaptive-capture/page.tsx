import AdaptiveCaptureDemo from "@/app/components/adaptive_capture_demo";
import ProductPage from "@/app/components/product_page";
import { marketingPageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";

const seo = {
  title: "Adaptive Capture — Control Mobile Monitoring Costs",
  description:
    "Dynamically control what monitoring data your mobile app collects without shipping new builds. Stop paying for data you'll never use.",
  path: "/product/adaptive-capture",
};

export const metadata: Metadata = marketingPageMetadata(seo);

export default function ProductAdaptiveCapture() {
  return (
    <ProductPage
      seo={seo}
      title="Adaptive Capture"
      intro={
        <>
          Most monitoring data is never read but ends up inflating your costs
          💰. Adaptive Capture lets you capture what matters based on changing
          needs.
          <br />
          <br />
          Need more data during a product launch or incident? Simply tweak your
          collection parameters to capture additional context when it matters
          most and collect only the essentials when things are running smoothly.
          <br />
          <br />
          The best part? No need to roll out app updates! When you change your
          captures settings, our servers propagate the changes to our SDK
          seamlessly.
          <br />
          <br />
          No more worrying about bloated costs or wasted data, Adaptive Capture
          lets you get the data you need, when you need it.
        </>
      }
      demo={{
        frame: "card",
        content: <AdaptiveCaptureDemo showTitle={false} />,
      }}
      ctaLocation="product_adaptive_capture"
    />
  );
}
