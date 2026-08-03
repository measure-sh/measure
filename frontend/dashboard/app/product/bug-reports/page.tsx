import ProductPage from "@/app/components/product_page";
import { pageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import BugReportDemo from "./bug_report_demo";

const seo = {
  title: "In-App Bug Reporting for Mobile Apps",
  description:
    "Capture bug reports with a device shake or SDK call. Get the full session context, device state and network info so you can get to the root cause.",
  path: "/product/bug-reports",
};

export const metadata: Metadata = pageMetadata(seo);

export default function ProductBugReports() {
  return (
    <ProductPage
      seo={seo}
      title="Bug Reports"
      intro={
        <>
          Empower your users to report issues directly from your app with a
          device shake or using your own custom button.
          <br />
          <br />
          Bug Reports automatically capture everything that matters - device
          information, app version, network conditions and the exact timestamp
          alongside the user&apos;s description and screenshots.
          <br />
          <br />
          Every bug report links directly to the complete session replay, so you
          can see exactly what the user experienced, review the sequence of
          events and identify the root cause without stumbling around in the
          dark.
          <br />
          <br />
          Bug Reports allows you to skip the email threads, support tickets and
          the back-and-forth asking users to remember what they were doing -
          your users describe the problem in their own words and you get all the
          technical data you need to solve it.
        </>
      }
      demo={{
        frame: "scaled",
        heightClassName: "h-[630px]",
        content: <BugReportDemo />,
        screenshot: {
          src: "/images/product_screenshots/bug_reports.webp",
          alt: "A bug report in Measure showing the reporter's screenshot, description and the device and network context captured with it",
          width: 2284,
          height: 1338,
        },
      }}
      ctaLocation="product_bug_reports"
    />
  );
}
