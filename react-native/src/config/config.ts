import { DefaultConfig } from './defaultConfig';
import type { InternalConfig } from './internalConfig';
import type { MeasureConfig } from './measureConfig';

export class Config implements InternalConfig, MeasureConfig {
  maxEventNameLength: number;
  enableLogging: boolean;
  samplingRateForErrorFreeSessions: number;
  traceSamplingRate: number;
  trackHttpHeaders: boolean;
  trackHttpBody: boolean;
  httpHeadersBlocklist: string[];
  httpUrlBlocklist: string[];
  httpUrlAllowlist: string[];
  autoStart: boolean;
  trackViewControllerLoadTime: boolean;

  constructor(
    enableLogging?: boolean,
    samplingRateForErrorFreeSessions?: number,
    traceSamplingRate?: number,
    trackHttpHeaders?: boolean,
    trackHttpBody?: boolean,
    httpHeadersBlocklist?: string[],
    httpUrlBlocklist?: string[],
    httpUrlAllowlist?: string[],
    autoStart?: boolean,
    trackViewControllerLoadTime?: boolean
  ) {
    this.enableLogging = enableLogging ?? DefaultConfig.enableLogging;
    this.samplingRateForErrorFreeSessions = samplingRateForErrorFreeSessions ?? DefaultConfig.sessionSamplingRate;
    this.traceSamplingRate = traceSamplingRate ?? DefaultConfig.traceSamplingRate;
    this.trackHttpHeaders = trackHttpHeaders ?? DefaultConfig.trackHttpHeaders;
    this.trackHttpBody = trackHttpBody ?? DefaultConfig.trackHttpBody;
    this.httpHeadersBlocklist = httpHeadersBlocklist ?? DefaultConfig.httpHeadersBlocklist;
    this.httpUrlBlocklist = httpUrlBlocklist ?? DefaultConfig.httpUrlBlocklist;
    this.httpUrlAllowlist = httpUrlAllowlist ?? DefaultConfig.httpUrlAllowlist;
    this.autoStart = autoStart ?? DefaultConfig.autoStart;
    this.trackViewControllerLoadTime = trackViewControllerLoadTime ?? DefaultConfig.trackViewControllerLoadTime;
    this.maxEventNameLength = 64;

    if (!(this.samplingRateForErrorFreeSessions >= 0 && this.samplingRateForErrorFreeSessions <= 1)) {
      console.warn('samplingRateForErrorFreeSessions must be between 0.0 and 1.0');
    }

    if (!(this.traceSamplingRate >= 0 && this.traceSamplingRate <= 1)) {
      console.warn('traceSamplingRate must be between 0.0 and 1.0');
    }
  }
}