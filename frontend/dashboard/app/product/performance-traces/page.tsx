import ProductPage from "@/app/components/product_page";
import { pageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";
import TraceDemo from "./trace_demo";

const seo = {
  title: "Mobile App Performance Tracing & Monitoring",
  description:
    "Improve mobile app performance with traces and spans. Find slow code, isolate bottlenecks and fix performance issues hurting your app.",
  path: "/product/performance-traces",
};

export const metadata: Metadata = pageMetadata(seo);

export default function ProductPerformanceTraces() {
  return (
    <ProductPage
      seo={seo}
      title="Performance Traces"
      intro={
        <>
          Measure exactly what matters for your app&apos;s user experience by
          instrumenting critical operations in your codebase.
          <br />
          <br />
          Performance traces let you understand how API fetches, complex code
          operations and UI rendering stack up within a single user flow or
          aggregate across millions of sessions, with waterfall charts that make
          bottlenecks immediately obvious.
          <br />
          <br />
          Every trace includes rich context such as device type and network
          conditions and links to a full session replay so you can spot patterns
          and correlate slowdowns within specific environments.
          <br />
          <br />
          Whether you&apos;re reducing checkout time, speeding up content
          loading or improving screen transitions, Performance Traces give you
          the quantitative data you need to make precise improvements.
        </>
      }
      demo={{
        frame: "scaled",
        heightClassName: "h-[505px]",
        content: <TraceDemo />,
        screenshot: {
          src: "/images/product_screenshots/performance_traces.webp",
          alt: "A performance trace in Measure showing parent and child spans laid out as a waterfall chart",
          width: 2280,
          height: 1208,
        },
      }}
      ctaLocation="product_performance_traces"
    />
  );
}
