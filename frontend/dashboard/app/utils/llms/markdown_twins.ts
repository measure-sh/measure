// The proxy needs to know which marketing pages have a page.md, but it
// cannot look for the files at runtime: on hosts that deploy the proxy as
// its own function, such as Vercel, the app/ folder is not deployed with
// it. A test compares this list with the page.md files under app/ and
// fails when one is added or removed without updating it.
export const MARKDOWN_TWIN_PATHS: ReadonlySet<string> = new Set([
  "/",
  "/about",
  "/bugsnag-alternative",
  "/crashlytics-alternative",
  "/datadog-alternative",
  "/embrace-alternative",
  "/for/android",
  "/for/flutter",
  "/for/ios",
  "/for/ipados",
  "/for/kmp",
  "/for/react-native",
  "/luciq-alternative",
  "/new-relic-alternative",
  "/pricing",
  "/product/adaptive-capture",
  "/product/agent",
  "/product/app-health",
  "/product/bug-reports",
  "/product/crashes-and-anrs",
  "/product/mcp",
  "/product/network-performance",
  "/product/performance-traces",
  "/product/session-replays",
  "/product/user-journeys",
  "/security",
  "/sentry-alternative",
  "/why-measure",
]);
