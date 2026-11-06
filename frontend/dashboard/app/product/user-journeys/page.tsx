import ProductPage from "@/app/components/product_page";
import { pageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import UserJourneysDemo from "./user_journeys_demo";

const seo = {
  title: "User Journey Tracking for Mobile Apps",
  description:
    "Understand how users actually move through your mobile app. Track popular paths, find friction and prioritize the flows that matter most.",
  path: "/product/user-journeys",
};

export const metadata: Metadata = pageMetadata(seo);

export default function ProductUserJourneys() {
  return (
    <ProductPage
      seo={seo}
      title="User Journeys"
      intro={
        <>
          See the full picture of user behavior with flow diagrams that reveal
          the actual paths users take through your app.
          <br />
          <br />
          User Journeys automatically map every screen transition, showing you
          which flows are most popular, where users drop off and which
          navigation patterns you never anticipated. Easily add your own screens
          and custom events to enrich them further.
          <br />
          <br />
          Click any screen, event or path to see exactly the issues users ran
          into along the way. If users are dropping off on a particular screen,
          you&apos;ll see the slow requests, traces and errors that affect them,
          along with the session replays to watch.
          <br />
          <br /> Whether you&apos;re redesigning navigation, prioritizing
          feature work or debugging issues in frequented paths, User Journeys
          transforms complex behavioral data into clear, actionable
          visualizations that help you build better experiences.
        </>
      }
      demo={{
        frame: "scaled",
        heightClassName: "h-235",
        content: <UserJourneysDemo />,
        screenshot: {
          src: "/images/product_screenshots/user_journeys.webp",
          alt: "A user journey graph in Measure showing how users move between screens and which routes are most affected by issues",
          width: 2264,
          height: 1800,
        },
      }}
      ctaLocation="product_user_journeys"
    />
  );
}
