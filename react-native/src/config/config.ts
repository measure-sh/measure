import { DefaultConfig } from './defaultConfig';
import type { InternalConfig } from './internalConfig';
import type { MeasureConfigInterface } from './measureConfig';
import type { ScreenshotMaskLevel } from './screenshotMaskLevel';

export class Config implements InternalConfig, MeasureConfigInterface {
  maxEventNameLength: number;
  enableLogging: boolean;
  samplingRateForErrorFreeSessions: number;
  coldLaunchSamplingRate: number;
  warmLaunchSamplingRate: number;
  hotLaunchSamplingRate: number;
  userJourneysSamplingRate: number;
  traceSamplingRate: number;
  trackHttpHeaders: boolean;
  trackHttpBody: boolean;
  httpHeadersBlocklist: string[];
  httpUrlBlocklist: string[];
  httpUrlAllowlist: string[];
  autoStart: boolean;
  customEventNameRegex: string;
  maxSpanNameLength: number;
  maxCheckpointNameLength: number;
  maxCheckpointsPerSpan: number;
  screenshotMaskLevel: ScreenshotMaskLevel;
  maxDiskUsageInMb: number;

  constructor(
    enableLogging?: boolean,
    samplingRateForErrorFreeSessions?: number,
    coldLaunchSamplingRate?: number,
    warmLaunchSamplingRate?: number,
    hotLaunchSamplingRate?: number,
    userJourneysSamplingRate?: number,
    traceSamplingRate?: number,
    trackHttpHeaders?: boolean,
    trackHttpBody?: boolean,
    httpHeadersBlocklist?: string[],
    httpUrlBlocklist?: string[],
    httpUrlAllowlist?: string[],
    autoStart?: boolean,
    screenshotMaskLevel?: ScreenshotMaskLevel,
    maxDiskUsageInMb?: number,
  ) {
    this.enableLogging = enableLogging ?? DefaultConfig.enableLogging;
    this.samplingRateForErrorFreeSessions = samplingRateForErrorFreeSessions ?? DefaultConfig.sessionSamplingRate;
    this.coldLaunchSamplingRate = coldLaunchSamplingRate ?? DefaultConfig.coldLaunchSamplingRate;
    this.warmLaunchSamplingRate = warmLaunchSamplingRate ?? DefaultConfig.warmLaunchSamplingRate;
    this.hotLaunchSamplingRate = hotLaunchSamplingRate ?? DefaultConfig.hotLaunchSamplingRate;
    this.userJourneysSamplingRate = userJourneysSamplingRate ?? DefaultConfig.userJourneysSamplingRate;
    this.traceSamplingRate = traceSamplingRate ?? DefaultConfig.traceSamplingRate;
    this.trackHttpHeaders = trackHttpHeaders ?? DefaultConfig.trackHttpHeaders;
    this.trackHttpBody = trackHttpBody ?? DefaultConfig.trackHttpBody;
    this.httpHeadersBlocklist = httpHeadersBlocklist ?? DefaultConfig.httpHeadersBlocklist;
    this.httpUrlBlocklist = httpUrlBlocklist ?? DefaultConfig.httpUrlBlocklist;
    this.httpUrlAllowlist = httpUrlAllowlist ?? DefaultConfig.httpUrlAllowlist;
    this.autoStart = autoStart ?? DefaultConfig.autoStart;
    this.screenshotMaskLevel = screenshotMaskLevel ?? DefaultConfig.screenshotMaskLevel;
    this.maxDiskUsageInMb = maxDiskUsageInMb ?? DefaultConfig.maxDiskUsageInMb;
    this.maxEventNameLength = 64;
    this.customEventNameRegex = DefaultConfig.customEventNameRegex;
    this.maxSpanNameLength = 64;
    this.maxCheckpointNameLength = 64;
    this.maxCheckpointsPerSpan = 100;

    if (!(this.samplingRateForErrorFreeSessions >= 0 && this.samplingRateForErrorFreeSessions <= 1)) {
      console.warn('samplingRateForErrorFreeSessions must be between 0.0 and 1.0');
    }

    if (!(this.traceSamplingRate >= 0 && this.traceSamplingRate <= 1)) {
      console.warn('traceSamplingRate must be between 0.0 and 1.0');
    }

    if (!(this.coldLaunchSamplingRate >= 0 && this.coldLaunchSamplingRate <= 1)) {
      console.warn('coldLaunchSamplingRate must be between 0.0 and 1.0');
    }

    if (!(this.warmLaunchSamplingRate >= 0 && this.warmLaunchSamplingRate <= 1)) {
      console.warn('warmLaunchSamplingRate must be between 0.0 and 1.0');
    }

    if (!(this.hotLaunchSamplingRate >= 0 && this.hotLaunchSamplingRate <= 1)) {
      console.warn('hotLaunchSamplingRate must be between 0.0 and 1.0');
    }

    if (!(this.userJourneysSamplingRate >= 0 && this.userJourneysSamplingRate <= 1)) {
      console.warn('userJourneysSamplingRate must be between 0.0 and 1.0');
    }
  }
}