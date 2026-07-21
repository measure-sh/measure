import ProductPage from "@/app/components/product_page";
import { marketingPageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import SessionTimelineDemo from "./session_timeline_demo";

export const metadata: Metadata = marketingPageMetadata({
  title: "Mobile Session Timelines & Replay",
  description:
    "See every click, navigation, network call, log, error and CPU/memory signal stitched into a single mobile session timeline to diagnose issues faster.",
  path: "/product/session-timelines",
});

export default function ProductSessionTimelines() {
  return (
    <ProductPage
      title="Session Timelines"
      intro={
        <>
          Debug issues faster by replaying the exact sequence of events that led
          to a crash or performance problem.
          <br />
          <br />
          Session Timeline captures the complete story - see which API call
          failed, what the user clicked right before an error occurred and how
          your app&apos;s resources were behaving at that precise moment.
          <br />
          <br />
          With Session Timelines, you can stop guessing and have the full
          context you need to identify and fix root causes in an
          easy-to-navigate timeline.
        </>
      }
      demo={{
        frame: "scaled",
        heightClassName: "h-[500px] md:h-[980px]",
        content: <SessionTimelineDemo />,
      }}
      ctaLocation="product_session_timelines"
    />
  );
}
