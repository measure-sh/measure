import ProductPage from "@/app/components/product_page";
import { pageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import SessionReplayDemo from "./session_replay_demo";

const seo = {
  title: "Mobile Session Replays",
  description:
    "See every click, navigation, network call, log, error and CPU/memory signal stitched into a single mobile session replay to diagnose issues faster.",
  path: "/product/session-replays",
};

export const metadata: Metadata = pageMetadata(seo);

export default function ProductSessionReplays() {
  return (
    <ProductPage
      seo={seo}
      title="Session Replays"
      intro={
        <>
          Debug issues faster by replaying the exact sequence of events that led
          to a crash or performance problem.
          <br />
          <br />
          Session Replay captures the complete story - see which API call
          failed, what the user clicked right before an error occurred and how
          your app&apos;s resources were behaving at that precise moment.
          <br />
          <br />
          With Session Replays, you can stop guessing and have the full context
          you need to identify and fix root causes in an easy-to-navigate
          replay.
        </>
      }
      demo={{
        frame: "scaled",
        heightClassName: "h-[500px] md:h-[745px]",
        content: <SessionReplayDemo />,
      }}
      ctaLocation="product_session_replays"
    />
  );
}
