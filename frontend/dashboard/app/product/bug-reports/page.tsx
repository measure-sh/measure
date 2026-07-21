import ProductPage from "@/app/components/product_page";
import { marketingPageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import BugReportDemo from "./bug_report_demo";

export const metadata: Metadata = marketingPageMetadata({
  title: "In-App Bug Reporting for Mobile Apps",
  description:
    "Capture bug reports with a device shake or SDK call. Get the full session context, device state and network info so you can get to the root cause.",
  path: "/product/bug-reports",
});

export default function ProductBugReports() {
  return (
    <ProductPage
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
          Every bug report links directly to the complete session timeline, so
          you can see exactly what the user experienced, review the sequence of
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
        heightClassName: "h-[400px] md:h-[740px]",
        content: <BugReportDemo />,
      }}
      ctaLocation="product_bug_reports"
    />
  );
}
