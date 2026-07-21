import ProductPage from "@/app/components/product_page";
import { marketingPageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import OverviewDemo from "./overview_demo";

export const metadata: Metadata = marketingPageMetadata({
  title: "Mobile App Health Metrics & Dashboards",
  description:
    "Track mobile app health metrics that matter: crash-free sessions, ANR-free sessions, app launch times, release adoption and more.",
  path: "/product/app-health",
});

export default function ProductAppHealth() {
  return (
    <ProductPage
      title="App Health"
      intro={
        <>
          Keep your finger on the pulse of your app&apos;s performance with
          comprehensive health monitoring that goes beyond the basics.
          <br />
          <br />
          App Health gives you fast insights into the metrics that matter most -
          from error rates, error rates as perceived by users, app adoption and
          app size to precise launch time measurements across cold, warm and hot
          starts.
          <br />
          <br />
          With App Health, you can proactively identify and address performance
          issues before they impact your users leading to a smooth rollout every
          time.
        </>
      }
      demo={{
        frame: "scaled",
        heightClassName: "h-[600px] md:h-[940px]",
        content: <OverviewDemo />,
      }}
      ctaLocation="product_app_health"
    />
  );
}
