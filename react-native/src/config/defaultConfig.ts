/// Default values for configuration options for the Measure SDK.
export const DefaultConfig = {
  enableLogging: false,
  sessionSamplingRate: 0.0,
  traceSamplingRate: 0.1,
  trackHttpHeaders: false,
  trackHttpBody: false,
  httpHeadersBlocklist: [],
  httpUrlBlocklist: [],
  httpUrlAllowlist: [],
  autoStart: true,
  trackViewControllerLoadTime: true,
  disallowedCustomHeaders: [
    "Content-Type",
    "msr-req-id",
    "Authorization",
    "Content-Length"
  ]
};