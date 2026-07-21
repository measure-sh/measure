import ProductPage from "@/app/components/product_page";
import { marketingPageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import UserJourneysDemo from "./user_journeys_demo";

export const metadata: Metadata = marketingPageMetadata({
  title: "User Journey Tracking for Mobile Apps",
  description:
    "Understand how users actually move through your mobile app. Track popular paths, find friction and prioritize the flows that matter most.",
  path: "/product/user-journeys",
});

export default function ProductUserJourneys() {
  return (
    <ProductPage
      title="User Journeys"
      intro={
        <>
          See the full picture of user behavior with beautiful flow diagrams
          that reveal the actual paths users take through your app.
          <br />
          <br />
          User Journeys automatically map every screen transition, showing you
          which flows are most popular, where users drop off and which
          navigation patterns you never anticipated. Easily add your own screens
          and views to enrich them further.
          <br />
          <br />
          Toggle between normal path analysis and exception view to see exactly
          where crashes and ANRs interrupt user flows. If users consistently
          crash when navigating from Product List to Product Detail screens,
          you&apos;ll see it highlighted with crash counts and session volumes.
          Click any path or exception to drill into the details and investigate
          further.
          <br />
          <br /> Whether you&apos;re redesigning navigation, prioritizing
          feature work or debugging issues in conversion funnels, User Journeys
          transforms complex behavioral data into clear, actionable
          visualizations that help you build better experiences.
        </>
      }
      demo={{
        frame: "scaled",
        heightClassName: "h-[400px] md:h-[840px]",
        content: <UserJourneysDemo />,
      }}
      ctaLocation="product_user_journeys"
    />
  );
}
