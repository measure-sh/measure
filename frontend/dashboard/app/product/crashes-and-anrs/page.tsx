import ProductPage from "@/app/components/product_page";
import { marketingPageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import ExceptionsDemo from "./exceptions_demo";

export const metadata: Metadata = marketingPageMetadata({
  title: "Mobile Crash Reporting & ANR Tracking",
  description:
    "Open source mobile Crash Reporting and ANR Tracking. Full stack traces, reproduction steps and session timelines — a Firebase Crashlytics alternative.",
  path: "/product/crashes-and-anrs",
});

export default function ProductCrashesAndANRs() {
  return (
    <ProductPage
      title="Crashes and ANRs"
      intro={
        <>
          Get instant visibility into every exception with detailed crash
          reports that include full stack traces, device information, OS
          versions and intelligent analysis of the sequence of user actions that
          led to the failure.
          <br />
          <br />
          Our Common Path feature reconstructs the user journey before each
          crash, showing you what screens they visited, which actions they took,
          what API calls were and several other important signals.
          <br />
          <br />
          Path analysis combined with comprehensive stack traces and
          thread-level details, gives you everything you need to reproduce
          issues effectively and ship fixes with confidence.
        </>
      }
      demo={{
        frame: "scaled",
        heightClassName: "h-[600px] md:h-[1000px]",
        content: <ExceptionsDemo />,
      }}
      ctaLocation="product_crashes_and_anrs"
    />
  );
}
