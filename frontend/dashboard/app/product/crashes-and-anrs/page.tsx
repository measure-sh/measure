import ProductPage from "@/app/components/product_page";
import { pageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import ExceptionsDemo from "./exceptions_demo";

const seo = {
  title: "Mobile Crash Reporting & ANR Tracking",
  description:
    "Open source mobile Crash Reporting and ANR Tracking. Full stack traces, reproduction steps and session replays — a Firebase Crashlytics alternative.",
  path: "/product/crashes-and-anrs",
};

export const metadata: Metadata = pageMetadata(seo);

export default function ProductCrashesAndANRs() {
  return (
    <ProductPage
      seo={seo}
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
        heightClassName: "h-[1000px]",
        content: <ExceptionsDemo />,
        screenshot: {
          src: "/images/product_screenshots/crashes_and_anrs.webp",
          alt: "A crash detail view in Measure showing the stacktrace, affected sessions and distribution across devices and app versions",
          width: 2300,
          height: 1996,
        },
      }}
      ctaLocation="product_crashes_and_anrs"
    />
  );
}
