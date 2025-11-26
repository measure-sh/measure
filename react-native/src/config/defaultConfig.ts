/// Default values for configuration options for the Measure SDK.
export const DefaultConfig = {
  enableLogging: false,
  sessionSamplingRate: 0.0,
  traceSamplingRate: 0.0001,
  coldLaunchSamplingRate: 0.01,
  warmLaunchSamplingRate: 0.01,
  hotLaunchSamplingRate: 0.01,
  userJourneysSamplingRate: 0,
  trackHttpHeaders: false,
  trackHttpBody: false,
  httpHeadersBlocklist: [],
  httpUrlBlocklist: [],
  httpUrlAllowlist: [],
  autoStart: true,
  disallowedCustomHeaders: [
    "Content-Type",
    "msr-req-id",
    "Authorization",
    "Content-Length"
  ],
  customEventNameRegex: "^[a-zA-Z0-9_-]+\$"
};