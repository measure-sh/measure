import ProductPage from "@/app/components/product_page";
import { marketingPageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import NetworkDemo from "./network_demo";

export const metadata: Metadata = marketingPageMetadata({
  title: "Mobile Network Performance Monitoring",
  description:
    "Monitor mobile API call latency, HTTP status codes and slow endpoints. Find and fix the network calls killing your app's performance.",
  path: "/product/network-performance",
});

export default function ProductNetworkPerformance() {
  return (
    <ProductPage
      title="Network Performance"
      intro={
        <>
          Monitor the health and performance of every network request your app
          makes. Instantly see HTTP status code distributions over time, giving
          you a clear picture of how your API layer is performing at a glance.
          <br />
          <br />
          Drill into your top endpoints ranked by latency, error rate and
          request frequency to pinpoint exactly which calls are slowing down
          your app or failing silently. Visualize when specific endpoints are
          called during a session to understand request patterns and timing.
          <br />
          <br />
          With Network Performance, you can proactively catch degraded
          endpoints, reduce error rates and optimize the API calls that matter
          most to your users.
        </>
      }
      demo={{
        frame: "scaled",
        heightClassName: "h-[380px] md:h-[760px]",
        content: <NetworkDemo />,
      }}
      ctaLocation="product_network_performance"
    />
  );
}
